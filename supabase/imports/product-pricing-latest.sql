-- ASMR & SAMR product pricing import
-- Generated from latest Excel workbook revisions on 2026-07-18T13:01:42.
-- Source: asmr-extrait: ASMR/ASMR 008/ASMR Perfume 008.xlsx
-- Source: samr-extrait: SAMR/SAMR 011/SAMR Perfume 011.xlsx
-- Source: asmr-spray: ASMR/Perfume 007/ASMR Body Spray 007.xlsx
-- Source: samr-spray: SAMR/SAMR 008/SAMR Body Spray 008.xlsx
-- Source: asmr-cream: ASMR/Perfume 007/ASMR Cream 007.xlsx
-- Source: samr-cream: SAMR/SAMR 008/SAMR Cream 008.xlsx
-- Source: duo-box: Derived from ASMR 50 ml + SAMR 50 ml latest launch prices
-- Source: asmr-trio: Derived from ASMR 50 ml, ASMR Body Spray, and ASMR Body Cream workbooks
-- Source: samr-trio: Derived from SAMR 50 ml, SAMR Body Spray, and SAMR Body Cream workbooks
-- Source: discovery-set: Derived from ASMR/SAMR launch strategy; sample packaging cost still requires supplier quote
-- Public prices are ex-VAT. The storefront adds VAT at checkout.
-- IMPORTANT: This file intentionally does not adjust sellable stock.

begin;

insert into public.product_prices (product_id, size, price)
values
  ('asmr-extrait', '10 ml', 80),
  ('asmr-extrait', '30 ml', 210),
  ('asmr-extrait', '50 ml', 320),
  ('asmr-extrait', '70 ml', 420),
  ('asmr-extrait', '100 ml', 560),
  ('samr-extrait', '10 ml', 60),
  ('samr-extrait', '30 ml', 160),
  ('samr-extrait', '50 ml', 230),
  ('samr-extrait', '70 ml', 290),
  ('samr-extrait', '100 ml', 370),
  ('asmr-spray', '100 ml', 99),
  ('samr-spray', '100 ml', 79),
  ('asmr-cream', '100 g', 79),
  ('samr-cream', '100 g', 69),
  ('duo-box', 'Duo Box (2x 50 ml)', 499),
  ('asmr-trio', 'Trio Set', 499),
  ('samr-trio', 'Trio Set', 379),
  ('discovery-set', '2x 2 ml', 60)
on conflict (product_id, size) do update
set price = excluded.price;

update public.products p
set cost = v.cost,
    tax_rate = 0.15,
    availability = case when p.availability = 'discontinued' then p.availability else 'in_stock' end,
    status = case when p.status = 'archived' then p.status else 'published' end,
    updated_at = now()
from (values
  ('asmr-extrait', 96.03),
  ('samr-extrait', 67.32),
  ('asmr-spray', 41.14),
  ('samr-spray', 30.34),
  ('asmr-cream', 8.19),
  ('samr-cream', 6.03),
  ('duo-box', 163.35),
  ('asmr-trio', 145.36),
  ('samr-trio', 103.69),
  ('discovery-set', 12)
) as v(product_id, cost)
where p.id = v.product_id;

update public.product_variants
set is_default = false,
    updated_at = now()
where product_id in ('asmr-cream', 'asmr-extrait', 'asmr-spray', 'asmr-trio', 'discovery-set', 'duo-box', 'samr-cream', 'samr-extrait', 'samr-spray', 'samr-trio')
  and archived_at is null;

update public.product_variants pv
set price = v.price,
    cost = v.cost,
    tax_rate = v.tax_rate,
    is_default = v.is_default,
    sort_order = v.sort_order,
    updated_at = now()
