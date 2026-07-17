"""
Deployment package contract tests.

Run: python website/test_deploy_package.py
"""
from __future__ import annotations

import io
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path


sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")

ROOT = Path(__file__).resolve().parents[1]
SCRIPT = ROOT / "scripts" / "build_static_site.py"
SOURCE_CONFIG = ROOT / "website" / "config.local.js"
WRANGLER = ROOT / "wrangler.toml"

passed: list[str] = []
failed: list[str] = []


def ok(label: str) -> None:
    passed.append(label)
    print(f"  PASS  {label}")


def fail(label: str) -> None:
    failed.append(label)
    print(f"  FAIL  {label}")


print("\n[1] Static deployment package")
tmp_root = Path(tempfile.mkdtemp(prefix="asmr-samr-deploy-"))
output = tmp_root / "site"

env = os.environ.copy()
env.update(
    {
        "ASMR_SAMR_SUPABASE_ANON_KEY": "sb_publishable_TEST_ONLY",
        "ASMR_SAMR_WHATSAPP_NUMBER": "966512345678",
        "ASMR_SAMR_SITE_DOMAIN": "https://example.test",
        "ASMR_SAMR_FOUNDER_NAME": "Launch Founder",
        "ASMR_SAMR_RESERVED_COUNT": "77",
    }
)

try:
    result = subprocess.run(
        [sys.executable, str(SCRIPT), "--output", str(output)],
        cwd=ROOT,
        env=env,
        text=True,
        capture_output=True,
        timeout=60,
    )
    (ok if result.returncode == 0 else fail)("deployment package script exits successfully")

    for relative in ("index.html", "app.js", "admin-dashboard.js", "style.css", "config.local.js", "assets"):
        (ok if (output / relative).exists() else fail)(f"package contains {relative}")

    generated = (output / "config.local.js").read_text(encoding="utf-8")
    match = re.search(r"window\.ASMR_SAMR_CONFIG\s*=\s*(\{[\s\S]*\});", generated)
    if match:
        parsed = json.loads(match.group(1))
        ok("generated config parses as JSON-compatible JavaScript")
        (ok if parsed.get("whatsappNumber") == "966512345678" else fail)("generated config uses deployment WhatsApp number")
        (ok if parsed.get("siteDomain") == "https://example.test" else fail)("generated config uses deployment domain")
        (ok if parsed.get("founderName") == "Launch Founder" else fail)("generated config uses deployment founder metadata")
        (ok if parsed.get("reservedCount") == 77 else fail)("generated config uses deployment reserved count")
    else:
        fail("generated config exposes window.ASMR_SAMR_CONFIG")

    if SOURCE_CONFIG.exists():
        source = SOURCE_CONFIG.read_text(encoding="utf-8")
        (ok if generated != source else fail)("developer-local config is not copied into package")
        local_key = re.search(r"supabaseAnonKey:\s*'([^']+)'", source)
        if local_key:
            (ok if local_key.group(1) not in generated else fail)("developer-local Supabase key is absent from package")

    wrangler = WRANGLER.read_text(encoding="utf-8") if WRANGLER.exists() else ""
    (ok if 'pages_build_output_dir = "./dist"' in wrangler else fail)("Cloudflare Pages output directory is configured")
finally:
    shutil.rmtree(tmp_root, ignore_errors=True)


print("\n" + "=" * 72)
print(f"{len(passed)} passed | {len(failed)} failed")
if failed:
    print("FAILURES:")
    for label in failed:
        print("  ·", label)
    raise SystemExit(1)
