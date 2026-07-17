-- Phase 6: surface safe storefront stock status and enforce inventory at
-- checkout persistence time without exposing protected inventory tables.

create or replace function public.get_storefront_catalog()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'products', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', p.id,
          'brand', p.brand,
          'type', p.type,
          'name_en', p.name_en,
          'name_ar', p.name_ar,
          'family_en', p.family_en,
          'family_ar', p.family_ar,
          'desc_en', p.desc_en,
          'desc_ar', p.desc_ar,
          'hero_size', p.hero_size,
          'featured_on_home', p.featured_on_home,
          'sort_order', p.sort_order,
          'image_webp', p.image_webp,
          'image_png', p.image_png,
          'badge_en', p.badge_en,
          'badge_ar', p.badge_ar,
          'gender_identity', p.gender_identity,
          'concentration', p.concentration,
          'availability', p.availability,
          'stock_status', case
            when p.availability in ('out_of_stock', 'discontinued') then 'out_of_stock'
            when coalesce(pi.stock, 0) <= 0 then 'out_of_stock'
            when coalesce(pi.stock, 0) <= coalesce(pi.low_stock_at, 0) then 'low_stock'
            else 'in_stock'
          end,
          'can_checkout', (
            p.availability not in ('out_of_stock', 'discontinued')
            and coalesce(pi.stock, 0) > 0
          ),
          'max_order_quantity', least(greatest(floor(coalesce(pi.stock, 0)), 0), 12)::integer,
          'status', p.status,
          'published_at', p.published_at,
          'scent_profile', p.scent_profile,
          'who_it_is_for', p.who_it_is_for,
          'how_to_wear', p.how_to_wear,
          'longevity', p.longevity,
          'gift_ready_message', p.gift_ready_message,
          'product_prices', coalesce((
            select jsonb_agg(
              jsonb_build_object('size', pp.size, 'price', pp.price)
              order by pp.size
            )
            from public.product_prices pp
            where pp.product_id = p.id
          ), '[]'::jsonb),
          'product_images', coalesce((
            select jsonb_agg(
              jsonb_build_object(
                'id', pi_img.id,
                'public_url', pi_img.public_url,
                'fallback_url', pi_img.fallback_url,
                'mime_type', pi_img.mime_type,
                'is_primary', pi_img.is_primary,
                'sort_order', pi_img.sort_order,
                'alt_text', pi_img.alt_text
              )
              order by pi_img.sort_order, pi_img.created_at
            )
            from public.product_images pi_img
            where pi_img.product_id = p.id
          ), '[]'::jsonb)
        )
        order by p.sort_order, p.id
      )
      from public.products p
      left join public.product_inventory pi on pi.product_id = p.id
      where p.is_active
        and p.status = 'published'
        and p.deleted_at is null
    ), '[]'::jsonb),
    'fragrance_notes', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'product_id', pfn.product_id,
          'phase', pfn.phase,
          'sort_order', pfn.sort_order,
          'fragrance_notes', jsonb_build_object(
            'name_en', fn.name_en,
            'name_ar', fn.name_ar
          )
        )
        order by p.sort_order, pfn.phase, pfn.sort_order
      )
      from public.product_fragrance_notes pfn
      join public.products p on p.id = pfn.product_id
      join public.fragrance_notes fn on fn.id = pfn.note_id
      where p.is_active
        and p.status = 'published'
        and p.deleted_at is null
    ), '[]'::jsonb),
    'related_products', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'product_id', rp.product_id,
          'related_product_id', rp.related_product_id,
          'relation_type', rp.relation_type,
          'sort_order', rp.sort_order
        )
        order by p.sort_order, rp.sort_order
      )
      from public.related_products rp
      join public.products p on p.id = rp.product_id
      join public.products related on related.id = rp.related_product_id
      where p.is_active
        and p.status = 'published'
        and p.deleted_at is null
        and related.is_active
        and related.status = 'published'
        and related.deleted_at is null
    ), '[]'::jsonb)
  )
$$;

revoke all on function public.get_storefront_catalog() from public, anon, authenticated;
grant execute on function public.get_storefront_catalog() to anon, authenticated;

comment on function public.get_storefront_catalog() is
  'Returns the published storefront catalog with a public-field projection and safe checkout availability status.';

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
  v_available numeric(14,3);
  v_availability text;
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

    select p.name_en, pp.price, coalesce(pi.stock, 0), p.availability
    into v_name, v_price, v_available, v_availability
    from public.products p
    join public.product_prices pp on pp.product_id = p.id and pp.size = v_size
    left join public.product_inventory pi on pi.product_id = p.id
    where p.id = v_product_id
      and p.is_active
      and p.status = 'published'
      and p.deleted_at is null;
    if not found then
      raise exception 'Product or size is not currently available';
    end if;
    if v_availability in ('out_of_stock', 'discontinued') or v_available <= 0 then
      raise exception 'Product is out of stock';
    end if;
    if v_available < v_qty then
      raise exception 'Requested quantity exceeds available stock';
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
  v_available numeric(14,3);
  v_availability text;
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

    select p.name_en, pp.price, coalesce(pi.stock, 0), p.availability
    into v_name, v_price, v_available, v_availability
    from public.products p
    join public.product_prices pp on pp.product_id = p.id and pp.size = v_size
    left join public.product_inventory pi on pi.product_id = p.id
    where p.id = v_product_id
      and p.is_active
      and p.status = 'published'
      and p.deleted_at is null;
    if not found then
      raise exception 'Product or size is not currently available';
    end if;
    if v_availability in ('out_of_stock', 'discontinued') or v_available <= 0 then
      raise exception 'Product is out of stock';
    end if;
    if v_available < v_qty then
      raise exception 'Requested quantity exceeds available stock';
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

comment on function public.submit_storefront_order(text, text, text, text, text, jsonb) is
  'Creates a WhatsApp-first storefront order with server-priced items, VAT totals, and inventory availability checks.';
comment on function public.submit_storefront_order(
  text, text, text, text, text, text, text, text, text, jsonb
) is 'Creates a WhatsApp-first storefront order with server-priced items, VAT totals, structured customer delivery context, and inventory availability checks.';
