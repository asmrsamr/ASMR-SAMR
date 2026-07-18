# ASMR & SAMR — Claude Working Strategy
*Owner: Claude · Branch: `Claude` · Created 2026-07-18. Companion to `CLAUDE-FINDINGS.md`.*

## 1. Operating rules (per the user's instruction)
1. **Branch discipline:** I work **only** on branch `Claude`. I never commit to `Codex`,
   `main`, or any other branch.
2. **Always start from the latest:** before any change I run
   `git fetch --all` and merge the newest work from the other agents
   (`Codex` is currently the freshest; `main` is the integration line) into `Claude`, so I
   never build on stale code. (This is essential here because an auto-commit system means a
   "clean" tree can still be behind the other agents.)
3. **Commit & push everything:** after each meaningful unit of work I run the tests, then
   `git add -A && git commit -m "..." && git push origin Claude`. Nothing stays uncommitted.
4. **Non-destructive:** keep backups (`docs/backups/`), never delete another agent's work
   without it being captured in git history.

### Git commands I use each cycle
```
git fetch --all
git checkout Claude
git merge origin/Codex        # pull the latest from the other agents
# …do the work…
python website/test_website.py
node --check website/app.js && node --check website/admin-dashboard.js
git add -A
git commit -m "Claude: <what changed>"
git push origin Claude
```

## 2. The core decision
The project has drifted into **two admin dashboards**. The Supabase-backed
`admin-dashboard.js` (Codex) is the more complete and the only one that can ever be *real*
(live data, auth, roles, payments). Therefore:

> **Strategy: consolidate on the Supabase admin. Retire the localStorage admin.**
> Keep the beautiful ASMR & SAMR storefront (`app.js`) for the public site; make
> `admin-dashboard.js` the single source of truth for `#/admin`.

This resolves F1 and removes the double-store problem (F6).

## 3. Phased plan

### Phase A — Stabilise & de-conflict (no new features)
- A1. Make `#/admin` render **only** the Supabase admin. In `app.js`, stop dispatching
  `#/admin*` to `renderAdmin()`; let `admin-dashboard.js` own it. Guard against double-mount.
- A2. Quarantine the localStorage admin code + keys behind a dev flag (or delete after
  backup). Remove duplicate Customers/Coupons/Marketing localStorage tabs.
- A3. Unify cache-busting: one `?v=<short-sha>` for `app.js`, `admin-dashboard.js`, `style.css`.
- A4. Commit + push. Tests green.

### Phase B — Make the Supabase backend real
- B1. Apply **all** `supabase/migrations/*.sql` to `thpuomqhqghqskyegpfj`
  (`supabase db push` or SQL editor). Create the missing `inventory` and
  `product_availability` objects; fix `coupons`/`content_settings`.
- B2. RLS + grants: public read for catalog (`products`, images), owner/staff-only for
  `orders`, `order_items`, `profiles`, payments. Prove with anon-key probes returning `[]`.
- B3. Seed a staff admin user (`role='admin'`, `status='active'`); verify login on `#/admin`.
- B4. Point each admin section at a confirmed-existing table; fix any 400/404 section.
- B5. Commit + push after each table group. Re-probe until every admin section is green.

### Phase C — Wire the storefront to live data (optional, staged)
- C1. Read the public catalog from Supabase `products` (grant anon SELECT) instead of the
  hardcoded array — behind a feature flag so the static fallback still works.
- C2. Persist real orders to Supabase on WhatsApp checkout (order + order_items rows).
- C3. Keep WhatsApp as the order channel; the DB just records the order for the admin.

### Phase D — Payments (needs the user's Tap/Moyasar account)
- D1. Server-side only (Supabase Edge Function). Secret key never in the browser.
- D2. Hosted checkout or payment intent + webhook to mark orders paid.
- D3. Requires the user to provision the gateway account and paste the secret into Supabase
  Edge Function secrets.

### Phase E — Quality, tests, launch
- E1. Add Supabase-admin tests (F7): login gate, per-section table calls, RLS zero-rows,
  no-JS-error smoke test.
- E2. Set config placeholders (F8): WhatsApp number, domain, og:image, founder.
- E3. Deploy: static storefront (Cloudflare Pages — a `cloudflare/workers-autoconfig` branch
  already exists) + Supabase as the backend. Document env + secrets.

## 4. Testing standard (every cycle)
- `python website/test_website.py` must stay green (currently 214/214).
- `node --check` on both JS bundles.
- Live smoke on `#/` and `#/admin` (no console errors; login renders unauthenticated).
- Supabase probes for the tables touched.

## 5. What needs the user (external / cannot be done in code)
- Applying migrations to the live Supabase project (or authorising the Supabase MCP so I can).
- A Tap/Moyasar payment account + secret key (for Phase D).
- Final config values (WhatsApp number, domain) and a Cloudflare/Vercel deploy target.

## 6. Immediate next actions (my very next steps)
1. Land these two docs on `Claude` (this commit).
2. Phase A1–A2: make `#/admin` single-owner (Supabase admin) and quarantine the localStorage
   admin — the highest-value, lowest-risk fix. Commit + push.
3. Report back with a green test run and ask the user to apply the Supabase migrations
   (or authorise the Supabase connector) so I can proceed with Phase B.
