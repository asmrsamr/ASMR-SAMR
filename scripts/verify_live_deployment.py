#!/usr/bin/env python3
"""Verify that the public Cloudflare Pages site is serving the expected build."""

from __future__ import annotations

import argparse
import json
import re
import subprocess
import sys
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_URL = "https://asmr-samr.pages.dev"
TITLE_RE = re.compile(r"<title>(.*?)</title>", re.I | re.S)
VERSION_RE = re.compile(r"\?v=([^'\"\s<>]+)")
ASSET_RE = re.compile(
    r"(?:href|src|(?:script|admin|config)\.src)\s*=\s*['\"]"
    r"([^'\"]+\.(?:css|js)\?v=[^'\"]+)['\"]",
    re.I,
)


def git_short_sha() -> str:
    try:
        result = subprocess.run(
            ["git", "rev-parse", "--short", "HEAD"],
            cwd=ROOT,
            text=True,
            capture_output=True,
            timeout=10,
            check=True,
        )
        return result.stdout.strip()
    except (OSError, subprocess.SubprocessError):
        return ""


def request_text(url: str, timeout: int) -> tuple[int, str]:
    request = urllib.request.Request(
        url,
        headers={
            "Cache-Control": "no-cache",
            "Pragma": "no-cache",
            "User-Agent": "asmr-samr-live-verifier/1.0",
        },
    )
    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            return response.status, response.read().decode("utf-8", errors="replace")
    except urllib.error.HTTPError as error:
        return error.code, error.read().decode("utf-8", errors="replace")


def resolve_asset_url(base_url: str, asset: str) -> str:
    return urllib.parse.urljoin(base_url, asset)


def main() -> int:
    parser = argparse.ArgumentParser(description="Check the live ASMR & SAMR deployment.")
    parser.add_argument("--url", default=DEFAULT_URL, help=f"Live site URL. Defaults to {DEFAULT_URL}.")
    parser.add_argument(
        "--expected-version",
        default=git_short_sha(),
        help="Expected asset cache version. Defaults to the current short git SHA.",
    )
    parser.add_argument("--timeout", type=int, default=30, help="HTTP timeout in seconds.")
    parser.add_argument("--json", action="store_true", help="Print machine-readable JSON.")
    args = parser.parse_args()

    checks: list[tuple[bool, str]] = []
    status, html = request_text(args.url, args.timeout)
    checks.append((status == 200, f"live HTML returns HTTP 200 (got {status})"))

    title = TITLE_RE.search(html)
    title_text = re.sub(r"\s+", " ", title.group(1)).strip() if title else ""
    checks.append(("ASMR" in title_text and "SAMR" in title_text, f"title identifies ASMR & SAMR ({title_text or 'missing'})"))
    checks.append(("admin-dashboard.js" in html, "Supabase admin bundle is referenced"))
    checks.append(("app.js" in html, "storefront bundle is referenced"))
    checks.append(("?v=dev" not in html, "development cache version is absent from live HTML"))

    versions = sorted(set(VERSION_RE.findall(html)))
    checks.append((len(versions) == 1, f"live assets share one cache version ({', '.join(versions) or 'none'})"))
    if args.expected_version:
        checks.append((versions == [args.expected_version], f"live cache version matches {args.expected_version}"))

    asset_urls = [resolve_asset_url(args.url, asset) for asset in ASSET_RE.findall(html)]
    for asset_url in asset_urls:
        asset_status, _ = request_text(asset_url, args.timeout)
        label = urllib.parse.urlparse(asset_url).path.rsplit("/", 1)[-1]
        checks.append((asset_status == 200, f"asset loads: {label} (HTTP {asset_status})"))

    payload = {
        "url": args.url,
        "status": status,
        "title": title_text,
        "versions": versions,
        "expected_version": args.expected_version,
        "asset_count": len(asset_urls),
        "passed": [label for ok, label in checks if ok],
        "failed": [label for ok, label in checks if not ok],
    }

    if args.json:
        print(json.dumps(payload, indent=2))
    else:
        print("\n[Live deployment]")
        for ok, label in checks:
            print(f"  {'PASS' if ok else 'FAIL':<4}  {label}")
        print(f"\n{len(payload['passed'])} passed | {len(payload['failed'])} failed")

    return 0 if not payload["failed"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
