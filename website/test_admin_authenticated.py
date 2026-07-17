"""Read-only authenticated Phase 2 acceptance checks with optional transient CRUD.

Credentials are accepted only through environment variables and are never printed.
Set ASMR_QA_ALLOW_WRITES=1 to create, update, and delete one temporary campaign.
"""

from __future__ import annotations

import json
import os
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path


HERE = Path(__file__).resolve().parent
CONFIG = HERE / "config.local.js"
EMAIL = os.getenv("ASMR_QA_EMAIL", "").strip()
PASSWORD = os.getenv("ASMR_QA_PASSWORD", "")
EXPECTED_ROLE = os.getenv("ASMR_QA_EXPECTED_ROLE", "").strip()
ALLOW_WRITES = os.getenv("ASMR_QA_ALLOW_WRITES") == "1"

passed: list[str] = []
failed: list[str] = []
warned: list[str] = []


def result(kind: str, label: str) -> None:
    print(f"  {kind:<4}  {label}")
    {"PASS": passed, "FAIL": failed, "WARN": warned}[kind].append(label)


def config_value(source: str, key: str) -> str:
    match = re.search(rf"\b{re.escape(key)}\s*:\s*['\"]([^'\"]+)['\"]", source)
    return match.group(1).strip() if match else ""


def request_json(
    url: str,
    method: str,
    headers: dict[str, str],
    body: object | None = None,
) -> tuple[int, object, dict[str, str]]:
    data = None if body is None else json.dumps(body).encode("utf-8")
    request = urllib.request.Request(url, data=data, method=method, headers=headers)
    try:
        with urllib.request.urlopen(request, timeout=25) as response:
            raw = response.read().decode("utf-8", errors="replace")
            payload = json.loads(raw) if raw else None
            return response.status, payload, dict(response.headers)
    except urllib.error.HTTPError as error:
        raw = error.read().decode("utf-8", errors="replace")
        try:
            payload = json.loads(raw) if raw else None
        except json.JSONDecodeError:
            payload = raw
        return error.code, payload, dict(error.headers)


if not EMAIL or not PASSWORD:
    print("\n[Phase 2 authenticated acceptance]")
    result("WARN", "ASMR_QA_EMAIL/ASMR_QA_PASSWORD are absent; authenticated checks skipped")
    print("1 warnings | 0 failed")
    sys.exit(0)

if not CONFIG.exists():
    result("FAIL", "website/config.local.js is required for authenticated acceptance")
    sys.exit(1)

source = CONFIG.read_text(encoding="utf-8")
base_url = config_value(source, "supabaseUrl").rstrip("/")
publishable_key = config_value(source, "supabaseAnonKey")
if not base_url or not publishable_key:
    result("FAIL", "browser-safe Supabase URL and publishable key are configured")
    sys.exit(1)

public_headers = {"apikey": publishable_key, "Content-Type": "application/json"}
status, auth, _ = request_json(
    f"{base_url}/auth/v1/token?grant_type=password",
    "POST",
    public_headers,
    {"email": EMAIL, "password": PASSWORD},
)
if status != 200 or not isinstance(auth, dict) or not auth.get("access_token"):
    result("FAIL", f"authorized QA account can sign in (HTTP {status})")
    sys.exit(1)

token = str(auth["access_token"])
user_id = str((auth.get("user") or {}).get("id") or "")
headers = {
    "apikey": publishable_key,
    "Authorization": f"Bearer {token}",
    "Content-Type": "application/json",
}
result("PASS", "authorized QA account can sign in")

