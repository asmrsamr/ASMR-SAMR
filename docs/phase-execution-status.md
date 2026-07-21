# Phase Execution Status

Date: 2026-07-22
Branch: `Codex`

## 2026-07-22 Completion Update

Completed in this pass:

- Applied `supabase/migrations/20260718193000_manual_payment_checkout_flow.sql` to the live Supabase project from the authenticated SQL Editor.
- Verified the new `submit_storefront_order` signature through the public RPC boundary: an intentionally invalid payment method now returns the expected `P0001 Invalid payment method` validation response instead of `PGRST202`.
- Confirmed live Supabase prices still match the latest Excel revisions for all 18 product/size records.
- Completed desktop browser QA for Home, ASMR, SAMR, Shop, product detail, Gifting, Story, Contact, Delivery, Returns, Privacy, FAQ, and Account with no broken images or horizontal overflow.
- Completed 375 px mobile browser QA and fixed off-canvas cart/navigation overflow on the ASMR and SAMR campaign pages.
- Fixed the mobile Account header so its cart/account controls no longer retain the desktop sidebar offset below 768 px.
- Verified the settled mobile navigation and cart drawer open/close states, including visibility, pointer blocking, `aria-hidden`, and `inert` behavior.
- Verified protected direct routes such as `#/admin/products` remain on the admin sign-in screen when no authorized session exists.
- Added regression coverage for root overflow containment, closed drawer interaction states, and the mobile Account header offset.
- Current automated result: `226` website checks, `37` admin contract checks, `29` security checks, and `16` deployment-package checks pass.

Remaining external launch blockers:

- GitHub does not have a `CLOUDFLARE_API_TOKEN` secret, so the automatic Cloudflare Pages workflow cannot publish the current commit.
- `https://asmr-samr.pages.dev` still serves mixed old cache versions (`admin-operations-20260717c` and `launch-phases-20260718a`) until that deployment succeeds.
- Authenticated admin CRUD/RLS acceptance still needs credentials supplied through local environment variables; no QA password is stored in the repository.
- Recovery administrator access for `jooo4444@gmail.com` still needs to be created or re-sent and accepted.
- Real stock quantities, costs, delivery rules, and approved policy wording still require owner input.

## 2026-07-18 Phase 1-6 Execution Update

Completed in this pass:

- Consolidated `#/admin` onto the Supabase-backed `admin-dashboard.js` bridge; the legacy localStorage admin renderer is now quarantined behind an explicit development flag and is no longer the production admin route.
- Unified source asset cache query strings and added build-time replacement so `style.css`, `app.js`, `admin-dashboard.js`, and `config.local.js` share one deployment version.
- Verified live Excel launch pricing in Supabase with `python scripts/verify_live_launch_pricing.py`; all ASMR/SAMR launch prices now match the latest workbook revisions.
- Added public launch policy routes for delivery, returns/exchange, privacy, and FAQ.
- Added footer access to those launch pages without changing the existing header/menu navigation.
- Updated static launch metadata to the free Cloudflare Pages URL and real WhatsApp number.
- Updated the public fallback config to use `https://asmr-samr.pages.dev`, `966560505651`, and `ASMR & SAMR Fragrances`.
- Added live QA, admin acceptance, free operations, and marketing launch runbooks:
  - `docs/phase-1-6-launch-execution-plan.md`
  - `docs/live-launch-qa-checklist.md`
  - `docs/admin-operations-acceptance-checklist.md`
  - `docs/free-launch-operations.md`
  - `docs/marketing-launch-plan.md`

Still requires owner action:

- Rotate or delete any Cloudflare API token pasted into chat.
- Accept the recovery admin invite for `jooo4444@gmail.com`.
- Confirm whether founder metadata should remain the brand entity or a public person name.
- Run the real WhatsApp checkout smoke without sending the message.
- Enter final live inventory, product costs, and order operations data in admin.

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

Status: Supabase admin is the production route; authenticated live acceptance pending

Completed:

- Production `#/admin` and `#/admin/<tab>` routes now render through the Supabase dashboard only.
- Legacy localStorage admin rendering remains available only through an explicit development fallback flag for migration recovery.
- Admin route contract tests now prevent the legacy admin from becoming the production route again.
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

Status: Supabase-backed catalog active; live launch pricing verified

Completed:

- Public storefront loads the catalog through `rpc/get_storefront_catalog` with the static product catalog retained as fallback.
- Home, shop, brand pages, product pages, gifting, newsletter, preorder, and order submission paths use the public Supabase configuration when available.
- Cart items are resynced against current product records whenever the cart is rendered or checkout starts.
- Add-to-cart, buy-now, and preorder flows now validate the current sellable product/size selection instead of trusting rendered button prices.
- WhatsApp checkout and buy-now refresh the public catalog before generating the order message.
- Local browser smoke test confirmed `#/product/samr-extrait` loads from Supabase and adds the current `50 ml` product selection to the cart.
- Added an Excel-backed pricing extraction workflow using the latest ASMR and SAMR workbook revisions. The current launch prices are `SAMR 50 ml = 230 SAR`, `ASMR 50 ml = 320 SAR`, and `Duo Box = 499 SAR`.
- Applied the update-only live pricing correction and verified every live product price against the latest Excel revisions.

