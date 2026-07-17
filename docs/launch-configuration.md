# Launch Configuration

The public site reads non-secret launch values from `window.ASMR_SAMR_CONFIG`
before `website/app.js` starts. Keep secrets out of this file. Supabase service
role keys, payment secrets, and private tokens must never be placed here.

Required before launch:

- `whatsappNumber`: merchant WhatsApp number with country code and digits only.
- `siteDomain`: final production storefront URL without a trailing slash.
- `founderName`: public founder name for JSON-LD structured data.
- `supabaseUrl`: Supabase project URL.
- `supabaseAnonKey`: Supabase publishable or anon key only.

Optional public values:

- `instagramUrl`
- `productionCityEn`
- `productionCityAr`
- `reservedCount`

Example:

```js
window.ASMR_SAMR_CONFIG = {
  supabaseUrl: 'https://thpuomqhqghqskyegpfj.supabase.co',
  supabaseAnonKey: 'YOUR_SUPABASE_PUBLISHABLE_OR_ANON_KEY',
  whatsappNumber: '9665XXXXXXXX',
  siteDomain: 'https://your-production-domain.com',
  founderName: 'Founder Name',
  instagramUrl: 'https://instagram.com/asmr.samr.perfumes',
  productionCityEn: 'Riyadh',
  productionCityAr: 'الرياض',
  reservedCount: 42,
  adminRoles: ['admin', 'manager', 'finance', 'marketing', 'inventory', 'production', 'support'],
  adminRequireAuth: true
};
```

After editing deployment config, verify:

1. Open `#/admin/status`.
2. Confirm WhatsApp checkout, production domain, and founder metadata are ready.
3. Open `#/contact` and verify the WhatsApp CTA uses the real merchant number.
4. Run one real checkout smoke test after the number is live.
