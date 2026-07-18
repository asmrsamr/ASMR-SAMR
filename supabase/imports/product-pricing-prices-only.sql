-- ASMR & SAMR price-only launch import
-- Use this if the full cost/variant import fails and the immediate blocker is
-- storefront price correctness. This updates only the table read by the public
-- storefront catalog RPC.

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

select product_id, size, price
from public.product_prices
where product_id in ('asmr-extrait', 'samr-extrait', 'duo-box')
order by product_id, size;
