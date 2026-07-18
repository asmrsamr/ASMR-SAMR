# ASMR & SAMR — Review Findings & Action Prompt
*Prepared by Claude on branch `Claude`, 2026-07-18. Based on the latest state of branch `Codex` (17 commits ahead of `main`).*

This document is written as a **ready-to-hand prompt** for any AI agent or developer.
It lists every issue found during a full review + test pass, with evidence and the exact
action required. Work only on the `Claude` branch; pull the latest from the other agents'
branches first; commit and push after every change.

---

## 0. How to use this prompt
> You are working in `C:\Users\Yousif's PC\Desktop\Ai Projects\Perfume` (repo
> `github.com/asmrsamr/ASMR-SAMR`). Before doing anything: `git fetch --all`, make sure you
> are on branch **Claude**, and merge the newest work from `Codex`/`main`. After each unit of
> work: run the tests, then `git add -A && git commit && git push origin Claude`. Do not touch
> other branches. Address the findings below in priority order.

## 1. Context discovered
- The repo is worked by **multiple AI agents** on separate branches (`Codex`, `main`,
  `cloudflare/workers-autoconfig`). An auto-commit/"coworking" system commits the working
  tree to the active branch, so "clean tree" does **not** mean "nothing changed" — always
  diff against the newest branch.
- There are now **TWO admin systems** shipping together in `website/`:
  1. `app.js` → `renderAdmin()` — the **localStorage** admin (Claude's earlier work:
     Overview/Orders/Products/Customers/Coupons/Content/Marketing/Reports/Status).
  2. `admin-dashboard.js` (6,593 lines) → global `ASMRSAMRAdmin` — a **Supabase-connected,
     login-gated** admin (Codex's work) with ~19 sections (Orders, Products, Inventory,
     Customers, Wishlist, Rewards, Gifting, Pre-orders, Coupons, Experience, Content,
     Marketing, Notifications, Reports, Roles, Settings, Status, Operations…).
- `index.html` dynamically loads **both** scripts (`app.js?v=launch-phases-20260718a` and
  `admin-dashboard.js?v=admin-operations-20260717c`).
- Supabase project is real: `https://thpuomqhqghqskyegpfj.supabase.co`. Migrations exist in
  `supabase/migrations/` (phase1–6). Backups of prior `app.js` are in `docs/backups/`.

## 2. Test status (passing, but coverage gap)
- `node --check website/app.js` → OK. `node --check website/admin-dashboard.js` → OK.
- `python website/test_website.py` → **214 passed · 0 failed**.
- ⚠️ Those tests target `app.js`/static behavior. They do **not** exercise the
  Supabase admin (`admin-dashboard.js`) — its auth, data fetches, and 19 sections are
  **untested**.

## 3. Findings (priority order)

### F1 — CRITICAL · Two competing admin systems on `#/admin`
- **Evidence:** at `#/admin`, both `renderAdmin` (function) and `ASMRSAMRAdmin` (object)
  exist; `#main-root` renders the localStorage admin (7 KB) AND `#admin-live-root` mounts the
  Supabase admin. The Supabase admin visually wins, but both load and both listen to hash
  changes → duplicate work, possible flash/race, and two sources of truth.
- **Action:** DECIDE on one admin. Recommended: keep the **Supabase admin**
  (`admin-dashboard.js`) as the real one; **retire** the localStorage admin path in `app.js`
  (stop routing `#/admin` there; keep the code only if needed as an offline fallback, behind a
  flag). Remove the now-redundant Customers/Coupons/Marketing localStorage tabs to avoid two
  coupon stores, two customer lists, etc.

### F2 — HIGH · Live Supabase schema is INCOMPLETE (admin sections will error)
- **Evidence (anon REST probes):** `orders` 200, `order_items` 200, `products` 200 (table
  exists) BUT `products` **SELECT denied to anon** (`42501`, hint: `GRANT SELECT ON
  public.products TO anon`); `profiles` 401; `inventory` **404 (missing)**;
  `product_availability` **404 (missing)**; `coupons` 400; `content_settings` 400.
- **Impact:** the admin's **Inventory** section has no table; **Coupons/Content** likely
  error; if the public storefront ever reads `products` from Supabase it will fail (anon
  denied).
- **Action:** the repo migrations are **not fully applied** to the live project. Apply all
  `supabase/migrations/*.sql` to `thpuomqhqghqskyegpfj` (via Supabase CLI `db push` or the SQL
  editor), add the missing `inventory` / `product_availability` objects, and set correct
  **RLS + grants** (public read for `products`/catalog; owner/staff-only for `orders`,
  `profiles`). Then re-probe every table the admin queries.

### F3 — HIGH · Admin login needs a seeded staff user (or nobody can get in)
- **Evidence:** `admin-dashboard.js` gates on a Supabase password login against `profiles`
  with `STAFF_ROLES = admin|manager|finance|marketing|inventory|production|support`.
- **Action:** confirm a staff user exists in `auth.users` + `profiles` with `role='admin'`
  and `status='active'`. If not, seed one (documented in the repo's admin-access doc). Verify
  an end-to-end login on `#/admin`.

### F4 — HIGH · Verify RLS actually protects customer data
- **Evidence:** `orders` returns `200 []` to the anon key (empty, so no leak *observed*), but
  this must be **confirmed by policy**, not by emptiness. `order_items` also 200.
- **Action:** review RLS on `orders`, `order_items`, `profiles`, payments — anon must never
  read another customer's data; staff read via authenticated role only. Add a test that a
  bare anon key returns zero rows for these tables.

### F5 — MEDIUM · Cache-version drift across agents
- **Evidence:** `index.html` currently pins `launch-phases-20260718a` /
  `admin-operations-20260717c`; a previous Claude value (`admin-tabs-20260716`) was
  overwritten by another agent. Different agents bump different strings.
- **Action:** adopt ONE cache-busting scheme (e.g., a single `?v=<gitshortsha>` applied to
  all assets by a small build step) so agents stop clobbering each other and users never get
  a stale bundle.

### F6 — MEDIUM · Redundant/legacy code & data stores
- **Evidence:** localStorage admin keys (`asmr_samr_admin_state_v1`, coupons, etc.) now
  duplicate Supabase tables; `docs/backups/` holds two prior `app.js` snapshots.
- **Action:** after F1, delete or clearly quarantine the superseded localStorage admin code
  and its keys; keep backups in `docs/backups/` only.

### F7 — MEDIUM · Test coverage gap for the Supabase admin
- **Evidence:** 214 tests cover the static site; none cover `admin-dashboard.js`.
- **Action:** add tests: (a) admin route renders login when unauthenticated; (b) each admin
  section calls the expected Supabase table; (c) anon RLS returns nothing for protected
  tables; (d) a smoke test that every nav section mounts without a JS error.

### F8 — LOW · Config placeholders still present (pre-launch)
- **Evidence (earlier passes):** WhatsApp number, `og:image` domain, JSON-LD `founder` are
  still placeholders in the storefront.
- **Action:** set the real WhatsApp number, domain, and founder before go-live.

## 4. Definition of done for this review cycle
1. One admin system live (F1). 2. Live Supabase fully migrated + probed green (F2).
3. A working staff login (F3). 4. RLS proven by test (F4). 5. Unified cache-busting (F5).
6. Legacy admin removed (F6). 7. Supabase-admin tests added (F7). 8. Config placeholders set
(F8). Each step committed and pushed to `Claude`.
