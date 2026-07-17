# Phase Execution Status

Date: 2026-07-17
Branch: `Codex`

## Phase 1: Security And Access

Status: Live access hardening applied; authenticated acceptance pending

Completed:

- GitHub CLI verified against the `asmrsamr` account without using the exposed PAT.
- Admin sessions moved to tab-scoped storage with inactivity and maximum-lifetime controls.
- Staff permission discovery corrected without exposing other role definitions.
- Non-admin staff profile modification blocked.
- Administrator self-lockout and final-administrator removal blocked in PostgreSQL and the user Edge Function.
- Anonymous and privileged-boundary security tests added.
- GitHub Actions quality gate added.
- Supabase migration `20260717131500_phase1_access_hardening.sql` applied to project `thpuomqhqghqskyegpfj`.
- Primary administrator created/promoted: `j.zoneng@gmail.com`.
- Recovery administrator invited/promoted: `jooo4444@gmail.com`.
- Live `admin-users` Edge Function source verified in the Supabase Code view with the secured staff-role implementation.

Pending external access:

- Recovery administrator must accept the Supabase invite and set credentials.
- Run the authenticated role matrix with a real admin session.
- If a strict timestamped function redeploy is required, authenticate the Supabase CLI or deploy from an account/API token that can refresh the Edge Function deployment. The live source currently matches the secured implementation.

## Phase 2: Operational Dashboard QA

Status: In progress; repository implementation complete, live acceptance pending

Completed:

- Role-aware sidebar visibility.
- Direct-route permission error behavior retained.
- Public storefront and protected login regression checks.
- Route-to-page contract coverage for every dashboard navigation item.
- Canonical staff-role coverage across the dashboard and legacy fallback helpers.
- Legacy admin tokens and protected remote caches moved out of persistent storage.
- Safe cancellation actions for orders and planned production records.
- Authenticated role/RLS acceptance harness with optional transient audited CRUD.
- Phase 2 contract gate added to GitHub Actions.

Pending:

- Recovery administrator invite acceptance.
- Run the authenticated read matrix for every operational role.
- Run the transient CRUD and audit cycle with an authorized account.
- Audit-log verification for sensitive changes.
- Correction of defects found during real-account testing.

## Phase 3: Public Website Dynamic Catalog

Status: Supabase-backed catalog active; commerce price/availability hardening applied

Completed:

- Public storefront loads the catalog through `rpc/get_storefront_catalog` with the static product catalog retained as fallback.
- Home, shop, brand pages, product pages, gifting, newsletter, preorder, and order submission paths use the public Supabase configuration when available.
- Cart items are resynced against current product records whenever the cart is rendered or checkout starts.
- Add-to-cart, buy-now, and preorder flows now validate the current sellable product/size selection instead of trusting rendered button prices.
- WhatsApp checkout and buy-now refresh the public catalog before generating the order message.
- Local browser smoke test confirmed `#/product/samr-extrait` loads from Supabase and adds the current `50 ml` / `270 SAR` catalog price to the cart.

Pending:

- Add public inventory quantity/availability to the storefront catalog RPC if real-time out-of-stock blocking is required before checkout.
- Replace placeholder launch configuration values: WhatsApp number, production domain, and founder name.
- Complete authenticated CRUD/RLS acceptance once an admin password is entered locally.

## Later Phases

Phases 4 through 8 remain gated by authenticated acceptance, approved checkout
path, real business data, launch content, production configuration, and
stakeholder acceptance.
