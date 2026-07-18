# Admin Operations Acceptance Checklist

Use this after the primary and recovery admin accounts are active.

## Admin Accounts

- Primary admin: `j.zoneng@gmail.com`
- Recovery admin: `jooo4444@gmail.com`

Required checks:

- Both admins can sign in.
- Both admins can sign out.
- Recovery admin invite is accepted.
- Non-admin users cannot access `#/admin` or direct admin subroutes.
- Role-specific users see only allowed modules.

## Product And Inventory Setup

Verify every sellable item:

- Product title.
- Brand identity: ASMR, SAMR, Duo, Discovery, Ritual.
- Category and collection.
- Concentration or product type.
- Size, SKU, barcode if available.
- Price, cost, tax, discount.
- Stock quantity and low-stock threshold.
- Primary image and additional images.
- Publish status.
- Availability status.

Test:

- Create product.
- Edit product.
- Duplicate product.
- Archive/unpublish product.
- Upload images.
- Select primary image.
- Adjust stock.
- Confirm stock movement history.

## Orders And Customers

Test:

- Submit a storefront order.
- Confirm the order appears in admin.
- Change status.
- Add internal note.
- Confirm customer record is created or linked.
- Confirm order reference is searchable.
- Export order data without secret fields.

## Production And Finance

Before launch, verify:

- Ingredient records exist for real materials.
- Low-stock ingredient alerts work.
- Formula access is role-restricted.
- Batch confirmation does not allow negative stock without admin override.
- Ledger transactions can be created, reversed, filtered, and exported.
- Product cost reports match approved business assumptions.

## Reports And Exports

Export and open:

- Products CSV/XLSX.
- Inventory CSV/XLSX.
- Orders CSV/XLSX.
- Customers CSV/XLSX.
- Finance report.
- Printable/PDF report where available.

Do not export raw API keys, passwords, service-role keys, or private secrets.

