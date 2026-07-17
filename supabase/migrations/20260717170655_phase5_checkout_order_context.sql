-- Phase 5 checkout hardening: keep WhatsApp checkout as the launch path, but
-- capture enough structured order context for real admin follow-up.

alter table public.orders
  add column if not exists customer_email text,
  add column if not exists customer_city text,
  add column if not exists customer_address text,
  add column if not exists source_route text;

create index if not exists orders_status_created_idx on public.orders (status, created_at desc);
create index if not exists orders_channel_created_idx on public.orders (channel, created_at desc);
create index if not exists orders_customer_phone_idx on public.orders (customer_phone) where customer_phone is not null;

create or replace function public.submit_storefront_order(
  p_order_no text,
  p_type text,
  p_customer_name text,
  p_customer_phone text,
  p_customer_email text,
  p_customer_city text,
  p_customer_address text,
  p_source_route text,
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
     or length(coalesce(p_customer_email, '')) > 254
     or length(coalesce(p_customer_city, '')) > 120
     or length(coalesce(p_customer_address, '')) > 500
     or length(coalesce(p_source_route, '')) > 160
     or length(coalesce(p_note, '')) > 3000 then
    raise exception 'Order contact details exceed the allowed length';
  end if;
  if coalesce(p_customer_email, '') <> ''
     and trim(p_customer_email) !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'Invalid customer email';
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
    order_no, customer_id, customer_name, customer_phone, customer_email,
    customer_city, customer_address, source_route, type, status, channel,
    subtotal, vat, total, currency, note
  ) values (
    upper(trim(p_order_no)), v_customer_id, nullif(trim(p_customer_name), ''),
    nullif(trim(p_customer_phone), ''), nullif(lower(trim(p_customer_email)), ''),
    nullif(trim(p_customer_city), ''), nullif(trim(p_customer_address), ''),
    nullif(trim(p_source_route), ''), p_type, 'awaiting_confirmation', 'web',
    v_subtotal, v_vat, v_total, 'SAR', nullif(trim(p_note), '')
  ) returning * into v_order;

  insert into public.order_items (order_id, product_id, name_en, size, qty, unit_price)
  select v_order.id, i.product_id, i.name_en, i.size, i.qty, i.unit_price
  from jsonb_to_recordset(v_validated_items) as i(
    product_id text, name_en text, size text, qty integer, unit_price numeric(14,2)
  );

  return jsonb_build_object(
    'id', v_order.id,
    'order_no', v_order.order_no,
    'status', v_order.status,
    'channel', v_order.channel,
    'subtotal', v_subtotal,
    'vat', v_vat,
    'total', v_total,
    'currency', 'SAR',
    'items', v_validated_items
  );
end;
$$;

revoke all on function public.submit_storefront_order(
  text, text, text, text, text, text, text, text, text, jsonb
) from public;
grant execute on function public.submit_storefront_order(
  text, text, text, text, text, text, text, text, text, jsonb
) to anon, authenticated;

comment on function public.submit_storefront_order(
  text, text, text, text, text, text, text, text, text, jsonb
) is 'Creates a WhatsApp-first storefront order with server-priced items, VAT totals, and structured customer delivery context.';
