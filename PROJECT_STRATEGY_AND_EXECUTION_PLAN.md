# ASMR & SAMR Project Strategy and Execution Plan

## Objective

Turn ASMR & SAMR from a polished static perfume website into a launch-ready luxury fragrance commerce system with a real admin backend, operational inventory controls, GitHub deployment workflow, and a clear marketing funnel.

The project should feel like a luxury fragrance house on the public side and like a practical operations console on the admin side.

## Current Status

- GitHub repository is connected: `asmrsamr/ASMR-SAMR`.
- Main branch has the initial project commit.
- Supabase MCP is configured for project `thpuomqhqghqskyegpfj`.
- Supabase database connection has been verified.
- Current Supabase tables include products, prices, inventory, orders, payments, newsletter subscribers, profiles, coupons, and content settings.
- The website is a static hash-based SPA in `website/`.
- The site already has product pages, cart, WhatsApp checkout, WebP product photos, ASMR/SAMR campaign pages, and a localStorage admin dashboard.
- GitHub is authenticated as `asmrsamr`.

## Brand Positioning

Core idea:

**Two energies. One signature.**

ASMR:

- Dark bottle, black cap.
- Warm city and stone mood.
- Quiet confidence.
- Tagline: `PRESENCE THAT STAYS.`
- Bottom campaign copy: `QUIET CONFIDENCE. STRENGTH WITHOUT NOISE.`

SAMR:

- Blush/clear bottle, cream cap.
- Beige architectural arches, dried florals, soft shadows.
- Softness with presence.
- Tagline: `THE SCENT HE CANNOT FORGET.`
- Bottom campaign copy: `SOFTNESS WITH PRESENCE. ELEGANCE THAT LINGERS.`

Commercial anchors:

- Duo Box is the main gifting product.
- Discovery Set reduces hesitation.
- Trio Sets create a premium ritual/layering offer.
- WhatsApp checkout is the short-term purchase path.
- Supabase should become the source of truth for catalog, orders, content, inventory, and admin settings.

## Phase 1: Repository and Workflow Foundation

Goal: make the project safe to develop, commit, review, and deploy.

Required steps:

1. Keep `main` stable and production-ready.
2. Create branches for each meaningful change:
   - `agent/supabase-backend`
   - `agent/admin-supabase-integration`
   - `agent/frontend-polish`
   - `agent/deployment`
3. Use focused commits with clear names.
4. Avoid committing secrets, local agent folders, cache folders, or temporary Office files.
5. Keep `.gitignore` and `.gitattributes` maintained.
6. Add a lightweight `README.md` at repo root explaining:
   - how to run the website locally
   - where the website files live
   - how admin currently works
   - deployment notes
7. Add a release checklist file before launch.

Acceptance criteria:

- `git status` is clean after every commit.
- GitHub shows the correct branch and commit.
- No secrets are committed.
- Local website still runs at `http://localhost:8000/#/`.

## Phase 2: Supabase Backend Foundation

Goal: make Supabase the real source of truth.

Required steps:

1. Inspect current Supabase schema:
   - `profiles`
   - `products`
   - `product_prices`
   - `product_inventory`
   - `coupons`
   - `orders`
   - `order_items`
   - `payments`
   - `newsletter_subscribers`
   - `content_settings`
2. Confirm column names, constraints, indexes, and relationships.
3. Decide which tables are public-readable and which are admin-only.
4. Enable RLS on public schema tables.
5. Create policies:
   - Public can read active products and public content settings.
   - Public can insert newsletter signups.
   - Public can create orders only through safe insert rules or an Edge Function.
   - Admin users can manage catalog, inventory, content, and order status.
6. Add seed data matching the current static product catalog.
7. Store image paths in Supabase but keep image files in the repo or later move them to Supabase Storage.
8. Add environment configuration:
   - Supabase project URL
   - Supabase publishable key
9. Avoid exposing service-role keys in the frontend.

Acceptance criteria:

- Supabase products match the current website catalog.
- Active products can be selected safely.
- Inactive products do not appear in public queries.
- RLS is enabled and tested.
- Admin-only operations are protected.

## Phase 3: Public Website Dynamic Catalog

Goal: replace hardcoded product data with Supabase-backed data while preserving current design.

Required steps:

1. Add a small Supabase client layer to the static website.
2. Load public catalog data from Supabase:
   - products
   - prices
   - inventory
   - badges
   - featured products
   - campaign settings
3. Keep a local static fallback so the website still renders if Supabase is temporarily unavailable.
4. Update these routes:
   - `#/`
   - `#/shop`
   - `#/asmr`
   - `#/samr`
   - `#/product/<id>`
5. Preserve the current header/menu labels and order.
6. Keep current product images and WebP fallback behavior.
7. Sync cart prices against the latest Supabase product price before checkout.
8. Block inactive/unavailable products from cart and buy-now actions.
9. Add user-facing loading, empty, and error states that match the luxury design.

Acceptance criteria:

- Shop renders from Supabase data.
- Product detail pages render from Supabase data.
- Home featured products are controlled from Supabase.
- Cart uses current Supabase price.
- Existing visual design is preserved.

