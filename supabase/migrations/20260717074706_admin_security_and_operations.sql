-- ASMR & SAMR authorization, transactional operations, and reporting views.

-- -----------------------------------------------------------------------------
-- Authorization helpers
-- -----------------------------------------------------------------------------

create or replace function private.current_role()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select p.role
  from public.profiles p
  where p.id = (select auth.uid())
    and p.status = 'active'
    and p.anonymized_at is null
  limit 1
$$;

create or replace function private.has_permission(p_permission text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    private.current_role() = 'admin'
    or exists (
      select 1
      from public.role_permissions rp
      where rp.role_name = private.current_role()
        and rp.permission = p_permission
    ),
    false
  )
$$;

create or replace function private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(private.current_role() = 'admin', false)
$$;

revoke all on function private.current_role() from public, anon;
revoke all on function private.has_permission(text) from public, anon;
revoke all on function private.is_admin() from public, anon;
grant usage on schema private to authenticated;
grant execute on function private.current_role() to authenticated;
grant execute on function private.has_permission(text) to authenticated;
grant execute on function private.is_admin() to authenticated;

-- Preserve compatibility with existing policies while hardening the helper.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = (select auth.uid())
      and p.role = 'admin'
      and p.status = 'active'
      and p.anonymized_at is null
  )
$$;
revoke all on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, full_name, role, status)
  values (
    new.id,
    new.email,
    nullif(trim(coalesce(new.raw_user_meta_data ->> 'full_name', '')), ''),
    'customer',
    'active'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;
revoke all on function public.handle_new_user() from public, anon, authenticated;

do $$
begin
  if to_regprocedure('public.rls_auto_enable()') is not null then
    revoke all on function public.rls_auto_enable() from public, anon, authenticated;
  end if;
end
$$;

-- -----------------------------------------------------------------------------
-- Shared trigger helpers and sensitive-field protections
-- -----------------------------------------------------------------------------

create or replace function private.touch_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create or replace function private.protect_profile_fields()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.role is distinct from old.role and not private.is_admin() then
    raise exception 'Only an administrator can change roles';
  end if;
  if new.points is distinct from old.points
     and current_user not in ('postgres', 'service_role') then
    raise exception 'Reward points must be changed through adjust_reward_points';
  end if;
  if new.membership_tier is distinct from old.membership_tier
     and not private.has_permission('customers.write') then
    raise exception 'Insufficient permission to change membership tier';
  end if;
  if new.status is distinct from old.status
     and not private.has_permission('customers.write') then
    raise exception 'Insufficient permission to change account status';
  end if;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists profiles_protect_sensitive_fields on public.profiles;
create trigger profiles_protect_sensitive_fields
before update on public.profiles
for each row execute function private.protect_profile_fields();

create or replace function private.protect_stock_columns()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if current_user in ('postgres', 'service_role') then
    return new;
  end if;

  if tg_table_name = 'product_inventory'
     and new.stock is distinct from old.stock then
    raise exception 'Product stock must be changed through adjust_product_stock';
  elsif tg_table_name = 'product_location_inventory'
     and (new.stock is distinct from old.stock or new.reserved is distinct from old.reserved) then
    raise exception 'Location stock must be changed through adjust_product_stock';
  elsif tg_table_name = 'product_variants'
     and new.stock is distinct from old.stock then
    raise exception 'Variant stock must be changed through adjust_product_stock';
  elsif tg_table_name = 'ingredients'
     and new.quantity_available is distinct from old.quantity_available then
    raise exception 'Ingredient stock must be changed through adjust_ingredient_stock';
  elsif tg_table_name = 'ingredient_lots'
     and new.quantity_available is distinct from old.quantity_available then
    raise exception 'Lot stock must be changed through adjust_ingredient_stock';
  end if;
  return new;
end;
$$;

drop trigger if exists product_inventory_protect_stock on public.product_inventory;
create trigger product_inventory_protect_stock before update on public.product_inventory
for each row execute function private.protect_stock_columns();
drop trigger if exists product_location_inventory_protect_stock on public.product_location_inventory;
create trigger product_location_inventory_protect_stock before update on public.product_location_inventory
for each row execute function private.protect_stock_columns();
drop trigger if exists product_variants_protect_stock on public.product_variants;
create trigger product_variants_protect_stock before update on public.product_variants
for each row execute function private.protect_stock_columns();
drop trigger if exists ingredients_protect_stock on public.ingredients;
create trigger ingredients_protect_stock before update on public.ingredients
for each row execute function private.protect_stock_columns();
drop trigger if exists ingredient_lots_protect_stock on public.ingredient_lots;
create trigger ingredient_lots_protect_stock before update on public.ingredient_lots
for each row execute function private.protect_stock_columns();

create or replace function private.protect_notification_content()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if current_user not in ('postgres', 'service_role')
     and (
       new.user_id is distinct from old.user_id
       or new.audience_role is distinct from old.audience_role
       or new.type is distinct from old.type
       or new.title is distinct from old.title
       or new.body is distinct from old.body
       or new.severity is distinct from old.severity
       or new.metadata is distinct from old.metadata
       or new.created_at is distinct from old.created_at
     ) then
    raise exception 'Recipients may only update notification read status';
  end if;
  return new;
end;
$$;
drop trigger if exists notifications_protect_content on public.notifications;
create trigger notifications_protect_content before update on public.notifications
for each row execute function private.protect_notification_content();

create or replace function private.protect_posted_finance()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if old.status in ('posted', 'reversed') and current_user not in ('postgres', 'service_role') then
    raise exception 'Posted transactions are immutable; create a reversal instead';
  end if;
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;
drop trigger if exists finance_transactions_protect_posted on public.finance_transactions;
create trigger finance_transactions_protect_posted
before update or delete on public.finance_transactions
for each row execute function private.protect_posted_finance();

create or replace function private.protect_posted_finance_lines()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_transaction_id uuid;
  v_status text;
begin
  v_transaction_id := case when tg_op = 'DELETE' then old.transaction_id else new.transaction_id end;
  select status into v_status from public.finance_transactions where id = v_transaction_id;
  if v_status in ('posted', 'reversed') and current_user not in ('postgres', 'service_role') then
    raise exception 'Ledger lines on posted transactions are immutable; create a reversal instead';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;
drop trigger if exists finance_transaction_lines_protect_posted on public.finance_transaction_lines;
create trigger finance_transaction_lines_protect_posted
before insert or update or delete on public.finance_transaction_lines
for each row execute function private.protect_posted_finance_lines();

create or replace function private.prevent_hard_delete()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if current_user not in ('postgres', 'service_role') then
    raise exception 'This record must be archived, cancelled, reversed, or anonymized instead of deleted';
  end if;
  return old;
end;
$$;

do $$
declare
  t text;
begin
  foreach t in array array['profiles', 'products', 'ingredients', 'formulas', 'production_batches', 'orders']
  loop
    execute format('drop trigger if exists %I on public.%I', t || '_prevent_hard_delete', t);
    execute format(
      'create trigger %I before delete on public.%I for each row execute function private.prevent_hard_delete()',
      t || '_prevent_hard_delete', t
    );
  end loop;
end
$$;

create or replace function private.audit_row_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_old jsonb;
  v_new jsonb;
  v_entity_id text;
begin
  v_old := case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) else null end;
  v_new := case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) else null end;
  v_old := v_old - array['key_hash', 'code_hash', 'raw'];
  v_new := v_new - array['key_hash', 'code_hash', 'raw'];
  v_entity_id := coalesce(
    v_new ->> 'id', v_old ->> 'id',
    v_new ->> 'product_id', v_old ->> 'product_id',
    v_new ->> 'code', v_old ->> 'code',
    v_new ->> 'key', v_old ->> 'key'
  );

  insert into public.audit_logs (
    actor_id, action, entity_type, entity_id, old_values, new_values
  ) values (
    (select auth.uid()), lower(tg_op), tg_table_name, v_entity_id, v_old, v_new
  );
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;
revoke all on function private.audit_row_change() from public, anon, authenticated;

