-- ASMR & SAMR update-only launch prices
-- Use this when the live product_prices rows already exist and the database
-- does not have a unique constraint that supports constraint-based upserts.

with launch_prices(product_id, size, price) as (
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
)
update public.product_prices pp
set price = lp.price
from launch_prices lp
where pp.product_id = lp.product_id
  and pp.size = lp.size;

with launch_prices(product_id, size, price) as (
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
)
select
  lp.product_id,
  lp.size,
  lp.price as expected_price,
  pp.price as live_price,
  case when pp.price = lp.price then 'ok' else 'check' end as status
from launch_prices lp
left join public.product_prices pp
  on pp.product_id = lp.product_id
 and pp.size = lp.size
order by lp.product_id, lp.size;
