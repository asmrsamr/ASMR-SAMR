"""ASMR & SAMR Phase 1 security release gate.

Runs static access-control checks everywhere. When website/config.local.js is
available, it also performs read-only live checks with the publishable key.
"""

from __future__ import annotations

import json
import os
import re
import sys
import urllib.error
import urllib.request
from pathlib import Path


HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
MIGRATIONS = ROOT / "supabase" / "migrations"
CONFIG = HERE / "config.local.js"

passed: list[str] = []
warned: list[str] = []
failed: list[str] = []


def result(kind: str, label: str) -> None:
    print(f"  {kind:<4}  {label}")
    {"PASS": passed, "WARN": warned, "FAIL": failed}[kind].append(label)


def check(condition: bool, label: str) -> None:
    result("PASS" if condition else "FAIL", label)


def warning(label: str) -> None:
    result("WARN", label)


def read(path: Path) -> str:
    return path.read_text(encoding="utf-8")


admin_js = read(HERE / "admin-dashboard.js")
app_js = read(HERE / "app.js")
edge_users = read(ROOT / "supabase" / "functions" / "admin-users" / "index.ts")
sql_files = sorted(MIGRATIONS.glob("*.sql"))
sql = "\n".join(read(path) for path in sql_files)

print("\n[1] Credential and session safety")
secret_patterns = {
    "GitHub token": re.compile(r"(?:github_pat_[A-Za-z0-9_]{20,}|gh[pousr]_[A-Za-z0-9]{20,})"),
    "Supabase secret key": re.compile(r"sb_secret_[A-Za-z0-9_-]{20,}"),
    "private key": re.compile(r"-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----"),
    "JWT": re.compile(r"eyJ[A-Za-z0-9_-]{40,}\.[A-Za-z0-9_-]{40,}\.[A-Za-z0-9_-]{20,}"),
}
scan_suffixes = {".js", ".ts", ".py", ".sql", ".md", ".json", ".toml", ".yml", ".yaml", ".html", ".css"}
scan_files: list[Path] = []
for path in ROOT.rglob("*"):
    if not path.is_file() or path.suffix.lower() not in scan_suffixes:
        continue
    relative = path.relative_to(ROOT)
    if any(part in {".git", ".tmp", "node_modules", "assets"} for part in relative.parts):
        continue
    scan_files.append(path)

secret_hits: list[str] = []
for path in scan_files:
    content = read(path)
    for label, pattern in secret_patterns.items():
        if pattern.search(content):
            secret_hits.append(f"{label} in {path.relative_to(ROOT)}")
check(not secret_hits, "no raw credentials or private keys in project text files")
if secret_hits:
    for hit in secret_hits:
        print(f"        {hit}")

check("sessionStorage.setItem(SESSION_KEY" in admin_js, "admin tokens use tab-scoped sessionStorage")
check("localStorage.setItem(SESSION_KEY" not in admin_js, "admin tokens are not persisted to localStorage")
check("localStorage.setItem(ADMIN_SESSION_KEY" not in app_js, "fallback admin tokens are not persisted to localStorage")
check("localStorage.setItem(ADMIN_REMOTE_CACHE_KEY" not in app_js, "protected admin cache is not persisted to localStorage")
check("ADMIN_IDLE_TIMEOUT_MS = 30 * 60 * 1000" in admin_js, "30-minute admin inactivity timeout is enforced")
check("ADMIN_MAX_SESSION_MS = 8 * 60 * 60 * 1000" in admin_js, "eight-hour admin session ceiling is enforced")
check("response.status === 401" in admin_js and "clearSession()" in admin_js, "unauthorized responses clear the admin session")
check("SUPABASE_SERVICE_ROLE_KEY" not in admin_js, "service-role credentials are absent from the browser bundle")
check("TAB_PERMISSION_GROUPS" in admin_js and "tabVisibleForCurrentRole" in admin_js, "dashboard navigation follows the role permission matrix")
check("tab === 'users' || tab === 'api-keys'" in admin_js, "user and API-key navigation remains administrator-only")

print("\n[2] RBAC and administrator continuity")
check("role_name = (select private.current_role())" in sql, "staff can read only their own role permissions")
check("Only an administrator can modify staff profiles" in sql, "non-admin roles cannot modify staff profiles")
check("At least one active administrator must remain" in sql, "database protects the final active administrator")
check("Administrators cannot disable or demote their own account" in sql, "database prevents administrator self-lockout")
check("protectAdminContinuity" in edge_users, "user-management Edge Function protects administrator continuity")
check("You cannot disable or demote your own administrator account" in edge_users, "Edge Function prevents administrator self-lockout")
check("raw_user_meta_data ->> 'role'" not in sql.lower(), "user-editable metadata is not used for authorization")

