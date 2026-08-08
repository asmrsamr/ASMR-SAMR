begin;

-- Privileged Edge Functions update profiles with the service role. The profile
-- protection trigger still evaluates these helpers, so it needs narrowly scoped
-- access to the private authorization functions it calls.
grant usage on schema private to service_role;
grant execute on function private.current_role() to service_role;
grant execute on function private.has_permission(text) to service_role;
grant execute on function private.is_admin() to service_role;

commit;
