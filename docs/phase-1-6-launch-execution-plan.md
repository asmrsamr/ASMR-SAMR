# ASMR & SAMR Phase 1-6 Launch Execution Plan

Date: 2026-07-18
Branch: `Codex`
Production URL: `https://asmr-samr.pages.dev`

## Objective

Move ASMR & SAMR from prototype into a free, launch-ready ecommerce workflow:

- Cloudflare Pages Free for the public website.
- Supabase Free for catalog, admin data, auth, storage, and orders.
- WhatsApp checkout for order confirmation.
- Admin dashboard for operational control.
- Manual exports and backups until paid tools are justified by sales.

## Phase 1: Secure Access

Completed in the repo and database:

- Admin routes are protected.
- Staff roles are checked before privileged dashboard access.
- Sensitive admin sessions are not stored permanently.
- Service-role keys are not exposed in browser code.
- API key management stores hashes only.
- Security and admin contract tests are in place.

Owner actions still required:

- Rotate or delete any Cloudflare API token that was pasted into chat.
- Accept the recovery admin invite for `jooo4444@gmail.com`.
- Test primary admin login with `j.zoneng@gmail.com`.
- Confirm non-admin users cannot open direct dashboard URLs.

## Phase 2: Live Website QA

Run the live checklist in `docs/live-launch-qa-checklist.md` after every deployment.

Minimum acceptance:

- Home, ASMR, SAMR, Shop, Product, Gifting, Story, Contact, Delivery, Returns, Privacy, and FAQ load on desktop and mobile.
- Product photos are clear and not cropped.
- Stock labels appear where expected.
- Add to Cart works.
- WhatsApp checkout opens a draft message without sending automatically.
- The WhatsApp draft includes the order reference.

## Phase 3: Content Finalization

Completed in this phase:

- Added public Delivery, Return/Exchange, Privacy, and FAQ pages.
- Added footer links to those pages without changing the header navigation.
- Updated static launch metadata to the free production URL and real WhatsApp number.
- Set the public fallback founder metadata to `ASMR & SAMR Fragrances` until a final personal founder name is approved.

Owner review still required:

- Confirm whether the public founder should remain the brand entity or a named person.
- Review delivery/return/privacy language before paid advertising.
- Review Arabic wording with a native legal/brand reviewer before large-scale launch.

## Phase 4: Admin Dashboard Setup

Required live setup:

- Add or verify all real products, prices, sizes, SKUs, stock, and product photos.
- Confirm product publish status for every item shown on the public site.
- Create at least one test order through WhatsApp checkout and confirm it appears in Supabase/admin.
- Test inventory adjustment, low-stock behavior, customer records, newsletter signups, preorder forms, reports, and exports.
- Confirm every operational role sees only the allowed dashboard sections.

Do not create duplicate Supabase tables unless the existing schema cannot support the field after review.

## Phase 5: Free Launch Operations

Free stack:

- Website: Cloudflare Pages Free.
- Database/auth/storage: Supabase Free.
- Checkout: WhatsApp order confirmation.
- Backups: Supabase exports plus dashboard CSV/XLSX/PDF exports.
- Marketing link: Cloudflare Pages URL until a custom domain is approved.

Weekly operating rhythm:

- Export orders, customers, inventory, and finance records.
- Check Supabase usage limits.
- Check Cloudflare deployment status.
- Review failed orders or abandoned WhatsApp drafts.
- Keep a local backup of product image originals.

## Phase 6: Marketing Launch

Launch sequence:

- Add `https://asmr-samr.pages.dev` to Instagram bio.
- Add WhatsApp link `https://wa.me/966560505651`.
- Publish 9 launch posts from `docs/marketing-launch-plan.md`.
- Soft launch to friends/family first.
- Collect comments on scent preference, price clarity, delivery friction, and checkout clarity before paid ads.

## Go/No-Go Gate

Go live when:

- Security token rotation is complete.
- Recovery admin login is accepted.
- Live checkout creates an order reference and opens WhatsApp correctly.
- Admin can see the submitted order.
- All public pages pass mobile QA.
- Product data, prices, and stock are confirmed by the owner.