from (values
  ('asmr-extrait', 'ASMR Extrait de Parfum 10 ml', '10 ml', 80, 23.21, 0.15, false, 10),
  ('asmr-extrait', 'ASMR Extrait de Parfum 30 ml', '30 ml', 210, 63.62, 0.15, false, 20),
  ('asmr-extrait', 'ASMR Extrait de Parfum 50 ml', '50 ml', 320, 96.03, 0.15, true, 30),
  ('asmr-extrait', 'ASMR Extrait de Parfum 70 ml', '70 ml', 420, 126.44, 0.15, false, 40),
  ('asmr-extrait', 'ASMR Extrait de Parfum 100 ml', '100 ml', 560, 167.06, 0.15, false, 50),
  ('samr-extrait', 'SAMR Extrait de Parfum 10 ml', '10 ml', 60, 17.46, 0.15, false, 10),
  ('samr-extrait', 'SAMR Extrait de Parfum 30 ml', '30 ml', 160, 46.39, 0.15, false, 20),
  ('samr-extrait', 'SAMR Extrait de Parfum 50 ml', '50 ml', 230, 67.32, 0.15, true, 30),
  ('samr-extrait', 'SAMR Extrait de Parfum 70 ml', '70 ml', 290, 86.25, 0.15, false, 40),
  ('samr-extrait', 'SAMR Extrait de Parfum 100 ml', '100 ml', 370, 109.64, 0.15, false, 50),
  ('asmr-spray', 'ASMR Body Spray 100 ml', '100 ml', 99, 41.14, 0.15, true, 10),
  ('samr-spray', 'SAMR Body Spray 100 ml', '100 ml', 79, 30.34, 0.15, true, 10),
  ('asmr-cream', 'ASMR Body Cream 100 g', '100 g', 79, 8.19, 0.15, true, 10),
  ('samr-cream', 'SAMR Body Cream 100 g', '100 g', 69, 6.03, 0.15, true, 10),
  ('duo-box', 'His & Hers Duo Box', 'Duo Box (2x 50 ml)', 499, 163.35, 0.15, true, 10),
  ('asmr-trio', 'ASMR Trio Set', 'Trio Set', 499, 145.36, 0.15, true, 10),
  ('samr-trio', 'SAMR Trio Set', 'Trio Set', 379, 103.69, 0.15, true, 10),
  ('discovery-set', 'Discovery Set', '2x 2 ml', 60, 12, 0.15, true, 10)
) as v(product_id, name, size, price, cost, tax_rate, is_default, sort_order)
where pv.product_id = v.product_id
  and pv.size = v.size
  and pv.archived_at is null;

insert into public.product_variants (
  product_id, name, size, price, cost, tax_rate, is_default, is_active, sort_order
)
select v.product_id, v.name, v.size, v.price, v.cost, v.tax_rate, v.is_default, true, v.sort_order
from (values
  ('asmr-extrait', 'ASMR Extrait de Parfum 10 ml', '10 ml', 80, 23.21, 0.15, false, 10),
  ('asmr-extrait', 'ASMR Extrait de Parfum 30 ml', '30 ml', 210, 63.62, 0.15, false, 20),
  ('asmr-extrait', 'ASMR Extrait de Parfum 50 ml', '50 ml', 320, 96.03, 0.15, true, 30),
  ('asmr-extrait', 'ASMR Extrait de Parfum 70 ml', '70 ml', 420, 126.44, 0.15, false, 40),
  ('asmr-extrait', 'ASMR Extrait de Parfum 100 ml', '100 ml', 560, 167.06, 0.15, false, 50),
  ('samr-extrait', 'SAMR Extrait de Parfum 10 ml', '10 ml', 60, 17.46, 0.15, false, 10),
  ('samr-extrait', 'SAMR Extrait de Parfum 30 ml', '30 ml', 160, 46.39, 0.15, false, 20),
  ('samr-extrait', 'SAMR Extrait de Parfum 50 ml', '50 ml', 230, 67.32, 0.15, true, 30),
  ('samr-extrait', 'SAMR Extrait de Parfum 70 ml', '70 ml', 290, 86.25, 0.15, false, 40),
  ('samr-extrait', 'SAMR Extrait de Parfum 100 ml', '100 ml', 370, 109.64, 0.15, false, 50),
  ('asmr-spray', 'ASMR Body Spray 100 ml', '100 ml', 99, 41.14, 0.15, true, 10),
  ('samr-spray', 'SAMR Body Spray 100 ml', '100 ml', 79, 30.34, 0.15, true, 10),
  ('asmr-cream', 'ASMR Body Cream 100 g', '100 g', 79, 8.19, 0.15, true, 10),
  ('samr-cream', 'SAMR Body Cream 100 g', '100 g', 69, 6.03, 0.15, true, 10),
  ('duo-box', 'His & Hers Duo Box', 'Duo Box (2x 50 ml)', 499, 163.35, 0.15, true, 10),
  ('asmr-trio', 'ASMR Trio Set', 'Trio Set', 499, 145.36, 0.15, true, 10),
  ('samr-trio', 'SAMR Trio Set', 'Trio Set', 379, 103.69, 0.15, true, 10),
  ('discovery-set', 'Discovery Set', '2x 2 ml', 60, 12, 0.15, true, 10)
) as v(product_id, name, size, price, cost, tax_rate, is_default, sort_order)
where not exists (
  select 1
  from public.product_variants pv
  where pv.product_id = v.product_id
    and pv.size = v.size
    and pv.archived_at is null
);

