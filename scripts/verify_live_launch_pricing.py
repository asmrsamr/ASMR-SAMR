#!/usr/bin/env python3
"""Verify live Supabase storefront prices against the latest Excel import.

This is intentionally read-only. It calls the public storefront catalog RPC
with the browser-safe publishable key from website/config.local.js.
"""

from __future__ import annotations

import io
import json
import re
import sys
import urllib.error
import urllib.request
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
CONFIG = ROOT / "website" / "config.local.js"
MANIFEST = ROOT / "data" / "product-pricing-latest.json"


def read_config_value(source: str, key: str) -> str:
    match = re.search(rf"\b{re.escape(key)}\s*:\s*['\"]([^'\"]+)['\"]", source)
    return match.group(1).strip() if match else ""


def request_json(url: str, key: str) -> dict:
    request = urllib.request.Request(
        url,
        data=b"{}",
        method="POST",
        headers={
            "apikey": key,
            "Authorization": f"Bearer {key}",
            "Content-Type": "application/json",
        },
    )
    try:
        with urllib.request.urlopen(request, timeout=25) as response:
            return json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as error:
        body = error.read().decode("utf-8", errors="replace")
        raise SystemExit(f"Supabase returned HTTP {error.code}: {body[:500]}") from error


def money(value: object) -> float:
    return round(float(value or 0), 2)


def main() -> int:
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")
    if not CONFIG.exists():
        raise SystemExit(f"Missing {CONFIG}")
    if not MANIFEST.exists():
        raise SystemExit(f"Missing {MANIFEST}")

    config = CONFIG.read_text(encoding="utf-8")
    supabase_url = read_config_value(config, "supabaseUrl").rstrip("/")
    publishable_key = read_config_value(config, "supabaseAnonKey")
    if not supabase_url or not publishable_key:
        raise SystemExit("website/config.local.js is missing supabaseUrl or supabaseAnonKey")

    manifest = json.loads(MANIFEST.read_text(encoding="utf-8"))
    expected = {
        (record["product_id"], size): money(price)
        for record in manifest.get("records", [])
        for size, price in record.get("prices", {}).items()
    }

    catalog = request_json(f"{supabase_url}/rest/v1/rpc/get_storefront_catalog", publishable_key)
    products = catalog.get("products", []) if isinstance(catalog, dict) else []
    actual = {
        (product.get("id"), price.get("size")): money(price.get("price"))
        for product in products
        for price in product.get("product_prices", [])
    }

    print("\n[Live launch pricing]")
    failures = 0
    for key, expected_price in sorted(expected.items()):
        actual_price = actual.get(key)
        product_id, size = key
        if actual_price == expected_price:
            print(f"  PASS  {product_id} {size}: {expected_price:g} SAR")
        else:
            failures += 1
            seen = "missing" if actual_price is None else f"{actual_price:g} SAR"
            print(f"  FAIL  {product_id} {size}: expected {expected_price:g} SAR, live has {seen}")

    if failures:
        print(f"\n{failures} live prices do not match the Excel launch import.")
        print("Apply supabase/imports/product-pricing-latest.sql, then rerun this verifier.")
        return 1

    print("\nLive Supabase prices match the latest Excel launch import.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
