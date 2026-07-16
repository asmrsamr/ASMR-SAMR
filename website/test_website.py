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

# ---- 11 · admin operations dashboard -----------------------------------------
print("\n[11] Admin operations dashboard")
(ok if "route.startsWith('#/admin/')" in js else fail)("admin routes wired (#/admin, #/admin/<tab>)")
for fn in ("renderAdmin", "renderAdminOverview", "renderAdminProducts", "renderAdminOrders",
           "renderAdminContent", "renderAdminStatus", "renderAdminReports"):
    (ok if f"function {fn}" in js else fail)(f"admin view: {fn}")
for fn in ("applyAdminState", "getPublicProducts", "getFeaturedProducts", "getAdminState", "getAdminAnalytics"):
    (ok if f"function {fn}" in js else fail)(f"catalog helper: {fn}")
for handler in ("adminSaveProductRow", "adminOpenProductEditor", "adminCloseProductEditor",
                "adminSaveProductDetails", "adminFilterProducts", "adminUpdateOrderStatus",
                "adminSaveSettings", "adminSeedSampleOrder", "adminResetState", "adminExportData"):
    (ok if f"window.{handler}" in js else fail)(f"admin handler exposed: {handler}")
(ok if "getProductById(productId, options" in js and "includeInactive" in js else fail)("getProductById supports includeInactive")
(ok if "getPublicAnnouncementBanner" in js else fail)("public announcement is admin-aware")
(ok if "[920, 1460, 1180, 2050, 1720, 2360]" not in js else fail)("revenue chart is real (no hardcoded seed data)")
(ok if "getPublicProducts()" in js and "let filtered = getPublicProducts()" in js else warn)("shop reads admin-aware public catalog")

# ---- 12 · extended admin (customers, coupons, marketing) ---------------------
print("\n[12] Extended admin tabs + analytics")
for tab in ("customers", "coupons", "marketing"):
    (ok if f"'{tab}'" in js and f"function renderAdmin{tab.capitalize()}" in js else fail)(f"admin tab wired: {tab}")
for h in ("getAdminCustomers", "getRevenueByCategory", "getOrderChannels", "getAdminCoupons"):
    (ok if f"function {h}" in js else fail)(f"analytics helper: {h}")
for handler in ("adminAddCoupon", "adminToggleCoupon", "adminDeleteCoupon"):
    (ok if f"window.{handler}" in js else fail)(f"coupon handler exposed: {handler}")
(ok if "revenueByCategory" in js and "orderChannels" in js and "topCustomers" in js else fail)("overview analytics extended")
(ok if "admin-breakdown-row" in css and "admin-insight-grid" in css else fail)("new admin panels have CSS")
(ok if "'overview', 'orders', 'products', 'customers', 'coupons', 'content', 'marketing', 'reports', 'status'" in js else warn)("ADMIN_TABS includes new tabs")

# ---- summary -----------------------------------------------------------------
print("\n" + "=" * 70)
print(f"{len(passed)} passed · {len(warned)} warnings · {len(failed)} failed")
if failed:
    print("FAILURES:")
    for f_ in failed:
        print("  ·", f_)
    sys.exit(1)
print("No hard failures — warnings are the pre-launch to-do list.")
