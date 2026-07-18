# Live Launch QA Checklist

Production URL: `https://asmr-samr.pages.dev`

Run this checklist after each Cloudflare Pages deployment.

## Public Pages

Test on desktop and mobile:

- `#/`
- `#/asmr`
- `#/samr`
- `#/shop`
- `#/shop/extrait`
- `#/shop/spray`
- `#/shop/cream`
- `#/shop/sets`
- `#/product/samr-extrait`
- `#/product/asmr-extrait`
- `#/gifting`
- `#/story`
- `#/contact`
- `#/ingredients`
- `#/delivery`
- `#/returns`
- `#/privacy`
- `#/faq`

Pass criteria:

- Header tabs keep the same labels and order.
- No coordinates appear anywhere.
- Product photos load clearly.
- Product cards are consistent.
- Prices are visible.
- Stock labels appear where expected.
- Footer links work.
- No visible console errors.

## Checkout Smoke

Do not send the WhatsApp message during smoke testing.

Steps:

1. Open `#/shop`.
2. Add `SAMR Extrait` to cart.
3. Open cart.
4. Submit checkout.
5. Confirm WhatsApp opens a draft to `+966560505651`.
6. Confirm the draft contains `Order Reference:`.
7. Close the WhatsApp draft without sending.

Pass criteria:

- Cart validates live catalog data before checkout.
- The order reference is present.
- The product name, size, quantity, and total are in the draft.
- No automatic message is sent.

## Admin Acceptance

Use a real admin account.

- Login works.
- Logout works.
- Direct admin URLs refresh correctly.
- Sidebar scrolls independently.
- Products, orders, inventory, users, marketing, finance, reports, and settings open the correct content.
- Unauthorized users are blocked from protected routes.

