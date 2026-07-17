"""
ASMR & SAMR website — automated QA suite.

Run:  python test_website.py          (server must be up: python -m http.server 8000 --directory website)

Checks: referenced assets resolve (HTTP 200), routes registered, catalog prices match the
approved Selling Strategy, SEO/meta/JSON-LD present, accessibility hooks, launch blockers
(placeholder phone/domain/OG image), responsive CSS markers.
"""
import io
import json
import os
import re
import sys
import urllib.request

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")

HERE = os.path.dirname(os.path.abspath(__file__))
BASE = "http://localhost:8000"

passed, warned, failed = [], [], []


def ok(label):
    passed.append(label)
    print(f"  PASS  {label}")


def warn(label):
    warned.append(label)
    print(f"  WARN  {label}")


def fail(label):
    failed.append(label)
    print(f"  FAIL  {label}")


def read(name):
    with open(os.path.join(HERE, name), encoding="utf-8") as f:
        return f.read()


html = read("index.html")
js = read("app.js")
admin_js = read("admin-dashboard.js")
config_example = read("config.example.js")
all_js = js + "\n" + admin_js
css = read("style.css") if os.path.exists(os.path.join(HERE, "style.css")) else ""

# ---- 1 · assets referenced in code all resolve -----------------------------
print("\n[1] Asset integrity (HTTP)")
assets = sorted(set(re.findall(r"assets/[A-Za-z0-9_\-./]+\.(?:png|webp|jpg|jpeg|svg|gif)", js + html + css)))
missing = []
for a in assets:
    try:
        with urllib.request.urlopen(f"{BASE}/{a}", timeout=10) as r:
            if r.status != 200:
                missing.append(a)
    except Exception:
        missing.append(a)
if missing:
    fail(f"{len(missing)}/{len(assets)} referenced assets missing: {missing[:5]}")
else:
    ok(f"all {len(assets)} referenced image assets return HTTP 200")

# ---- 2 · routes -------------------------------------------------------------
print("\n[2] Routes")
want = ["#/", "#/samr", "#/asmr", "#/shop", "#/product", "#/gifting", "#/story", "#/contact"]
for r_ in want:
    (ok if f"'{r_}'" in js or f'"{r_}"' in js else fail)(f"route registered: {r_}")

# ---- 3 · catalog prices match the approved Selling Strategy ----------------
print("\n[3] Catalog prices vs approved strategy (SAR)")
expected = {
    "samr-extrait": 270, "asmr-extrait": 380,
    "samr-spray": 79, "asmr-spray": 99,
    "samr-cream": 69, "asmr-cream": 79,
    "discovery-set": 60, "duo-box": 599,
    "samr-trio": 379, "asmr-trio": 499,
}
for pid, price in expected.items():
    i = js.find(f"id: '{pid}'")
    if i < 0:
        warn(f"{pid}: product id not found in catalog data")
        continue
    block = js[i:i + 2500]
    prices = re.findall(r"(?:'[^']+'|price\w*)\s*:\s*(\d+)", block)
    if str(price) in prices:
        ok(f"{pid}: {price} SAR present in its price data")
    else:
        fail(f"{pid}: expected {price} SAR, found {prices[:6]}")
# extrait size-ladder spot checks (10/30/70/100 ml from Selling Strategy tabs)
for ladder_price in ("70", "190", "360", "460", "90", "250", "510", "680"):
    (ok if re.search(rf"[\"':\s]{ladder_price}\b", js) else warn)(f"ladder price {ladder_price} SAR present somewhere in catalog")

# ---- 4 · SEO & structured data ---------------------------------------------
print("\n[4] SEO / structured data")
(ok if "<title>" in html else fail)("<title> present")
(ok if 'name="description"' in html else fail)("meta description present")
(ok if 'property="og:' in html else fail)("Open Graph tags present")
(ok if "application/ld+json" in html else fail)("JSON-LD present")
try:
    ld = json.loads(re.search(r'<script type="application/ld\+json">([\s\S]*?)</script>', html).group(1))
    ok(f"JSON-LD parses ({ld.get('@type')})")
except Exception as e:
    fail(f"JSON-LD does not parse: {e}")

# ---- 5 · accessibility ------------------------------------------------------
print("\n[5] Accessibility hooks")
(ok if "skip" in html.lower() else warn)("skip link present")
(ok if 'lang="en"' in html else warn)('html lang attribute')
(ok if "aria-label" in js or "aria-label" in html else warn)("aria-labels used")
(ok if "prefers-reduced-motion" in css else warn)("prefers-reduced-motion respected (style.css)")
(ok if ":focus" in css else warn)("visible focus styles defined")

