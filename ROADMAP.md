# ASMR & SAMR — Progress & Roadmap
*Reviewed and verified 2026-07-12; updated 2026-07-13. Re-run the test suites after any change.*

## Update — 2026-07-15: admin operations dashboard (validated)

A device-local **admin dashboard** (built by Gemini per the ops-dashboard plan) was
reviewed, validated, and corrected. Route: **`#/admin`** (+ `/products` `/orders`
`/content` `/status` `/reports`). It sits behind the unchanged public header.

- **Model:** `applyAdminState()` rebuilds each product from a base snapshot + a localStorage
  overlay (`asmr_samr_admin_state_v1`) — non-destructive and resettable. Helpers:
  `getPublicProducts` (filters inactive + sorts), `getFeaturedProducts`, `getProductById(id,
  {includeInactive})`, `getAdminAnalytics`.
- **Public wiring verified live:** deactivating a product removes it from `#/shop` (still
  visible in admin); featuring one adds it to the home featured row; editing a price flows to
  the product page, cart, and WhatsApp order; the content banner overrides the public header
  announcement (EN + AR).
- **Metrics:** sales/revenue total, newsletter count, inventory total, low-stock count, batch
  progress, top products, plus an Export-JSON action and a seed-sample-order/reset.
- **Fix I made:** the monthly revenue chart used **hardcoded seed numbers**
  (`[920,1460,…]`) shown as real revenue — replaced with a real trailing-6-months bucketing
  of logged orders, with an "Awaiting logged sales" note when empty (consistent with the
  no-fake-data rule).
- **Design confirmed:** warm beige wrapper `rgb(247,242,234)`, charcoal sidebar
  `rgb(39,35,31)`, gold accents, serif headings (Instrument Serif); no overflow/overlap on
  mobile; public nav labels/order unchanged; WebP+PNG images preserved.
- **Validation:** `node --check` clean; QA suite extended to **113 checks — 113 pass /
  0 fail** (added an Admin section); all 6 checklist routes render error-free; all 10
  products listed. Cache bumped to `admin-dashboard-20260715-v2`.
- **Limitation (unchanged):** all admin edits are **device-local** (localStorage) until a
  backend is added — they do not sync across devices/users and are not a real multi-admin
  system.

## Update — 2026-07-13 (evening): dashboard tabs + header fixes

Three reported issues fixed directly in `website/app.js` + `website/style.css`:

1. **Dashboard tabs / "Rewards everywhere".** Root cause: account tabs lived only in
   in-memory `state.accountTab` — the URL was always `#/account`, so direct navigation,
   refresh and back/forward could not target a tab, and any mismatch/stale build could
   strand a tab. Fix: tabs are now **real linkable sub-routes** `#/account/<tab>`;
   `switchAccountTab` drives the URL (history entries), the router derives the active tab
   from the URL, and an **unknown tab falls back to Overview** (never rewards, never a
   bounce home). Verified: all 8 tabs render unique content, active highlight correct,
   and direct-URL / refresh / back / forward all land on the right tab.
2. **Brand logo not fully clickable.** The wordmark was an inline text anchor. Fix: it is
   now a padded clickable rectangle (`wordmark-link`, 252×90 hit area) with pointer cursor,
   `:focus-visible` outline, subtle hover, and an accessible label — clicking anywhere in
   it returns home.
3. **Invisible basket/language controls on the account page.** Root cause: the account
   page uses a light `#FAF8F5` header, but only `header a` was recoloured — the language
   and cart **`<button>`s** kept `.nav-btn`'s ivory colour, so they were invisible until
   hover turned them gold. Fix: on the account page the controls are now **charcoal with a
   subtle border by default** (hover/focus = gold as an enhancement), the cart badge keeps
   a legible ring, and consistent default/hover/active/focus/disabled states were added to
   `.nav-btn` globally. Verified visible in both desktop and mobile.

Re-tests: QA suite extended to **86 checks — 86 pass / 0 fail** (added a routing+header
section). Live: tab sub-routing incl. back/forward + unknown-tab fallback; logo click →
home; controls charcoal `rgb(17,16,15)` on the pale header (desktop + mobile); cart badge
shows count; language EN↔AR/RTL intact; other routes unaffected.

## Update — 2026-07-13 (afternoon): full audit + account fix

**Reality check first — what the site actually is:** a static, backend-free SPA
(HTML/JS/CSS on `python -m http.server`) with all data device-local in `localStorage`.
There is **no Supabase, no server database, no real authentication/login/password, and
no admin panel** — those were never built and are not present. Adding them is a separate,
credentialed project (see "Remaining / external" below).

