r"""
ASMR — file distribution with permanent versioning.

Rule (per user, 2026-07-10): never overwrite delivered files. Every distribution
creates a NEW numbered version folder — locally and on Google Drive — while the
unnumbered files at the root always hold the latest copy.

    project root ─┬─ ASMR_Production_Suite.xlsx            (latest — used by scripts)
                  ├─ ASMR Perfume.xlsx                    (latest)
                  ├─ ASMR Perfume - Master Method.docx    (latest guide)
                  ├─ Originals\           frozen first release — never touched
                  ├─ Revisions\           legacy snapshots — kept, no longer written
                  ├─ Perfume 001\         permanent, never overwritten:
                  │      ASMR Perfume 001.xlsx
                  │      ASMR Perfume - Master Method 001.docx
                  │      README 001.md
                  │      Version Info 001.txt
                  └─ Perfume 002\  ...

    G:\My Drive\ASMR\   mirrors the same structure (latest files + version folders).

Run standalone:      python distribute.py
Called from builder: distribute.main() at the end of build_workbook.py.
"""

from __future__ import annotations

import datetime
import re
import shutil
import sys
import time
from pathlib import Path

try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass

HERE = Path(__file__).resolve().parent
CANON = HERE / "ASMR_Production_Suite.xlsx"
RENAMED = HERE / "ASMR Perfume.xlsx"
GUIDE = HERE / "ASMR Perfume - Master Method.docx"
PREP = HERE / "ASMR Preparation Guide.docx"
README = HERE / "README.md"
BUILD_WORKBOOK = HERE / "build_workbook.py"
BUILD_PREP = HERE / "build_preparation_doc.py"
CHECKS = HERE / "check_workbook.py"
DIST = HERE / "distribute.py"
ORIGINALS = HERE / "Originals"

DRIVE_ROOT = Path(r"G:\My Drive\ASMR")

VERSION_RE = re.compile(r"^Perfume (\d{1,4})$")


def _copy(src: Path, dst: Path) -> None:
    """Copy with retries — Word/Excel/DriveFS can hold transient locks for a few seconds."""
    dst.parent.mkdir(parents=True, exist_ok=True)
    for attempt in range(4):
        try:
            shutil.copy2(src, dst)
            return
        except OSError:
            if attempt == 3:
                raise
            time.sleep(2)


def _drive_available() -> bool:
    try:
        return DRIVE_ROOT.parent.exists()
    except OSError:
        return False


def _next_version(roots: list[Path]) -> int:
    highest = 0
    for root in roots:
        if not root.exists():
            continue
        for child in root.iterdir():
            if child.is_dir():
                m = VERSION_RE.match(child.name)
                if m:
                    highest = max(highest, int(m.group(1)))
    return highest + 1


def _seed_originals(targets: list[Path]) -> None:
    stamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
    for base in targets:
        base.mkdir(parents=True, exist_ok=True)
        if not any(base.iterdir()):
            _copy(CANON, base / f"ASMR_Production_Suite__ORIGINAL_{stamp}.xlsx")
            _copy(CANON, base / f"ASMR Perfume__ORIGINAL_{stamp}.xlsx")


def main() -> None:
    if not CANON.exists():
        raise SystemExit(f"Canonical file not found: {CANON}\nRun build_workbook.py first.")

    drive_ok = _drive_available()
    roots = [HERE] + ([DRIVE_ROOT] if drive_ok else [])
    n = _next_version(roots)
    tag = f"{n:03d}"
    now = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    # deliverables that exist right now: (source, versioned name)
    deliverables = [
        (CANON, f"ASMR_Production_Suite {tag}.xlsx"),
        (CANON, f"ASMR Perfume {tag}.xlsx"),
    ]
    if GUIDE.exists():
        deliverables.append((GUIDE, f"ASMR Perfume - Master Method {tag}.docx"))
    if PREP.exists():
        deliverables.append((PREP, f"ASMR Preparation Guide {tag}.docx"))
    if README.exists():
        deliverables.append((README, f"README {tag}.md"))
    for src, name in [
        (BUILD_WORKBOOK, "build_workbook.py"),
        (BUILD_PREP, "build_preparation_doc.py"),
        (CHECKS, "check_workbook.py"),
        (DIST, "distribute.py"),
    ]:
        if src.exists():
            deliverables.append((src, name))

    # 1 · seed Originals/ if this is the first ever run
    _seed_originals([ORIGINALS] + ([DRIVE_ROOT / "Originals"] if drive_ok else []))

    # 2 · permanent version folders (never overwrite an existing one)
    for root in roots:
        vdir = root / f"Perfume {tag}"
        if vdir.exists():
            raise SystemExit(f"Refusing to overwrite existing version folder: {vdir}")
        vdir.mkdir(parents=True)
        for src, name in deliverables:
            _copy(src, vdir / name)
        info = vdir / f"Version Info {tag}.txt"
        info.write_text(
            f"ASMR Perfume — version {tag}\n"
            f"created: {now}\n"
            f"files:\n" + "".join(f"  - {name}\n" for _, name in deliverables) +
            "\nThis folder is permanent. New builds create the next number; "
            "the unnumbered files at the root are always the latest copy.\n",
            encoding="utf-8")

    # 3 · latest (unnumbered) copies at the roots — never fatal: the permanent
    #     version folders above are already safe on disk and Drive
    latest = [(CANON, RENAMED)]
    if drive_ok:
        latest += [(CANON, DRIVE_ROOT / CANON.name), (CANON, DRIVE_ROOT / RENAMED.name)]
        if GUIDE.exists():
            latest.append((GUIDE, DRIVE_ROOT / GUIDE.name))
        if PREP.exists():
            latest.append((PREP, DRIVE_ROOT / PREP.name))
        if README.exists():
            latest.append((README, DRIVE_ROOT / README.name))
    for src, dst in latest:
        try:
            _copy(src, dst)
        except OSError as e:
            print(f"  warn    → could not refresh latest copy {dst.name}: {e}")

    # 4 · report
    print(f"  version → Perfume {tag}  ({len(deliverables)} files + version info)")
    print(f"  local   → {HERE / f'Perfume {tag}'}")
    if drive_ok:
        print(f"  drive   → {DRIVE_ROOT / f'Perfume {tag}'}")
        print(f"  drive   → latest copies refreshed at {DRIVE_ROOT}")
    else:
        print("  drive   → SKIPPED (G:\\ not mounted — is Google Drive for Desktop running?)")


if __name__ == "__main__":
    main()