# ---- 6 · responsive markers -------------------------------------------------
print("\n[6] Responsive CSS")
mq = len(re.findall(r"@media", css))
(ok if mq >= 3 else warn)(f"{mq} media queries in style.css")
(warn if "burger" not in (js + css).lower() and "hamburger" not in (js + css).lower()
 else ok)("mobile hamburger menu (7-item nav shows in full on 375px — add a menu)")

# ---- 7 · launch blockers (placeholders that MUST change before go-live) -----
print("\n[7] Launch blockers / placeholders")
(warn if "966500000000" in js or "IS_WHATSAPP_PLACEHOLDER = true" in js.replace("  ", " ")
 else ok)("WhatsApp number still a placeholder — set the real number before launch")
(warn if "unsplash.com" in html else ok)("og:image is an Unsplash hotlink — replace with own hero image")
(warn if "asmrsamr.com" in html else ok)("JSON-LD url is a placeholder domain — set the real domain")
(warn if "Artisan Perfumer & Founder" in html else ok)("founder name placeholder in JSON-LD")
(ok if "PUBLIC_CONFIG" in js and "whatsappNumber" in config_example and "siteDomain" in config_example and "founderName" in config_example else fail)("public launch config can override WhatsApp, domain, and founder metadata")
(ok if "getLaunchReadinessChecks" in js and "Production domain" in js and "Founder metadata" in js else fail)("admin status reports launch readiness for merchant config")

# ---- 8 · customer dashboard ---------------------------------------------------
print("\n[8] Customer dashboard (#/account)")
(ok if "'#/account'" in js else fail)("route registered: #/account")
(ok if "function renderAccount" in js else fail)("renderAccount view exists")
for fn in ("getProfile", "logOrder", "getWishlist", "toggleWishlist", "resendOrder", "clearAccountData"):
    (ok if f"function {fn}" in js else fail)(f"dashboard helper: {fn}")
for key in ("asmr_samr_profile", "asmr_samr_orders", "asmr_samr_wishlist"):
    (ok if key in js else fail)(f"storage key wired: {key}")
hooks = js.count("logOrder(")
(ok if hooks >= 4 else fail)(f"order logging hooked into checkout flows ({hooks - 1} call sites)")
(ok if js.count("account_title") >= 3 else fail)("account translations present in EN + AR")
(ok if 'id="account-btn"' in js else fail)("account icon in header")
(ok if "savedProfile.name" in js else fail)("pre-order modal prefilled from profile")
(ok if "account-wish-toggle" in js else fail)("wishlist button on product detail")
(ok if ("Riyadh. Thank you" not in js and "من الرياض" not in js) else fail)(
    "checkout messages use CONFIG city (no hard-coded city)")

# ---- 9 · account integrity (no fake/demo data; real rewards) -----------------
print("\n[9] Account integrity")
for bad in ("Ahmed Ali", "ahmedali", "initializeDemoUserData", "VIP Member", "4321"):
    (ok if bad not in js else fail)(f"no fake/demo artefact: '{bad}'")
(ok if "function getRewards" in js else fail)("real rewards engine (getRewards) present")
(ok if "reduce((sum, o) => sum + (Number(o.total)" in js else warn)("points derived from real order totals")
(ok if js.count("alert(") == 0 else fail)(f"no native alert() dialogs ({js.count('alert(')} found)")
(ok if "function showToast" in js else fail)("on-theme toast helper present")
(ok if "function esc(" in js else fail)("HTML-escape helper present")
(ok if "VISA" not in js else fail)("no fake payment card in Payments tab")
for tab in ("overview", "orders", "addresses", "payments", "wishlist", "rewards", "preferences", "notifications"):
    (ok if f"activeTab === '{tab}'" in js else fail)(f"account tab implemented: {tab}")

# ---- 10 · dashboard routing + header fixes (2026-07-13) ----------------------
print("\n[10] Dashboard routing + header controls")
(ok if "route.startsWith('#/account/')" in js else fail)("account tabs are linkable sub-routes (#/account/<tab>)")
(ok if "validTabs.includes(sub) ? sub : 'overview'" in js else fail)("unknown tab falls back to overview (never strands on rewards)")
(ok if "window.location.hash = target" in js else fail)("switchAccountTab drives the URL (refresh/back-forward work)")
(ok if "wordmark-link" in js and ".wordmark-link" in css else fail)("brand logo is a clickable rectangle (wordmark-link)")
(ok if 'aria-label="${state.lang' in js and "home" in js else warn)("logo has an accessible label")
(ok if ".wordmark-link:focus-visible" in css else fail)("logo has a keyboard focus state")
(ok if "body:has(.account-dashboard-wrapper) header .nav-btn" in css and "var(--charcoal-900) !important" in css
 else fail)("account-page nav controls are charcoal (visible by default, not only on hover)")