**Critical issue found & fixed — the account was a fake mockup.** Gemini had rebuilt
`#/account` into a beautiful tabbed VIP dashboard, but it seeded **fake data for every
visitor**: a fake customer "Ahmed Ali / ahmedali@email.com", three fake past orders,
a hardcoded 3,250-point balance, a fake VISA card "•••• 4321", and a hardcoded "member
since May 2024". A real customer would have seen someone else's account. **Fixed:** removed
all demo seeding; the account now reflects the real visitor — Guest empty-state until they
add details, real order history from their own WhatsApp orders, and a **real rewards engine**
(`getRewards`) that earns 1 point per SAR actually spent and derives the Classic/Select/
Reserve tier from real totals.

**Other fixes applied this pass:**
- Payments tab: removed the fake saved card; now states the real model (WhatsApp order →
  bank transfer / cash on delivery, "no card details stored").
- Replaced all 3 blocking native `alert()` dialogs with an on-theme, RTL-aware toast.
- Notifications tab now persists real preferences to `localStorage` (was a throwaway alert).
- Security: added an `esc()` HTML-escaper and applied it to user-entered values injected
  into the account views (name/email/city/address, order item names) — closes an
  attribute-injection gap.
- Order logging now records the product `id` on every line (cart, buy-now, pre-order) so
  order thumbnails, re-order, and points all use real data.
- Order status chips now read "Awaiting confirmation" (truthful for WhatsApp orders)
  instead of a hardcoded "Delivered".
- "Clear my data" also resets notifications + the active tab, with a confirmation + toast.

**Re-tests (2026-07-13):** website QA suite extended to **76 checks — 76 pass / 0 fail**
(added an Account-Integrity section that fails if any fake artefact returns). Live
end-to-end in-browser: fresh visitor → Guest state → real order → 782 real points →
Classic tier → payments/orders/wishlist/rewards tabs all render; no console errors on any
route; all 8 account tabs render; no horizontal overflow at desktop/tablet/mobile;
hamburger shows on mobile; Arabic/RTL intact.

**Remaining / external (unchanged, need YOU or a backend):**
- The 3 CONFIG placeholders: real WhatsApp number, real domain, founder name.
- If you want *true* accounts (login/password, server-side order history synced across
  devices, an admin panel, card payments): that requires a backend — e.g. Supabase +
  a payment gateway (Moyasar/Tap for KSA) + SFDA-compliant data handling. This is a
  deliberate future decision, not a bug; the current WhatsApp-first, device-local model
  was the approved architecture. Ballpark: a focused 1–2 week build once you decide.

## Update — 2026-07-13 (morning)
- **Gemini Stages 1–3 verified in the code:** CONFIG block, mobile nav drawer,
  `<picture>`/lazy images, reduced-motion support, pre-order modal + reservation
  counter (`RESERVED_COUNT`), `#/ingredients` transparency page. Stage 4 (marketing
  kit) still pending with Gemini.
- **Customer dashboard (`#/account`) built and shipped** (by Claude): profile
  (name + WhatsApp, prefills the reservation modal and cart orders), full order &
  reservation history with one-tap *Resend via WhatsApp*, wishlist (save button on
  every product page), language preference, and a clear-my-data control. 100%
  device-local (no backend), bilingual EN/AR, RTL-safe. Header now has an account icon.
- **Order logging wired into all three checkout flows** (cart, direct buy, pre-order);
  fixed two hard-coded "Riyadh" strings Gemini missed — checkout messages now use
  CONFIG.PRODUCTION_CITY.
- **Tests:** QA suite extended to 56 checks + live end-to-end smoke test (profile →
  wishlist → order → dashboard, EN + AR): **56 passed · 4 warnings · 0 failed**.
- **Remaining 4 warnings = the same user decisions:** real WhatsApp number, own
  og:image URL, real domain, founder name (all one-line CONFIG edits).

---

## 1 · Where the business stands (all verified today)

| Asset | Status | Proof |
|---|---|---|
| SAMR production suite (her) | ✅ v011, all tabs live | `SAMR\check_workbook.py` — **59/59 pass** |
| ASMR production suite (him, ex-AURA 37) | ✅ renamed cleanly, v008 | `ASMR\check_workbook.py` — **58/58 pass** |
| Formula compliance (IFRA + allergens) | ✅ no violations | `Perfume\compliance_check.py` — SAMR coumarin at its designed 84% watch level, ASMR unrestricted |
| Feasibility study (20 pp, both brands) | ✅ current | `Perfume\ASMR & SAMR - Feasibility Study.docx` + Drive |
| Preparation guides (docx) | ✅ both brands | brand folders + version folders |
| Website (Gemini SPA) | ✅ working, pre-launch | `website\test_website.py` — **38 pass / 5 warnings / 0 fail** |
| Google Drive mirrors | ✅ ASMR + SAMR | `G:\My Drive\ASMR`, `G:\My Drive\SAMR` |