print("\n[3] RLS and privileged database code")
created_tables = set(re.findall(r"create table(?: if not exists)? public\.([a-z0-9_]+)", sql, re.I))
direct_rls = set(re.findall(r"alter table public\.([a-z0-9_]+)\s+enable row level security", sql, re.I))
loop_rls: set[str] = set()
for match in re.finditer(
    r"foreach\s+t\s+in\s+array\s+array\[(.*?)\]\s*loop(.*?)end loop;",
    sql,
    re.I | re.S,
):
    if "enable row level security" in match.group(2).lower():
        loop_rls.update(re.findall(r"'([a-z0-9_]+)'", match.group(1), re.I))
missing_rls = sorted(created_tables - direct_rls - loop_rls)
check(not missing_rls, "every migration-created public table is covered by RLS")
if missing_rls:
    print(f"        Missing RLS coverage: {', '.join(missing_rls)}")

definer_without_search_path: list[str] = []
function_pattern = re.compile(
    r"create(?: or replace)? function\s+([a-z0-9_.]+)\s*\([^;]*?(?=\ncreate(?: or replace)? function|\Z)",
    re.I | re.S,
)
for match in function_pattern.finditer(sql):
    block = match.group(0)
    header = block.split("as $$", 1)[0].lower()
    if "security definer" in header and "set search_path" not in header:
        definer_without_search_path.append(match.group(1))
check(not definer_without_search_path, "SECURITY DEFINER functions pin search_path")
if definer_without_search_path:
    print(f"        Missing search_path: {', '.join(sorted(set(definer_without_search_path)))}")

allowed_anon_rpcs = {"get_storefront_catalog", "submit_storefront_order"}
anon_rpcs: set[str] = set()
for match in re.finditer(
    r"grant execute on function public\.([a-z0-9_]+)\([^;]*?\)\s+to\s+([^;]+);",
    sql,
    re.I | re.S,
):
    if re.search(r"\banon\b", match.group(2), re.I):
        anon_rpcs.add(match.group(1).lower())
check(anon_rpcs <= allowed_anon_rpcs, "anonymous RPC grants are limited to validated storefront operations")


def config_value(source: str, key: str) -> str:
    match = re.search(rf"\b{re.escape(key)}\s*:\s*['\"]([^'\"]+)['\"]", source)
    return match.group(1).strip() if match else ""


def request_json(url: str, method: str, headers: dict[str, str], body: object | None = None) -> tuple[int, object]:
    data = None if body is None else json.dumps(body).encode("utf-8")
    request = urllib.request.Request(url, data=data, method=method, headers=headers)
    try:
        with urllib.request.urlopen(request, timeout=20) as response:
            raw = response.read().decode("utf-8", errors="replace")
            return response.status, json.loads(raw) if raw else None
    except urllib.error.HTTPError as error:
        raw = error.read().decode("utf-8", errors="replace")
        try:
            payload: object = json.loads(raw) if raw else None
        except json.JSONDecodeError:
            payload = raw
        return error.code, payload


print("\n[4] Live anonymous boundary")
if not CONFIG.exists():
    warning("config.local.js is absent; live Supabase denial checks skipped")
else:
    config_source = read(CONFIG)
    supabase_url = config_value(config_source, "supabaseUrl").rstrip("/")
    publishable_key = config_value(config_source, "supabaseAnonKey")
    if not supabase_url or not publishable_key:
        warning("browser-safe Supabase configuration is incomplete; live checks skipped")
    else:
        public_headers = {
            "apikey": publishable_key,
            "Authorization": f"Bearer {publishable_key}",
            "Content-Type": "application/json",
        }
        status, catalog = request_json(
            f"{supabase_url}/rest/v1/rpc/get_storefront_catalog",
            "POST",
            public_headers,
            {},
        )
        products = catalog.get("products", []) if isinstance(catalog, dict) else []
        check(status == 200 and bool(products), "safe storefront catalog RPC is publicly available")

        protected_paths = [
            "api_keys?select=id&limit=1",
            "role_permissions?select=role_name,permission&limit=1",
            "profiles?select=id,role,status&limit=1",
            "products?select=id,cost&limit=1",
        ]
        for path in protected_paths:
            status, payload = request_json(f"{supabase_url}/rest/v1/{path}", "GET", public_headers)
            unavailable = status in {401, 403, 404} or (status == 200 and payload in (None, []))
            check(unavailable, f"anonymous data unavailable: {path.split('?')[0]}")

        for function_name in ("admin-api-keys", "admin-users", "admin-gift-cards"):
            status, _ = request_json(
                f"{supabase_url}/functions/v1/{function_name}",
                "POST",
                public_headers,
                {"action": "list"},
            )
            check(status in {401, 403}, f"unauthenticated Edge Function denied: {function_name}")

print("\n" + "=" * 72)
print(f"{len(passed)} passed | {len(warned)} warnings | {len(failed)} failed")
if failed:
    sys.exit(1)