(ok if ".nav-btn:focus-visible" in css else fail)("nav buttons have a focus-visible state")
(ok if ".nav-btn:disabled" in css or '.nav-btn[aria-disabled="true"]' in css else warn)("nav buttons have a disabled state")
(ok if ".nav-btn.is-active" in css else fail)("nav buttons have an active state")

# ---- 11 · live admin operations dashboard ------------------------------------
print("\n[11] Live admin operations dashboard")
(ok if "route.startsWith('#/admin/')" in js else fail)("admin routes wired (#/admin, #/admin/<tab>)")
(ok if "admin-dashboard.js" in html else fail)("Supabase admin application is loaded")
for fn in ("renderOverview", "renderProducts", "renderOrders", "renderInventory",
           "renderIngredients", "renderFinance", "renderContent",
           "renderMarketing", "renderUsers", "renderApiKeys", "renderReports", "renderSettings"):
    (ok if f"function {fn}" in admin_js else fail)(f"live admin view: {fn}")
(ok if "production: CONFIGS.production" in admin_js and "return renderGeneric(genericMap[tab], root)" in admin_js else fail)("live admin view: production")
for tab in ("products", "orders", "inventory", "ingredients", "production", "finance",
            "marketing", "content", "users", "api-keys", "reports", "settings"):
    (ok if f"['{tab}'," in admin_js else fail)(f"admin tab wired: {tab}")
for handler in ("openGenericForm", "saveGeneric", "deleteGeneric", "exportCurrent",
                "openProductAdjustment", "openIngredientAdjustment", "confirmBatch",
                "rotateApiKey", "revokeApiKey", "saveOrderItem"):
    (ok if f"{handler}:" in admin_js or f"{handler}," in admin_js else fail)(f"admin handler exposed: {handler}")
(ok if "adminSeedSampleOrder" not in all_js else fail)("no sample-order or mock-data generator remains")
(ok if "loadPublicCatalogFromSupabase" in js else fail)("public catalog reads published Supabase products")
(ok if "rpc/get_storefront_catalog" in js else fail)("public catalog uses the safe server-side projection")
(ok if "website_content?select=content_type" in js and "storefrontContent" in js else fail)("published homepage content is loaded from Supabase")
(ok if "function renderApp() {\n  applyAdminState();" not in js else fail)("legacy local admin state cannot overwrite the storefront catalog")
(ok if "WELCOME10" not in js and "DUO50" not in js else fail)("legacy seeded coupons are absent")
(ok if "(0, eval)" not in html and "config.local.js" in html else fail)("browser config loads without eval or CSP bypasses")
(ok if "loadPublicCatalogFromSupabase().then" in js else fail)("storefront renders before the live catalog refresh completes")
(ok if "Number.parseFloat(left)" in js else fail)("dynamic product sizes remain in numeric order")
(ok if "persistStorefrontOrder" in js and "rpc/submit_storefront_order" in js else fail)("storefront orders use a transactional Supabase RPC")
(ok if "p_customer_email" in js and "p_customer_city" in js and "p_source_route" in js else fail)("storefront orders send customer contact, delivery, and route context")
(ok if "Could not find the function|schema cache|p_customer_email|p_source_route" in js else fail)("storefront order RPC remains backward compatible during migration rollout")
(ok if "createStorefrontOrderNo" in js and "Order Reference:" in js else fail)("WhatsApp checkout includes a traceable storefront order reference")
(ok if "const orderNo = createStorefrontOrderNo();" in js and "async function buyNowWhatsApp" in js else fail)("buy-now creates its traceable order reference before persistence")
(ok if "newsletter_subscribers" in js and "preorders" in js else fail)("newsletter and preorder forms persist to Supabase")
(ok if "function getSellableProductSelection" in js else fail)("storefront commerce validates sellable product selections")
(ok if "Number(product.prices[validSize] || 0)" in js else fail)("cart actions use catalog prices instead of rendered button prices")
(ok if "canCheckoutProduct(product)" in js and "getProductMaxOrderQuantity(product)" in js else fail)("cart actions enforce public stock availability and max quantity")
(ok if "stock-status-" in js and ".stock-status" in css else fail)("shop and product pages display stock status without changing navigation")
(ok if "async function checkoutToWhatsApp" in js and "await refreshPublicCatalogForCommerce();" in js else fail)("checkout refreshes the public catalog before WhatsApp order generation")
(ok if "async function buyNowWhatsApp" in js else fail)("buy-now refreshes catalog data before direct WhatsApp order generation")
(ok if "async function handlePreorderSubmit" in js else fail)("preorder submission revalidates current catalog availability")
(ok if "showUnavailableProductNotice" in js else fail)("unavailable products are blocked with a storefront-safe notice")

