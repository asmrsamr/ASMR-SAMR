# Claude Code Prompt: Bring Barberar Admin Dashboard Into ASMR & SAMR Perfume

You are working in:

`C:\Users\Yousif's PC\Desktop\Ai Projects\Perfume`

The goal is to bring the full admin dashboard concept from the Barberar Services project into the ASMR & SAMR perfume website, customize it for the perfume business, and connect it dynamically to the current site.

## Source Project To Study

Inspect the Barberar dashboard first:

`C:\Users\Yousif's PC\Desktop\Ai Projects\Barberar Services-Gemini\web_platform\src\app\admin\page.tsx`

Also inspect child admin pages/components in:

`C:\Users\Yousif's PC\Desktop\Ai Projects\Barberar Services-Gemini\web_platform\src\app\admin`

Extract the useful admin experience details:

- KPI cards
- Revenue overview
- Live platform status
- Recent activity
- Top services/products
- Booking/order source breakdown
- Recent bookings/orders
- Quick actions
- Reports
- Admin navigation/sidebar
- Dense operational layout

Do not copy Barberar branding or service language directly. Translate the structure into a luxury perfume business dashboard.

## Target Project Context

This perfume site is a static hash-based SPA, not Next.js.

Main files:

- `website\index.html`
- `website\app.js`
- `website\style.css`

The public site already has:

- Home route: `#/`
- ASMR page: `#/asmr`
- SAMR page: `#/samr`
- Shop route: `#/shop`
- Product route: `#/product/<product-id>`
- Cart drawer
- WhatsApp checkout
- Account/customer dashboard
- Product data in `website\app.js`
- Product images with WebP first and PNG fallback

Important: keep the existing public header/menu navigation exactly as it is. Do not rename, remove, reorder, or redesign the public navigation tabs.

## Admin Route Requirement

Create or complete a hidden admin route:

`#/admin`

Admin subroutes should work:

- `#/admin`
- `#/admin/products`
- `#/admin/orders`
- `#/admin/content`
- `#/admin/status`
- `#/admin/reports`

The admin dashboard can have its own sidebar and admin navigation inside the admin route, but do not add a new public menu tab unless explicitly requested.

## Dynamic Data Requirement

Because this site is currently static, use localStorage as the first dynamic layer.

Create/administer a local state key such as:

`asmr_samr_admin_state_v1`

The admin dashboard must control and reflect:

- Product active/inactive state
- Product featured-on-home state
- Best seller state
- Product prices by size
- Product stock
- Low stock thresholds
- Product display order
- Product English name/family/description
- Product badge, such as For Her, For Him, Gift Set, Ritual Set, Best Seller
- Launch banner text
- Reserved batch count
- Batch size
- Launch mode, such as preorder/live/private
- Payment mode, such as WhatsApp/bank/gateway
- Fulfillment city
- Order statuses

The public site must read from this admin state:

- Home featured products should use admin-featured products.
- Shop should show only active products.
- Brand pages should show only active products for that brand.
- Product detail pages should not show inactive products.
- Add to Cart and Buy Now should use the latest admin price.
- Existing cart items should sync to current catalog price and remove inactive/unavailable products before checkout.
- Header announcement banner should use admin content settings.

## Perfume Admin Dashboard Content

Customize the Barberar dashboard concepts into ASMR & SAMR:

### Overview

Include:

- Revenue logged
- Batch B.077 progress
- Active catalog count
- Inventory/low-stock count
- Revenue overview chart/bars
- Live platform status
- Top products
- Recent activity feed
- Quick actions

Use perfume-specific language:

- Batch B.077
- WhatsApp orders
- Preorders/reservations
- Discovery Set
- Duo Box
- Gift sets
- Ritual sets
- Extrait, body spray, body cream

### Products

Create a catalog manager for all products:

