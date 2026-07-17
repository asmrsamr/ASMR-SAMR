-- Phase 1 access hardening: make staff RBAC usable without exposing other
-- roles, and prevent direct profile updates from locking out administrators.

revoke all privileges on table
  public.app_roles,
  public.role_permissions,
  public.profiles,
  public.audit_logs,
  public.api_keys,
  public.api_key_activity
from public, anon;

drop policy if exists role_permissions_staff_read on public.role_permissions;
create policy role_permissions_staff_read on public.role_permissions
for select to authenticated
using (
  role_name = (select private.current_role())
  or (select private.has_permission('roles.read'))
  or (select private.has_permission('roles.write'))
);

create or replace function private.protect_profile_fields()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_is_privileged boolean := current_user in ('postgres', 'service_role');
  v_other_active_admins integer;
begin
  if not v_is_privileged and old.role <> 'customer' and not private.is_admin() then
    raise exception 'Only an administrator can modify staff profiles';
  end if;

  if new.role is distinct from old.role
     and not v_is_privileged
     and not private.is_admin() then
    raise exception 'Only an administrator can change roles';
  end if;

  if new.points is distinct from old.points
     and not v_is_privileged then
    raise exception 'Reward points must be changed through adjust_reward_points';
  end if;

  if new.membership_tier is distinct from old.membership_tier
     and not v_is_privileged
     and not private.has_permission('customers.write') then
    raise exception 'Insufficient permission to change membership tier';
  end if;

  if new.status is distinct from old.status
     and not v_is_privileged
     and not private.has_permission('customers.write') then
    raise exception 'Insufficient permission to change account status';
  end if;

  if new.anonymized_at is distinct from old.anonymized_at
     and not v_is_privileged then
    raise exception 'Account anonymization must use the controlled user operation';
  end if;

  if old.role = 'admin'
     and old.status = 'active'
     and old.anonymized_at is null
     and (
       new.role <> 'admin'
       or new.status <> 'active'
       or new.anonymized_at is not null
     )
     and current_user <> 'postgres' then
    if current_user <> 'service_role' and old.id = (select auth.uid()) then
      raise exception 'Administrators cannot disable or demote their own account';
    end if;

    select count(*)
    into v_other_active_admins
    from public.profiles p
    where p.id <> old.id
      and p.role = 'admin'
      and p.status = 'active'
      and p.anonymized_at is null;

    if v_other_active_admins = 0 then
      raise exception 'At least one active administrator must remain';
    end if;
  end if;

  new.updated_at := now();
  return new;
end;
$$;

comment on function private.protect_profile_fields() is
  'Protects roles, rewards, staff accounts, anonymization, and the final active administrator.';
