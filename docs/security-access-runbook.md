# Security And Access Runbook

Date: 2026-07-17

## Session Policy

- Admin access tokens and refresh tokens are stored in `sessionStorage`, not persistent browser storage.
- Admin sessions expire after 30 minutes without dashboard activity.
- Admin sessions have an eight-hour maximum lifetime.
- A `401` response clears the local admin session and requires a new sign-in.
- Signing out calls Supabase Auth logout before clearing the browser session.
- Service-role and secret keys are prohibited from frontend code and browser configuration.

## Role Matrix

| Role | Primary Access |
| --- | --- |
| Administrator | All modules, users, roles, API keys, and audit operations |
| Manager | Products, inventory, ingredients, production, orders, customers, marketing, reports, and exports |
| Finance | Finance, posting, costing, reports, gifting, and exports |
| Marketing | Product reads, customer reads, campaigns, content, and exports |
| Inventory | Products, inventory, ingredients, suppliers, purchasing, and exports |
| Production | Ingredient and inventory reads, formulas, production, costing reads, and exports |
| Support | Orders, customers, notifications, returns, and exports |
| Customer | Own storefront account records only; no dashboard access |

Staff can read only the permissions assigned to their own role. Users and API
keys remain administrator-only. Navigation visibility is a convenience layer;
database RLS and Edge Functions remain authoritative.

## Administrator Continuity

- An administrator cannot disable, suspend, anonymize, or demote their own account.
- Non-admin staff cannot modify staff profiles.
- The database and user-management Edge Function both prevent removal of the final active administrator.
- Maintain at least two named administrator accounts before launch so account recovery does not depend on one person.

## First Administrator

Use `docs/admin-first-user-setup.md`. The initial user must be created through
Supabase Authentication and promoted by a project owner. There is no public
bootstrap endpoint and no mock administrator.

## Acceptance Matrix

| Scenario | Expected Result |
| --- | --- |
| Anonymous catalog request | Published catalog projection only |
| Anonymous internal table request | `401`, `403`, `404`, or an empty RLS result |
| Anonymous admin Edge Function request | `401` or `403` |
| Customer opens an admin URL | Access denied with no business data |
| Staff opens an unauthorized module URL | Permission error with no records |
| Staff reads role permissions | Only the staff member's current role |
| Staff attempts to modify another staff profile | Database rejection |
| Administrator attempts self-demotion | Database and Edge Function rejection |
| Administrator attempts to remove the final active admin | Database and Edge Function rejection |

Run these gates before deployment:

```powershell
node --check website/app.js
node --check website/admin-dashboard.js
python website/test_website.py
python website/test_security.py
```
