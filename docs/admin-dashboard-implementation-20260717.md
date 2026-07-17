# ASMR & SAMR Admin Operations Implementation

Date: 2026-07-17
Branch: `Codex`
Supabase project: `thpuomqhqghqskyegpfj`

## Implementation Plan Used

1. Audited the public storefront, existing admin routes, authentication, schema, storage, and RLS before editing.
2. Preserved the pre-operations website files under `docs/backups/admin-dashboard-before-operations-20260717/`.
3. Extended the existing Supabase schema with migrations instead of replacing current tables or data.
4. Added role-aware RLS, transactional RPCs, audit logging, protected storage, and server-side Edge Functions.
5. Integrated one dashboard application into the existing hash router and restyled it with the ASMR & SAMR tokens.
6. Connected the public catalog and order path to Supabase while retaining the current offline catalog fallback.
7. Added reusable CRUD, images, stock movements, costing, reporting, and export behavior.
8. Ran syntax, migration, HTTP, security, desktop, mobile, route-history, and visual checks.

## Existing Issues Found

- The dashboard surface did not cover the requested operational modules or complete CRUD journeys.
- Several business areas had no persistent schema, RLS policy, audit trail, or transactional operation.
- Public catalog and ordering were primarily client-side rather than driven by published Supabase records.
- Product images lacked complete storage metadata, ordering, replacement, and primary-image controls.
- API-key management had no secure one-time reveal, hashing, rotation, or activity-log lifecycle.
- Long dashboard navigation could make lower menu items inaccessible on smaller screens.
- Direct dashboard routes, history navigation, loading, empty, validation, and error handling were incomplete.

## Modules Added Or Improved

- Commerce: overview, orders, payments, returns, refunds, subscriptions, products, categories, collections, fragrance notes, variants, images, inventory, customers, wishlist, rewards, gifting, pre-orders, and coupons.
- Operations: ingredients, lots, movements, suppliers, purchase orders, formulas, versions, production batches, production consumption, costing, and stock valuation.
- Finance: accounts, categories, ledger transactions, posting, reversal, payments, budgets, income/expense views, receivables/payables, cash flow, profit and loss, and reports.
- Experience: website content, homepage sections, journal, FAQs, policies, SEO, requests, reviews, newsletter, notifications, and reports.
- Marketing: campaigns, calendar, promotions, email, SMS, push, segments, abandoned carts, wishlist, loyalty, referral, gifting, partners, content planning, expenses, performance, and reports.
- System: user management, roles, permissions, secure API keys, API-key activity, audit logs, settings, and status.
- Dashboard overview: live commerce, stock, production, finance, customer, campaign, and action-required summaries.

## CRUD And Operational Behavior

- Reusable CRUD provides create, read/details, update, delete or archive, confirmation, search, filter, sort, pagination, validation, permission checks, loading, empty, success, and error states.
- Products support publish/unpublish, duplicate, archive, variants, prices, notes, related products, and multiple image upload/reorder/replace/metadata/primary selection.
- Product and ingredient stock changes run through RPCs and preserve movement history; production confirmation deducts ingredients atomically and prevents negative stock without an authorized override.
- Posted finance is immutable; corrections use reversal entries with audit history.
- Formula approval, production confirmation/reversal, costing snapshots, reward adjustments, user anonymization, and order total recalculation run server-side.
- API keys and gift-card codes are created or rotated server-side, displayed once, and stored only as hashes.
- Analytics, activity, audit, and derived report views remain read-only where destructive CRUD would be inappropriate.

## Files

Modified:

- `website/app.js`
- `website/index.html`
- `website/style.css`
- `website/test_website.py`

Added:

- `website/admin-dashboard.js`
- `supabase/config.toml`
- Eight files under `supabase/migrations/`
- Four Edge Functions and their shared security helper under `supabase/functions/`
- Pre-operations backups and implementation documentation under `docs/`

Removed: none.

## Database Migrations And RLS

- `20260717074551_extend_admin_operations.sql`: operational commerce, inventory, production, finance, marketing, content, user, API-key, and audit schema.
- `20260717074706_admin_security_and_operations.sql`: authorization helpers, protections, audit triggers, transactional RPCs, and RLS.
- `20260717074710_admin_storage_and_backfill.sql`: storage buckets/policies and safe catalog backfill.
- `20260717082159_complete_commerce_admin.sql`: pre-orders, exports, formula approval, payment status, and related completion work.
- `20260717091500_harden_admin_and_complete_modules.sql`: transactional storefront order submission, order recalculation, API-table denial, storage hardening, and indexes.
- `20260717102500_optimize_core_rls.sql`: removes overlapping legacy staff policies and optimizes authenticated policy evaluation.
- `20260717124500_secure_storefront_catalog.sql`: safe public catalog projection and removal of direct anonymous access to internal product data.
- `20260717130000_fix_product_image_urls.sql`: updates the original catalog rows to optimized WebP assets with PNG backups without touching custom uploads.

All eight migrations were applied to the linked Supabase project. Existing data was preserved. RLS is enabled for new operational tables, direct access to API-key hashes is denied, and storefront reads/writes use constrained server-side projections or validated RPCs.

## Dependencies And Exports

- No new public-site npm dependency or build step was introduced.
- Edge Functions pin `@supabase/functions-js` from JSR and `@supabase/server` from npm in local `deno.json` files.
- Exports support filtered CSV, XLSX, printable reports, and PDF where suitable. Sensitive fields are excluded and export actions are permission-aware.

## Tests Performed

- `node --check website/app.js`: passed.
- `node --check website/admin-dashboard.js`: passed.
- `python website/test_website.py`: 172 passed, 3 launch-content warnings, 0 failed.
- All eight migrations were accepted by the live PostgreSQL engine; the original six were also parsed with local PostgreSQL syntax tooling before deployment.
- Edge Function unauthenticated/invalid-key smoke tests returned the expected JSON `401` responses.
- Live schema, RPC grants, RLS denials, indexes, storage policies, and deployed Edge Function status were verified.
- Browser QA passed at desktop, tablet, and mobile sizes for immediate rendering, live Supabase refresh, home, shop, product, protected admin routes, image loading, no horizontal overflow, sidebar scrolling, mobile drawer, direct URLs, refresh, back, and forward.
- Browser console checks returned no errors on tested routes.
- Anonymous calls can use the safe catalog RPC, while direct reads of internal product cost/stock and coupon tables return `401`.

## Remaining External Or Business Tasks

- Create or invite the first real Supabase user and promote that profile to `admin` using `docs/admin-first-user-setup.md`. No mock administrator was created.
- Run authenticated browser CRUD journeys with that real admin account; the current environment has no admin profile to use for this final step.
- Replace the placeholder WhatsApp number, production domain, and founder structured-data value.
- Confirm payment, shipping, tax, return, approval, formula-access, and negative-stock override rules before launch.
- Connect production email/SMS/push/payment providers and enter real suppliers, ingredients, formulas, opening stock, and finance balances.

## Design Confirmation

The public navigation labels, order, and structure were not changed. Imported operational behavior was restyled to the existing warm ivory, sand, stone, champagne, graphite, and charcoal system. No Barberar branding, terminology, assets, routes, sample data, or visual tokens remain in the ASMR & SAMR implementation.
