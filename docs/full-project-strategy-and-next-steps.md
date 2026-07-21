# ASMR & SAMR Full Project Strategy And Remaining Steps

Date: 2026-07-22
Branch: `Codex`
Current production target: `https://asmr-samr.pages.dev`
Current checkout path: WhatsApp `966560505651`

## Current Status

The project is now shaped as a luxury fragrance ecommerce site with a working public storefront, product pages, cart, WhatsApp checkout flow, and Supabase-backed admin architecture. The design direction should remain stable: warm ivory, sand, stone, champagne, graphite, charcoal, architectural campaign photography, and restrained luxury typography.

Current technical baseline:

- `#/admin` and `#/admin/<tab>` render through the Supabase-backed dashboard, not the legacy localStorage admin.
- Live Supabase launch pricing matches the latest Excel revisions.
- Static deployment rewrites storefront/admin bundle query strings to one shared cache-busting version.
- The live manual-payment checkout migration is applied and the new RPC signature is verified.
- Desktop and 375 px mobile route QA passes locally after fixing closed-drawer overflow and the mobile Account header offset.
- Both Supabase administrator profiles are verified as `admin / active`; the recovery account is confirmed and has signed in successfully.
- Automated gates currently pass: 226 website checks, 37 admin checks, 29 security checks, and 16 deployment-package checks.
- Production Cloudflare deployment remains blocked only by the missing GitHub secret `CLOUDFLARE_API_TOKEN`; the current live site still serves the older mixed-version assets.

The free launch stack is:

- Cloudflare Pages Free for the static website.
- Supabase Free for database, auth, storage, and backend functions while traffic is small.
- WhatsApp for checkout and customer confirmation.
- GitHub for version control and future Cloudflare auto-deploys.

Official limits must still be watched before a large campaign:

- Cloudflare Pages Free currently supports free static asset requests and a generous Pages free tier.
- Supabase Free currently supports getting started with free projects, but limits and inactivity behavior must be monitored from the Supabase dashboard.
- A custom root domain such as `asmr-samr.dev` is not free because the domain registration itself is paid. The free URL should remain `https://asmr-samr.pages.dev` until a domain is purchased.

## Source Of Truth

Product prices and costing should come from the latest Excel revisions, then flow into Supabase and the storefront.

Current imported source files:

- `ASMR/ASMR 008/ASMR Perfume 008.xlsx`
- `SAMR/SAMR 011/SAMR Perfume 011.xlsx`
- `ASMR/Perfume 007/ASMR Body Spray 007.xlsx`
- `ASMR/Perfume 007/ASMR Cream 007.xlsx`
- `SAMR/SAMR 008/SAMR Body Spray 008.xlsx`
- `SAMR/SAMR 008/SAMR Cream 008.xlsx`

Generated artifacts:

- `data/product-pricing-latest.json`
- `supabase/imports/product-pricing-latest.sql`
- `supabase/imports/product-pricing-prices-only.sql`
- `supabase/imports/product-pricing-update-existing.sql`
- `scripts/extract_excel_product_pricing.py`
- `scripts/verify_live_launch_pricing.py`

Current launch prices:

- SAMR Extrait 50 ml: `230 SAR`
- ASMR Extrait 50 ml: `320 SAR`
- SAMR Extrait sizes: `10 ml 60`, `30 ml 160`, `50 ml 230`, `70 ml 290`, `100 ml 370`
- ASMR Extrait sizes: `10 ml 80`, `30 ml 210`, `50 ml 320`, `70 ml 420`, `100 ml 560`
- Duo Box: `499 SAR`
- SAMR Trio: `379 SAR`
- ASMR Trio: `499 SAR`
- Discovery Set: `60 SAR`

Do not update sellable stock directly through the pricing SQL. Use the admin dashboard or stock RPCs so stock movement history and audit logs stay correct.

## Immediate Phase

1. Create a new least-privilege Cloudflare Pages token and store it only as the GitHub Actions secret `CLOUDFLARE_API_TOKEN`.
2. Rerun the deployment workflow and verify the production asset cache version.
3. Run authenticated admin CRUD/RLS QA using owner-supplied local test credentials; do not store a password in the repository.
4. Enter real inventory stock through the admin dashboard.
5. Confirm final delivery, returns, founder, and inventory metadata.

## Admin Access Verification

Primary admin email: `j.zoneng@gmail.com`
Recovery admin email: `jooo4444@gmail.com`

Verified on 2026-07-22:

- Both profiles exist in `public.profiles` with role `admin` and status `active`.
- The recovery Auth user is confirmed and has completed a successful sign-in.
- No replacement invite or temporary password is required.

Remaining acceptance work is to run the authenticated admin CRUD/RLS test suite with credentials supplied only through local environment variables. No password should be committed, pasted into chat, or stored in the browser configuration.

Do not paste Supabase service-role keys, API secrets, or personal tokens into chat or source files.

