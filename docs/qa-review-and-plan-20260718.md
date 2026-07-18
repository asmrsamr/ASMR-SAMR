# ASMR & SAMR — Full QA Review, Strategy & Plan

*Prepared by Claude, 2026-07-18. Driven live against the running site (localhost:8000, python http.server) plus the live Supabase project. Companion to `ASMR & SAMR - Claude Strategy & Findings.docx` and `docs/full-project-strategy-and-next-steps.md`.*

---

## 0. Verdict at a glance

| Area | Verdict |
| --- | --- |
| Public storefront (pages, commerce, i18n, account) | **PASS** — every page, tab, and button exercised; zero JS errors |
| Admin — dual-admin conflict (old F1) | **RESOLVED in the current build** — single Supabase admin, login-gated, legacy admin quarantined behind a flag |
| Admin — becoming *real* (schema, login, RLS, tests) | **BLOCKED on backend + credentials** — needs the user (Supabase migrations + a staff login) |
| Automated test suites | **GREEN** — 220 + 37 + 29 + 16 pass; 1 authenticated suite skipped (no QA creds) |

**Bottom line:** the storefront is launch-quality and the biggest previously-flagged risk (two competing admins) has already been fixed by the coworking system during this pass. Remaining work is almost entirely backend enablement that only the user can unblock (apply Supabase migrations, seed a staff user, provision payments), plus test coverage for the logged-in admin.

---

## 1. How this was tested

- Enumerated every route, tab, and button from source: `website/app.js` (6,709 lines) and `website/admin-dashboard.js` (6,593 lines).
- Ran all five Python suites.
- Drove the live site in a browser: navigated all 21 public routes, invoked commerce handlers through the real DOM buttons, toggled language, walked all account and admin tabs, and read the DOM / console after each step (screenshots time out on this SPA — DOM + JS reads are the reliable channel).
- Probed the live Supabase project with the browser's anon key to confirm which tables actually exist and what anon can read.

---

## 2. Public storefront — PASS (evidence)

**Routing** — all render, no console errors; unknown route redirects home:
`#/`, `#/samr`, `#/asmr`, `#/shop`, `#/shop/extrait`, `#/shop/spray`, `#/shop/cream`, `#/shop/sets`, `#/story`, `#/gifting`, `#/contact`, `#/ingredients`, `#/delivery`, `#/returns`, `#/privacy`, `#/faq`, `#/product/{samr-extrait, asmr-extrait, duo-box}`, and `#/nonsense` → `#/`.

**Commerce flow (end-to-end, real buttons):**
- Size selector → `selectProductSize`; **Add to Cart** writes `{id, size:"50 ml", quantity, price:320}`.
- Cart drawer opens from the header trigger (with live badge count), closes via `closeCartDrawer`; quantity update and remove work.
- **Wishlist** toggle persists to `asmr_samr_wishlist`.
- **Checkout** builds the correct link — `https://wa.me/966560505651?text=…` — with an itemised message, **15% VAT**, and a VAT-inclusive total; the order is logged to `asmr_samr_orders`. The real WhatsApp number is live (no longer a placeholder).

**Internationalisation:** the `#lang-btn` toggle flips `html.dir` ltr↔rtl, persists `asmr_samr_lang=ar`, relabels the button EN↔العربية, and renders Arabic copy (full RTL).

**Account dashboard:** all 8 tabs render with content — overview, orders, addresses, payments, wishlist, rewards, preferences, notifications (real sub-routes `#/account/<tab>`).

**Header controls:** language, cart trigger, mobile-nav toggle, and account nav all function.

---

## 3. Admin — current state

### 3.1 The dual-admin conflict (old F1) is RESOLVED in the current build
- `#/admin` now routes to `renderSupabaseAdminRoute()` → `ASMRSAMRAdmin.render()` (the Supabase admin). `app.js:6490`.
- The legacy localStorage admin (`renderAdmin`) has **no external caller** and is gated behind `isLegacyAdminFallbackEnabled()` — a dev flag (config `enableLegacyAdminFallback` or a sessionStorage key), which returns **false** by default.
- Verified in the DOM: exactly one `#admin-live-root` (nested in the Supabase shell), one `.admin-dashboard-wrapper` (the `admin-dashboard-enhanced` Supabase one), Supabase nav groups (Commerce / Experience / Operations / System), and every tab's content is **login-gated** ("AUTHORIZED ACCESS — Sign in to Admin Studio").

> Note: the older strategy docx still lists F1 as OPEN. That was true at the start of this session; the coworking auto-commit executed the consolidation while the review was running. This doc supersedes it.

### 3.2 Login gate works
The Supabase admin shows an email + password gate, validates an empty submit without crashing, and keeps unauthenticated users out of every section. It cannot be driven further here — that needs a seeded staff account (below).

### 3.3 Cache-busting (old F5) — partially addressed
`index.html` now pins a single token, `app.js?v=dev` and `admin-dashboard.js?v=dev`. Good that it is unified; `dev` is a static string, so it still needs to become a per-build value (short git SHA) before production so users never get a stale bundle.

### 3.4 Admin gaps that need the backend / the user (cannot be closed in the browser)

Live anon probe of `https://thpuomqhqghqskyegpfj.supabase.co` (2026-07-18):