Pending:

- Adjust real product stock through the admin dashboard or stock RPCs so movement history and audit logs remain accurate.
- Add public inventory quantity/availability to the storefront catalog RPC if real-time out-of-stock blocking is required before checkout.
- Replace the placeholder founder name after the final public identity is approved.
- Complete authenticated CRUD/RLS acceptance once a working admin login is available locally.

## Phase 5: Checkout And Orders

Status: Live manual-payment checkout migration applied and RPC boundary verified

Completed:

- Added and applied migration `20260717170655_phase5_checkout_order_context.sql` to capture checkout customer email, city, address, source route, and order follow-up indexes.
- Added an extended `submit_storefront_order` RPC overload that keeps server-side product pricing, VAT calculation, and published-product validation.
- Kept the existing RPC signature available so current live deployments and older clients remain compatible.
- Storefront checkout now creates a stable order reference before WhatsApp opens.
- Cart checkout and buy-now wait for Supabase order persistence, record the remote order id/status/totals back into local order history, and mark sync as pending if the network is unavailable.
- WhatsApp cart checkout includes the order reference and customer delivery details when the visitor saved them in Account.
- Live Supabase verification confirmed 4 new order context columns and 2 `submit_storefront_order` RPC overloads.
- Applied `20260718193000_manual_payment_checkout_flow.sql`, adding the structured payment method, operational manual-payment statuses, updated admin overview, and refreshed PostgREST schema.
- Verified the deployed RPC accepts the new `p_payment_method` signature and rejects invalid values before any order is created.

Pending:

- Run one owner-observed end-to-end order using the configured WhatsApp number and confirm the created row appears in Admin Orders.
- Decide whether to add public inventory availability to the storefront RPC before launch.

## Phase 6: Storefront Inventory Availability

Status: Live storefront inventory availability applied and verified

Completed:

- Added migration `20260717171531_phase6_storefront_inventory_availability.sql` to extend `get_storefront_catalog` with safe public availability fields: stock status, checkout eligibility, and capped max order quantity.
- Updated both storefront order RPC signatures to reject out-of-stock products and requested quantities above available stock before creating an order.
- Storefront product cards and product detail pages now show subtle stock status labels using the existing luxury design language.
- Add-to-cart, cart quantity controls, checkout sync, and buy-now now honor live availability and max quantity data from the public catalog.
- Fixed direct buy-now order reference creation before Supabase persistence.
- Added regression tests for safe catalog availability fields, inventory validation, stock-aware cart behavior, and buy-now order references.
- Applied the Phase 6 migration to project `thpuomqhqghqskyegpfj`.
- Live public RPC verification confirmed products now return `stock_status`, `can_checkout`, and `max_order_quantity`.
- Local browser smoke test confirmed the shop loads from Supabase, renders stock labels, and reports no console errors.

Pending:

- Run one real checkout/order test after the launch WhatsApp number is configured.

## Phase 7: Launch Configuration Readiness

Status: Repository implementation complete; production values pending

Completed:

- Public merchant launch values now merge from `window.ASMR_SAMR_CONFIG` before the storefront initializes.
- Deployment config can override WhatsApp number, site domain, founder metadata, Instagram URL, production city labels, and reserved batch count without editing `app.js`.
- Admin status now separates launch readiness checks for WhatsApp checkout, production domain, and founder structured-data metadata.
- Added `website/config.example.js` launch keys for the real go-live values.
- Added `docs/launch-configuration.md` with the exact public config fields and verification steps.
- Added regression checks to ensure merchant launch config remains externally configurable and visible in admin readiness.

Pending:

- Set the real merchant WhatsApp number in deployment config.
- Confirm the final production domain and set `siteDomain`.
- Replace the founder metadata placeholder with the approved public name.
- Run the real checkout smoke test after the launch number is live.

## Phase 8: Static Deployment Package

Status: Repository implementation complete; Cloudflare credential blocks production upload

Completed:

- Added `scripts/build_static_site.py` to produce a clean static `dist/` package from `website/`.
- The package builder excludes developer-local `website/config.local.js` and writes a generated browser-safe runtime config from deployment environment variables.
- The package builder rewrites storefront/admin asset query strings to one shared cache-busting version from `ASMR_SAMR_ASSET_VERSION` or the current short git SHA.
- Added `website/test_deploy_package.py` to verify required package files, generated launch config values, and absence of developer-local config leakage.
- Added the deployment package build/test to the GitHub quality gate.
- Added `docs/deployment-package.md` with build commands, required public environment variables, and verification steps.
- Added `dist/` to `.gitignore`.
- Added Cloudflare Pages project config via `wrangler.toml`.
- Set the public default WhatsApp launch number to `966560505651`.
- Added `docs/cloudflare-pages-free-hosting.md` with the free Cloudflare Pages + Supabase setup.

Pending:

- Add a new least-privilege Cloudflare Pages token as the GitHub Actions secret `CLOUDFLARE_API_TOKEN`.
- Rerun the `Cloudflare Pages Deploy` workflow from `main` and confirm the live assets share the new git cache version.
- Run final production smoke tests after deployment.

## Later Phases

Future phases remain gated by authenticated acceptance, approved checkout path,
real business data, launch content, production configuration, and stakeholder
acceptance.
