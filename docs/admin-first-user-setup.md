# First Admin Setup

The dashboard intentionally has no insecure public bootstrap route. Create the first administrator through Supabase with project-owner access.

## 1. Create Or Invite The User

In Supabase Dashboard, open **Authentication > Users** and invite or create the real administrator email. Have the user complete the normal password or magic-link flow.

## 2. Promote The Existing Profile

Run the following once in Supabase SQL Editor after replacing the email placeholder:

```sql
begin;

insert into public.profiles (id, email, full_name, role, status)
select
  id,
  email,
  coalesce(nullif(raw_user_meta_data ->> 'full_name', ''), 'ASMR & SAMR Admin'),
  'admin',
  'active'
from auth.users
where lower(email) = lower('replace-with-real-admin@example.com')
on conflict (id) do update
set role = 'admin',
    status = 'active',
    anonymized_at = null,
    updated_at = now();

commit;
```

Confirm exactly one profile was updated:

```sql
select id, email, role, status
from public.profiles
where lower(email) = lower('replace-with-real-admin@example.com');
```

## 3. Verify Access

1. Open `http://localhost:8000/#/admin`.
2. Sign in with the invited account.
3. Confirm the overview loads and the API Keys page never exposes stored raw keys.
4. Create a disposable draft product, edit it, archive it, and confirm the related audit entries.

Do not put a service-role key in `website/config.local.js`, browser storage, source code, Git, or the dashboard. The browser configuration must contain only the Supabase URL and publishable/anon key.