do $$
declare
  t text;
begin
  foreach t in array array[
    'profiles', 'products', 'product_inventory', 'product_variants', 'product_images',
    'suppliers', 'ingredients', 'ingredient_lots', 'purchase_orders',
    'formulas', 'formula_versions', 'production_batches',
    'finance_transactions', 'budgets', 'product_cost_components',
    'marketing_campaigns', 'website_content', 'api_keys', 'app_roles', 'role_permissions'
  ]
  loop
    execute format('drop trigger if exists %I on public.%I', t || '_audit_change', t);
    execute format(
      'create trigger %I after insert or update or delete on public.%I for each row execute function private.audit_row_change()',
      t || '_audit_change', t
    );
  end loop;
end
$$;

do $$
declare
  t text;
begin
  foreach t in array array[
    'app_roles', 'user_addresses', 'product_categories', 'product_collections',
    'product_variants', 'product_images', 'inventory_locations', 'product_location_inventory',
    'suppliers', 'ingredients', 'ingredient_lots', 'purchase_orders', 'formulas',
    'production_batches', 'product_cost_components', 'finance_accounts',
    'finance_transactions', 'budgets', 'marketing_segments', 'marketing_campaigns',
    'marketing_partners', 'marketing_content_items', 'abandoned_carts', 'website_content',
    'customer_requests', 'product_reviews', 'gift_cards', 'subscriptions', 'order_returns',
    'order_refunds', 'shipping_methods', 'api_keys'
  ]
  loop
    execute format('drop trigger if exists %I on public.%I', t || '_touch_updated_at', t);
    execute format(
      'create trigger %I before update on public.%I for each row execute function private.touch_updated_at()',
      t || '_touch_updated_at', t
    );
  end loop;
end
$$;

-- -----------------------------------------------------------------------------
-- Transactional stock, production, rewards, finance, and costing RPCs
-- -----------------------------------------------------------------------------

