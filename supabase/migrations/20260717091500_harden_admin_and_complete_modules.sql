-- Harden public commerce entry points and finish operational indexing/auditing.

alter table public.products
  add column if not exists scent_profile text,
  add column if not exists who_it_is_for text,
  add column if not exists how_to_wear text,
  add column if not exists longevity text,
  add column if not exists gift_ready_message text;

-- -----------------------------------------------------------------------------
-- Public commerce policies: retain storefront compatibility without open writes.
-- -----------------------------------------------------------------------------

drop policy if exists news_insert_any on public.newsletter_subscribers;
drop policy if exists newsletter_public_insert on public.newsletter_subscribers;
create policy newsletter_public_insert on public.newsletter_subscribers
for insert to anon, authenticated
with check (
  length(email) between 5 and 254
  and email = lower(trim(email))
  and email ~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$'
);

drop policy if exists orders_insert_any on public.orders;
drop policy if exists orders_public_insert on public.orders;

drop policy if exists items_insert_any on public.order_items;
drop policy if exists order_items_public_insert on public.order_items;
revoke insert on public.orders, public.order_items from anon;

revoke delete, update, truncate, references, trigger
on public.newsletter_subscribers, public.orders, public.order_items
from anon;
revoke truncate, references, trigger
on public.newsletter_subscribers, public.orders, public.order_items
from authenticated;

drop policy if exists preorders_public_insert on public.preorders;
create policy preorders_public_insert on public.preorders
for insert to anon, authenticated
with check (
  customer_id is null
  and status = 'requested'
  and source = 'web'
  and quantity between 1 and 10
  and unit_price >= 0
  and deposit_amount = 0
  and currency = 'SAR'
  and converted_order_id is null
  and length(customer_name) between 1 and 160
  and length(customer_email) between 5 and 254
  and length(customer_phone) between 7 and 40
  and length(coalesce(notes, '')) <= 3000
  and exists (
    select 1 from public.products p
    where p.id = preorders.product_id
      and p.is_active
      and p.status = 'published'
      and p.deleted_at is null
  )
);
grant insert on public.preorders to anon;
revoke select, update, delete, truncate, references, trigger on public.preorders from anon;