- Product image thumbnail
- Product name
- Brand/family
- Price inputs by size
- Stock input
- Sort order input
- Active checkbox
- Featured checkbox
- Best seller checkbox
- Details editor/modal for name, family, description, badge, hero size, low-stock threshold, lead time
- Filters: All, SAMR, ASMR, Sets, Low stock, Inactive

### Orders

Use existing local order storage:

- `asmr_samr_orders`
- `asmr_samr_preorders`

Show:

- WhatsApp checkout orders
- Buy-now orders
- Preorder leads
- Order statuses
- Resend/open WhatsApp message action

### Content

Create admin settings for:

- Announcement banner English
- Announcement banner Arabic
- Reserved count
- Batch size
- Launch mode
- Payment mode
- Fulfillment city
- Low-stock global alert

### Status

Show health checks for:

- Storefront route
- Catalog
- Product images/WebP assets
- WhatsApp number
- Batch mode
- Inventory alerts

### Reports

Show:

- Sales total
- Newsletter count
- Inventory total
- Low stock count
- Batch progress
- Export JSON action

## Design Requirements

Match the perfume site’s luxury beige campaign style:

- Warm beige/stone background
- Charcoal admin sidebar
- Gold accents
- Serif headings
- Clean dense operational panels
- No childish colors
- No generic SaaS purple/blue look
- No oversized fonts
- No coordinates anywhere
- Mobile responsive

Do not make it a marketing page. It must feel like a practical luxury operations dashboard.

## Functional Constraints

- Keep all existing shop/product/cart functionality working.
- Do not break Arabic/English switching.
- Do not change public nav labels, order, or header structure.
- Do not remove existing product photos.
- Keep WebP image usage with PNG backup.
- Use existing helper patterns in `website\app.js`.
- Use plain JavaScript and CSS. Do not introduce React, Next.js, build tools, or backend services unless requested.
- Avoid destructive file changes.

## Suggested Implementation Plan

1. Inspect current `website\app.js`, `website\style.css`, and `website\index.html`.
2. Inspect Barberar admin source and map features to perfume equivalents.
3. Add admin localStorage state helpers.
4. Add product/public catalog helpers:
   - `getPublicProducts`
   - `getFeaturedProducts`
   - `getProductById(productId, { includeInactive })`
   - `applyAdminState`
5. Add admin render functions:
   - `renderAdmin`
   - `renderAdminOverview`
   - `renderAdminProducts`
   - `renderAdminOrders`
   - `renderAdminContent`
   - `renderAdminStatus`
   - `renderAdminReports`
6. Add admin action handlers:
   - Save product row
   - Open/close product editor
   - Save product details
   - Filter products
   - Update order status
   - Save content settings
   - Add sample order
   - Reset local admin state
   - Export admin JSON
7. Wire admin routes into the existing router.
8. Update public pages to read admin-aware catalog state.
9. Add admin CSS in `website\style.css`.
10. Bump cache query strings in `website\index.html`.
11. Validate routes in browser.

## Validation Checklist

Run:

`node --check website\app.js`

Open and verify:

- `http://localhost:8000/#/admin`
- `http://localhost:8000/#/admin/products`
- `http://localhost:8000/#/admin/orders`
- `http://localhost:8000/#/admin/content`
- `http://localhost:8000/#/shop`
- `http://localhost:8000/#/product/samr-extrait`

Confirm:

- Admin route renders without JS errors.
- Products admin page shows all products.
- Product save updates localStorage.
- Inactive product disappears from public shop.
- Featured product affects home featured section.
- Price edits affect product page/cart/WhatsApp order price.
- Content banner changes public header announcement.
- Orders and preorders appear in admin.
- Public nav still has the same labels/order.
- Mobile layout does not overlap.

## Final Response Expected

When finished, summarize:

- Files changed
- Admin route URL
- What dashboard features were added
- What public pages are dynamically connected
- Validation performed
- Any remaining limitations, especially that localStorage is device-local until a backend is added