create or replace function public.adjust_product_stock(
  p_product_id text,
  p_quantity_delta integer,
  p_movement_type text,
  p_reason text,
  p_variant_id uuid default null,
  p_from_location_id uuid default null,
  p_to_location_id uuid default null,
  p_allow_negative boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_current integer;
  v_next integer;
  v_location uuid;
  v_location_stock numeric(14,3);
  v_quantity integer;
  v_can_override boolean;
begin
  if not private.has_permission('inventory.write') then
    raise exception 'Insufficient inventory permission';
  end if;
  if p_quantity_delta = 0 or nullif(trim(p_reason), '') is null then
    raise exception 'A non-zero quantity and reason are required';
  end if;
  v_can_override := p_allow_negative and private.is_admin();

  insert into public.product_inventory (product_id, stock, low_stock_at)
  values (p_product_id, 0, 0)
  on conflict (product_id) do nothing;

  select stock into v_current
  from public.product_inventory
  where product_id = p_product_id
  for update;

  if p_movement_type = 'transfer' then
    if p_from_location_id is null or p_to_location_id is null or p_from_location_id = p_to_location_id then
      raise exception 'A transfer requires different source and destination locations';
    end if;
    v_quantity := abs(p_quantity_delta);
    insert into public.product_location_inventory (product_id, variant_id, location_id, stock)
    values (p_product_id, p_variant_id, p_from_location_id, 0)
    on conflict (product_id, location_id) do nothing;
    insert into public.product_location_inventory (product_id, variant_id, location_id, stock)
    values (p_product_id, p_variant_id, p_to_location_id, 0)
    on conflict (product_id, location_id) do nothing;

    select stock into v_location_stock
    from public.product_location_inventory
    where product_id = p_product_id and location_id = p_from_location_id
    for update;
    if v_location_stock - v_quantity < 0 and not v_can_override then
      raise exception 'Transfer would create negative stock';
    end if;
    update public.product_location_inventory
    set stock = stock - v_quantity, updated_at = now()
    where product_id = p_product_id and location_id = p_from_location_id;
    update public.product_location_inventory
    set stock = stock + v_quantity, updated_at = now()
    where product_id = p_product_id and location_id = p_to_location_id;

    insert into public.product_stock_movements (
      product_id, variant_id, from_location_id, to_location_id, movement_type,
      quantity_delta, resulting_stock, reason, created_by
    ) values (
      p_product_id, p_variant_id, p_from_location_id, p_to_location_id, 'transfer',
      v_quantity, v_current, trim(p_reason), (select auth.uid())
    );
    return jsonb_build_object('product_id', p_product_id, 'stock', v_current, 'transferred', v_quantity);
  end if;

  v_next := v_current + p_quantity_delta;
  if v_next < 0 and not v_can_override then
    raise exception 'Stock adjustment would create negative stock';
  end if;

  update public.product_inventory
  set stock = v_next, updated_at = now(), updated_by = (select auth.uid())
  where product_id = p_product_id;

  if p_variant_id is not null then
    update public.product_variants
    set stock = stock + p_quantity_delta, updated_at = now()
    where id = p_variant_id and product_id = p_product_id;
  end if;

  select coalesce(
    p_to_location_id,
    p_from_location_id,
    (select id from public.inventory_locations where is_default and is_active limit 1)
  ) into v_location;

  if v_location is not null then
    insert into public.product_location_inventory (product_id, variant_id, location_id, stock)
    values (p_product_id, p_variant_id, v_location, 0)
    on conflict (product_id, location_id) do nothing;
    select stock into v_location_stock
    from public.product_location_inventory
    where product_id = p_product_id and location_id = v_location
    for update;
    if v_location_stock + p_quantity_delta < 0 and not v_can_override then
      raise exception 'Location adjustment would create negative stock';
    end if;
    update public.product_location_inventory
    set stock = stock + p_quantity_delta, updated_at = now()
    where product_id = p_product_id and location_id = v_location;
  end if;

  insert into public.product_stock_movements (
    product_id, variant_id, from_location_id, to_location_id, movement_type,
    quantity_delta, resulting_stock, reason, created_by
  ) values (
    p_product_id,
    p_variant_id,
    case when p_quantity_delta < 0 then v_location else null end,
    case when p_quantity_delta > 0 then v_location else null end,
    p_movement_type,
    p_quantity_delta,
    v_next,
    trim(p_reason),
    (select auth.uid())
  );

  return jsonb_build_object('product_id', p_product_id, 'stock', v_next);
end;
$$;

create or replace function public.adjust_ingredient_stock(
  p_ingredient_id uuid,
  p_quantity_delta numeric,
  p_movement_type text,
  p_reason text,
  p_lot_id uuid default null,
  p_location_id uuid default null,
  p_reference_type text default null,
  p_reference_id text default null,
  p_allow_negative boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_current numeric(16,4);
  v_next numeric(16,4);
  v_lot_current numeric(16,4);
  v_can_override boolean;
  v_unit_cost numeric(14,6);
begin
  if not (private.has_permission('ingredients.write') or private.has_permission('production.write')) then
    raise exception 'Insufficient ingredient permission';
  end if;
  if p_quantity_delta = 0 or nullif(trim(p_reason), '') is null then
    raise exception 'A non-zero quantity and reason are required';
  end if;
  v_can_override := p_allow_negative and private.is_admin();

  select quantity_available, unit_cost into v_current, v_unit_cost
  from public.ingredients
  where id = p_ingredient_id and archived_at is null
  for update;
  if not found then
    raise exception 'Ingredient not found or archived';
  end if;
  v_next := v_current + p_quantity_delta;
  if v_next < 0 and not v_can_override then
    raise exception 'Ingredient adjustment would create negative stock';
  end if;

  if p_lot_id is not null then
    select quantity_available into v_lot_current
    from public.ingredient_lots
    where id = p_lot_id and ingredient_id = p_ingredient_id
    for update;
    if not found then
      raise exception 'Ingredient lot not found';
    end if;
    if v_lot_current + p_quantity_delta < 0 and not v_can_override then
      raise exception 'Lot adjustment would create negative stock';
    end if;
    update public.ingredient_lots
    set quantity_available = quantity_available + p_quantity_delta,
        updated_at = now(),
        updated_by = (select auth.uid())
    where id = p_lot_id;
  end if;

  update public.ingredients
  set quantity_available = v_next,
      updated_at = now(),
      updated_by = (select auth.uid())
  where id = p_ingredient_id;

  insert into public.ingredient_stock_movements (
    ingredient_id, lot_id, location_id, movement_type, quantity_delta,
    resulting_quantity, unit_cost, reason, reference_type, reference_id, created_by
  ) values (
    p_ingredient_id, p_lot_id, p_location_id, p_movement_type, p_quantity_delta,
    v_next, v_unit_cost, trim(p_reason), p_reference_type, p_reference_id, (select auth.uid())
  );
  return jsonb_build_object('ingredient_id', p_ingredient_id, 'quantity_available', v_next);
end;
$$;

create or replace function public.adjust_reward_points(
  p_user_id uuid,
  p_points_delta integer,
  p_reason text
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_points integer;
begin
  if not private.has_permission('customers.write') then
    raise exception 'Insufficient customer permission';
  end if;
  if p_points_delta = 0 or nullif(trim(p_reason), '') is null then
    raise exception 'A non-zero adjustment and reason are required';
  end if;
  select points into v_points from public.profiles where id = p_user_id for update;
  if not found then raise exception 'User not found'; end if;
  if v_points + p_points_delta < 0 then raise exception 'Reward balance cannot be negative'; end if;
  update public.profiles set points = v_points + p_points_delta, updated_at = now() where id = p_user_id;
  insert into public.reward_adjustments (user_id, points_delta, reason, created_by)
  values (p_user_id, p_points_delta, trim(p_reason), (select auth.uid()));
  return v_points + p_points_delta;
end;
$$;

create or replace function public.anonymize_user(
  p_user_id uuid,
  p_reason text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.is_admin() then raise exception 'Only administrators may anonymize users'; end if;
  if nullif(trim(p_reason), '') is null then raise exception 'An anonymization reason is required'; end if;
  update public.profiles
  set full_name = 'Anonymized user', phone = null, email = null, city = null,
      address = null, preference = null, status = 'anonymized', notes = null,
      tags = '{}', consent = '{}'::jsonb, anonymized_at = now(), updated_at = now()
  where id = p_user_id;
  if not found then raise exception 'User not found'; end if;
  delete from public.user_addresses where user_id = p_user_id;
  insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
  values ((select auth.uid()), 'anonymize', 'profiles', p_user_id::text, jsonb_build_object('reason', trim(p_reason)));
  return true;
end;
$$;

create or replace function public.confirm_production_batch(
  p_batch_id uuid,
  p_allow_negative boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_batch public.production_batches%rowtype;
  v_version public.formula_versions%rowtype;
  v_item record;
  v_required numeric(16,6);
  v_current numeric(16,4);
  v_next numeric(16,4);
  v_ingredient_cost numeric(14,2) := 0;
  v_total_cost numeric(14,2);
  v_can_override boolean;
begin
  if not private.has_permission('production.write') then
    raise exception 'Insufficient production permission';
  end if;
  v_can_override := p_allow_negative and private.is_admin();

  select * into v_batch from public.production_batches where id = p_batch_id for update;
  if not found then raise exception 'Production batch not found'; end if;
  if v_batch.status not in ('planned', 'trial') then
    raise exception 'Only planned or trial batches can be confirmed';
  end if;
  select * into v_version from public.formula_versions where id = v_batch.formula_version_id;
  if not found then raise exception 'Formula version not found'; end if;

  for v_item in
    select fi.*, i.quantity_available, i.unit_cost
    from public.formula_items fi
    join public.ingredients i on i.id = fi.ingredient_id
    where fi.formula_version_id = v_batch.formula_version_id
    order by fi.sort_order, fi.id
  loop
    v_required := round(v_item.quantity_per_batch * (v_batch.batch_size / v_version.reference_batch_size), 6);
    select quantity_available into v_current
    from public.ingredients where id = v_item.ingredient_id for update;
    v_next := v_current - v_required;
    if v_next < 0 and not v_can_override then
      raise exception 'Insufficient stock for ingredient %', v_item.ingredient_id;
    end if;
    update public.ingredients
    set quantity_available = v_next, updated_at = now(), updated_by = (select auth.uid())
    where id = v_item.ingredient_id;
    insert into public.ingredient_stock_movements (
      ingredient_id, movement_type, quantity_delta, resulting_quantity, unit_cost,
      reason, reference_type, reference_id, created_by
    ) values (
      v_item.ingredient_id, 'production', -v_required, v_next, v_item.unit_cost,
      'Production batch ' || v_batch.batch_number, 'production_batch', v_batch.id::text, (select auth.uid())
    );
    insert into public.production_consumptions (
      production_batch_id, ingredient_id, planned_quantity, actual_quantity, unit_cost, total_cost
    ) values (
      v_batch.id, v_item.ingredient_id, v_required, v_required, v_item.unit_cost,
      round(v_required * v_item.unit_cost, 4)
    );
    v_ingredient_cost := v_ingredient_cost + round(v_required * v_item.unit_cost, 2);
  end loop;

  v_total_cost := v_ingredient_cost + v_batch.packaging_cost + v_batch.labor_cost + v_batch.operational_cost;
  update public.production_batches
  set status = 'confirmed',
      production_date = coalesce(production_date, current_date),
      ingredient_cost = v_ingredient_cost,
      total_cost = v_total_cost,
      cost_per_bottle = case when planned_bottles > 0 then round(v_total_cost / planned_bottles, 4) else 0 end,
      override_negative_stock = v_can_override,
      confirmed_by = (select auth.uid()),
      confirmed_at = now(),
      updated_by = (select auth.uid()),
      updated_at = now()
  where id = v_batch.id;

  return jsonb_build_object(
    'batch_id', v_batch.id,
    'status', 'confirmed',
    'ingredient_cost', v_ingredient_cost,
    'total_cost', v_total_cost
  );
end;
$$;

create or replace function public.reverse_production_batch(
  p_batch_id uuid,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_batch public.production_batches%rowtype;
  v_consumption record;
  v_next numeric(16,4);
begin
  if not private.has_permission('production.write') then
    raise exception 'Insufficient production permission';
  end if;
  if nullif(trim(p_reason), '') is null then raise exception 'A correction reason is required'; end if;
  select * into v_batch from public.production_batches where id = p_batch_id for update;
  if not found then raise exception 'Production batch not found'; end if;
  if v_batch.status not in ('confirmed', 'macerating', 'quality_control') then
    raise exception 'This batch cannot be reversed from its current status';
  end if;

  for v_consumption in
    select * from public.production_consumptions where production_batch_id = p_batch_id for update
  loop
    update public.ingredients
    set quantity_available = quantity_available + v_consumption.actual_quantity,
        updated_at = now(), updated_by = (select auth.uid())
    where id = v_consumption.ingredient_id
    returning quantity_available into v_next;
    insert into public.ingredient_stock_movements (
      ingredient_id, lot_id, movement_type, quantity_delta, resulting_quantity,
      unit_cost, reason, reference_type, reference_id, created_by
    ) values (
      v_consumption.ingredient_id, v_consumption.ingredient_lot_id, 'reversal',
      v_consumption.actual_quantity, v_next, v_consumption.unit_cost,
      trim(p_reason), 'production_batch_reversal', p_batch_id::text, (select auth.uid())
    );
  end loop;

  update public.production_batches
  set status = 'cancelled', cancellation_reason = trim(p_reason),
      cancelled_by = (select auth.uid()), cancelled_at = now(),
      updated_by = (select auth.uid()), updated_at = now()
  where id = p_batch_id;
  return jsonb_build_object('batch_id', p_batch_id, 'status', 'cancelled');
end;
$$;

create or replace function public.post_finance_transaction(p_transaction_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_transaction public.finance_transactions%rowtype;
  v_debits numeric(16,2);
  v_credits numeric(16,2);
begin
  if not private.has_permission('finance.post') then
    raise exception 'Insufficient permission to post transactions';
  end if;
  select * into v_transaction from public.finance_transactions where id = p_transaction_id for update;
  if not found then raise exception 'Transaction not found'; end if;
  if v_transaction.status <> 'draft' then raise exception 'Only draft transactions can be posted'; end if;

  select
    coalesce(sum(amount) filter (where direction = 'debit'), 0),
    coalesce(sum(amount) filter (where direction = 'credit'), 0)
  into v_debits, v_credits
  from public.finance_transaction_lines where transaction_id = p_transaction_id;

  if v_debits = 0 or v_debits <> v_credits then
    raise exception 'Ledger lines must contain equal non-zero debits and credits';
  end if;
  if v_transaction.amount <> v_debits then
    raise exception 'Transaction amount must equal the balanced ledger total';
  end if;

  update public.finance_transactions
  set status = 'posted', approved_by = (select auth.uid()), posted_at = now(), updated_at = now()
  where id = p_transaction_id;
  return jsonb_build_object('transaction_id', p_transaction_id, 'status', 'posted', 'amount', v_debits);
end;
$$;

create or replace function public.reverse_finance_transaction(
  p_transaction_id uuid,
  p_reason text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_original public.finance_transactions%rowtype;
  v_reversal_id uuid := extensions.gen_random_uuid();
  v_reversal_number text;
begin
  if not private.has_permission('finance.post') then
    raise exception 'Insufficient permission to reverse transactions';
  end if;
  if nullif(trim(p_reason), '') is null then raise exception 'A reversal reason is required'; end if;
  select * into v_original from public.finance_transactions where id = p_transaction_id for update;
  if not found then raise exception 'Transaction not found'; end if;
  if v_original.status <> 'posted' then raise exception 'Only posted transactions can be reversed'; end if;

  v_reversal_number := 'REV-' || v_original.transaction_number || '-' || to_char(clock_timestamp(), 'YYYYMMDDHH24MISSMS');
  insert into public.finance_transactions (
    id, transaction_number, transaction_date, type, category_id, description, amount,
    currency, tax_amount, payment_method, payment_status, status, customer_id,
    supplier_id, order_id, purchase_order_id, invoice_reference, notes, created_by,
    approved_by, posted_at, reversed_transaction_id
  ) values (
    v_reversal_id, v_reversal_number, current_date, 'reversal', v_original.category_id,
    'Reversal of ' || v_original.transaction_number, v_original.amount,
    v_original.currency, v_original.tax_amount, v_original.payment_method, 'cancelled',
    'posted', v_original.customer_id, v_original.supplier_id, v_original.order_id,
    v_original.purchase_order_id, v_original.invoice_reference, trim(p_reason),
    (select auth.uid()), (select auth.uid()), now(), v_original.id
  );

  insert into public.finance_transaction_lines (transaction_id, account_id, direction, amount, description)
  select v_reversal_id, account_id,
    case when direction = 'debit' then 'credit' else 'debit' end,
    amount, 'Reversal: ' || coalesce(description, v_original.description)
  from public.finance_transaction_lines where transaction_id = v_original.id;

  update public.finance_transactions
  set status = 'reversed', reversed_at = now(), updated_at = now()
  where id = v_original.id;
  return v_reversal_id;
end;
$$;

create or replace function public.snapshot_product_cost(
  p_product_id text,
  p_variant_id uuid default null,
  p_selling_price numeric default null,
  p_target_margin numeric default 0.65
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_price numeric(14,2);
  v_ingredient numeric(14,4);
  v_packaging numeric(14,4);
  v_labor numeric(14,4);
  v_shipping numeric(14,4);
  v_marketing numeric(14,4);
  v_payment numeric(14,4);
  v_tax numeric(14,4);
  v_other numeric(14,4);
  v_total numeric(14,4);
  v_id bigint;
begin
  if not private.has_permission('costing.write') and not private.has_permission('finance.write') then
    raise exception 'Insufficient costing permission';
  end if;
  if p_target_margin < 0 or p_target_margin >= 1 then raise exception 'Target margin must be between 0 and 1'; end if;
  select coalesce(
    p_selling_price,
    (select price from public.product_variants where id = p_variant_id),
    (select min(price) from public.product_prices where product_id = p_product_id),
    0
  ) into v_price;

  select
    coalesce(sum(case when component_type = 'ingredient' then amount else 0 end), 0),
    coalesce(sum(case when component_type in ('packaging','bottle','cap','label','box','filling') then amount else 0 end), 0),
    coalesce(sum(case when component_type = 'labor' then amount else 0 end), 0),
    coalesce(sum(case when component_type = 'shipping' then amount else 0 end), 0),
    coalesce(sum(case when component_type = 'marketing' then amount else 0 end), 0),
    coalesce(sum(case when component_type = 'payment_fee' then
      case when allocation_method = 'percent_revenue' then v_price * amount / 100 else amount end else 0 end), 0),
    coalesce(sum(case when component_type = 'tax' then amount else 0 end), 0),
    coalesce(sum(case when component_type = 'other' then amount else 0 end), 0)
  into v_ingredient, v_packaging, v_labor, v_shipping, v_marketing, v_payment, v_tax, v_other
  from public.product_cost_components
  where product_id = p_product_id
    and (variant_id is null or variant_id = p_variant_id)
    and effective_from <= current_date
    and (effective_to is null or effective_to >= current_date);

  select v_ingredient + v_packaging + v_labor + v_shipping + v_marketing + v_payment + v_tax + v_other
  into v_total;

  insert into public.product_cost_snapshots (
    product_id, variant_id, ingredient_cost, packaging_cost, labor_cost,
    shipping_cost, marketing_cost, payment_fee, tax_cost, total_cost,
    cost_per_unit, selling_price, wholesale_margin, retail_margin, gross_profit,
    net_profit_estimate, break_even_price, recommended_price, created_by
  ) values (
    p_product_id, p_variant_id, v_ingredient, v_packaging, v_labor,
    v_shipping, v_marketing, v_payment, v_tax, v_total,
    v_total, v_price,
    case when v_price > 0 then (v_price * 0.5 - v_total) / (v_price * 0.5) else null end,
    case when v_price > 0 then (v_price - v_total) / v_price else null end,
    v_price - v_total, v_price - v_total, v_total,
    round(v_total / (1 - p_target_margin), 2), (select auth.uid())
  ) returning id into v_id;
  return v_id;
end;
$$;

revoke all on function public.adjust_product_stock(text, integer, text, text, uuid, uuid, uuid, boolean) from public, anon;
revoke all on function public.adjust_ingredient_stock(uuid, numeric, text, text, uuid, uuid, text, text, boolean) from public, anon;
revoke all on function public.adjust_reward_points(uuid, integer, text) from public, anon;
revoke all on function public.anonymize_user(uuid, text) from public, anon;
revoke all on function public.confirm_production_batch(uuid, boolean) from public, anon;
revoke all on function public.reverse_production_batch(uuid, text) from public, anon;
revoke all on function public.post_finance_transaction(uuid) from public, anon;
revoke all on function public.reverse_finance_transaction(uuid, text) from public, anon;
revoke all on function public.snapshot_product_cost(text, uuid, numeric, numeric) from public, anon;
grant execute on function public.adjust_product_stock(text, integer, text, text, uuid, uuid, uuid, boolean) to authenticated;
grant execute on function public.adjust_ingredient_stock(uuid, numeric, text, text, uuid, uuid, text, text, boolean) to authenticated;
grant execute on function public.adjust_reward_points(uuid, integer, text) to authenticated;
grant execute on function public.anonymize_user(uuid, text) to authenticated;
grant execute on function public.confirm_production_batch(uuid, boolean) to authenticated;
grant execute on function public.reverse_production_batch(uuid, text) to authenticated;
grant execute on function public.post_finance_transaction(uuid) to authenticated;
grant execute on function public.reverse_finance_transaction(uuid, text) to authenticated;
grant execute on function public.snapshot_product_cost(text, uuid, numeric, numeric) to authenticated;

-- -----------------------------------------------------------------------------
-- RLS and least-privilege grants
-- -----------------------------------------------------------------------------

do $$
declare
  t text;
begin
  foreach t in array array[
    'app_roles', 'role_permissions', 'user_addresses', 'reward_adjustments',
    'wishlist_items', 'user_activity', 'product_categories', 'product_collections',
    'product_collection_items', 'product_variants', 'product_images', 'fragrance_notes',
    'product_fragrance_notes', 'related_products', 'inventory_locations',
    'product_location_inventory', 'product_stock_movements', 'suppliers', 'ingredients',
    'ingredient_lots', 'ingredient_stock_movements', 'purchase_orders',
    'purchase_order_items', 'documents', 'formulas', 'formula_versions', 'formula_items',
    'production_batches', 'production_consumptions', 'product_cost_components',
    'product_cost_snapshots', 'finance_accounts', 'finance_categories',
    'finance_transactions', 'finance_transaction_lines', 'budgets', 'marketing_segments',
    'marketing_campaigns', 'marketing_campaign_products', 'marketing_events',
    'marketing_partners', 'marketing_content_items', 'abandoned_carts', 'website_content',
    'customer_requests', 'product_reviews', 'gift_cards', 'subscriptions', 'order_returns',
    'order_refunds', 'shipping_methods', 'tax_rates', 'notifications', 'api_keys',
    'api_key_activity', 'audit_logs'
  ]
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('grant select, insert, update, delete on table public.%I to authenticated', t);
  end loop;
end
$$;
grant usage, select on all sequences in schema public to authenticated;

do $$
declare
  r record;
begin
  for r in
    select * from (values
      ('app_roles', 'roles'), ('role_permissions', 'roles'),
      ('products', 'products'), ('product_prices', 'products'),
      ('product_categories', 'products'), ('product_collections', 'products'),
      ('product_collection_items', 'products'), ('product_variants', 'products'),
      ('product_images', 'products'), ('fragrance_notes', 'products'),
      ('product_fragrance_notes', 'products'), ('related_products', 'products'),
      ('inventory_locations', 'inventory'), ('product_location_inventory', 'inventory'),
      ('product_stock_movements', 'inventory'), ('product_inventory', 'inventory'),
      ('suppliers', 'ingredients'), ('ingredients', 'ingredients'),
      ('ingredient_lots', 'ingredients'), ('ingredient_stock_movements', 'ingredients'),
      ('purchase_orders', 'purchasing'), ('purchase_order_items', 'purchasing'),
      ('documents', 'ingredients'), ('formulas', 'production'),
      ('formula_versions', 'production'), ('formula_items', 'production'),
      ('production_batches', 'production'), ('production_consumptions', 'production'),
      ('product_cost_components', 'costing'), ('product_cost_snapshots', 'costing'),
      ('finance_accounts', 'finance'), ('finance_categories', 'finance'),
      ('finance_transactions', 'finance'), ('finance_transaction_lines', 'finance'),
      ('budgets', 'finance'), ('marketing_segments', 'marketing'),
      ('marketing_campaigns', 'marketing'), ('marketing_campaign_products', 'marketing'),
      ('marketing_events', 'marketing'), ('marketing_partners', 'marketing'),
      ('marketing_content_items', 'marketing'), ('abandoned_carts', 'marketing'),
      ('website_content', 'content'), ('content_settings', 'content'),
      ('user_addresses', 'customers'),
      ('reward_adjustments', 'customers'), ('wishlist_items', 'customers'),
      ('user_activity', 'customers'), ('customer_requests', 'customers'),
      ('product_reviews', 'customers'), ('subscriptions', 'customers'),
      ('orders', 'orders'), ('order_items', 'orders'), ('payments', 'orders'),
      ('order_returns', 'orders'), ('order_refunds', 'orders'),
      ('coupons', 'marketing'), ('newsletter_subscribers', 'marketing'),
      ('shipping_methods', 'settings'), ('tax_rates', 'settings'),
      ('notifications', 'notifications'), ('gift_cards', 'finance')
    ) as m(table_name, module_name)
  loop
    execute format(
      'create policy %I on public.%I for select to authenticated using ((select private.has_permission(%L)) or (select private.has_permission(%L)))',
      r.table_name || '_staff_read', r.table_name, r.module_name || '.read', r.module_name || '.write'
    );
    execute format(
      'create policy %I on public.%I for all to authenticated using ((select private.has_permission(%L))) with check ((select private.has_permission(%L)))',
      r.table_name || '_staff_write', r.table_name, r.module_name || '.write', r.module_name || '.write'
    );
  end loop;
end
$$;

create policy profiles_staff_read on public.profiles
for select to authenticated
using ((select private.has_permission('customers.read')) or (select private.has_permission('customers.write')));
create policy profiles_staff_update on public.profiles
for update to authenticated
using ((select private.has_permission('customers.write')))
with check ((select private.has_permission('customers.write')));

create policy audit_logs_staff_read on public.audit_logs
for select to authenticated
using ((select private.has_permission('reports.read')) or (select private.is_admin()));

-- API-key rows are intentionally not exposed through table policies. The Edge
-- Function returns a redacted projection and performs every lifecycle action.

create policy user_addresses_own_all on public.user_addresses
for all to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));
create policy wishlist_items_own_all on public.wishlist_items
for all to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));
create policy reward_adjustments_own_read on public.reward_adjustments
for select to authenticated using (user_id = (select auth.uid()));
create policy user_activity_own_read on public.user_activity
for select to authenticated using (user_id = (select auth.uid()));
create policy product_reviews_own_read on public.product_reviews
for select to authenticated using (customer_id = (select auth.uid()));
create policy product_reviews_own_insert on public.product_reviews
for insert to authenticated with check (customer_id = (select auth.uid()) and status = 'pending');
create policy subscriptions_own_read on public.subscriptions
for select to authenticated using (customer_id = (select auth.uid()));
create policy customer_requests_own_read on public.customer_requests
for select to authenticated using (customer_id = (select auth.uid()));
create policy customer_requests_own_insert on public.customer_requests
for insert to authenticated with check (customer_id = (select auth.uid()) and status = 'new');
create policy abandoned_carts_own_read on public.abandoned_carts
for select to authenticated using (customer_id = (select auth.uid()));
create policy order_returns_own_read on public.order_returns
for select to authenticated using (customer_id = (select auth.uid()));
create policy order_refunds_own_read on public.order_refunds
for select to authenticated
using (exists (select 1 from public.orders o where o.id = order_id and o.customer_id = (select auth.uid())));
create policy notifications_own_read on public.notifications
for select to authenticated using (user_id = (select auth.uid()));
create policy notifications_own_update on public.notifications
for update to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

grant select on public.product_categories, public.product_collections,
  public.product_collection_items, public.product_variants, public.product_images,
  public.fragrance_notes, public.product_fragrance_notes, public.related_products,
  public.website_content, public.product_reviews, public.shipping_methods, public.tax_rates
to anon, authenticated;

create policy product_categories_public_read on public.product_categories
for select to anon, authenticated using (is_active and archived_at is null);
create policy product_collections_public_read on public.product_collections
for select to anon, authenticated using (is_active and archived_at is null and (starts_at is null or starts_at <= now()) and (ends_at is null or ends_at >= now()));
create policy product_collection_items_public_read on public.product_collection_items
for select to anon, authenticated
using (exists (select 1 from public.products p where p.id = product_id and p.is_active and p.deleted_at is null));
create policy product_variants_public_read on public.product_variants
for select to anon, authenticated
using (is_active and archived_at is null and exists (select 1 from public.products p where p.id = product_id and p.is_active and p.deleted_at is null));
create policy product_images_public_read on public.product_images
for select to anon, authenticated
using (exists (select 1 from public.products p where p.id = product_id and p.is_active and p.deleted_at is null));
create policy fragrance_notes_public_read on public.fragrance_notes
for select to anon, authenticated using (true);
create policy product_fragrance_notes_public_read on public.product_fragrance_notes
for select to anon, authenticated
using (exists (select 1 from public.products p where p.id = product_id and p.is_active and p.deleted_at is null));
create policy related_products_public_read on public.related_products
for select to anon, authenticated
using (exists (select 1 from public.products p where p.id = product_id and p.is_active and p.deleted_at is null));
create policy website_content_public_read on public.website_content
for select to anon, authenticated using (status = 'published' and (published_at is null or published_at <= now()));
create policy product_reviews_public_read on public.product_reviews
for select to anon, authenticated using (status = 'published');
create policy shipping_methods_public_read on public.shipping_methods
for select to anon, authenticated using (is_active);
create policy tax_rates_public_read on public.tax_rates
for select to anon, authenticated
using (is_active and effective_from <= current_date and (effective_to is null or effective_to >= current_date));

-- -----------------------------------------------------------------------------
-- Security-invoker reporting views; all financial calculations stay in Postgres
-- -----------------------------------------------------------------------------

create or replace view public.ingredient_inventory_summary
with (security_invoker = true)
as
select
  i.id,
  i.internal_code,
  i.name,
  i.category,
  i.quantity_available,
  i.unit,
  i.minimum_stock,
  i.reorder_quantity,
  i.unit_cost,
  round(i.quantity_available * i.unit_cost, 2) as stock_value,
  i.supplier_id,
  s.name as supplier_name,
  case
    when i.quantity_available <= 0 then 'out_of_stock'
    when i.quantity_available <= i.minimum_stock then 'low_stock'
    else 'ready'
  end as stock_status,
  (select min(coalesce(l.expiry_date, l.retest_date)) from public.ingredient_lots l where l.ingredient_id = i.id and l.status in ('available', 'released')) as next_expiry_date,
  i.updated_at
from public.ingredients i
left join public.suppliers s on s.id = i.supplier_id
where i.archived_at is null;

create or replace view public.product_inventory_summary
with (security_invoker = true)
as
select
  p.id as product_id,
  p.name_en,
  p.brand,
  p.type,
  p.status,
  coalesce(pi.stock, 0) as stock,
  coalesce(pi.low_stock_at, 0) as low_stock_at,
  p.cost,
  round(coalesce(pi.stock, 0) * p.cost, 2) as inventory_value,
  case
    when coalesce(pi.stock, 0) <= 0 then 'out_of_stock'
    when coalesce(pi.stock, 0) <= coalesce(pi.low_stock_at, 0) then 'low_stock'
    else 'ready'
  end as stock_status,
  pi.updated_at
from public.products p
left join public.product_inventory pi on pi.product_id = p.id
where p.deleted_at is null;

create or replace view public.current_product_costing
with (security_invoker = true)
as
with component_costs as (
  select
    c.product_id,
    c.variant_id,
    sum(case when c.component_type = 'ingredient' then c.amount else 0 end) as ingredient_cost,
    sum(case when c.component_type in ('packaging','bottle','cap','label','box','filling') then c.amount else 0 end) as packaging_cost,
    sum(case when c.component_type = 'labor' then c.amount else 0 end) as labor_cost,
    sum(case when c.component_type = 'shipping' then c.amount else 0 end) as shipping_cost,
    sum(case when c.component_type = 'marketing' then c.amount else 0 end) as marketing_cost,
    sum(case when c.component_type = 'payment_fee' and c.allocation_method <> 'percent_revenue' then c.amount else 0 end) as payment_fee,
    sum(case when c.component_type = 'tax' then c.amount else 0 end) as tax_cost,
    sum(case when c.component_type = 'other' then c.amount else 0 end) as other_cost
  from public.product_cost_components c
  where c.effective_from <= current_date and (c.effective_to is null or c.effective_to >= current_date)
  group by c.product_id, c.variant_id
)
select
  p.id as product_id,
  p.name_en,
  cc.variant_id,
  coalesce(v.name, p.hero_size, 'Base') as variant_name,
  coalesce(v.price, (select min(pp.price) from public.product_prices pp where pp.product_id = p.id), 0) as selling_price,
  coalesce(cc.ingredient_cost, 0) as ingredient_cost,
  coalesce(cc.packaging_cost, 0) as packaging_cost,
  coalesce(cc.labor_cost, 0) as labor_cost,
  coalesce(cc.shipping_cost, 0) as shipping_cost,
  coalesce(cc.marketing_cost, 0) as marketing_cost,
  coalesce(cc.payment_fee, 0) as payment_fee,
  coalesce(cc.tax_cost, 0) as tax_cost,
  coalesce(cc.other_cost, 0) as other_cost,
  coalesce(cc.ingredient_cost, 0) + coalesce(cc.packaging_cost, 0) +
    coalesce(cc.labor_cost, 0) + coalesce(cc.shipping_cost, 0) +
    coalesce(cc.marketing_cost, 0) + coalesce(cc.payment_fee, 0) +
    coalesce(cc.tax_cost, 0) + coalesce(cc.other_cost, 0) as total_cost
from public.products p
left join component_costs cc on cc.product_id = p.id
left join public.product_variants v on v.id = cc.variant_id
where p.deleted_at is null;

create or replace view public.finance_monthly_summary
with (security_invoker = true)
as
select
  date_trunc('month', transaction_date)::date as month,
  currency,
  coalesce(sum(amount) filter (where type in ('income', 'customer_payment')), 0) as income,
  coalesce(sum(amount) filter (where type in ('expense', 'supplier_payment', 'tax', 'cogs')), 0) as expenses,
  coalesce(sum(amount) filter (where type = 'receivable' and payment_status in ('unpaid', 'partially_paid', 'overdue')), 0) as receivables,
  coalesce(sum(amount) filter (where type = 'payable' and payment_status in ('unpaid', 'partially_paid', 'overdue')), 0) as payables,
  coalesce(sum(amount) filter (where type in ('income', 'customer_payment')), 0) -
    coalesce(sum(amount) filter (where type in ('expense', 'supplier_payment', 'tax', 'cogs')), 0) as net_cash_flow
from public.finance_transactions
where status = 'posted'
group by date_trunc('month', transaction_date)::date, currency;

create or replace view public.campaign_performance
with (security_invoker = true)
as
select
  c.*,
  case when c.orders_count > 0 then round(c.revenue / c.orders_count, 2) else 0 end as average_order_value,
  case when c.actual_spend > 0 then round(c.revenue / c.actual_spend, 4) else 0 end as return_on_marketing_spend,
  case when c.orders_count > 0 then round(c.conversions::numeric / c.orders_count, 4) else 0 end as conversion_rate
from public.marketing_campaigns c;

create or replace view public.admin_business_overview
with (security_invoker = true)
as
select
  (select coalesce(sum(total), 0) from public.orders where status in ('paid', 'shipped', 'delivered')) as total_sales,
  (select count(*) from public.orders) as total_orders,
  (select coalesce(avg(total), 0) from public.orders where status <> 'cancelled') as average_order_value,
  (select count(*) from public.orders where status in ('awaiting_confirmation', 'confirmed')) as pending_orders,
  (select count(*) from public.product_inventory where stock <= low_stock_at) as low_stock_products,
  (select count(*) from public.ingredients where archived_at is null and quantity_available <= minimum_stock) as low_stock_ingredients,
  (select count(*) from public.ingredient_lots where status in ('available', 'released') and coalesce(expiry_date, retest_date) <= current_date + 60) as expiring_ingredients,
  (select coalesce(sum(amount), 0) from public.finance_transactions where status = 'posted' and type = 'receivable' and payment_status in ('unpaid', 'partially_paid', 'overdue')) as outstanding_receivables,
  (select coalesce(sum(amount), 0) from public.finance_transactions where status = 'posted' and type = 'payable' and payment_status in ('unpaid', 'partially_paid', 'overdue')) as outstanding_payables,
  (select coalesce(sum(amount), 0) from public.finance_transactions where status = 'posted' and type in ('expense', 'supplier_payment') and transaction_date >= date_trunc('month', current_date)::date) as monthly_expenses,
  (select coalesce(sum(amount) filter (where type in ('income', 'customer_payment')), 0) - coalesce(sum(amount) filter (where type = 'cogs'), 0) from public.finance_transactions where status = 'posted') as gross_profit;

grant select on public.ingredient_inventory_summary, public.product_inventory_summary,
  public.current_product_costing, public.finance_monthly_summary,
  public.campaign_performance, public.admin_business_overview
to authenticated;
