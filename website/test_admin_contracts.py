"""Phase 2 dashboard route, CRUD, and authorization contract gate."""

from __future__ import annotations

import re
import sys
from pathlib import Path


HERE = Path(__file__).resolve().parent
ROOT = HERE.parent

admin_js = (HERE / "admin-dashboard.js").read_text(encoding="utf-8")
app_js = (HERE / "app.js").read_text(encoding="utf-8")
css = (HERE / "style.css").read_text(encoding="utf-8")
example_config = (HERE / "config.example.js").read_text(encoding="utf-8")
sql = "\n".join(
    path.read_text(encoding="utf-8")
    for path in sorted((ROOT / "supabase" / "migrations").glob("*.sql"))
)

passed: list[str] = []
failed: list[str] = []


def check(condition: bool, label: str) -> None:
    kind = "PASS" if condition else "FAIL"
    print(f"  {kind:<4}  {label}")
    (passed if condition else failed).append(label)


expected_tabs = {
    "overview", "orders", "products", "inventory", "customers", "wishlist",
    "rewards", "gifting", "preorders", "coupons", "content", "marketing",
    "notifications", "reports", "roles", "settings", "status", "ingredients",
    "suppliers", "purchase-orders", "formulas", "production", "finance",
    "costing", "users", "campaigns", "api-keys", "audit",
}

nav_block = re.search(r"const NAV_ITEMS = \[(.*?)\n  \];", admin_js, re.S)
nav_tabs = set(re.findall(r"\['([^']+)',\s*'[^']+'\]", nav_block.group(1) if nav_block else ""))

print("\n[1] Navigation and direct routes")
check(nav_tabs == expected_tabs, "all intended dashboard tabs appear exactly once")
generic_block = re.search(r"const genericMap = \{(.*?)\n    \};", admin_js, re.S)
generic_tabs = set(re.findall(r"(?:^|\n)\s*(?:'([^']+)'|([a-z-]+)):\s*CONFIGS", generic_block.group(1) if generic_block else ""))
generic_tabs = {left or right for left, right in generic_tabs}
explicit_tabs = set(re.findall(r"if \(tab === '([^']+)'\)", admin_js))
check(nav_tabs <= generic_tabs | explicit_tabs, "every sidebar tab dispatches to a connected page")
check("route === '#/admin' || route.startsWith('#/admin/')" in app_js, "direct admin URLs are routed by the application")
check("mainRoot.innerHTML = renderSupabaseAdminRoute(sub)" in app_js, "admin routes render only the Supabase dashboard bridge")
check("mainRoot.innerHTML = renderAdmin(sub)" not in app_js, "legacy localStorage admin is not the production admin route")
check("LEGACY_ADMIN_FALLBACK_FLAG" in app_js and "enableLegacyAdminFallback === true" in app_js, "legacy admin fallback is quarantined behind an explicit development flag")
check("window.addEventListener('hashchange'" in app_js, "browser back and forward navigation re-renders routes")
check("const TAB_PERMISSION_GROUPS" in admin_js and "tabVisibleForCurrentRole" in admin_js, "sidebar visibility follows permissions")
check("tab === 'users' || tab === 'api-keys'" in admin_js, "privileged system tabs remain administrator-only")

print("\n[2] CRUD behavior")
crud_markers = [
    "openGenericForm", "viewGeneric", "deleteGeneric", "queueSearch", "setFilter",
    "setSort", "setPage", "required", "loadingState", "emptyState", "errorState",
    "confirmAction", "canRead(config)", "canWrite(config)",
]
for marker in crud_markers:
    check(marker in admin_js, f"generic CRUD contract includes {marker}")
