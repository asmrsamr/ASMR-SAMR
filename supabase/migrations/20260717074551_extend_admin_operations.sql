-- ASMR & SAMR operational data model.
-- This migration extends the existing storefront schema; it does not replace it.

create extension if not exists pgcrypto with schema extensions;
create schema if not exists private;
revoke all on schema private from public;

-- -----------------------------------------------------------------------------
-- Roles, profiles, and permissions
-- -----------------------------------------------------------------------------

create table public.app_roles (
  name text primary key,
  label text not null,
  description text,
  is_system boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.role_permissions (
  role_name text not null references public.app_roles(name) on delete cascade,
  permission text not null,
  created_at timestamptz not null default now(),
  primary key (role_name, permission)
);

insert into public.app_roles (name, label, description, is_system) values
  ('admin', 'Administrator', 'Full business administration access.', true),
  ('manager', 'Manager', 'Operational oversight without security-key administration.', true),
  ('finance', 'Finance', 'Ledger, payments, costing, budgets, and financial reports.', true),
  ('marketing', 'Marketing', 'Campaigns, promotions, audiences, and content planning.', true),
  ('inventory', 'Inventory', 'Products, stock, ingredients, suppliers, and purchasing.', true),
  ('production', 'Production', 'Formulas, batches, consumption, and quality control.', true),
  ('support', 'Support', 'Customers, orders, consultations, returns, and notifications.', true),
  ('customer', 'Customer', 'Storefront customer account.', true)
on conflict (name) do update set
  label = excluded.label,
  description = excluded.description,
  is_system = excluded.is_system,
  updated_at = now();

insert into public.role_permissions (role_name, permission) values
  ('manager', 'dashboard.read'),
  ('manager', 'products.read'), ('manager', 'products.write'),
  ('manager', 'inventory.read'), ('manager', 'inventory.write'),
  ('manager', 'ingredients.read'), ('manager', 'ingredients.write'),
  ('manager', 'production.read'), ('manager', 'production.write'),
  ('manager', 'orders.read'), ('manager', 'orders.write'),
  ('manager', 'customers.read'), ('manager', 'customers.write'),
  ('manager', 'marketing.read'), ('manager', 'marketing.write'),
  ('manager', 'reports.read'), ('manager', 'exports.run'),
  ('finance', 'dashboard.read'), ('finance', 'finance.read'), ('finance', 'finance.write'),
  ('finance', 'finance.post'), ('finance', 'costing.read'), ('finance', 'costing.write'),
  ('finance', 'reports.read'), ('finance', 'exports.run'),
  ('marketing', 'dashboard.read'), ('marketing', 'products.read'),
  ('marketing', 'customers.read'), ('marketing', 'marketing.read'), ('marketing', 'marketing.write'),
  ('marketing', 'content.read'), ('marketing', 'content.write'), ('marketing', 'exports.run'),
  ('inventory', 'dashboard.read'), ('inventory', 'products.read'), ('inventory', 'products.write'),
  ('inventory', 'inventory.read'), ('inventory', 'inventory.write'),
  ('inventory', 'ingredients.read'), ('inventory', 'ingredients.write'),
  ('inventory', 'purchasing.read'), ('inventory', 'purchasing.write'), ('inventory', 'exports.run'),
  ('production', 'dashboard.read'), ('production', 'ingredients.read'),
  ('production', 'inventory.read'), ('production', 'production.read'), ('production', 'production.write'),
  ('production', 'costing.read'), ('production', 'exports.run'),
  ('support', 'dashboard.read'), ('support', 'orders.read'), ('support', 'orders.write'),
  ('support', 'customers.read'), ('support', 'customers.write'),
  ('support', 'notifications.read'), ('support', 'notifications.write'), ('support', 'exports.run')
on conflict do nothing;

alter table public.profiles
  add column if not exists status text not null default 'active',
  add column if not exists membership_tier text not null default 'ivory',
  add column if not exists notes text,
  add column if not exists tags text[] not null default '{}',
  add column if not exists consent jsonb not null default '{}'::jsonb,
  add column if not exists last_login_at timestamptz,
  add column if not exists last_activity_at timestamptz,
  add column if not exists updated_at timestamptz not null default now(),
  add column if not exists anonymized_at timestamptz;

alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles drop constraint if exists profiles_status_check;
alter table public.profiles drop constraint if exists profiles_membership_tier_check;
alter table public.profiles
  add constraint profiles_role_check check (role in ('customer', 'admin', 'manager', 'finance', 'marketing', 'inventory', 'production', 'support')),
  add constraint profiles_status_check check (status in ('invited', 'active', 'inactive', 'suspended', 'anonymized')),
  add constraint profiles_membership_tier_check check (membership_tier in ('ivory', 'amber', 'signature'));

create table public.user_addresses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  label text,
  recipient_name text,
  phone text,
  country text not null default 'Saudi Arabia',
  city text,
  district text,
  street text,
  postal_code text,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index user_addresses_one_default_idx
  on public.user_addresses (user_id) where is_default;
create index user_addresses_user_id_idx on public.user_addresses (user_id);

create table public.reward_adjustments (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles(id) on delete restrict,
  points_delta integer not null check (points_delta <> 0),
  reason text not null,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create index reward_adjustments_user_id_created_idx on public.reward_adjustments (user_id, created_at desc);

create table public.wishlist_items (
  user_id uuid not null references public.profiles(id) on delete cascade,
  product_id text not null references public.products(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, product_id)
);
create index wishlist_items_product_id_idx on public.wishlist_items (product_id);

create table public.user_activity (
  id bigint generated always as identity primary key,
  user_id uuid references public.profiles(id) on delete set null,
  event_type text not null,
  description text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index user_activity_user_created_idx on public.user_activity (user_id, created_at desc);

-- -----------------------------------------------------------------------------
-- Product catalog, media, and inventory
-- -----------------------------------------------------------------------------

create table public.product_categories (
  id uuid primary key default gen_random_uuid(),
  name_en text not null,
  name_ar text,
  slug text not null unique,
  description text,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz
);

create table public.product_collections (
  id uuid primary key default gen_random_uuid(),
  name_en text not null,
  name_ar text,
  slug text not null unique,
  description text,
  is_active boolean not null default true,
  starts_at timestamptz,
  ends_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz
);

alter table public.products
  add column if not exists category_id uuid references public.product_categories(id) on delete set null,
  add column if not exists gender_identity text not null default 'unisex',
  add column if not exists concentration text,
  add column if not exists sku text,
  add column if not exists barcode text,
  add column if not exists cost numeric(12,2) not null default 0,
  add column if not exists tax_rate numeric(7,4) not null default 0.15,
  add column if not exists discount_type text,
  add column if not exists discount_value numeric(12,2) not null default 0,
  add column if not exists availability text not null default 'in_stock',
  add column if not exists status text not null default 'draft',
  add column if not exists notes text,
  add column if not exists ingredients_summary text,
  add column if not exists seo_title text,
  add column if not exists seo_description text,
  add column if not exists published_at timestamptz,
  add column if not exists archived_at timestamptz,
  add column if not exists deleted_at timestamptz,
  add column if not exists created_by uuid references public.profiles(id) on delete set null,
  add column if not exists updated_by uuid references public.profiles(id) on delete set null;

alter table public.products drop constraint if exists products_type_check;
alter table public.products drop constraint if exists products_gender_identity_check;
alter table public.products drop constraint if exists products_availability_check;
alter table public.products drop constraint if exists products_status_check;
alter table public.products drop constraint if exists products_discount_type_check;
alter table public.products
  add constraint products_type_check check (type in ('extrait', 'edp', 'edt', 'spray', 'mist', 'cream', 'wash', 'set', 'sets', 'sample', 'gift_card')),
  add constraint products_gender_identity_check check (gender_identity in ('for_her', 'for_him', 'unisex', 'duo')),
  add constraint products_availability_check check (availability in ('in_stock', 'low_stock', 'out_of_stock', 'preorder', 'discontinued')),
  add constraint products_status_check check (status in ('draft', 'published', 'unpublished', 'archived')),
  add constraint products_discount_type_check check (discount_type is null or discount_type in ('percent', 'fixed')),
  add constraint products_cost_check check (cost >= 0 and tax_rate >= 0 and discount_value >= 0);

create unique index products_sku_active_idx on public.products (sku) where sku is not null and deleted_at is null;
create unique index products_barcode_active_idx on public.products (barcode) where barcode is not null and deleted_at is null;
create index products_category_id_idx on public.products (category_id);
create index products_status_sort_idx on public.products (status, sort_order) where deleted_at is null;

create table public.product_collection_items (
  collection_id uuid not null references public.product_collections(id) on delete cascade,
  product_id text not null references public.products(id) on delete cascade,
  sort_order integer not null default 0,
  primary key (collection_id, product_id)
);
create index product_collection_items_product_id_idx on public.product_collection_items (product_id);

create table public.product_variants (
  id uuid primary key default gen_random_uuid(),
  product_id text not null references public.products(id) on delete cascade,
  name text not null,
  size text,
  concentration text,
  sku text,
  barcode text,
  price numeric(12,2) not null default 0 check (price >= 0),
  cost numeric(12,2) not null default 0 check (cost >= 0),
  tax_rate numeric(7,4) not null default 0.15 check (tax_rate >= 0),
  stock numeric(14,3) not null default 0,
  low_stock_at numeric(14,3) not null default 0 check (low_stock_at >= 0),
  is_default boolean not null default false,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz
);
create index product_variants_product_id_idx on public.product_variants (product_id);
create unique index product_variants_sku_active_idx on public.product_variants (sku) where sku is not null and archived_at is null;
create unique index product_variants_barcode_active_idx on public.product_variants (barcode) where barcode is not null and archived_at is null;
create unique index product_variants_one_default_idx on public.product_variants (product_id) where is_default and archived_at is null;
create unique index product_variants_product_size_active_idx on public.product_variants (product_id, size) where size is not null and archived_at is null;

create table public.product_images (
  id uuid primary key default gen_random_uuid(),
  product_id text not null references public.products(id) on delete cascade,
  variant_id uuid references public.product_variants(id) on delete cascade,
  storage_bucket text not null default 'product-images',
  storage_path text not null,
  public_url text,
  fallback_url text,
  alt_text text not null,
  title text,
  mime_type text,
  file_size bigint check (file_size is null or file_size >= 0),
  width integer check (width is null or width > 0),
  height integer check (height is null or height > 0),
  is_primary boolean not null default false,
  sort_order integer not null default 0,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (storage_bucket, storage_path)
);
create index product_images_product_sort_idx on public.product_images (product_id, sort_order);
create index product_images_variant_id_idx on public.product_images (variant_id);
create unique index product_images_one_primary_idx on public.product_images (product_id) where is_primary;

create table public.fragrance_notes (
  id uuid primary key default gen_random_uuid(),
  name_en text not null,
  name_ar text,
  family text,
  description text,
  created_at timestamptz not null default now(),
  unique (name_en)
);

create table public.product_fragrance_notes (
  product_id text not null references public.products(id) on delete cascade,
  note_id uuid not null references public.fragrance_notes(id) on delete restrict,
  phase text not null check (phase in ('top', 'heart', 'base', 'profile')),
  sort_order integer not null default 0,
  primary key (product_id, note_id, phase)
);
create index product_fragrance_notes_note_id_idx on public.product_fragrance_notes (note_id);

create table public.related_products (
  product_id text not null references public.products(id) on delete cascade,
  related_product_id text not null references public.products(id) on delete cascade,
  relation_type text not null default 'paired_with' check (relation_type in ('paired_with', 'alternative', 'accessory', 'layering')),
  sort_order integer not null default 0,
  primary key (product_id, related_product_id, relation_type),
  check (product_id <> related_product_id)
);
create index related_products_related_id_idx on public.related_products (related_product_id);

alter table public.product_inventory
  add column if not exists updated_at timestamptz not null default now(),
  add column if not exists updated_by uuid references public.profiles(id) on delete set null;

create table public.inventory_locations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  code text not null unique,
  address text,
  is_active boolean not null default true,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index inventory_locations_one_default_idx on public.inventory_locations ((is_default)) where is_default;

create table public.product_location_inventory (
  product_id text not null references public.products(id) on delete cascade,
  variant_id uuid references public.product_variants(id) on delete cascade,
  location_id uuid not null references public.inventory_locations(id) on delete restrict,
  stock numeric(14,3) not null default 0,
  reserved numeric(14,3) not null default 0 check (reserved >= 0),
  low_stock_at numeric(14,3) not null default 0 check (low_stock_at >= 0),
  updated_at timestamptz not null default now(),
  primary key (product_id, location_id)
);
create index product_location_inventory_location_idx on public.product_location_inventory (location_id);
create index product_location_inventory_variant_idx on public.product_location_inventory (variant_id);

create table public.product_stock_movements (
  id bigint generated always as identity primary key,
  product_id text not null references public.products(id) on delete restrict,
  variant_id uuid references public.product_variants(id) on delete set null,
  from_location_id uuid references public.inventory_locations(id) on delete restrict,
  to_location_id uuid references public.inventory_locations(id) on delete restrict,
  movement_type text not null check (movement_type in ('initial', 'purchase', 'sale', 'add', 'remove', 'adjustment', 'damaged', 'expired', 'lost', 'sampled', 'returned', 'reserved', 'released', 'transfer', 'production', 'reversal')),
  quantity_delta numeric(14,3) not null check (quantity_delta <> 0),
  resulting_stock numeric(14,3) not null,
  unit_cost numeric(12,4) check (unit_cost is null or unit_cost >= 0),
  reason text not null,
  reference_type text,
  reference_id text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create index product_stock_movements_product_created_idx on public.product_stock_movements (product_id, created_at desc);
create index product_stock_movements_variant_idx on public.product_stock_movements (variant_id);
create index product_stock_movements_from_location_idx on public.product_stock_movements (from_location_id);
create index product_stock_movements_to_location_idx on public.product_stock_movements (to_location_id);

-- -----------------------------------------------------------------------------
-- Ingredients, suppliers, purchasing, and documents
-- -----------------------------------------------------------------------------

create table public.suppliers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  code text not null unique,
  contact_name text,
  email text,
  phone text,
  country text,
  address text,
  payment_terms text,
  status text not null default 'active' check (status in ('active', 'inactive', 'blocked', 'archived')),
  notes text,
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz
);

create table public.ingredients (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  internal_code text not null unique,
  category text not null check (category in ('aroma_chemical', 'essential_oil', 'absolute', 'solvent', 'alcohol', 'carrier', 'preservative', 'packaging_material', 'other')),
  manufacturer text,
  supplier_id uuid references public.suppliers(id) on delete set null,
  supplier_product_code text,
  country_of_origin text,
  quantity_available numeric(16,4) not null default 0,
  unit text not null default 'g',
  minimum_stock numeric(16,4) not null default 0 check (minimum_stock >= 0),
  reorder_quantity numeric(16,4) not null default 0 check (reorder_quantity >= 0),
  unit_cost numeric(14,6) not null default 0 check (unit_cost >= 0),
  storage_location text,
  safety_information text,
  ifra_reference text,
  technical_reference text,
  notes text,
  status text not null default 'active' check (status in ('active', 'inactive', 'quarantined', 'archived')),
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz
);
create index ingredients_supplier_id_idx on public.ingredients (supplier_id);
create index ingredients_low_stock_idx on public.ingredients (quantity_available, minimum_stock) where archived_at is null;

create table public.ingredient_lots (
  id uuid primary key default gen_random_uuid(),
  ingredient_id uuid not null references public.ingredients(id) on delete restrict,
  supplier_id uuid references public.suppliers(id) on delete set null,
  lot_number text not null,
  purchase_date date,
  received_date date,
  expiry_date date,
  retest_date date,
  quantity_received numeric(16,4) not null default 0 check (quantity_received >= 0),
  quantity_available numeric(16,4) not null default 0,
  unit_cost numeric(14,6) not null default 0 check (unit_cost >= 0),
  location_id uuid references public.inventory_locations(id) on delete set null,
  status text not null default 'available' check (status in ('available', 'quarantined', 'released', 'expired', 'consumed', 'returned', 'archived')),
  notes text,
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (ingredient_id, lot_number)
);
create index ingredient_lots_ingredient_id_idx on public.ingredient_lots (ingredient_id);
create index ingredient_lots_supplier_id_idx on public.ingredient_lots (supplier_id);
create index ingredient_lots_location_id_idx on public.ingredient_lots (location_id);
create index ingredient_lots_expiry_idx on public.ingredient_lots (expiry_date) where status in ('available', 'released');

create table public.ingredient_stock_movements (
  id bigint generated always as identity primary key,
  ingredient_id uuid not null references public.ingredients(id) on delete restrict,
  lot_id uuid references public.ingredient_lots(id) on delete set null,
  location_id uuid references public.inventory_locations(id) on delete set null,
  movement_type text not null check (movement_type in ('initial', 'purchase', 'consume', 'correction', 'waste', 'damage', 'sample', 'trial', 'return', 'transfer', 'production', 'reversal')),
  quantity_delta numeric(16,4) not null check (quantity_delta <> 0),
  resulting_quantity numeric(16,4) not null,
  unit_cost numeric(14,6) check (unit_cost is null or unit_cost >= 0),
  reason text not null,
  reference_type text,
  reference_id text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create index ingredient_stock_movements_ingredient_created_idx on public.ingredient_stock_movements (ingredient_id, created_at desc);
create index ingredient_stock_movements_lot_id_idx on public.ingredient_stock_movements (lot_id);
create index ingredient_stock_movements_location_id_idx on public.ingredient_stock_movements (location_id);

create table public.purchase_orders (
  id uuid primary key default gen_random_uuid(),
  order_number text not null unique,
  supplier_id uuid not null references public.suppliers(id) on delete restrict,
  status text not null default 'draft' check (status in ('draft', 'submitted', 'approved', 'partially_received', 'received', 'cancelled')),
  order_date date not null default current_date,
  expected_date date,
  currency text not null default 'SAR',
  subtotal numeric(14,2) not null default 0 check (subtotal >= 0),
  tax numeric(14,2) not null default 0 check (tax >= 0),
  shipping numeric(14,2) not null default 0 check (shipping >= 0),
  total numeric(14,2) not null default 0 check (total >= 0),
  notes text,
  created_by uuid references public.profiles(id) on delete set null,
  approved_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index purchase_orders_supplier_id_idx on public.purchase_orders (supplier_id);
create index purchase_orders_status_date_idx on public.purchase_orders (status, order_date desc);

create table public.purchase_order_items (
  id bigint generated always as identity primary key,
  purchase_order_id uuid not null references public.purchase_orders(id) on delete cascade,
  ingredient_id uuid references public.ingredients(id) on delete restrict,
  description text,
  quantity numeric(16,4) not null check (quantity > 0),
  unit text not null,
  unit_cost numeric(14,6) not null check (unit_cost >= 0),
  tax_rate numeric(7,4) not null default 0 check (tax_rate >= 0),
  received_quantity numeric(16,4) not null default 0 check (received_quantity >= 0 and received_quantity <= quantity)
);
create index purchase_order_items_po_id_idx on public.purchase_order_items (purchase_order_id);
create index purchase_order_items_ingredient_id_idx on public.purchase_order_items (ingredient_id);

create table public.documents (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null,
  entity_id text not null,
  document_type text not null,
  title text not null,
  storage_bucket text not null default 'admin-documents',
  storage_path text not null,
  mime_type text,
  file_size bigint check (file_size is null or file_size >= 0),
  expires_at date,
  uploaded_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (storage_bucket, storage_path)
);
create index documents_entity_idx on public.documents (entity_type, entity_id);
create index documents_expires_at_idx on public.documents (expires_at) where expires_at is not null;

-- -----------------------------------------------------------------------------
-- Formula, production, and costing
-- -----------------------------------------------------------------------------

create table public.formulas (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  product_id text references public.products(id) on delete set null,
  description text,
  status text not null default 'draft' check (status in ('draft', 'trial', 'approved', 'retired', 'archived')),
  is_sensitive boolean not null default true,
  current_version_id uuid,
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz
);
create index formulas_product_id_idx on public.formulas (product_id);

create table public.formula_versions (
  id uuid primary key default gen_random_uuid(),
  formula_id uuid not null references public.formulas(id) on delete restrict,
  version_number integer not null check (version_number > 0),
  reference_batch_size numeric(16,4) not null check (reference_batch_size > 0),
  unit text not null default 'g',
  concentration text,
  total_percentage numeric(8,4) not null default 100 check (total_percentage > 0 and total_percentage <= 100),
  status text not null default 'draft' check (status in ('draft', 'trial', 'approved', 'superseded', 'rejected')),
  change_notes text,
  approved_by uuid references public.profiles(id) on delete set null,
  approved_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (formula_id, version_number)
);
create index formula_versions_formula_id_idx on public.formula_versions (formula_id);

alter table public.formulas
  add constraint formulas_current_version_id_fkey foreign key (current_version_id) references public.formula_versions(id) on delete set null;

create table public.formula_items (
  id bigint generated always as identity primary key,
  formula_version_id uuid not null references public.formula_versions(id) on delete cascade,
  ingredient_id uuid not null references public.ingredients(id) on delete restrict,
  percentage numeric(9,6) not null check (percentage > 0 and percentage <= 100),
  quantity_per_batch numeric(16,6) not null check (quantity_per_batch > 0),
  sort_order integer not null default 0,
  notes text,
  unique (formula_version_id, ingredient_id)
);
create index formula_items_ingredient_id_idx on public.formula_items (ingredient_id);

create table public.production_batches (
  id uuid primary key default gen_random_uuid(),
  batch_number text not null unique,
  formula_version_id uuid not null references public.formula_versions(id) on delete restrict,
  product_id text references public.products(id) on delete set null,
  status text not null default 'planned' check (status in ('planned', 'trial', 'confirmed', 'macerating', 'quality_control', 'released', 'completed', 'cancelled', 'corrected')),
  batch_size numeric(16,4) not null check (batch_size > 0),
  unit text not null default 'g',
  planned_bottles integer check (planned_bottles is null or planned_bottles > 0),
  production_date date,
  maceration_start_date date,
  maceration_end_date date,
  actual_yield numeric(16,4) check (actual_yield is null or actual_yield >= 0),
  wastage numeric(16,4) not null default 0 check (wastage >= 0),
  ingredient_cost numeric(14,2) not null default 0 check (ingredient_cost >= 0),
  packaging_cost numeric(14,2) not null default 0 check (packaging_cost >= 0),
  labor_cost numeric(14,2) not null default 0 check (labor_cost >= 0),
  operational_cost numeric(14,2) not null default 0 check (operational_cost >= 0),
  total_cost numeric(14,2) not null default 0 check (total_cost >= 0),
  cost_per_bottle numeric(14,4) not null default 0 check (cost_per_bottle >= 0),
  quality_control_notes text,
  override_negative_stock boolean not null default false,
  confirmed_by uuid references public.profiles(id) on delete set null,
  confirmed_at timestamptz,
  cancellation_reason text,
  cancelled_by uuid references public.profiles(id) on delete set null,
  cancelled_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index production_batches_formula_version_idx on public.production_batches (formula_version_id);
create index production_batches_product_id_idx on public.production_batches (product_id);
create index production_batches_status_date_idx on public.production_batches (status, production_date desc);

create table public.production_consumptions (
  id bigint generated always as identity primary key,
  production_batch_id uuid not null references public.production_batches(id) on delete restrict,
  ingredient_id uuid not null references public.ingredients(id) on delete restrict,
  ingredient_lot_id uuid references public.ingredient_lots(id) on delete set null,
  planned_quantity numeric(16,6) not null check (planned_quantity > 0),
  actual_quantity numeric(16,6) not null check (actual_quantity > 0),
  unit_cost numeric(14,6) not null check (unit_cost >= 0),
  total_cost numeric(14,4) not null check (total_cost >= 0),
  created_at timestamptz not null default now(),
  unique (production_batch_id, ingredient_id, ingredient_lot_id)
);
create index production_consumptions_ingredient_id_idx on public.production_consumptions (ingredient_id);
create index production_consumptions_lot_id_idx on public.production_consumptions (ingredient_lot_id);

create table public.product_cost_components (
  id uuid primary key default gen_random_uuid(),
  product_id text not null references public.products(id) on delete cascade,
  variant_id uuid references public.product_variants(id) on delete cascade,
  component_type text not null check (component_type in ('ingredient', 'packaging', 'bottle', 'cap', 'label', 'box', 'filling', 'labor', 'shipping', 'marketing', 'payment_fee', 'tax', 'other')),
  name text not null,
  amount numeric(14,4) not null check (amount >= 0),
  allocation_method text not null default 'per_unit' check (allocation_method in ('per_unit', 'per_batch', 'percent_revenue')),
  effective_from date not null default current_date,
  effective_to date,
  supplier_id uuid references public.suppliers(id) on delete set null,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (effective_to is null or effective_to >= effective_from)
);
create index product_cost_components_product_effective_idx on public.product_cost_components (product_id, effective_from desc);
create index product_cost_components_variant_id_idx on public.product_cost_components (variant_id);
create index product_cost_components_supplier_id_idx on public.product_cost_components (supplier_id);

create table public.product_cost_snapshots (
  id bigint generated always as identity primary key,
  product_id text not null references public.products(id) on delete restrict,
  variant_id uuid references public.product_variants(id) on delete set null,
  production_batch_id uuid references public.production_batches(id) on delete set null,
  ingredient_cost numeric(14,4) not null default 0,
  packaging_cost numeric(14,4) not null default 0,
  labor_cost numeric(14,4) not null default 0,
  shipping_cost numeric(14,4) not null default 0,
  marketing_cost numeric(14,4) not null default 0,
  payment_fee numeric(14,4) not null default 0,
  tax_cost numeric(14,4) not null default 0,
  total_cost numeric(14,4) not null default 0,
  cost_per_unit numeric(14,4) not null default 0,
  selling_price numeric(14,2) not null default 0,
  wholesale_margin numeric(9,4),
  retail_margin numeric(9,4),
  gross_profit numeric(14,4),
  net_profit_estimate numeric(14,4),
  break_even_price numeric(14,4),
  recommended_price numeric(14,2),
  snapshot_at timestamptz not null default now(),
  created_by uuid references public.profiles(id) on delete set null
);
create index product_cost_snapshots_product_date_idx on public.product_cost_snapshots (product_id, snapshot_at desc);
create index product_cost_snapshots_variant_id_idx on public.product_cost_snapshots (variant_id);
create index product_cost_snapshots_batch_id_idx on public.product_cost_snapshots (production_batch_id);

-- -----------------------------------------------------------------------------
-- Financial ledger
-- -----------------------------------------------------------------------------

create table public.finance_accounts (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  account_type text not null check (account_type in ('asset', 'liability', 'equity', 'income', 'expense', 'cogs')),
  currency text not null default 'SAR',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.finance_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  kind text not null check (kind in ('income', 'expense', 'asset', 'liability', 'cogs', 'tax', 'refund')),
  parent_id uuid references public.finance_categories(id) on delete set null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (name, kind)
);
create index finance_categories_parent_id_idx on public.finance_categories (parent_id);

create table public.finance_transactions (
  id uuid primary key default gen_random_uuid(),
  transaction_number text not null unique,
  transaction_date date not null default current_date,
  type text not null check (type in ('income', 'expense', 'payment', 'receivable', 'payable', 'supplier_payment', 'customer_payment', 'refund', 'tax', 'cogs', 'adjustment', 'reversal')),
  category_id uuid references public.finance_categories(id) on delete set null,
  description text not null,
  amount numeric(16,2) not null check (amount >= 0),
  currency text not null default 'SAR',
  tax_amount numeric(16,2) not null default 0 check (tax_amount >= 0),
  payment_method text,
  payment_status text not null default 'unpaid' check (payment_status in ('unpaid', 'partially_paid', 'paid', 'overdue', 'cancelled', 'refunded')),
  status text not null default 'draft' check (status in ('draft', 'posted', 'reversed', 'cancelled')),
  due_date date,
  paid_date date,
  customer_id uuid references public.profiles(id) on delete set null,
  supplier_id uuid references public.suppliers(id) on delete set null,
  order_id uuid references public.orders(id) on delete set null,
  purchase_order_id uuid references public.purchase_orders(id) on delete set null,
  invoice_reference text,
  receipt_document_id uuid references public.documents(id) on delete set null,
  notes text,
  created_by uuid references public.profiles(id) on delete set null,
  approved_by uuid references public.profiles(id) on delete set null,
  posted_at timestamptz,
  reversed_transaction_id uuid references public.finance_transactions(id) on delete set null,
  reversed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index finance_transactions_date_idx on public.finance_transactions (transaction_date desc);
create index finance_transactions_status_date_idx on public.finance_transactions (status, transaction_date desc);
create index finance_transactions_category_id_idx on public.finance_transactions (category_id);
create index finance_transactions_customer_id_idx on public.finance_transactions (customer_id);
create index finance_transactions_supplier_id_idx on public.finance_transactions (supplier_id);
create index finance_transactions_order_id_idx on public.finance_transactions (order_id);
create index finance_transactions_purchase_order_id_idx on public.finance_transactions (purchase_order_id);
create index finance_transactions_receipt_document_idx on public.finance_transactions (receipt_document_id);
create index finance_transactions_reversed_id_idx on public.finance_transactions (reversed_transaction_id);

create table public.finance_transaction_lines (
  id bigint generated always as identity primary key,
  transaction_id uuid not null references public.finance_transactions(id) on delete cascade,
  account_id uuid not null references public.finance_accounts(id) on delete restrict,
  direction text not null check (direction in ('debit', 'credit')),
  amount numeric(16,2) not null check (amount > 0),
  description text
);
create index finance_transaction_lines_transaction_idx on public.finance_transaction_lines (transaction_id);
create index finance_transaction_lines_account_idx on public.finance_transaction_lines (account_id);

create table public.budgets (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category_id uuid references public.finance_categories(id) on delete set null,
  period_start date not null,
  period_end date not null,
  amount numeric(16,2) not null check (amount >= 0),
  currency text not null default 'SAR',
  notes text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (period_end >= period_start)
);
create index budgets_category_id_idx on public.budgets (category_id);
create index budgets_period_idx on public.budgets (period_start, period_end);

-- -----------------------------------------------------------------------------
-- Marketing, content, and commerce support
-- -----------------------------------------------------------------------------

create table public.marketing_segments (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  description text,
  criteria jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.marketing_campaigns (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  objective text,
  channel text not null check (channel in ('email', 'sms', 'push', 'social', 'influencer', 'referral', 'loyalty', 'gift', 'wishlist', 'abandoned_cart', 'multi_channel')),
  audience text,
  segment_id uuid references public.marketing_segments(id) on delete set null,
  start_at timestamptz,
  end_at timestamptz,
  budget numeric(14,2) not null default 0 check (budget >= 0),
  actual_spend numeric(14,2) not null default 0 check (actual_spend >= 0),
  status text not null default 'draft' check (status in ('draft', 'scheduled', 'active', 'paused', 'completed', 'cancelled')),
  discount_type text,
  discount_value numeric(14,2) not null default 0 check (discount_value >= 0),
  coupon_code text references public.coupons(code) on delete set null,
  revenue numeric(14,2) not null default 0 check (revenue >= 0),
  orders_count integer not null default 0 check (orders_count >= 0),
  conversions integer not null default 0 check (conversions >= 0),
  notes text,
  owner_id uuid references public.profiles(id) on delete set null,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_at is null or start_at is null or end_at >= start_at),
  check (discount_type is null or discount_type in ('percent', 'fixed'))
);
create index marketing_campaigns_segment_id_idx on public.marketing_campaigns (segment_id);
create index marketing_campaigns_status_dates_idx on public.marketing_campaigns (status, start_at, end_at);
create index marketing_campaigns_coupon_code_idx on public.marketing_campaigns (coupon_code);
create index marketing_campaigns_owner_id_idx on public.marketing_campaigns (owner_id);

create table public.marketing_campaign_products (
  campaign_id uuid not null references public.marketing_campaigns(id) on delete cascade,
  product_id text not null references public.products(id) on delete cascade,
  primary key (campaign_id, product_id)
);
create index marketing_campaign_products_product_idx on public.marketing_campaign_products (product_id);

create table public.marketing_events (
  id bigint generated always as identity primary key,
  campaign_id uuid not null references public.marketing_campaigns(id) on delete cascade,
  event_type text not null,
  event_date date not null default current_date,
  value numeric(16,4) not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index marketing_events_campaign_date_idx on public.marketing_events (campaign_id, event_date desc);

create table public.marketing_partners (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  partner_type text not null check (partner_type in ('influencer', 'affiliate', 'retailer', 'agency', 'other')),
  email text,
  phone text,
  social_handle text,
  commission_rate numeric(7,4) not null default 0 check (commission_rate >= 0),
  status text not null default 'active' check (status in ('active', 'inactive', 'archived')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.marketing_content_items (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  channel text not null,
  content_type text not null,
  scheduled_at timestamptz,
  status text not null default 'idea' check (status in ('idea', 'draft', 'review', 'scheduled', 'published', 'archived')),
  campaign_id uuid references public.marketing_campaigns(id) on delete set null,
  owner_id uuid references public.profiles(id) on delete set null,
  notes text,
  attachment_document_id uuid references public.documents(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index marketing_content_campaign_id_idx on public.marketing_content_items (campaign_id);
create index marketing_content_owner_id_idx on public.marketing_content_items (owner_id);
create index marketing_content_document_id_idx on public.marketing_content_items (attachment_document_id);
create index marketing_content_schedule_idx on public.marketing_content_items (scheduled_at) where status = 'scheduled';

create table public.abandoned_carts (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references public.profiles(id) on delete set null,
  email text,
  phone text,
  items jsonb not null default '[]'::jsonb,
  total numeric(14,2) not null default 0,
  currency text not null default 'SAR',
  recovered_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index abandoned_carts_customer_id_idx on public.abandoned_carts (customer_id);
create index abandoned_carts_open_idx on public.abandoned_carts (created_at desc) where recovered_at is null;

create table public.website_content (
  id uuid primary key default gen_random_uuid(),
  content_type text not null check (content_type in ('homepage_banner', 'website_section', 'journal', 'faq', 'policy', 'seo', 'notification', 'page')),
  slug text not null,
  title_en text,
  title_ar text,
  body_en text,
  body_ar text,
  metadata jsonb not null default '{}'::jsonb,
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  sort_order integer not null default 0,
  published_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (content_type, slug)
);
create index website_content_status_sort_idx on public.website_content (status, content_type, sort_order);

create table public.customer_requests (
  id uuid primary key default gen_random_uuid(),
  request_type text not null check (request_type in ('contact', 'consultation', 'engraving', 'personalization', 'support')),
  customer_id uuid references public.profiles(id) on delete set null,
  name text,
  email text,
  phone text,
  subject text,
  message text,
  status text not null default 'new' check (status in ('new', 'assigned', 'in_progress', 'resolved', 'closed', 'cancelled')),
  assigned_to uuid references public.profiles(id) on delete set null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index customer_requests_customer_id_idx on public.customer_requests (customer_id);
create index customer_requests_assigned_to_idx on public.customer_requests (assigned_to);
create index customer_requests_status_created_idx on public.customer_requests (status, created_at desc);

create table public.product_reviews (
  id uuid primary key default gen_random_uuid(),
  product_id text not null references public.products(id) on delete restrict,
  customer_id uuid references public.profiles(id) on delete set null,
  rating integer not null check (rating between 1 and 5),
  title text,
  body text,
  status text not null default 'pending' check (status in ('pending', 'published', 'rejected', 'archived')),
  verified_purchase boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index product_reviews_product_status_idx on public.product_reviews (product_id, status, created_at desc);
create index product_reviews_customer_id_idx on public.product_reviews (customer_id);

create table public.gift_cards (
  id uuid primary key default gen_random_uuid(),
  code_hash text not null unique,
  code_last_four text not null,
  initial_balance numeric(14,2) not null check (initial_balance > 0),
  current_balance numeric(14,2) not null check (current_balance >= 0),
  currency text not null default 'SAR',
  status text not null default 'active' check (status in ('active', 'redeemed', 'expired', 'revoked')),
  purchaser_id uuid references public.profiles(id) on delete set null,
  recipient_email text,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index gift_cards_status_expiry_idx on public.gift_cards (status, expires_at);
create index gift_cards_purchaser_id_idx on public.gift_cards (purchaser_id);

create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.profiles(id) on delete restrict,
  product_id text references public.products(id) on delete restrict,
  status text not null default 'active' check (status in ('active', 'paused', 'cancelled', 'expired')),
  frequency text not null,
  next_order_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  cancelled_at timestamptz
);
create index subscriptions_customer_id_idx on public.subscriptions (customer_id);
create index subscriptions_product_id_idx on public.subscriptions (product_id);
create index subscriptions_next_order_idx on public.subscriptions (next_order_at) where status = 'active';

create table public.order_returns (
  id uuid primary key default gen_random_uuid(),
  return_number text not null unique,
  order_id uuid not null references public.orders(id) on delete restrict,
  customer_id uuid references public.profiles(id) on delete set null,
  status text not null default 'requested' check (status in ('requested', 'approved', 'received', 'rejected', 'completed', 'cancelled')),
  reason text not null,
  notes text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index order_returns_order_id_idx on public.order_returns (order_id);
create index order_returns_customer_id_idx on public.order_returns (customer_id);

create table public.order_refunds (
  id uuid primary key default gen_random_uuid(),
  refund_number text not null unique,
  order_id uuid not null references public.orders(id) on delete restrict,
  return_id uuid references public.order_returns(id) on delete set null,
  payment_id uuid references public.payments(id) on delete set null,
  amount numeric(14,2) not null check (amount > 0),
  currency text not null default 'SAR',
  status text not null default 'pending' check (status in ('pending', 'approved', 'processed', 'failed', 'cancelled')),
  reason text,
  created_by uuid references public.profiles(id) on delete set null,
  approved_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index order_refunds_order_id_idx on public.order_refunds (order_id);
create index order_refunds_return_id_idx on public.order_refunds (return_id);
create index order_refunds_payment_id_idx on public.order_refunds (payment_id);

create table public.shipping_methods (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  code text not null unique,
  price numeric(14,2) not null default 0 check (price >= 0),
  free_over numeric(14,2) check (free_over is null or free_over >= 0),
  regions text[] not null default '{}',
  estimated_days_min integer check (estimated_days_min is null or estimated_days_min >= 0),
  estimated_days_max integer check (estimated_days_max is null or estimated_days_max >= estimated_days_min),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.tax_rates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  country text not null default 'Saudi Arabia',
  region text,
  rate numeric(7,4) not null check (rate >= 0),
  is_active boolean not null default true,
  effective_from date not null default current_date,
  effective_to date,
  created_at timestamptz not null default now(),
  check (effective_to is null or effective_to >= effective_from)
);
create index tax_rates_active_dates_idx on public.tax_rates (is_active, effective_from, effective_to);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade,
  audience_role text,
  type text not null,
  title text not null,
  body text,
  severity text not null default 'info' check (severity in ('info', 'success', 'warning', 'critical')),
  is_read boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  read_at timestamptz
);
create index notifications_user_unread_idx on public.notifications (user_id, created_at desc) where not is_read;
create index notifications_role_created_idx on public.notifications (audience_role, created_at desc);

-- -----------------------------------------------------------------------------
-- API-key metadata and audit logs (raw keys are never stored)
-- -----------------------------------------------------------------------------

create table public.api_keys (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  key_prefix text not null,
  key_last_four text not null,
  key_hash text not null unique,
  status text not null default 'active' check (status in ('active', 'inactive', 'revoked', 'expired')),
  permissions text[] not null default '{}',
  allowed_services text[] not null default '{}',
  expires_at timestamptz,
  owner_id uuid not null references public.profiles(id) on delete restrict,
  last_used_at timestamptz,
  rotated_at timestamptz,
  revoked_at timestamptz,
  rotated_from_id uuid references public.api_keys(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index api_keys_owner_id_idx on public.api_keys (owner_id);
create index api_keys_status_expiry_idx on public.api_keys (status, expires_at);
create index api_keys_rotated_from_idx on public.api_keys (rotated_from_id);

create table public.api_key_activity (
  id bigint generated always as identity primary key,
  api_key_id uuid references public.api_keys(id) on delete set null,
  action text not null check (action in ('created', 'updated', 'used', 'rotated', 'revoked', 'deactivated', 'activated', 'deleted', 'rejected')),
  service text,
  actor_id uuid references public.profiles(id) on delete set null,
  ip_hash text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index api_key_activity_key_created_idx on public.api_key_activity (api_key_id, created_at desc);
create index api_key_activity_actor_id_idx on public.api_key_activity (actor_id);

create table public.audit_logs (
  id bigint generated always as identity primary key,
  actor_id uuid references public.profiles(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id text,
  old_values jsonb,
  new_values jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index audit_logs_entity_created_idx on public.audit_logs (entity_type, entity_id, created_at desc);
create index audit_logs_actor_created_idx on public.audit_logs (actor_id, created_at desc);

-- Indexes missing from the original schema audit.
create index if not exists order_items_product_id_idx on public.order_items (product_id);
create index if not exists orders_coupon_code_idx on public.orders (coupon_code);
create index if not exists orders_customer_id_idx on public.orders (customer_id);
create index if not exists payments_order_id_idx on public.payments (order_id);