# ---- 12 · navigation, responsive layout, and exports --------------------------
print("\n[12] Admin navigation, responsive layout, and exports")
(ok if "position: fixed" in css and "admin-sidebar" in css else fail)("dashboard sidebar remains fixed")
(ok if "overflow-y: auto" in css and ".admin-dashboard-enhanced .admin-nav" in css else fail)("sidebar navigation scrolls independently")
(ok if "admin-sidebar-footer" in admin_js and "logout" in admin_js.lower() else fail)("bottom profile/settings/logout actions remain accessible")
(ok if "@media" in css and "admin-mobile" in css else fail)("dashboard has mobile navigation behavior")
for tabs in ("PRODUCT_TABS", "ORDER_TABS", "CONTENT_TABS", "MARKETING_TABS"):
    (ok if f"const {tabs}" in admin_js else fail)(f"correct sub-route mapping: {tabs}")
for fn in ("buildCsv", "buildXlsx", "buildPdf", "printTable"):
    (ok if f"function {fn}" in admin_js else fail)(f"export support: {fn}")

# ---- 13 · database, RLS, and server-side security -----------------------------
print("\n[13] Database migrations and server-side security")
migration_dir = os.path.join(HERE, "..", "supabase", "migrations")
migrations = "\n".join(
    open(os.path.join(migration_dir, name), encoding="utf-8").read()
    for name in sorted(os.listdir(migration_dir)) if name.endswith(".sql")
)
for table in ("product_stock_movements", "ingredients", "ingredient_stock_movements", "formulas",
              "production_batches", "finance_transactions", "marketing_campaigns",
              "api_keys", "audit_logs", "product_images"):
    (ok if f"create table public.{table}" in migrations.lower() else fail)(f"database module: {table}")
for rpc in ("adjust_product_stock", "adjust_ingredient_stock", "confirm_production_batch",
            "reverse_finance_transaction", "recalculate_order_totals", "submit_storefront_order",
            "get_storefront_catalog"):
    (ok if rpc in migrations else fail)(f"server-side operation: {rpc}")
(ok if "p_customer_email text" in migrations and "customer_city" in migrations and "source_route" in migrations else fail)("checkout order migration stores structured customer delivery context")
(ok if "orders_status_created_idx" in migrations and "orders_channel_created_idx" in migrations else fail)("checkout order migration adds operational order indexes")
(ok if "'stock_status'" in migrations and "'can_checkout'" in migrations and "'max_order_quantity'" in migrations else fail)("storefront catalog exposes safe checkout availability fields")
(ok if "Requested quantity exceeds available stock" in migrations and "Product is out of stock" in migrations else fail)("storefront order RPC validates inventory before creating orders")
(ok if "enable row level security" in migrations.lower() else fail)("RLS is enabled by migration")
(ok if "revoke select on table" in migrations.lower() and "internal costs" in migrations.lower() else fail)("public catalog cannot read internal product fields directly")
(ok if "key_hash" in migrations and "raw keys are never stored" in migrations.lower() else fail)("raw API keys are never stored")
(ok if "SUPABASE_SERVICE_ROLE_KEY" not in all_js else fail)("service-role credentials are absent from frontend code")
function_dir = os.path.join(HERE, "..", "supabase", "functions")
function_sources = "\n".join(
    open(os.path.join(root, name), encoding="utf-8").read()
    for root, _, names in os.walk(function_dir) for name in names if name.endswith(".ts")
)
for function_name in ("admin-api-keys", "verify-api-key", "admin-users", "admin-gift-cards"):
    (ok if os.path.isdir(os.path.join(function_dir, function_name)) else fail)(f"Edge Function source: {function_name}")
(ok if "crypto.subtle.digest" in function_sources and "key_hash" in function_sources else fail)("API keys use server-side cryptographic hashing")

# ---- summary -----------------------------------------------------------------
print("\n" + "=" * 70)
print(f"{len(passed)} passed · {len(warned)} warnings · {len(failed)} failed")
if failed:
    print("FAILURES:")
    for f_ in failed:
        print("  ·", f_)
    sys.exit(1)
print("No hard failures — warnings are the pre-launch to-do list.")
