-- Complete the commerce administration model without replacing existing data.

create table public.preorders (
  id uuid primary key default gen_random_uuid(),
  reservation_number text not null unique,
  customer_id uuid references public.profiles(id) on delete set null,
  product_id text not null references public.products(id) on delete restrict,
  variant_id uuid references public.product_variants(id) on delete set null,
  quantity integer not null default 1 check (quantity > 0),
  unit_price numeric(14,2) not null default 0 check (unit_price >= 0),
  deposit_amount numeric(14,2) not null default 0 check (deposit_amount >= 0),
  currency text not null default 'SAR',
  status text not null default 'requested' check (
    status in ('requested', 'confirmed', 'deposit_paid', 'ready', 'converted', 'cancelled', 'expired')
  ),
  source text not null default 'website',
  customer_name text,
  customer_email text,
  customer_phone text,
  requested_at timestamptz not null default now(),
  expires_at timestamptz,
  converted_order_id uuid references public.orders(id) on delete set null,
  notes text,
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,
  check (expires_at is null or expires_at >= requested_at)
);

create index preorders_customer_created_idx on public.preorders (customer_id, created_at desc);
create index preorders_product_status_idx on public.preorders (product_id, status, created_at desc);
create index preorders_variant_id_idx on public.preorders (variant_id);
create index preorders_converted_order_id_idx on public.preorders (converted_order_id);
create index preorders_open_idx on public.preorders (created_at desc)
  where status in ('requested', 'confirmed', 'deposit_paid', 'ready') and archived_at is null;

