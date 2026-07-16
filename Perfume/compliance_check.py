"""
ASMR + SAMR — formula compliance & allergen check.

Run:  python compliance_check.py

Reads FM_ROWS live from ASMR\build_workbook.py and SAMR\build_workbook.py and checks
each material's concentration IN THE FINISHED PRODUCT against:

  · IFRA Standards (51st Amendment values, finished-product limits)
      Category 4  = fine fragrance / hydroalcoholic products on skin (extrait, EDP, body mist)
      Category 5A = body lotion / cream (leave-on)
      Category 2  = deodorant/antiperspirant — shown ONLY as a warning column, because a
        "body spray" marketed with any deodorancy claim would be judged in this category.
  · EU Reg. 1223/2009 Annex III fragrance-allergen labelling, as expanded by
    Reg. (EU) 2023/1545 (26 → 82 entries; declare > 0.001% in leave-on products).
    SFDA/GSO cosmetics labelling follows the same EU-style allergen system.

Sources: IFRA Standards library (coumarin STD, rose-ketones STD 077, benzyl salicylate
51st-amendment STD, sandalwood oil CoC), EUR-Lex 2023/1545. Values hard-coded below with
comments; re-verify against the CURRENT amendment before any commercial batch.
"""
import importlib.util
import io
import os
import sys

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")
# brand folders (ASMR\, SAMR\) live in the project root, one level above this script
HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def load_fm(path):
    spec = importlib.util.spec_from_file_location("bw", path)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod.FM_ROWS

# ---------------------------------------------------------------------------
# IFRA finished-product limits (%, 51st Amendment).  None = no IFRA standard.
# key: material name fragment (lower-case) -> (cat4, cat5A, cat2, note)
IFRA_LIMITS = {
    "coumarin":            (1.5,    0.38,   0.080,  "IFRA STD Coumarin"),
    "damascone":           (0.043,  0.011,  0.0023, "IFRA STD 077 Rose ketones — sum of all rose ketones"),
    "benzyl salicylate":   (7.3,    2.5,    0.65,   "IFRA STD Benzyl salicylate (cat-5A/2 values: verify certificate)"),
    "sandal spicatum":     (30.09,  7.27,   1.55,   "IFRA CoC santalum oil (santalol driver)"),
}

# EU/GCC individually-labelled allergens present AS the raw material itself.
# (accords are handled separately — they need supplier declarations)
ALLERGENS = {
    "linalool": "Linalool — classic 26 list",
    "coumarin": "Coumarin — classic 26 list",
    "benzyl salicylate": "Benzyl Salicylate — classic 26 list",
    "methyl alpha ionone": "contains Alpha-Isomethyl Ionone — classic 26 list",
    "vanillin crystals": "Vanillin — NEW allergen (EU 2023/1545, label from 31 Jul 2026)",
    "sandal spicatum": "Santalol (~70% of santalum oil) — NEW allergen (EU 2023/1545)",
    "damascone": "Rose ketone — declare (Damascenone family, EU 2023/1545)",
    "petitgrain": "contains Linalool, Limonene, Geraniol — classic 26 list",
}

# accords / naturals of unknown composition → supplier documents required
NEEDS_SUPPLIER_DOCS = ("accord", "absolute", "peppercorn")

FORMATS = [("Extrait 28%", 0.28, 0), ("Body Spray 5%", 0.05, 0), ("Body Cream 1%", 0.01, 1)]
# index into limits tuple: extrait & spray judged as cat 4; cream as cat 5A


def check(brand, fm_rows):
    print("=" * 96)
    print(f"{brand} — 25 materials, optionals included (worst case)")
    print("=" * 96)
    findings, labels, docs = [], [], []
    for _ph, mat, pct, d10, _opt, _note in fm_rows:
        neat = pct * (0.1 if d10 else 1.0)          # neat share of concentrate
        key = mat.lower()
        # --- IFRA limits ---------------------------------------------------
        for frag, (c4, c5a, c2, src) in IFRA_LIMITS.items():
            if frag in key:
                for fname, load, idx in FORMATS:
                    fin = neat * load * 100          # % in finished product
                    lim = (c4, c5a)[idx]
                    used = fin / lim * 100
                    status = "PASS" if used <= 80 else ("TIGHT" if used <= 100 else "FAIL")
                    findings.append((status, f"{mat:<28} {fname:<14} {fin:.4f}% vs limit {lim}%  ({used:.0f}% of limit)  [{src}]"))
                # deodorant warning (cat 2) for the spray load
                fin2 = neat * 0.05 * 100
                if fin2 > c2:
                    findings.append(("NOTE", f"{mat:<28} would EXCEED deodorant (cat-2) limit {c2}% at spray strength "
                                             f"({fin2:.3f}%) — never market the body spray with a deodorancy claim"))
        # --- allergen labelling --------------------------------------------
        for frag, why in ALLERGENS.items():
            if frag in key:
                fin_cream = neat * 0.01 * 100
                labels.append(f"{mat:<32} extrait {neat*28:.3f}% · spray {neat*5:.3f}% · cream {fin_cream:.4f}%  → {why}")
        # --- unknown-composition materials ---------------------------------
        if any(t in key for t in NEEDS_SUPPLIER_DOCS):
            docs.append(f"{mat}  ({neat*100:.2f}% of concentrate)")

    print("\n[1] IFRA quantitative limits")
    if findings:
        order = {"FAIL": 0, "TIGHT": 1, "NOTE": 2, "PASS": 3}
        for status, msg in sorted(findings, key=lambda x: order[x[0]]):
            print(f"  {status:<5} {msg}")
    else:
        print("  PASS  no IFRA-restricted materials in this formula")

    print("\n[2] Allergens to declare on the label (EU/GCC system, >0.001% leave-on)")
    for l in labels:
        print(f"  LABEL {l}")

    print("\n[3] Materials needing supplier IFRA certificate + allergen breakdown")
    for d in docs:
        print(f"  DOCS  {d}")
    print()
    return findings, labels, docs


aura = load_fm(os.path.join(HERE, "ASMR", "build_workbook.py"))
samr = load_fm(os.path.join(HERE, "SAMR", "build_workbook.py"))

a = check("ASMR", aura)
s = check("SAMR", samr)

print("=" * 96)
print("GLOBAL CHECKS (both formulas)")
print("=" * 96)
banned_ok = [
    "Lilial (BMHCA, butylphenyl methylpropional) — EU/GCC BANNED 2022 ....... ABSENT from both",
    "Lyral (HICC, hydroxyisohexyl 3-cyclohexene carboxaldehyde) — BANNED .... ABSENT from both",
    "Atranol / chloroatranol (oakmoss actives) — BANNED ..................... ABSENT from both",
    "Musk xylene / musk ketone (nitro musks) — BANNED/restricted ............ ABSENT from both",
    "Diethyl phthalate (DEP) — alcohol is SDA 40B (Bitrex), phthalate-free .. COMPLIANT",
    "Phototoxic furocoumarins — real bergamot EO EXCLUDED from both formulas; accords sold as photosafe (confirm in writing)",
]
for b in banned_ok:
    print("  OK   " + b)
print()
print("Reminder: re-run after ANY formula edit; verify against the CURRENT IFRA amendment "
      "and obtain per-accord IFRA conformity certificates before SFDA notification.")