**Website review highlights:** all 8 routes render; full EN↔AR with true RTL flip;
cart works (localStorage, bilingual items); WhatsApp checkout builds a prefilled order
message; catalog prices match the approved Selling Strategy exactly (270/380 heroes,
79/99 sprays, 69/79 creams, 60 discovery, 599 duo, 379/499 trios); JSON-LD PerfumeStore
schema; all images have alt text; no broken assets; no horizontal overflow on mobile.

## 2 · Findings from this review (fix next)

1. **Website launch blockers (the 5 test warnings):**
   - Real WhatsApp number (placeholder +966 50 000 0000 / `IS_WHATSAPP_PLACEHOLDER`)
   - `og:image` is an Unsplash hotlink → use own hero image
   - Placeholder domain `asmrsamr.com` and founder name in JSON-LD
   - **No mobile hamburger menu** — 7-item nav renders in full at 375px
2. **City inconsistency:** site says *Riyadh* everywhere; the materials supplier and
   earlier docs say *Makkah*. Confirm the real production city and align site + docs.
3. **Stray folder:** `ASMAR\ASMAR 007\` (one orphaned Body Spray xlsx from the interim
   rename) — recommend deleting after confirming `ASMR 007` holds the same file.
4. Browser screenshots of the site time out in the preview pane (renderer quirk) —
   cosmetic QA on a phone/desktop browser still recommended before launch.

## 3 · The plan

### Track A — Product (from the feasibility study, unchanged)
- **Phase 0 (now):** bottle current stock (5 ASMR + 7 SAMR), 16 wear tests, real
  packaging quotes. Gate: ≥40% would-buy.
- **Phase 1:** scale-up purchase (~SAR 3,887 both brands — Scale-Up tabs), produce
  158 × 50 ml, pre-orders during 6-week maceration, private launch.
- **Phase 2:** SFDA + IFRA docs (incl. **supplier IFRA certificates for the 11
  accords** — the one open compliance gap), Arabic labels, e-store, sprays & creams,
  bulk packs, boutique consignment.
- **Phase 3:** workshop, quarterly 300–500 bottles, wholesale, GCC.

### Track B — Website (new)
1. Fix the 5 launch blockers + city + mobile menu (Gemini prompt below).
2. Buy domain + host the static site (any static host; the site needs no backend).
3. Point WhatsApp CTAs at the real business number; test an order end-to-end on a phone.
4. Replace testimonial samples with real wear-test quotes (Phase 0 output).
5. Add product photography of real bottles when packaging arrives (keep generated
   images as placeholders until then).
6. Launch alongside Phase 1 pre-orders — the site's "join the first numbered batch"
   capture is the pre-order engine.

### Next 7 concrete actions
1. Confirm production city (Riyadh or Makkah) → align site + JSON-LD + study.
2. Give Gemini the fix-prompt below → re-run `python website\test_website.py`
   (target: 0 warnings).
3. Decide the real WhatsApp business number + Instagram handle.
4. Bottle the 12 bottles; start the 16 wear tests (log in the workbooks).
5. Request accord IFRA certificates + allergen breakdowns from iterji.
6. Get 3 packaging quotes; update Pricing & Sales tabs.
7. Delete the stray `ASMAR\` folder after checking `ASMR 007`.

## 4 · Prompt for Gemini (paste as-is, next iteration)

```
You built the ASMR & SAMR fragrance-house SPA (index.html + app.js + style.css, hash
router, EN/AR with RTL, localStorage cart, WhatsApp checkout). Apply ONLY these fixes —
do not redesign or rename anything:

1. MOBILE NAV: below 768px, collapse the 7-item header nav into an elegant hamburger
   (gold lines, slide-in charcoal drawer, focus-trapped, closes on route change; works
   in RTL too).
2. CONFIG BLOCK: move WHATSAPP_NUMBER, INSTAGRAM_URL, SITE_DOMAIN, FOUNDER_NAME,
   PRODUCTION_CITY into one clearly-commented CONFIG object at the top of app.js.
   Replace every hard-coded "Riyadh" in copy (EN + AR) with the CONFIG city.
3. SEO: replace the Unsplash og:image with assets/hero/landing-duo-photo.png (absolute
   URL from SITE_DOMAIN); sync JSON-LD url/founder/addressLocality with CONFIG.
4. PERFORMANCE: serve the .webp catalog images with png fallback (<picture>), add
   loading="lazy" to below-the-fold images, and preload the hero image.
5. POLISH: add prefers-reduced-motion media query disabling transitions; add a simple
   404/unknown-route view that redirects home; add rel=noopener to all target=_blank.
Keep everything else byte-identical. List the files you changed and why.
```

---
*Test commands:* `python website\test_website.py` · `ASMR\check_workbook.py` ·
`SAMR\check_workbook.py` · `python Perfume\compliance_check.py`