| Table | anon status | Meaning |
| --- | --- | --- |
| `orders` | 200 · **0 rows** | No leak observed; RLS/emptiness — needs a positive proof (F4) |
| `order_items` | 200 · **0 rows** | Same |
| `content_settings` | 200 · 3 rows | Public banner text — intended public read ✓ |
| `products` | 401 | anon fully denied |
| `profiles` | 401 | anon fully denied ✓ |
| `coupons` | 401 | anon fully denied |
| `inventory` | **404** | **Table missing** — admin Inventory section will error |
| `product_availability` | **404** | **Table missing** — availability section will error |

- **F2 (schema incomplete):** `inventory` and `product_availability` still don't exist; migrations aren't fully applied. Some sections will 404 once someone logs in.
- **F3 (no verifiable login):** authenticated admin tests skip because `ASMR_QA_EMAIL` / `ASMR_QA_PASSWORD` aren't set and no staff user is confirmed seeded.
- **F4 (RLS unproven):** anon sees 0 rows in `orders`/`order_items` — reassuring but must be proven with a seeded row, not emptiness.
- **F7 (admin test gap):** the logged-in admin (auth + its ~31 sections + data fetches) has no automated coverage.

---

## 4. Test suites (all green)

| Suite | Result |
| --- | --- |
| `python website/test_website.py` | **220 passed** · 0 failed |
| `python website/test_admin_contracts.py` | **37 passed** · 0 failed |
| `python website/test_security.py` | **29 passed** · 0 failed |
| `python website/test_deploy_package.py` | **16 passed** · 0 failed |
| `python website/test_admin_authenticated.py` | **skipped** — set `ASMR_QA_EMAIL` / `ASMR_QA_PASSWORD` to run |

---

## 5. Strategy

The strategy is unchanged in spirit but has advanced a phase:

1. **Storefront is done and launch-ready.** Keep it as the public site; treat regressions as the only storefront work. Freeze scope; fix, don't add.
2. **The Supabase admin is now the single admin.** Phase A (consolidation) is effectively complete. Do **not** revive the localStorage admin — keep it only as the flag-gated offline fallback, or delete it after a backup once the Supabase admin is proven end-to-end.
3. **The gating items are all backend enablement**, and they need the user. The plan below front-loads exactly those asks so nothing else is blocked.
4. **Prove before launch, don't assume.** Every "green" that depends on Supabase (login, RLS, each section's table) must be demonstrated with a probe or a test, because the live schema is not yet the repo schema.

---

## 6. Plan

### Phase A — Consolidation · **DONE** (verify & lock)
- [x] `#/admin` renders only the Supabase admin; legacy admin behind `isLegacyAdminFallbackEnabled()` (false by default).
- [ ] **A-lock:** add a regression test asserting `#/admin` mounts one admin and shows the login gate when unauthenticated (closes the "could regress" risk). *(Claude — no backend needed.)*

### Phase B — Make the backend real · **NEEDS THE USER**
- [ ] **B1.** Apply all `supabase/migrations/*.sql` to `thpuomqhqghqskyegpfj`, creating `inventory` and `product_availability`. *(User applies, or authorises the Supabase MCP so Claude can.)*
- [ ] **B2.** Set RLS + grants: public read for catalog/content; staff-only for `orders`, `order_items`, `profiles`, `coupons`, `payments`.
- [ ] **B3.** Seed one staff user (`role='admin'`, `status='active'`); share `ASMR_QA_EMAIL` / `ASMR_QA_PASSWORD` for the test runner (per `docs/admin-first-user-setup.md`).
- [ ] **B4.** Re-probe every table each admin section queries; fix any 400/404 section. *(Claude, once B1–B3 land.)*

### Phase C — Prove it (tests) · Claude, after B
- [ ] **C1.** Run `test_admin_authenticated.py` with real creds → each section loads.
- [ ] **C2.** RLS test: seed one order, confirm the anon key still returns 0 rows (closes F4).
- [ ] **C3.** Smoke test: every admin nav section mounts without a JS error (closes F7).

### Phase D — Storefront ↔ live data (optional, staged) · Claude
- [ ] **D1.** Read the public catalog from Supabase `products` behind a feature flag (grant anon SELECT), static array as fallback.
- [ ] **D2.** Persist real orders to Supabase on WhatsApp checkout; WhatsApp stays the channel.

### Phase E — Payments · **NEEDS THE USER**
- [ ] Provision a Tap/Moyasar account; put the secret in Supabase Edge Function secrets (server-side only, never in the browser). Then Claude wires a hosted checkout + webhook.

### Phase F — Launch polish · Claude + user
- [ ] **F5-final:** replace `?v=dev` with a per-build short-SHA cache-buster.
- [ ] **F8:** set the founder name and final domain in Cloudflare Pages env vars (WhatsApp number already done). og:image follows the domain.
- [ ] Cloudflare Pages already auto-deploys from the repo; confirm the production branch and do the live smoke test in `docs/cloudflare-pages-free-hosting.md`.

---

## 7. What I need from the user (unblocks everything else)

1. **Apply the Supabase migrations** to `thpuomqhqghqskyegpfj` — or authorise the Supabase connector so I can (it's currently unauthorised in this session). This alone unblocks B, C, and D.
2. **Seed a staff admin user** and share test credentials (`ASMR_QA_EMAIL` / `ASMR_QA_PASSWORD`) so the authenticated admin can be tested.
3. **(When ready) a Tap/Moyasar account** for Phase E, and the **founder name + final domain** for Phase F.

Everything not in this list — the A-lock regression test, section re-probes after migration, cache-busting, storefront data-wiring behind a flag — I can do without any credentials.