create or replace function public.submit_storefront_order(
  p_order_no text,
  p_type text,
  p_customer_name text,
  p_customer_phone text,
  p_note text,
  p_items jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders%rowtype;
  v_item jsonb;
  v_product_id text;
  v_name text;
  v_size text;
  v_qty integer;
  v_price numeric(14,2);
  v_subtotal numeric(14,2) := 0;
  v_tax_rate numeric(7,4) := 0.15;
  v_vat numeric(14,2);
  v_total numeric(14,2);
  v_customer_id uuid;
  v_validated_items jsonb := '[]'::jsonb;
begin
  if p_type not in ('cart', 'buy_now', 'whatsapp') then
    raise exception 'Unsupported order type';
  end if;
  if p_order_no is null or length(trim(p_order_no)) not between 4 and 50
     or trim(p_order_no) !~ '^[A-Za-z0-9-]+$' then
    raise exception 'Invalid order number';
  end if;
  if jsonb_typeof(p_items) <> 'array'
     or jsonb_array_length(p_items) not between 1 and 30 then
    raise exception 'Orders require between 1 and 30 items';
  end if;
  if length(coalesce(p_customer_name, '')) > 160
     or length(coalesce(p_customer_phone, '')) > 40
     or length(coalesce(p_note, '')) > 3000 then
    raise exception 'Order contact details exceed the allowed length';
  end if;

  select tr.rate
  into v_tax_rate
  from public.tax_rates tr
  where tr.is_active
    and tr.country = 'Saudi Arabia'
    and tr.effective_from <= current_date
    and (tr.effective_to is null or tr.effective_to >= current_date)
  order by tr.effective_from desc
  limit 1;
  v_tax_rate := coalesce(v_tax_rate, 0.15);

  for v_item in select value from jsonb_array_elements(p_items)
  loop
    v_product_id := nullif(trim(v_item ->> 'product_id'), '');
    v_size := nullif(trim(v_item ->> 'size'), '');
    begin
      v_qty := (v_item ->> 'qty')::integer;
    exception when others then
      raise exception 'Invalid order quantity';
    end;
    if v_product_id is null or v_size is null or v_qty not between 1 and 100 then
      raise exception 'Invalid order item';
    end if;

    select p.name_en, pp.price
    into v_name, v_price
    from public.products p
    join public.product_prices pp on pp.product_id = p.id and pp.size = v_size
    where p.id = v_product_id
      and p.is_active
      and p.status = 'published'
      and p.deleted_at is null;
    if not found then
      raise exception 'Product or size is not currently available';
    end if;

    v_subtotal := v_subtotal + round(v_price * v_qty, 2);
    v_validated_items := v_validated_items || jsonb_build_array(jsonb_build_object(
      'product_id', v_product_id,
      'name_en', v_name,
      'size', v_size,
      'qty', v_qty,
      'unit_price', v_price
    ));
  end loop;

  v_subtotal := round(v_subtotal, 2);
  v_vat := round(v_subtotal * v_tax_rate, 2);
  v_total := v_subtotal + v_vat;

  select p.id into v_customer_id
  from public.profiles p
  where p.id = (select auth.uid());

  insert into public.orders (
    order_no, customer_id, customer_name, customer_phone, type, status,
    channel, subtotal, vat, total, currency, note
  ) values (
    upper(trim(p_order_no)), v_customer_id, nullif(trim(p_customer_name), ''),
    nullif(trim(p_customer_phone), ''), p_type, 'awaiting_confirmation',
    'web', v_subtotal, v_vat, v_total, 'SAR', nullif(trim(p_note), '')
  ) returning * into v_order;

  insert into public.order_items (order_id, product_id, name_en, size, qty, unit_price)
  select v_order.id, i.product_id, i.name_en, i.size, i.qty, i.unit_price
  from jsonb_to_recordset(v_validated_items) as i(
    product_id text, name_en text, size text, qty integer, unit_price numeric(14,2)
  );

  return jsonb_build_object(
    'id', v_order.id,
    'order_no', v_order.order_no,
    'subtotal', v_subtotal,
    'vat', v_vat,
    'total', v_total,
    'currency', 'SAR'
  );
end;
$$;
revoke all on function public.submit_storefront_order(text, text, text, text, text, jsonb) from public;
grant execute on function public.submit_storefront_order(text, text, text, text, text, jsonb) to anon, authenticated;

create or replace function public.recalculate_order_totals(p_order_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_subtotal numeric(14,2);
  v_vat numeric(14,2);
  v_total numeric(14,2);
begin
  if not private.has_permission('orders.write') then
    raise exception 'Insufficient order permission';
  end if;

  perform 1 from public.orders where id = p_order_id for update;
  if not found then
    raise exception 'Order not found';
  end if;

  select round(coalesce(sum(oi.qty * oi.unit_price), 0), 2)
  into v_subtotal
  from public.order_items oi
  where oi.order_id = p_order_id;

  v_vat := round(v_subtotal * 0.15, 2);
  v_total := v_subtotal + v_vat;

  update public.orders
  set subtotal = v_subtotal, vat = v_vat, total = v_total
  where id = p_order_id;

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
  values (
    (select auth.uid()), 'recalculate_totals', 'orders', p_order_id::text,
    jsonb_build_object('subtotal', v_subtotal, 'vat', v_vat, 'total', v_total)
  );

  return jsonb_build_object('order_id', p_order_id, 'subtotal', v_subtotal, 'vat', v_vat, 'total', v_total);
end;
$$;
revoke all on function public.recalculate_order_totals(uuid) from public, anon;
grant execute on function public.recalculate_order_totals(uuid) to authenticated;

-- API credentials are service-side only. Explicit deny policies avoid accidental
-- browser access if grants change later while Edge Functions keep service access.
revoke all on public.api_keys, public.api_key_activity from anon, authenticated;
drop policy if exists api_keys_no_direct_access on public.api_keys;
create policy api_keys_no_direct_access on public.api_keys
for all to authenticated using (false) with check (false);
drop policy if exists api_key_activity_no_direct_access on public.api_key_activity;
create policy api_key_activity_no_direct_access on public.api_key_activity
for all to authenticated using (false) with check (false);

-- Public buckets remain retrievable through public object URLs. Listing objects is
-- restricted to staff with the matching write permission.
drop policy if exists product_images_public_read on storage.objects;
drop policy if exists product_images_staff_read on storage.objects;
create policy product_images_staff_read on storage.objects
for select to authenticated
using (
  bucket_id = 'product-images'
  and (
    (select private.has_permission('products.read'))
    or (select private.has_permission('products.write'))
  )
);

drop policy if exists marketing_assets_public_read on storage.objects;
drop policy if exists marketing_assets_staff_read on storage.objects;
create policy marketing_assets_staff_read on storage.objects
for select to authenticated
using (
  bucket_id = 'marketing-assets'
  and (
    (select private.has_permission('marketing.read'))
    or (select private.has_permission('marketing.write'))
  )
);

-- -----------------------------------------------------------------------------
-- Foreign-key indexes reported by the database advisor.
-- -----------------------------------------------------------------------------

create index if not exists budgets_created_by_idx on public.budgets (created_by);
create index if not exists documents_uploaded_by_idx on public.documents (uploaded_by);
create index if not exists finance_transactions_approved_by_idx on public.finance_transactions (approved_by);
create index if not exists finance_transactions_created_by_idx on public.finance_transactions (created_by);
create index if not exists formula_versions_approved_by_idx on public.formula_versions (approved_by);
create index if not exists formula_versions_created_by_idx on public.formula_versions (created_by);
create index if not exists formulas_created_by_idx on public.formulas (created_by);
create index if not exists formulas_current_version_idx on public.formulas (current_version_id);
create index if not exists formulas_updated_by_idx on public.formulas (updated_by);
create index if not exists ingredient_lots_created_by_idx on public.ingredient_lots (created_by);
create index if not exists ingredient_lots_updated_by_idx on public.ingredient_lots (updated_by);
create index if not exists ingredient_stock_movements_created_by_idx on public.ingredient_stock_movements (created_by);
create index if not exists ingredients_created_by_idx on public.ingredients (created_by);
create index if not exists ingredients_updated_by_idx on public.ingredients (updated_by);
create index if not exists marketing_campaigns_created_by_idx on public.marketing_campaigns (created_by);
create index if not exists marketing_segments_created_by_idx on public.marketing_segments (created_by);
create index if not exists notifications_user_idx on public.notifications (user_id);
create index if not exists order_refunds_approved_by_idx on public.order_refunds (approved_by);
create index if not exists order_refunds_created_by_idx on public.order_refunds (created_by);
create index if not exists order_returns_created_by_idx on public.order_returns (created_by);
create index if not exists preorders_created_by_idx on public.preorders (created_by);
create index if not exists preorders_updated_by_idx on public.preorders (updated_by);
create index if not exists product_cost_components_created_by_idx on public.product_cost_components (created_by);
create index if not exists product_cost_snapshots_created_by_idx on public.product_cost_snapshots (created_by);
create index if not exists product_images_created_by_idx on public.product_images (created_by);
create index if not exists product_inventory_updated_by_idx on public.product_inventory (updated_by);
create index if not exists product_stock_movements_created_by_idx on public.product_stock_movements (created_by);
create index if not exists production_batches_cancelled_by_idx on public.production_batches (cancelled_by);
create index if not exists production_batches_confirmed_by_idx on public.production_batches (confirmed_by);
create index if not exists production_batches_created_by_idx on public.production_batches (created_by);
create index if not exists production_batches_updated_by_idx on public.production_batches (updated_by);
create index if not exists products_created_by_idx on public.products (created_by);
create index if not exists products_updated_by_idx on public.products (updated_by);
create index if not exists purchase_orders_approved_by_idx on public.purchase_orders (approved_by);
create index if not exists purchase_orders_created_by_idx on public.purchase_orders (created_by);
create index if not exists reward_adjustments_created_by_idx on public.reward_adjustments (created_by);
create index if not exists suppliers_created_by_idx on public.suppliers (created_by);
create index if not exists suppliers_updated_by_idx on public.suppliers (updated_by);
create index if not exists website_content_created_by_idx on public.website_content (created_by);
create index if not exists website_content_updated_by_idx on public.website_content (updated_by);

-- -----------------------------------------------------------------------------
-- Extend audit coverage to all operational records exposed by the dashboard.
-- -----------------------------------------------------------------------------

do $$
declare
  t text;
begin
  foreach t in array array[
    'product_categories', 'product_collections', 'product_collection_items',
    'fragrance_notes', 'product_fragrance_notes', 'related_products',
    'inventory_locations', 'product_location_inventory', 'product_stock_movements',
    'ingredient_lots', 'ingredient_stock_movements', 'purchase_order_items', 'documents',
    'formula_versions', 'formula_items', 'production_consumptions',
    'product_cost_snapshots', 'finance_accounts', 'finance_categories',
    'finance_transaction_lines', 'marketing_segments', 'marketing_campaign_products',
    'marketing_events', 'marketing_partners', 'marketing_content_items',
    'abandoned_carts', 'customer_requests', 'product_reviews', 'gift_cards',
    'subscriptions', 'order_returns', 'order_refunds', 'shipping_methods',
    'tax_rates', 'notifications', 'preorders', 'data_exports'
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
