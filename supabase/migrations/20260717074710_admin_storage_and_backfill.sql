-- ASMR & SAMR storage policies and real-data backfill from the existing catalog.

-- -----------------------------------------------------------------------------
-- Storage buckets
-- -----------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  (
    'product-images',
    'product-images',
    true,
    8388608,
    array['image/jpeg', 'image/png', 'image/webp', 'image/avif']
  ),
  (
    'admin-documents',
    'admin-documents',
    false,
    15728640,
    array[
      'application/pdf',
      'image/jpeg',
      'image/png',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ]
  ),
  (
    'marketing-assets',
    'marketing-assets',
    true,
    15728640,
    array['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'application/pdf', 'video/mp4']
  )
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists product_images_public_read on storage.objects;
create policy product_images_public_read on storage.objects
for select to anon, authenticated
using (bucket_id = 'product-images');

drop policy if exists product_images_staff_insert on storage.objects;
create policy product_images_staff_insert on storage.objects
for insert to authenticated
with check (bucket_id = 'product-images' and (select private.has_permission('products.write')));

drop policy if exists product_images_staff_update on storage.objects;
create policy product_images_staff_update on storage.objects
for update to authenticated
using (bucket_id = 'product-images' and (select private.has_permission('products.write')))
with check (bucket_id = 'product-images' and (select private.has_permission('products.write')));

drop policy if exists product_images_staff_delete on storage.objects;
create policy product_images_staff_delete on storage.objects
for delete to authenticated
using (bucket_id = 'product-images' and (select private.has_permission('products.write')));

drop policy if exists marketing_assets_public_read on storage.objects;
create policy marketing_assets_public_read on storage.objects
for select to anon, authenticated
using (bucket_id = 'marketing-assets');

drop policy if exists marketing_assets_staff_insert on storage.objects;
create policy marketing_assets_staff_insert on storage.objects
for insert to authenticated
with check (bucket_id = 'marketing-assets' and (select private.has_permission('marketing.write')));

drop policy if exists marketing_assets_staff_update on storage.objects;
create policy marketing_assets_staff_update on storage.objects
for update to authenticated
using (bucket_id = 'marketing-assets' and (select private.has_permission('marketing.write')))
with check (bucket_id = 'marketing-assets' and (select private.has_permission('marketing.write')));

drop policy if exists marketing_assets_staff_delete on storage.objects;
create policy marketing_assets_staff_delete on storage.objects
for delete to authenticated
using (bucket_id = 'marketing-assets' and (select private.has_permission('marketing.write')));

drop policy if exists admin_documents_staff_read on storage.objects;
create policy admin_documents_staff_read on storage.objects
for select to authenticated
using (
  bucket_id = 'admin-documents'
  and (
    (select private.has_permission('ingredients.read'))
    or (select private.has_permission('production.read'))
    or (select private.has_permission('finance.read'))
    or (select private.has_permission('marketing.read'))
    or (select private.is_admin())
  )
);

drop policy if exists admin_documents_staff_insert on storage.objects;
create policy admin_documents_staff_insert on storage.objects
for insert to authenticated
with check (
  bucket_id = 'admin-documents'
  and (
    (select private.has_permission('ingredients.write'))
    or (select private.has_permission('production.write'))
    or (select private.has_permission('finance.write'))
    or (select private.has_permission('marketing.write'))
    or (select private.is_admin())
  )
);

drop policy if exists admin_documents_staff_update on storage.objects;
create policy admin_documents_staff_update on storage.objects
for update to authenticated
using (
  bucket_id = 'admin-documents'
  and (
    (select private.has_permission('ingredients.write'))
    or (select private.has_permission('production.write'))
    or (select private.has_permission('finance.write'))
    or (select private.has_permission('marketing.write'))
    or (select private.is_admin())
  )
)
with check (
  bucket_id = 'admin-documents'
  and (
    (select private.has_permission('ingredients.write'))
    or (select private.has_permission('production.write'))
    or (select private.has_permission('finance.write'))
    or (select private.has_permission('marketing.write'))
    or (select private.is_admin())
  )
);

drop policy if exists admin_documents_staff_delete on storage.objects;
create policy admin_documents_staff_delete on storage.objects
for delete to authenticated
using (
  bucket_id = 'admin-documents'
  and (
    (select private.has_permission('ingredients.write'))
    or (select private.has_permission('production.write'))
    or (select private.has_permission('finance.write'))
    or (select private.has_permission('marketing.write'))
    or (select private.is_admin())
  )
);

-- -----------------------------------------------------------------------------
-- Backfill normalized product records from existing production catalog rows
-- -----------------------------------------------------------------------------

insert into public.product_categories (name_en, slug, description, is_active)
select distinct
  initcap(replace(p.type, '_', ' ')),
  regexp_replace(lower(p.type), '[^a-z0-9]+', '-', 'g'),
  'Derived from the existing ASMR & SAMR catalog.',
  true
from public.products p
where p.type is not null
on conflict (slug) do nothing;

update public.products p
set category_id = c.id
from public.product_categories c
where c.slug = regexp_replace(lower(p.type), '[^a-z0-9]+', '-', 'g')
  and p.category_id is null;

insert into public.product_collections (name_en, slug, description, is_active)
select distinct
  p.brand,
  regexp_replace(lower(p.brand), '[^a-z0-9]+', '-', 'g'),
  'Derived from the existing ASMR & SAMR brand catalog.',
  true
from public.products p
where p.brand is not null
on conflict (slug) do nothing;

insert into public.product_collection_items (collection_id, product_id, sort_order)
select c.id, p.id, p.sort_order
from public.products p
join public.product_collections c
  on c.slug = regexp_replace(lower(p.brand), '[^a-z0-9]+', '-', 'g')
on conflict do nothing;

update public.products p
set
  status = case when p.is_active then 'published' else 'unpublished' end,
  published_at = case when p.is_active then coalesce(p.published_at, p.created_at) else p.published_at end,
  availability = case
    when coalesce(pi.stock, 0) <= 0 then 'out_of_stock'
    when coalesce(pi.stock, 0) <= coalesce(pi.low_stock_at, 0) then 'low_stock'
    else 'in_stock'
  end,
  gender_identity = case
    when p.brand = 'SAMR' then 'for_her'
    when p.brand = 'ASMR' then 'for_him'
    else 'duo'
  end,
  concentration = case
    when p.type = 'extrait' then 'Extrait de Parfum'
    when p.type in ('spray', 'mist') then 'Body Mist'
    when p.type = 'cream' then 'Perfumed Cream'
    else p.concentration
  end
from public.product_inventory pi
where pi.product_id = p.id;

insert into public.product_variants (
  product_id, name, size, concentration, price, cost, tax_rate,
  stock, low_stock_at, is_default, is_active, sort_order
)
select
  pp.product_id,
  pp.size,
  pp.size,
  p.concentration,
  pp.price,
  p.cost,
  p.tax_rate,
  case when pp.size = p.hero_size then coalesce(pi.stock, 0) else 0 end,
  case when pp.size = p.hero_size then coalesce(pi.low_stock_at, 0) else 0 end,
  pp.size = p.hero_size,
  p.is_active,
  row_number() over (partition by pp.product_id order by (pp.size = p.hero_size) desc, pp.size)
from public.product_prices pp
join public.products p on p.id = pp.product_id
left join public.product_inventory pi on pi.product_id = p.id
on conflict do nothing;

insert into public.product_images (
  product_id, storage_bucket, storage_path, public_url, fallback_url,
  alt_text, mime_type, is_primary, sort_order
)
select
  p.id,
  'legacy-assets',
  coalesce(nullif(p.image_webp, ''), p.image_png),
  coalesce(nullif(p.image_webp, ''), p.image_png),
  nullif(p.image_png, ''),
  p.name_en || ' product photograph',
  case when nullif(p.image_webp, '') is not null then 'image/webp' else 'image/png' end,
  true,
  0
from public.products p
where coalesce(nullif(p.image_webp, ''), nullif(p.image_png, '')) is not null
on conflict (storage_bucket, storage_path) do nothing;

insert into public.inventory_locations (name, code, is_active, is_default)
values ('Main Inventory', 'MAIN', true, true)
on conflict (code) do update set is_active = true, is_default = true, updated_at = now();

insert into public.product_location_inventory (
  product_id, location_id, stock, reserved, low_stock_at
)
select pi.product_id, l.id, pi.stock, 0, pi.low_stock_at
from public.product_inventory pi
cross join lateral (
  select id from public.inventory_locations where code = 'MAIN' limit 1
) l
on conflict (product_id, location_id) do update set
  stock = excluded.stock,
  low_stock_at = excluded.low_stock_at,
  updated_at = now();

insert into public.product_stock_movements (
  product_id, to_location_id, movement_type, quantity_delta, resulting_stock,
  reason, reference_type, reference_id
)
select
  pi.product_id,
  l.id,
  'initial',
  pi.stock,
  pi.stock,
  'Initial balance migrated from product_inventory',
  'schema_migration',
  '20260717074710'
from public.product_inventory pi
cross join lateral (
  select id from public.inventory_locations where code = 'MAIN' limit 1
) l
where pi.stock <> 0
  and not exists (
    select 1 from public.product_stock_movements m
    where m.product_id = pi.product_id
      and m.reference_type = 'schema_migration'
      and m.reference_id = '20260717074710'
  );

-- Operational chart of accounts and categories. These are system configuration,
-- not transaction or sample data.
insert into public.finance_accounts (code, name, account_type, currency) values
  ('1000', 'Cash', 'asset', 'SAR'),
  ('1010', 'Bank', 'asset', 'SAR'),
  ('1100', 'Accounts Receivable', 'asset', 'SAR'),
  ('1200', 'Product Inventory', 'asset', 'SAR'),
  ('1210', 'Ingredient Inventory', 'asset', 'SAR'),
  ('2000', 'Accounts Payable', 'liability', 'SAR'),
  ('2100', 'VAT Payable', 'liability', 'SAR'),
  ('3000', 'Owner Equity', 'equity', 'SAR'),
  ('4000', 'Product Sales', 'income', 'SAR'),
  ('5000', 'Cost of Goods Sold', 'cogs', 'SAR'),
  ('6000', 'Operating Expenses', 'expense', 'SAR'),
  ('6100', 'Marketing Expenses', 'expense', 'SAR'),
  ('6200', 'Shipping Expenses', 'expense', 'SAR')
on conflict (code) do update set name = excluded.name, account_type = excluded.account_type, is_active = true, updated_at = now();

insert into public.finance_categories (name, kind) values
  ('Product sales', 'income'),
  ('Customer payments', 'income'),
  ('Supplier purchases', 'expense'),
  ('Packaging', 'expense'),
  ('Shipping', 'expense'),
  ('Marketing', 'expense'),
  ('Operating expenses', 'expense'),
  ('Cost of goods sold', 'cogs'),
  ('VAT', 'tax'),
  ('Customer refunds', 'refund')
on conflict (name, kind) do update set is_active = true;

insert into public.tax_rates (name, country, rate, is_active, effective_from)
select 'Saudi VAT', 'Saudi Arabia', 0.15, true, current_date
where not exists (
  select 1 from public.tax_rates where name = 'Saudi VAT' and is_active
);
