# Prompt for Gemini — proceed with the ASMR & SAMR roadmap

Paste everything below the line into Gemini (attach or paste index.html, app.js, style.css when it asks, or work stage by stage).

---

You are the senior brand engineer for **ASMR & SAMR**, a his-&-hers artisan perfume house in Saudi Arabia. You already built our website — a vanilla-JS hash-router SPA (`index.html`, `app.js`, `style.css`) with EN/AR + full RTL, a localStorage cart (`asmr_samr_cart`), WhatsApp checkout, and a 10-product catalog. It passed an automated audit (38 checks) with 5 known warnings. Your job now is to execute the next roadmap stages IN ORDER. Do not redesign, rename, or restructure anything that works. After each stage, list exactly which files changed and why, so our test suite can be re-run.

FIXED BUSINESS FACTS — never alter these:
- Brands: ASMR (him, "Presence that stays") and SAMR (her, "The scent he cannot forget"). House = "ASMR & SAMR".
- Prices (SAR, ex-VAT, 15% VAT note stays): SAMR Extrait 10/30/50/70/100 ml = 70/190/270/360/460 · ASMR Extrait = 90/250/380/510/680 · Body Sprays 79 (SAMR) / 99 (ASMR) · Body Creams 69 / 79 · Discovery Set 60 · Duo Box 599 · Trio Sets 379 / 499.
- Model: WhatsApp-first pre-orders of a numbered small batch (158 × 50 ml, "Batch B.077" styling stays); no online payment yet.
- Claims discipline: cosmetic language only — never medical, pheromone, or "attraction guarantee" claims; "irresistible" style poetry is fine.

════════ STAGE 1 — LAUNCH BLOCKERS (do this first) ════════
1. MOBILE NAV: below 768px collapse the 7-item header nav into a hamburger — gold lines, slide-in charcoal drawer, focus-trapped, Escape/route-change closes it, mirrored correctly in RTL.
2. CONFIG: create one commented CONFIG object at the top of app.js: WHATSAPP_NUMBER, INSTAGRAM_URL, SITE_DOMAIN, FOUNDER_NAME, PRODUCTION_CITY (+ Arabic city name). Replace every hard-coded "Riyadh" (EN and AR copy) with CONFIG.PRODUCTION_CITY. Keep the IS_WHATSAPP_PLACEHOLDER guard working off CONFIG.
3. SEO: og:image → our own `assets/hero/landing-duo-photo.png` (absolute URL from SITE_DOMAIN); sync JSON-LD url / founder / addressLocality with CONFIG.
4. PERFORMANCE: `<picture>` with .webp + .png fallback for catalog images, `loading="lazy"` below the fold, preload the hero.
5. POLISH: `prefers-reduced-motion` support, a graceful unknown-route redirect to home, `rel="noopener"` on all `target="_blank"`.

════════ STAGE 2 — PRE-ORDER ENGINE ════════
6. Add a "Reserve from Batch B.077" flow: a pre-order badge on product pages, a bottle counter ("X of 158 reserved" — driven by one CONFIG number we update manually), and a pre-order form (name, WhatsApp number, product, size) that opens WhatsApp with the reservation summary.
7. Discovery Set push: a site-wide slim banner "Try both for 60 SAR — redeemable against your full bottle" linking to the Discovery Set product.
8. Newsletter capture: store submissions in localStorage AND offer a mailto/WhatsApp fallback (no backend yet). Label it "Join the first numbered batch."

════════ STAGE 3 — INGREDIENTS & TRUST PAGE ════════
9. Build the `#/ingredients` page (linked from footer): our transparency story (IFRA-conscious formulation, hand-weighed, patch-test advice) plus per-product allergen declarations, EXACTLY these lists (they come from our lab audit — do not invent or remove entries):
   - SAMR Extrait: Linalool, Benzyl Salicylate, Alpha-Isomethyl Ionone, Coumarin, Vanillin.
   - ASMR Extrait: Linalool, Benzyl Salicylate, Alpha-Isomethyl Ionone, Santalol, Limonene, Geraniol.
   - Note under both: "Full INCI list on every label. Composed-accord documentation in progress with our supplier."
   - Body sprays/creams: same allergens at lower levels; creams contain a broad-spectrum preservative.
   Bilingual EN/AR like the rest of the site.

════════ STAGE 4 — LAUNCH MARKETING KIT (separate deliverables, not website code) ════════
10. Instagram bio (EN + AR) for @[handle placeholder], and a 9-post launch grid plan: the founder story (husband → wife), the two heroes, the duo box, "what is an extrait (28%)", the numbered-batch ritual, wear-test testimonials placeholder, Eid/wedding gifting, discovery set CTA. For each post: caption EN + AR, hashtags, and an image brief matching our art direction (charcoal #2C2825, gold #C4A566, ivory #FBF8F1, nocturnal amber-glass mood).
11. WhatsApp Business catalog text for all 10 SKUs (name, 1-line poetry, price, size) EN + AR.
12. Printable A6 "batch card" design brief to include in every box: batch number, bottle number, date, founder signature line, patch-test note.

RULES: work stage by stage and stop after each for my confirmation; keep all existing copy, prices, and design tokens; everything bilingual with correct RTL; output complete changed files (no fragments); if something is ambiguous, ask ONE question and propose a default instead of stalling.

Start with STAGE 1 now.