create table public.data_exports (
  id bigint generated always as identity primary key,
  module text not null,
  format text not null check (format in ('csv', 'xlsx', 'pdf', 'print')),
  filters jsonb not null default '{}'::jsonb,
  row_count integer not null default 0 check (row_count >= 0),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create index data_exports_created_by_idx on public.data_exports (created_by, created_at desc);
create index data_exports_module_idx on public.data_exports (module, created_at desc);

alter table public.preorders enable row level security;
alter table public.data_exports enable row level security;
grant select, insert, update, delete on public.preorders to authenticated;
grant select, insert on public.data_exports to authenticated;
grant usage, select on sequence public.data_exports_id_seq to authenticated;

create policy preorders_staff_read on public.preorders
for select to authenticated
using ((select private.has_permission('orders.read')) or (select private.has_permission('orders.write')));

create policy preorders_staff_write on public.preorders
for all to authenticated
using ((select private.has_permission('orders.write')))
with check ((select private.has_permission('orders.write')));

create policy preorders_own_read on public.preorders
for select to authenticated
using (customer_id = (select auth.uid()));

create policy preorders_own_insert on public.preorders
for insert to authenticated
with check (
  customer_id = (select auth.uid())
  and status = 'requested'
  and created_by is null
);

create policy data_exports_staff_read on public.data_exports
for select to authenticated
using ((select private.has_permission('reports.read')) or (select private.has_permission('exports.run')));

create policy data_exports_staff_insert on public.data_exports
for insert to authenticated
with check ((select private.has_permission('exports.run')) and created_by = (select auth.uid()));

drop trigger if exists preorders_touch_updated_at on public.preorders;
create trigger preorders_touch_updated_at
before update on public.preorders
for each row execute function private.touch_updated_at();

drop trigger if exists preorders_audit_changes on public.preorders;
create trigger preorders_audit_changes
after insert or update or delete on public.preorders
for each row execute function private.audit_row_change();

drop trigger if exists data_exports_audit_changes on public.data_exports;
create trigger data_exports_audit_changes
after insert or update or delete on public.data_exports
for each row execute function private.audit_row_change();

create or replace view public.product_profitability
with (security_invoker = true)
as
select
  c.product_id,
  c.name_en,
  c.variant_id,
  c.variant_name,
  c.selling_price,
  c.ingredient_cost,
  c.packaging_cost,
  c.labor_cost,
  c.shipping_cost,
  c.marketing_cost,
  c.payment_fee,
  c.tax_cost,
  c.other_cost,
  c.total_cost,
  round(c.selling_price - c.total_cost, 2) as gross_profit,
  case when c.selling_price > 0
    then round((c.selling_price - c.total_cost) / c.selling_price, 4)
    else null
  end as retail_margin,
  round(c.total_cost, 2) as break_even_price,
  round(c.total_cost / (1 - 0.65), 2) as recommended_price
from public.current_product_costing c;

create or replace view public.ingredient_cost_trends
with (security_invoker = true)
as
select
  m.ingredient_id,
  i.internal_code,
  i.name,
  date_trunc('month', m.created_at)::date as month,
  round(avg(coalesce(m.unit_cost, i.unit_cost)), 6) as average_unit_cost,
  round(sum(abs(m.quantity_delta)), 4) as quantity_moved,
  round(sum(abs(m.quantity_delta) * coalesce(m.unit_cost, i.unit_cost)), 2) as movement_value
from public.ingredient_stock_movements m
join public.ingredients i on i.id = m.ingredient_id
group by m.ingredient_id, i.internal_code, i.name, date_trunc('month', m.created_at)::date;

grant select on public.product_profitability, public.ingredient_cost_trends to authenticated;

create or replace function public.approve_formula_version(p_version_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_version public.formula_versions%rowtype;
  v_percentage numeric(12,6);
  v_item_count integer;
begin
  if not private.has_permission('production.write') then
    raise exception 'Insufficient production permission';
  end if;

  select * into v_version
  from public.formula_versions
  where id = p_version_id
  for update;
  if not found then raise exception 'Formula version not found'; end if;
  if v_version.status not in ('draft', 'trial') then
    raise exception 'Only draft or trial versions can be approved';
  end if;

  select count(*), coalesce(sum(percentage), 0)
  into v_item_count, v_percentage
  from public.formula_items
  where formula_version_id = p_version_id;
  if v_item_count = 0 then raise exception 'Formula version has no ingredient lines'; end if;
  if abs(v_percentage - v_version.total_percentage) > 0.0001 then
    raise exception 'Ingredient percentages (%) do not equal the declared formula total (%)', v_percentage, v_version.total_percentage;
  end if;

  update public.formula_versions
  set status = 'superseded'
  where formula_id = v_version.formula_id
    and id <> v_version.id
    and status = 'approved';

  update public.formula_versions
  set status = 'approved',
      approved_by = (select auth.uid()),
      approved_at = now()
  where id = v_version.id;

  update public.formulas
  set current_version_id = v_version.id,
      status = 'approved',
      updated_by = (select auth.uid()),
      updated_at = now()
  where id = v_version.formula_id;

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
  values (
    (select auth.uid()),
    'approve',
    'formula_versions',
    v_version.id::text,
    jsonb_build_object('formula_id', v_version.formula_id, 'percentage', v_percentage, 'item_count', v_item_count)
  );

  return jsonb_build_object(
    'version_id', v_version.id,
    'formula_id', v_version.formula_id,
    'status', 'approved',
    'percentage', v_percentage
  );
end;
$$;

create or replace function public.set_finance_payment_status(
  p_transaction_id uuid,
  p_payment_status text,
  p_paid_date date default null,
  p_payment_method text default null,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_transaction public.finance_transactions%rowtype;
begin
  if not private.has_permission('finance.write') then
    raise exception 'Insufficient finance permission';
  end if;
  if p_payment_status not in ('unpaid', 'partially_paid', 'paid', 'overdue', 'cancelled', 'refunded') then
    raise exception 'Invalid payment status';
  end if;
  if nullif(trim(coalesce(p_reason, '')), '') is null then
    raise exception 'A payment-status reason is required';
  end if;

  select * into v_transaction
  from public.finance_transactions
  where id = p_transaction_id
  for update;
  if not found then raise exception 'Transaction not found'; end if;
  if v_transaction.status <> 'posted' then
    raise exception 'Only posted transactions may receive controlled payment-status updates';
  end if;

  update public.finance_transactions
  set payment_status = p_payment_status,
      payment_method = coalesce(nullif(trim(coalesce(p_payment_method, '')), ''), payment_method),
      paid_date = case
        when p_payment_status in ('paid', 'refunded') then coalesce(p_paid_date, current_date)
        when p_payment_status in ('unpaid', 'overdue', 'cancelled') then null
        else p_paid_date
      end,
      updated_at = now()
  where id = p_transaction_id;

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, old_values, new_values, metadata)
  values (
    (select auth.uid()),
    'payment_status',
    'finance_transactions',
    p_transaction_id::text,
    jsonb_build_object('payment_status', v_transaction.payment_status, 'paid_date', v_transaction.paid_date, 'payment_method', v_transaction.payment_method),
    jsonb_build_object('payment_status', p_payment_status, 'paid_date', p_paid_date, 'payment_method', p_payment_method),
    jsonb_build_object('reason', trim(p_reason))
  );

  return jsonb_build_object('transaction_id', p_transaction_id, 'payment_status', p_payment_status);
end;
$$;

revoke all on function public.approve_formula_version(uuid) from public, anon;
revoke all on function public.set_finance_payment_status(uuid, text, date, text, text) from public, anon;
grant execute on function public.approve_formula_version(uuid) to authenticated;
grant execute on function public.set_finance_payment_status(uuid, text, date, text, text) to authenticated;

comment on table public.preorders is 'Commerce reservations that can be converted into orders; replaces browser-only preorder records.';
comment on table public.data_exports is 'Audit metadata for role-controlled dashboard exports; exported payloads are never stored here.';
