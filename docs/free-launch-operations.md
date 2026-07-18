# Free Launch Operations Runbook

## Free Stack

- Hosting: Cloudflare Pages Free.
- Database/Auth/Storage: Supabase Free.
- Checkout: WhatsApp.
- Backups: Supabase exports plus dashboard exports.
- Analytics: Cloudflare Web Analytics or lightweight manual reporting.

## Daily

- Check new WhatsApp orders.
- Confirm payment and delivery manually.
- Update order status in admin.
- Check low-stock product alerts.
- Reply to contact, preorder, and consultation requests.

## Weekly

- Export orders, customers, inventory, and finance records.
- Save a backup copy outside the project folder.
- Review Supabase usage limits.
- Review Cloudflare deployment health.
- Check broken images or console errors.
- Review product profitability and stock movement.

## Monthly

- Review best sellers.
- Review abandoned carts and WhatsApp drafts.
- Refresh product photos or campaign sections if needed.
- Archive inactive campaigns.
- Reconcile finance ledger with real payments.
- Decide whether paid checkout is justified.

## Upgrade Triggers

Add a paid payment gateway only when:

- Manual WhatsApp checkout becomes a bottleneck.
- Customers ask for card/apple pay repeatedly.
- Order volume makes manual reconciliation risky.
- The cost is justified by recurring sales.

Candidate gateways later:

- Stripe if available for the final business setup.
- Tap Payments.
- Moyasar.
- HyperPay.

