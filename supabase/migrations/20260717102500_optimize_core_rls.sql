-- Remove legacy policy overlap and keep auth checks as one-time init plans.

drop policy if exists content_admin_write on public.content_settings;
drop policy if exists coupons_admin_write on public.coupons;
drop policy if exists news_admin_read on public.newsletter_subscribers;
drop policy if exists orders_admin_write on public.orders;
drop policy if exists payments_admin_read on public.payments;
drop policy if exists inv_admin_write on public.product_inventory;
drop policy if exists prices_admin_write on public.product_prices;
drop policy if exists products_admin_write on public.products;
drop policy if exists profiles_admin_all on public.profiles;

drop policy if exists orders_read_own on public.orders;
create policy orders_read_own on public.orders
for select to authenticated
using (
  customer_id = (select auth.uid())
  or (select public.is_admin())
);

drop policy if exists items_read on public.order_items;
create policy items_read on public.order_items
for select to authenticated
using (
  (select public.is_admin())
  or exists (
    select 1
    from public.orders o
    where o.id = order_items.order_id
      and o.customer_id = (select auth.uid())
  )
);

drop policy if exists profiles_self_read on public.profiles;
create policy profiles_self_read on public.profiles
for select to authenticated
using (
  id = (select auth.uid())
  or (select public.is_admin())
);

drop policy if exists profiles_self_update on public.profiles;
create policy profiles_self_update on public.profiles
for update to authenticated
using (
  id = (select auth.uid())
  or (select public.is_admin())
)
with check (
  id = (select auth.uid())
  or (select public.is_admin())
);

-- An ALL policy also participates in SELECT. Split generated staff-write policies
-- into INSERT, UPDATE, and DELETE policies so staff reads have one policy path.
do $$
declare
  p record;
  policy_prefix text;
  using_expression text;
  check_expression text;
begin
  for p in
    select schemaname, tablename, policyname, qual, with_check
    from pg_policies
    where schemaname = 'public'
      and cmd = 'ALL'
      and policyname like '%\_staff\_write' escape '\'
      and roles = array['authenticated']::name[]
  loop
    policy_prefix := left(p.policyname, 52);
    using_expression := coalesce(p.qual, p.with_check, 'false');
    check_expression := coalesce(p.with_check, p.qual, 'false');

    execute format('drop policy if exists %I on %I.%I', p.policyname, p.schemaname, p.tablename);
    execute format(
      'create policy %I on %I.%I for insert to authenticated with check (%s)',
      policy_prefix || '_ins', p.schemaname, p.tablename, check_expression
    );
    execute format(
      'create policy %I on %I.%I for update to authenticated using (%s) with check (%s)',
      policy_prefix || '_upd', p.schemaname, p.tablename, using_expression, check_expression
    );
    execute format(
      'create policy %I on %I.%I for delete to authenticated using (%s)',
      policy_prefix || '_del', p.schemaname, p.tablename, using_expression
    );
  end loop;
end
$$;
