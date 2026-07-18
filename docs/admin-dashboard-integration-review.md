# Admin Dashboard Integration Review

## Scope

Integrate the useful admin-dashboard structure and workflows from the Barberar Services project into the ASMR & SAMR static storefront without redesigning the public website or importing Barberar branding.

## Projects Reviewed

### Barberar Services

Location: `C:\Users\Yousif's PC\Desktop\Ai Projects\Barberar Services-Gemini\web_platform`

Architecture:

- Next.js 16, React 19, TypeScript, Tailwind.
- Admin route tree under `src/app/admin`.
- Protected admin shell in `src/app/admin/layout.tsx`.
- Supabase client in `src/lib/supabase.ts`.
- Role guard in `src/components/auth-guard.tsx`.
- Dashboard pages for overview, services, orders, customers, coupons, employees, teams, roles, reports, activity, integrations, settings, payments, locations, reviews, disputes, taxes, and logs.

Reusable patterns:

- Grouped sidebar navigation.
- Protected admin area pattern using Supabase Auth and `profiles.role`.
- KPI overview cards.
- Product/service CRUD flow.
- Order status management.
- Customer directory.
- Coupons/offers management.
- Activity, reports, settings, and role-management screens.
- Loading/error/fallback patterns.

Excluded from direct copy:

- Barberar/Primora branding, colors, text, icons, stock imagery, service terminology, salon-specific routes, provider/branch/room concepts, and demo data.
- Next.js/Tailwind app shell, because ASMR & SAMR is currently a static hash SPA.

### ASMR & SAMR

Location: `C:\Users\Yousif's PC\Desktop\Ai Projects\Perfume`

Architecture:

- Static hash-based storefront in `website/index.html`, `website/app.js`, and `website/style.css`.
- Existing public routes preserved: home, shop, brand pages, product detail, gifting, journal, contact, account, cart.
- Existing admin route: `#/admin` and `#/admin/<tab>`.
- Existing admin dashboard already managed local products, orders, customers, coupons, content, marketing, reports, and status.
- Existing visual system: warm ivory, sand, stone, champagne/gold, graphite, charcoal, luxury architectural campaign styling.

Supabase schema inspected through configured MCP project `thpuomqhqghqskyegpfj`:

- Project URL: `https://thpuomqhqghqskyegpfj.supabase.co`
- Tables with RLS enabled: `profiles`, `products`, `product_prices`, `product_inventory`, `coupons`, `orders`, `order_items`, `payments`, `newsletter_subscribers`, `content_settings`.
- MCP could not list policy names or execute SQL in this session, so no schema or RLS policy changes were made.

## Implementation Plan Used

1. Preserve existing ASMR dashboard files before edits.
2. Keep the ASMR public website and header/menu untouched.
3. Reuse Barberar's admin information architecture and management workflows, not its styling or domain text.
4. Expand ASMR admin tabs to perfume-domain modules:
   - Overview
   - Orders
   - Products
   - Inventory
   - Customers
   - Wishlist
   - Rewards
   - Gifting
   - Pre-orders
   - Coupons
   - Content
   - Marketing
   - Notifications
   - Reports
   - Roles
   - Settings
   - Status
5. Add a Supabase REST bridge that uses only a publishable/anon key and an authenticated admin session.
6. Keep localStorage fallback so the static site stays usable while Supabase frontend config is not present.
7. Add a config example and ignore local config.
8. Verify syntax and route rendering.

## Supabase Integration Notes

Frontend config is loaded from `website/config.local.js` when present. The file is ignored by Git.

Use `website/config.example.js` as the template. The dashboard never needs or accepts a service-role key in browser code.

2026-07-18 update: production admin routes now render through `admin-dashboard.js` only. The older localStorage admin renderer remains in `website/app.js` only as migration-history fallback behind an explicit development flag and is not the normal `#/admin` route.

When configured and signed in:

- Product edits sync to `products`, `product_prices`, and `product_inventory`.
- Coupon edits sync to `coupons`.
- Content banner edits sync to `content_settings`.
- Order status updates attempt to sync to `orders`.
- Dashboard reads `profiles`, `orders`, `order_items`, `newsletter_subscribers`, and catalog tables.

When not configured:

- The production admin route shows a secure configuration/login state from the Supabase dashboard bridge.
- The legacy local studio can be enabled only through the explicit development fallback flag during migration recovery.
- Public storefront behavior is unchanged.

## Conflicts Identified

- Barberar is a Next/Tailwind app; ASMR is static HTML/CSS/JS.
- Barberar routes are path-based; ASMR routes are hash-based.
- Barberar business models are service/provider/booking oriented; ASMR models are product/order/fragrance/inventory oriented.
- Barberar includes dev-role access shortcuts; ASMR must not import them.
- ASMR currently lacks a committed frontend Supabase key, so live sync requires local or deployment config.

## No Database Changes

No migrations were created. Existing tables were sufficient for the implemented dashboard bridge. Policy names could not be inspected with the available MCP tools, but all inspected tables reported RLS enabled.
