# Static Deployment Package

The website is a static application. Build a clean deployable package with:

```bash
python scripts/build_static_site.py --output dist
```

The script copies `website/` into `dist/`, excludes developer-local
`website/config.local.js`, and generates a new browser-visible
`dist/config.local.js` from environment variables.

Required production environment variables:

- `ASMR_SAMR_SUPABASE_URL`
- `ASMR_SAMR_SUPABASE_ANON_KEY`
- `ASMR_SAMR_WHATSAPP_NUMBER`
- `ASMR_SAMR_SITE_DOMAIN`
- `ASMR_SAMR_FOUNDER_NAME`

Optional public variables:

- `ASMR_SAMR_INSTAGRAM_URL`
- `ASMR_SAMR_PRODUCTION_CITY_EN`
- `ASMR_SAMR_PRODUCTION_CITY_AR`
- `ASMR_SAMR_RESERVED_COUNT`

Example:

```bash
ASMR_SAMR_SUPABASE_URL="https://thpuomqhqghqskyegpfj.supabase.co" \
ASMR_SAMR_SUPABASE_ANON_KEY="YOUR_PUBLISHABLE_KEY" \
ASMR_SAMR_WHATSAPP_NUMBER="966560505651" \
ASMR_SAMR_SITE_DOMAIN="https://your-production-domain.com" \
ASMR_SAMR_FOUNDER_NAME="Founder Name" \
python scripts/build_static_site.py --output dist
```

Do not put service-role keys, payment secrets, GitHub tokens, or any private
credential in these variables. `config.local.js` is loaded by browsers and is
public by design.

Verify before uploading `dist/`:

```bash
python website/test_deploy_package.py
python -m http.server 8000 --directory dist
```

Then open `http://localhost:8000/#/admin/status` and confirm launch readiness.

For free hosting setup, see [cloudflare-pages-free-hosting.md](cloudflare-pages-free-hosting.md).