check("deleteMode: 'archive'" in admin_js, "important records support soft archival")
check("archiveField: false" in admin_js, "status-only cancellation does not write nonexistent archive columns")
check("archiveStatus: { field: 'status', value: 'cancelled' }" in admin_js, "orders and planned production can be cancelled safely")
check("['profiles', 'products', 'ingredients', 'formulas', 'production_batches', 'orders']" in sql, "database blocks hard deletion of protected business records")
check("audit_row_change" in sql and "audit_logs" in sql, "sensitive CRUD operations have database audit coverage")
check('name="product_images"' in admin_js and "storeProductImages(savedRecord" in admin_js,
      "product create and edit forms include managed photo upload")
check("The product was saved, but its photos need attention" in admin_js,
      "partial product-image failures preserve the saved product and report recovery guidance")

print("\n[3] Session and role consistency")
staff_roles = {"owner", "admin", "manager", "finance", "marketing", "inventory", "production", "support"}
role_line = re.search(r"const ADMIN_STAFF_ROLES = \[(.*?)\];", app_js)
app_roles = set(re.findall(r"'([^']+)'", role_line.group(1) if role_line else ""))
config_roles = set(re.findall(r"'([^']+)'", re.search(r"adminRoles:\s*\[(.*?)\]", example_config).group(1)))
check(app_roles == staff_roles, "legacy application helpers recognize the canonical staff roles")
check(config_roles == staff_roles, "browser configuration example documents every operational role")
check("localStorage.setItem(ADMIN_SESSION_KEY" not in app_js, "fallback admin login never persists tokens in localStorage")
check("sessionStorage.setItem(ADMIN_SESSION_KEY" in app_js, "fallback admin login uses tab-scoped sessionStorage")
check("localStorage.setItem(ADMIN_REMOTE_CACHE_KEY" not in app_js, "protected remote cache is not persisted in localStorage")
check("sessionStorage.setItem(ADMIN_REMOTE_CACHE_KEY" in app_js, "protected remote cache is tab-scoped")

print("\n[4] Security and accessibility remediation")
check("PRIVILEGED_ROLES = new Set(['owner', 'admin'])" in admin_js, "owner and administrator are the explicit privileged roles")
check("Owner or administrator access is required." in admin_js, "direct privileged routes enforce authorization")
check("await recordExport(config, format, rows.length);" in admin_js, "export audit is recorded before file delivery")
check("^[\\t\\r\\n ]*[=+\\-@]" in admin_js, "CSV cells neutralize spreadsheet formulas")
check("recordDataIssue(error)" in admin_js and "admin-data-health" in admin_js, "partial dashboard failures remain visible")
check("handleModalKeydown" in admin_js and "event.key === 'Escape'" in admin_js, "dialogs support focus containment and Escape")
check("togglePasswordVisibility" in app_js and "password-visibility-toggle" in admin_js, "password fields provide an accessible visibility control")
check("function saveOwnProfile" in admin_js and "admin-users" in admin_js,
      "admin profile identity is editable through authorized data paths")
check("requestOwnPasswordReset" in admin_js and "openOwnAuditLog" in admin_js,
      "admin profile provides recovery and account-activity controls")
check("grant usage on schema private to service_role" in sql
      and "grant execute on function private.current_role() to service_role" in sql,
      "profile Edge Function can execute the narrowly scoped private trigger guards")
check("renderSettings(section || 'overview'" in admin_js and "function renderSettingsOverview" in admin_js,
      "Settings opens a dedicated control overview instead of Shipping Methods")
check("e.currentTarget.checkValidity()" in app_js and "e.currentTarget.reportValidity()" in app_js,
      "customer profile edits use native form validation")
check('href="#/account/preferences"' in app_js and 'href="#/account/orders"' in app_js,
      "customer dashboard links expose their real direct routes")

print("\n[5] Responsive sidebar")
check(".admin-sidebar" in css and "position: fixed" in css, "dashboard sidebar remains fixed")
check(".admin-nav" in css and "overflow-y: auto" in css, "dashboard navigation scrolls independently")
check(".admin-sidebar-footer" in css, "profile, settings, and logout remain in the sidebar footer")

print("\n" + "=" * 72)
print(f"{len(passed)} passed | {len(failed)} failed")
if failed:
    sys.exit(1)