## Phase 4: Admin Dashboard Supabase Integration

Goal: move the admin dashboard from device-local localStorage to real Supabase operations.

Required steps:

1. Keep the existing `#/admin` route as the admin shell.
2. Add admin authentication:
   - short term: protected admin login with Supabase Auth
   - later: role-based admin profile records
3. Replace localStorage admin state with Supabase reads/writes:
   - products
   - prices
   - inventory
   - content settings
   - orders
   - preorders/newsletter
4. Keep localStorage as a temporary draft/fallback layer only if useful.
5. Add admin CRUD flows:
   - activate/deactivate products
   - edit product name/family/description
   - edit badges
   - edit prices by size
   - update stock and low-stock thresholds
   - set featured products
   - set best-seller flags
   - update order status
   - export operational data
6. Add confirmation and toast states for writes.
7. Add validation for required fields and numeric price/stock values.
8. Add audit-friendly timestamps where possible.

Acceptance criteria:

- Admin edits persist across devices.
- Public website reflects admin changes after refresh.
- Admin cannot be accessed by unauthenticated public visitors.
- Product and order writes are protected by RLS or secure backend functions.

## Phase 5: Checkout and Orders

Goal: make WhatsApp checkout operational while preparing for payment links.

Required steps:

1. Keep WhatsApp checkout as the immediate launch path.
2. When checkout starts, create an order record in Supabase.
3. Generate a clear WhatsApp message from that order.
4. Store:
   - customer name
   - phone
   - city
   - address if provided
   - cart items
   - subtotal
   - VAT
   - total
   - order status
   - source route
5. Add admin order statuses:
   - new
   - confirmed
   - awaiting payment
   - preparing
   - ready
   - delivered
   - cancelled
6. Add coupon support after base order flow is stable.
7. Later integrate a payment provider:
   - Tap
   - Moyasar
   - Stripe
   - payment links

Acceptance criteria:

- Every WhatsApp checkout creates an order.
- Admin dashboard shows the order.
- Order status can be updated.
- Customer message contains accurate item and price data.

## Phase 6: Content, Trust, and Launch Pages

Goal: make the site persuasive enough to sell.

Required steps:

1. Add trust sections:
   - Made in small batches
   - Extrait concentration
   - Gift packaging
   - Delivery inside Saudi Arabia
   - Return/exchange policy
   - WhatsApp support
2. Strengthen product pages:
   - notes/profile
   - who it is for
   - how to wear
   - best paired with
   - gift-ready section for sets
3. Add SEO basics:
   - page title
   - meta description
   - Open Graph image
   - structured product data later
4. Add Arabic copy review.
5. Make sure no coordinates appear anywhere.
6. Keep all typography scaled down and mobile-safe.

Acceptance criteria:

- Site communicates luxury and trust.
- Product pages answer buying questions.
- Mobile text and controls do not overlap.
- SEO metadata is present.

## Phase 7: Deployment

Goal: publish the website reliably.

Required steps:

1. Decide hosting:
   - GitHub Pages for static launch, or
   - OpenAI Sites, or
   - Vercel/Netlify
2. Configure production environment variables safely.
3. Ensure hash routes work on the chosen host.
4. Add deployment instructions.
5. Add pre-launch checks:
   - product images load
   - Supabase reads work
   - admin login works
   - checkout creates orders
   - WhatsApp opens with correct message
   - mobile layout passes review
6. Add a rollback plan.

Acceptance criteria:

- Production URL works.
- Admin can manage products.
- Shop and checkout work on mobile.
- Deployment steps are documented.

## Phase 8: Marketing Funnel

Goal: create a launch system, not just a website.

Required steps:

1. Build a simple funnel:
   - landing page sells emotion
   - ASMR/SAMR pages sell identity
   - Discovery Set reduces hesitation
   - Duo Box drives gifting
   - WhatsApp closes the sale
2. Create campaign assets:
   - Instagram posts
   - reels/story copy
   - WhatsApp broadcast text
   - product launch captions
3. Track newsletter/preorder signups.
4. Create first launch offer:
   - Discovery Set redeemable against full bottle
   - Duo Box gifting offer
5. Add analytics later:
   - page views
   - product clicks
   - checkout clicks
   - WhatsApp conversion intent

Acceptance criteria:

- Launch campaign has clear copy and offer.
- Leads are captured.
- Admin can see demand signals.

## Immediate Next Branches

Recommended branch order:

1. `agent/root-readme-and-release-checklist`
2. `agent/supabase-schema-audit`
3. `agent/supabase-public-catalog`
4. `agent/admin-supabase-integration`
5. `agent/checkout-orders`
6. `agent/deployment`

## Immediate Next Task

Start with Supabase schema audit and root documentation.

Why:

- The repo is now on GitHub.
- Supabase is connected.
- The website already has a local admin dashboard.
- The next highest-value step is turning existing local data into real Supabase data safely.

First implementation target:

**Create a Supabase-backed catalog read layer while preserving the existing static fallback.**

