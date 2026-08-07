begin;

insert into public.app_roles (name, label, description, is_system)
values ('owner', 'Owner / Super Admin', 'Highest-trust business owner with implicit access to every administrative capability.', true)
on conflict (name) do update set
  label = excluded.label,
  description = excluded.description,
  is_system = excluded.is_system,
  updated_at = now();

alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles
  add constraint profiles_role_check check (
    role in ('customer', 'owner', 'admin', 'manager', 'finance', 'marketing', 'inventory', 'production', 'support')
  );

create or replace function private.has_permission(p_permission text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    private.current_role() in ('owner', 'admin')
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
  select coalesce(private.current_role() in ('owner', 'admin'), false)
$$;

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
      and p.role in ('owner', 'admin')
      and p.status = 'active'
      and p.anonymized_at is null
  )
$$;

drop policy if exists profiles_staff_read on public.profiles;
create policy profiles_staff_read on public.profiles
for select to authenticated
using (
  role = 'customer'
  and (
    (select private.has_permission('customers.read'))
    or (select private.has_permission('customers.write'))
  )
);

drop policy if exists profiles_staff_update on public.profiles;
create policy profiles_staff_update on public.profiles
for update to authenticated
using (
  (select private.is_admin())
  or (role = 'customer' and (select private.has_permission('customers.write')))
)
with check (
  (select private.is_admin())
  or (role = 'customer' and (select private.has_permission('customers.write')))
);

drop view if exists public.staff_directory;
create view public.staff_directory
with (security_barrier = true)
as
select p.id, p.full_name, p.email, p.role, p.status
from public.profiles p
where p.role <> 'customer'
  and p.status = 'active'
  and p.anonymized_at is null
  and private.current_role() in ('owner', 'admin', 'manager', 'finance', 'marketing', 'inventory', 'production', 'support');

revoke all on public.staff_directory from public, anon;
grant select on public.staff_directory to authenticated;

comment on view public.staff_directory is
  'Minimal staff identity projection for assignment fields; sensitive profile fields remain protected.';

create or replace function private.protect_profile_fields()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_is_service boolean := current_user in ('postgres', 'service_role');
  v_actor_role text := private.current_role();
  v_other_active_privileged integer;
  v_other_active_owners integer;
begin
  if not v_is_service
     and (old.role = 'owner' or new.role = 'owner')
     and v_actor_role <> 'owner' then
    raise exception 'Only an owner can assign or modify the owner role';
  end if;

  if not v_is_service and old.role <> 'customer' and not private.is_admin() then
    raise exception 'Only an owner or administrator can modify staff profiles';
  end if;

  if new.role is distinct from old.role
     and not v_is_service
     and not private.is_admin() then
    raise exception 'Only an owner or administrator can change roles';
  end if;

  if new.points is distinct from old.points and not v_is_service then
    raise exception 'Reward points must be changed through adjust_reward_points';
  end if;

  if new.membership_tier is distinct from old.membership_tier
     and not v_is_service
     and not private.has_permission('customers.write') then
    raise exception 'Insufficient permission to change membership tier';
  end if;

  if new.status is distinct from old.status
     and not v_is_service
     and not private.has_permission('customers.write') then
    raise exception 'Insufficient permission to change account status';
  end if;

  if new.anonymized_at is distinct from old.anonymized_at and not v_is_service then
    raise exception 'Account anonymization must use the controlled user operation';
  end if;

  if old.role in ('owner', 'admin')
     and old.status = 'active'
     and old.anonymized_at is null
     and (
       new.role not in ('owner', 'admin')
       or new.status <> 'active'
       or new.anonymized_at is not null
     )
     and current_user <> 'postgres' then
    if current_user <> 'service_role' and old.id = (select auth.uid()) then
      raise exception 'Owners and administrators cannot disable or demote their own account';
    end if;

    select count(*) into v_other_active_privileged
    from public.profiles p
    where p.id <> old.id
      and p.role in ('owner', 'admin')
      and p.status = 'active'
      and p.anonymized_at is null;

    if v_other_active_privileged = 0 then
      raise exception 'At least one active owner or administrator must remain';
    end if;
  end if;

  if old.role = 'owner'
     and old.status = 'active'
     and old.anonymized_at is null
     and (
       new.role <> 'owner'
       or new.status <> 'active'
       or new.anonymized_at is not null
     )
     and current_user <> 'postgres' then
    select count(*) into v_other_active_owners
    from public.profiles p
    where p.id <> old.id
      and p.role = 'owner'
      and p.status = 'active'
      and p.anonymized_at is null;

    if v_other_active_owners = 0 then
      raise exception 'At least one active owner must remain';
    end if;
  end if;

  new.updated_at := now();
  return new;
end;
$$;

comment on function private.protect_profile_fields() is
  'Protects owner continuity, privileged roles, rewards, staff accounts, and anonymization.';

commit;