try:
    encoded_user = urllib.parse.quote(user_id, safe="")
    status, rows, _ = request_json(
        f"{base_url}/rest/v1/profiles?id=eq.{encoded_user}&select=id,role,status",
        "GET",
        headers,
    )
    profile = rows[0] if status == 200 and isinstance(rows, list) and rows else {}
    role = str(profile.get("role") or "")
    active = profile.get("status") == "active"
    result("PASS" if role and active else "FAIL", "active staff profile is available through RLS")
    if EXPECTED_ROLE:
        result("PASS" if role == EXPECTED_ROLE else "FAIL", f"account role matches {EXPECTED_ROLE}")

    encoded_role = urllib.parse.quote(role, safe="")
    status, permission_rows, _ = request_json(
        f"{base_url}/rest/v1/role_permissions?role_name=eq.{encoded_role}&select=permission",
        "GET",
        headers,
    )
    permissions = {
        row.get("permission") for row in permission_rows
        if isinstance(row, dict) and row.get("permission")
    } if isinstance(permission_rows, list) else set()
    result("PASS" if status == 200 and (role == "admin" or permissions) else "FAIL", "role permissions load for the signed-in account")

    probes = {
        "dashboard": "dashboard_overview?select=total_sales&limit=1",
        "products": "products?select=id&limit=1",
        "inventory": "product_inventory?select=product_id&limit=1",
        "customers": "profiles?select=id&limit=1",
        "orders": "orders?select=id&limit=1",
        "marketing": "marketing_campaigns?select=id&limit=1",
        "content": "website_content?select=id&limit=1",
        "notifications": "notifications?select=id&limit=1",
        "reports": "audit_logs?select=id&limit=1",
        "roles": "app_roles?select=name&limit=1",
        "settings": "shipping_methods?select=id&limit=1",
        "ingredients": "ingredients?select=id&limit=1",
        "purchasing": "purchase_orders?select=id&limit=1",
        "production": "formulas?select=id&limit=1",
        "finance": "finance_transactions?select=id&limit=1",
        "costing": "product_cost_components?select=id&limit=1",
    }
    readable_modules = set(probes) if role == "admin" else {
        permission.split(".", 1)[0]
        for permission in permissions
        if permission.endswith((".read", ".write"))
    }
    for module in sorted(readable_modules & set(probes)):
        status, _, _ = request_json(f"{base_url}/rest/v1/{probes[module]}", "GET", headers)
        result("PASS" if status == 200 else "FAIL", f"{role} can read authorized {module} data")

    if ALLOW_WRITES and (role == "admin" or "marketing.write" in permissions):
        qa_name = f"QA-{int(time.time())}"
        create_headers = {**headers, "Prefer": "return=representation"}
        status, created, _ = request_json(
            f"{base_url}/rest/v1/marketing_campaigns",
            "POST",
            create_headers,
            {"name": qa_name, "channel": "email", "status": "draft", "created_by": user_id},
        )
        campaign = created[0] if status == 201 and isinstance(created, list) and created else {}
        campaign_id = str(campaign.get("id") or "")
        result("PASS" if campaign_id else "FAIL", "transient campaign can be created")
        if campaign_id:
            encoded_id = urllib.parse.quote(campaign_id, safe="")
            status, updated, _ = request_json(
                f"{base_url}/rest/v1/marketing_campaigns?id=eq.{encoded_id}",
                "PATCH",
                create_headers,
                {"objective": "Phase 2 authenticated CRUD acceptance"},
            )
            result("PASS" if status == 200 and updated else "FAIL", "transient campaign can be updated")
            status, _, _ = request_json(
                f"{base_url}/rest/v1/marketing_campaigns?id=eq.{encoded_id}",
                "DELETE",
                {**headers, "Prefer": "return=minimal"},
            )
            result("PASS" if status == 204 else "FAIL", "transient campaign can be deleted")
            if role == "admin" or "reports.read" in permissions:
                status, audit_rows, _ = request_json(
                    f"{base_url}/rest/v1/audit_logs?entity_type=eq.marketing_campaigns&entity_id=eq.{encoded_id}&select=action&order=created_at.asc",
                    "GET",
                    headers,
                )
                actions = {row.get("action") for row in audit_rows} if isinstance(audit_rows, list) else set()
                result("PASS" if {"insert", "update", "delete"} <= actions else "FAIL", "campaign CRUD is recorded in the audit log")
    elif ALLOW_WRITES:
        result("WARN", "write acceptance requested but this role lacks marketing.write")
    else:
        result("WARN", "authenticated checks ran read-only; set ASMR_QA_ALLOW_WRITES=1 for transient CRUD")
finally:
    request_json(f"{base_url}/auth/v1/logout", "POST", headers)

print("\n" + "=" * 72)
print(f"{len(passed)} passed | {len(warned)} warnings | {len(failed)} failed")
if failed:
    sys.exit(1)