## Launch Phase 1: Data And Catalog

Goal: make the storefront and admin dashboard show the same truth.

Steps:

1. Keep `python scripts/verify_live_launch_pricing.py` green after any pricing change.
2. Verify `product_prices`, `product_variants`, `product_cost_components`, and `product_cost_snapshots` during authenticated admin QA.
3. Use `supabase/imports/product-pricing-update-existing.sql` only if live prices drift again.
4. Enter live stock quantities through Product or Inventory adjustments.
5. Upload final product images to Supabase Storage if the live database does not already reference the optimized WebP assets.
6. Confirm every product has status, availability, primary image, price, SKU, and public description.
7. Confirm archived or unavailable products do not appear as buyable.

Acceptance:

- Public shop prices match the Excel launch prices.
- Admin prices match public prices.
- Cart price and WhatsApp price match the product detail page.
- Stock movements are recorded for every inventory change.

## Launch Phase 2: Admin QA

Goal: prove the dashboard can run daily operations.

Test:

- Login and logout.
- Protected route access for admin, staff, and non-admin users.
- Product CRUD.
- Product image upload and replacement.
- Inventory add, remove, adjustment, damage, sample, return, and low-stock flow.
- Orders and order status changes.
- Customers and account records.
- Ingredients, suppliers, batches, formulas, production, finance, marketing, reports, and settings.
- API key creation, one-time reveal, rotation, revoke, delete, and activity log.
- CSV, XLSX, PDF, and print exports.

Acceptance:

- No dashboard tab shows another tab's content.
- Direct URLs, refresh, back, and forward work.
- No console or network errors in normal flows.
- Unauthorized users cannot access protected data.

## Launch Phase 3: Public QA

Goal: make the customer experience safe for a soft launch.

Test:

- Home, ASMR, SAMR, Shop, Product, Gifting, Story, Contact, Delivery, Returns, Privacy, FAQ, Cart, and Account.
- Desktop, tablet, and mobile.
- Product photos are clear and not cropped.
- Buttons and forms have loading, success, empty, and error states.
- WhatsApp checkout opens with the correct number and order reference.
- Arabic/English language switching if enabled.

Acceptance:

- No coordinates anywhere.
- Header navigation labels and order remain unchanged.
- The luxury design theme is preserved.
- Checkout works without asking the customer to understand technical details.

## Launch Phase 4: Deployment

Goal: run the public site for free until traffic or business needs justify payment.

Preferred path:

1. Connect the GitHub repository to Cloudflare Pages.
2. Set the production branch to `Codex` only if this branch is intended to be the launch branch. Otherwise merge `Codex` into the chosen production branch.
3. Configure build command and output directory if Cloudflare is not already using the prepared static package.
4. Add public environment variables only. Never add secret keys to frontend config.
5. Deploy to `https://asmr-samr.pages.dev`.
6. Run the live QA checklist.

Manual fallback:

1. Build the static site locally.
2. Deploy with Wrangler only after a new Cloudflare token is created and stored safely outside the repo.
3. Delete or rotate the deployment token after use if you do not want it kept.

## Launch Phase 5: Operations

Goal: keep the free setup healthy.

Weekly:

- Export orders, products, inventory, customers, and finance.
- Check Supabase usage and project activity.
- Check Cloudflare deployment history.
- Review failed checkout/order logs.
- Back up original product images and Excel workbooks.

Daily during launch:

- Check WhatsApp orders.
- Update order statuses.
- Record stock changes.
- Record returns, refunds, samples, and damaged stock.
- Review low-stock alerts.

## Launch Phase 6: Marketing

Goal: sell the story without breaking the operations.

Soft launch:

1. Put `https://asmr-samr.pages.dev` in Instagram bio.
2. Use the WhatsApp link `https://wa.me/966560505651`.
3. Launch ASMR, SAMR, Duo Box, Discovery Set, and Trio content first.
4. Ask early customers about scent direction, price clarity, delivery friction, and gift packaging.
5. Fix operational issues before paid ads.

Paid marketing should wait until:

- Admin access is fully recovered.
- Recovery admin works.
- Product data is correct in Supabase.
- Live checkout has been tested end to end.
- Delivery/returns/privacy wording is approved.

## Remaining Decisions

- Final public website domain.
- Final founder/public brand metadata.
- Delivery cities, fees, and timelines.
- Return/exchange policy wording.
- Whether payment stays WhatsApp-only or moves to payment links.
- Real initial stock quantities per size and set.
- Real SKU/barcode format.
- Supplier costs for discovery packaging, boxes, bottles, caps, labels, and shipping.

## Do Not Do Yet

- Do not start paid ads before admin recovery is working.
- Do not hardcode new stock numbers in frontend code.
- Do not create duplicate Supabase tables for data that already has a table.
- Do not expose API keys, service-role keys, GitHub tokens, or Cloudflare tokens.
- Do not redesign the website unless a separate design phase is approved.