delete from public.product_cost_components
where product_id in ('asmr-cream', 'asmr-extrait', 'asmr-spray', 'asmr-trio', 'discovery-set', 'duo-box', 'samr-cream', 'samr-extrait', 'samr-spray', 'samr-trio')
  and effective_from = date '2026-07-18'
  and name like 'Excel launch import:%';

insert into public.product_cost_components (
  product_id, component_type, name, amount, allocation_method, effective_from
)
values
  ('asmr-extrait', 'ingredient', 'Excel launch import: ingredient/juice', 56.03, 'per_unit', date '2026-07-18'),
  ('asmr-extrait', 'packaging', 'Excel launch import: packaging', 40, 'per_unit', date '2026-07-18'),
  ('samr-extrait', 'ingredient', 'Excel launch import: ingredient/juice', 27.32, 'per_unit', date '2026-07-18'),
  ('samr-extrait', 'packaging', 'Excel launch import: packaging', 40, 'per_unit', date '2026-07-18'),
  ('asmr-spray', 'ingredient', 'Excel launch import: ingredient/juice', 41.14, 'per_unit', date '2026-07-18'),
  ('samr-spray', 'ingredient', 'Excel launch import: ingredient/juice', 30.34, 'per_unit', date '2026-07-18'),
  ('asmr-cream', 'ingredient', 'Excel launch import: ingredient/juice', 8.19, 'per_unit', date '2026-07-18'),
  ('samr-cream', 'ingredient', 'Excel launch import: ingredient/juice', 6.03, 'per_unit', date '2026-07-18'),
  ('duo-box', 'other', 'Excel launch import: bundle/component cost', 163.35, 'per_unit', date '2026-07-18'),
  ('asmr-trio', 'other', 'Excel launch import: bundle/component cost', 145.36, 'per_unit', date '2026-07-18'),
  ('samr-trio', 'other', 'Excel launch import: bundle/component cost', 103.69, 'per_unit', date '2026-07-18'),
  ('discovery-set', 'ingredient', 'Excel launch import: ingredient/juice', 4, 'per_unit', date '2026-07-18'),
  ('discovery-set', 'packaging', 'Excel launch import: packaging', 8, 'per_unit', date '2026-07-18');

insert into public.product_cost_snapshots (
  product_id, ingredient_cost, packaging_cost, labor_cost,
  total_cost, cost_per_unit, selling_price, gross_profit, recommended_price
)
values
  ('asmr-extrait', 56.03, 40, 0, 96.03, 96.03, 320, 223.97, 320),
  ('samr-extrait', 27.32, 40, 0, 67.32, 67.32, 230, 162.68, 230),
  ('asmr-spray', 41.14, 0, 0, 41.14, 41.14, 99, 57.86, 99),
  ('samr-spray', 30.34, 0, 0, 30.34, 30.34, 79, 48.66, 79),
  ('asmr-cream', 8.19, 0, 0, 8.19, 8.19, 79, 70.81, 79),
  ('samr-cream', 6.03, 0, 0, 6.03, 6.03, 69, 62.97, 69),
  ('duo-box', 0, 0, 0, 163.35, 163.35, 499, 335.65, 499),
  ('asmr-trio', 0, 0, 0, 145.36, 145.36, 499, 353.64, 499),
  ('samr-trio', 0, 0, 0, 103.69, 103.69, 379, 275.31, 379),
  ('discovery-set', 4, 8, 0, 12, 12, 60, 48, 60);

commit;
