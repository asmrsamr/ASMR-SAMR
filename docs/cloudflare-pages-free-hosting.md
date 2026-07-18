# Free Hosting With Cloudflare Pages

Recommended free launch stack:

- **Cloudflare Pages** for the static website.
- **Supabase Free** for Auth, users, admin data, catalog, orders, and storage.
- **GitHub** as the source repository.

This gives you a free public URL first, then you can add the final domain later.

## Cloudflare Pages Setup

1. Create or sign in to a free Cloudflare account.
2. Go to **Workers & Pages**.
3. Choose **Create application** then **Pages**.
4. Connect GitHub.
5. Select the `asmrsamr/ASMR-SAMR` repository.
6. Set production branch to `Codex` for now, or `main` after merging.
7. Use these build settings:

| Setting | Value |
| --- | --- |
| Framework preset | None |
| Build command | `python scripts/build_static_site.py --output dist` |
| Build output directory | `dist` |
| Root directory | `/` |

The repo also includes `wrangler.toml` with:

```toml
pages_build_output_dir = "./dist"
```

## Environment Variables

Add these as **plain text** Cloudflare Pages environment variables for
Production and Preview:

| Variable | Value |
| --- | --- |
| `ASMR_SAMR_SUPABASE_URL` | `https://thpuomqhqghqskyegpfj.supabase.co` |
| `ASMR_SAMR_SUPABASE_ANON_KEY` | Your Supabase publishable key |
| `ASMR_SAMR_WHATSAPP_NUMBER` | `966560505651` |
| `ASMR_SAMR_SITE_DOMAIN` | Use the Cloudflare Pages URL until the final domain is ready |
| `ASMR_SAMR_FOUNDER_NAME` | Approved public founder name |

Optional:

| Variable | Value |
| --- | --- |
| `ASMR_SAMR_INSTAGRAM_URL` | Instagram profile URL |
| `ASMR_SAMR_PRODUCTION_CITY_EN` | `Riyadh` |
| `ASMR_SAMR_PRODUCTION_CITY_AR` | `الرياض` |
| `ASMR_SAMR_RESERVED_COUNT` | Current B.077 reservation count |

Do not add service-role keys, payment secrets, GitHub tokens, or private
credentials. These values are written into browser-visible `config.local.js`.

## After First Deploy

Cloudflare will give you a free URL like:

```text
https://asmr-samr.pages.dev
```

Use that URL as `ASMR_SAMR_SITE_DOMAIN` until your real domain is ready, then
redeploy.

## Smoke Test

After deploy:

1. Open the Cloudflare Pages URL.
2. Visit `/#/shop` and confirm product cards load from Supabase.
3. Visit `/#/admin/status`.
4. Confirm WhatsApp checkout is ready.
5. Confirm domain and founder metadata show the expected status.
6. Add one product to cart.
7. Click checkout and confirm WhatsApp opens with `966560505651`.

Do not complete fake customer orders in production unless you plan to clean them
from the admin dashboard afterwards.

## If The Live Site Is Stale

Current diagnostic on 2026-07-18:

- Local build from `Codex` commit `2aeb3c9` produces one asset version: `?v=2aeb3c9`.
- `https://asmr-samr.pages.dev` still served older mixed versions during the check: `launch-phases-20260718a` and `admin-operations-20260717c`.
- GitHub Actions quality gate passed for commit `2aeb3c9`, so the stale live site is a Cloudflare deployment/configuration issue, not a repository test failure.

Check Cloudflare Pages:

1. Open **Workers & Pages** then the `asmr-samr` Pages project.
2. Go to **Deployments** and confirm whether a build exists for commit `2aeb3c9`.
3. If it failed, open the build log and confirm the build command is `python scripts/build_static_site.py --output dist` and output directory is `dist`.
4. If no build exists, go to **Settings > Builds & deployments** and confirm the production branch is `Codex`.
5. Retry the latest deployment after fixing the branch/build settings.

You can verify the live deployment from the repo with:

```bash
python scripts/verify_live_deployment.py --expected-version 2aeb3c9
```

## Optional GitHub Manual Deploy

The repository includes a manual-only workflow:

```text
.github/workflows/cloudflare-pages-manual-deploy.yml
```

Use it only if Cloudflare Git integration is not auto-deploying.

Required GitHub secret:

- `CLOUDFLARE_API_TOKEN`

Required GitHub variable or secret:

- `CLOUDFLARE_ACCOUNT_ID`

Optional GitHub variables:

- `CLOUDFLARE_PAGES_PROJECT` default: `asmr-samr`
- `ASMR_SAMR_SUPABASE_URL`
- `ASMR_SAMR_WHATSAPP_NUMBER`
- `ASMR_SAMR_SITE_DOMAIN`
- `ASMR_SAMR_FOUNDER_NAME`
- `ASMR_SAMR_INSTAGRAM_URL`
- `ASMR_SAMR_PRODUCTION_CITY_EN`
- `ASMR_SAMR_PRODUCTION_CITY_AR`
- `ASMR_SAMR_RESERVED_COUNT`

Optional GitHub secret:

- `ASMR_SAMR_SUPABASE_ANON_KEY`

Do not paste Cloudflare tokens into chat or commit them. Add them in GitHub
repository settings as Actions secrets.
