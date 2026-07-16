from __future__ import annotations

import importlib.util
import sys
from pathlib import Path

from openpyxl import Workbook, load_workbook
from openpyxl.styles import Alignment, Border, Font, PatternFill, Protection, Side
from openpyxl.utils import get_column_letter


ROOT = Path(__file__).resolve().parents[1]


ARIAL = "Arial"
CHARCOAL = "404040"
CHARCOAL_DK = "2F2F2F"
GOLD = "C9A961"
GOLD_LT = "EBDFC6"
IVORY = "FBF8F1"
IVORY_DK = "F3EBDD"
INPUT_FILL = "FFF8D8"
RED_FILL = "F6D7D2"
GREEN_FILL = "DCEBDC"
WHITE = "FFFFFF"
MUTED = "666666"
LINK_BLUE = "1155CC"

F_TITLE = Font(name=ARIAL, size=18, bold=True, color=CHARCOAL)
F_SUB = Font(name=ARIAL, size=10, italic=True, color=MUTED)
F_HDR = Font(name=ARIAL, size=9, bold=True, color=WHITE)
F_LABEL = Font(name=ARIAL, size=9, color=CHARCOAL)
F_LABEL_B = Font(name=ARIAL, size=9, bold=True, color=CHARCOAL)
F_INPUT = Font(name=ARIAL, size=9, bold=True, color="1F4E79")
F_MUTED = Font(name=ARIAL, size=8, color=MUTED)
F_LINK = Font(name=ARIAL, size=8, underline="single", color=LINK_BLUE)

FILL_HDR = PatternFill("solid", start_color=CHARCOAL_DK)
FILL_GOLD = PatternFill("solid", start_color=GOLD)
FILL_GOLD_LT = PatternFill("solid", start_color=GOLD_LT)
FILL_IVORY = PatternFill("solid", start_color=IVORY)
FILL_IVORY_DK = PatternFill("solid", start_color=IVORY_DK)
FILL_INPUT = PatternFill("solid", start_color=INPUT_FILL)
FILL_RED = PatternFill("solid", start_color=RED_FILL)
FILL_GREEN = PatternFill("solid", start_color=GREEN_FILL)

SIDE_THIN = Side(style="thin", color="D9D0BD")
B_ALL = Border(left=SIDE_THIN, right=SIDE_THIN, top=SIDE_THIN, bottom=SIDE_THIN)
B_INPUT = Border(left=Side(style="thin", color=GOLD), right=Side(style="thin", color=GOLD),
                 top=Side(style="thin", color=GOLD), bottom=Side(style="thin", color=GOLD))

FMT_G = '0.00" g"'
FMT_SAR = '"SAR "#,##0.00'
FMT_PCT = "0.0%"
FMT_INT = "0"


def load_builder(project_dir: Path):
    path = project_dir / "build_workbook.py"
    name = f"builder_{project_dir.name.lower()}"
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec)
    assert spec and spec.loader
    sys.path.insert(0, str(project_dir))
    try:
        spec.loader.exec_module(module)
    finally:
        sys.path.pop(0)
    return module


def put(ws, addr, value, font=F_LABEL, fill=None, fmt=None, align="left", border=None,
        wrap=False, unlocked=False):
    cell = ws[addr]
    cell.value = value
    cell.font = font
    if fill:
        cell.fill = fill
    if fmt:
        cell.number_format = fmt
    cell.alignment = Alignment(horizontal=align, vertical="center", wrap_text=wrap)
    if border:
        cell.border = border
    if unlocked:
        cell.protection = Protection(locked=False)
    return cell


def merge(ws, range_addr):
    ws.merge_cells(range_addr)


def widths(ws, widths_map):
    for col, width in widths_map.items():
        ws.column_dimensions[col].width = width


def title(ws, title_text, subtitle):
    ws.sheet_view.showGridLines = False
    merge(ws, "A1:H1")
    put(ws, "A1", title_text, font=F_TITLE, align="center")
    merge(ws, "A2:H2")
    put(ws, "A2", subtitle, font=F_SUB, align="center")
    ws.row_dimensions[1].height = 28


def band(ws, row, text, last_col=8, fill=FILL_GOLD):
    merge(ws, f"A{row}:{get_column_letter(last_col)}{row}")
    put(ws, f"A{row}", text, font=F_HDR, fill=fill, align="center", border=B_ALL)


def header(ws, row, labels):
    for i, label in enumerate(labels, start=1):
        put(ws, f"{get_column_letter(i)}{row}", label, font=F_HDR, fill=FILL_HDR,
            align="center", border=B_ALL, wrap=True)


def unlock_sheet(ws):
    ws.protection.sheet = False
    for row in ws.iter_rows():
        for cell in row:
            cell.protection = Protection(locked=False)


def source_value(project_dir: Path, sheet: str, cell: str):
    wb = load_workbook(project_dir / next(project_dir.glob("*_Production_Suite.xlsx")).name, data_only=True)
    try:
        return wb[sheet][cell].value
    finally:
        wb.close()


def get_links(builder, mat: str):
    if hasattr(builder, "SUPPLIER"):
        label, url, _ = builder.SUPPLIER.get(mat, ("iterji.com", "", True))
        return label, url
    for row in builder.INV_ROWS:
        if row[0] == mat and len(row) >= 8:
            return "iterji.com", row[7]
    return "iterji.com", ""


def product_inventory_rows(builder, product_type, project_name, conc_cost, alc_cost):
    alcohol_label, alcohol_url = get_links(builder, "Alcohol 190 proof SDA 40B")
    concentrate_note = f"Finished {project_name} perfume concentrate made from the main production suite."
    rows = [
        {
            "material": f"{project_name} perfume concentrate",
            "role": "Fragrance",
            "pack": 1,
            "unit": "g",
            "price": conc_cost,
            "density": 1.00,
            "supplier": "Internal",
            "url": "",
            "use": "Weigh as finished concentrate. Do not rebuild the full perfume formula inside this product file.",
            "storage": "Amber glass, tightly closed, cool dark cabinet.",
        }
    ]
    if product_type == "body_spray":
        rows.append({
            "material": "Alcohol 190 proof SDA 40B",
            "role": "Diluent / carrier",
            "pack": 1000,
            "unit": "ml",
            "price": alc_cost * 1000 * 0.81,
            "density": 0.81,
            "supplier": alcohol_label,
            "url": alcohol_url,
            "use": "Use only SDA 40B. Add slowly to concentrate while stirring; keep away from flame.",
            "storage": "Flammable. Keep capped, ventilated, away from heat.",
        })
    else:
        rows.extend([
            {
                "material": "Distilled water",
                "role": "Water phase / balance",
                "pack": 1000,
                "unit": "g",
                "price": 8.00,
                "density": 1.00,
                "supplier": "iterji.com / local pharmacy",
                "url": "https://iterji.com/",
                "use": "Use distilled water only. Heat this phase before emulsifying.",
                "storage": "Use clean sealed bottle; discard if contaminated.",
            },
            {
                "material": "Emulsifying wax",
                "role": "Emulsifier",
                "pack": 250,
                "unit": "g",
                "price": 35.00,
                "density": 1.00,
                "supplier": "iterji.com / cosmetic supplier",
                "url": "https://iterji.com/",
                "use": "Melt fully in the oil phase before combining with water.",
                "storage": "Dry container, away from moisture.",
            },
            {
                "material": "Carrier oil",
                "role": "Oil phase",
                "pack": 250,
                "unit": "g",
                "price": 30.00,
                "density": 1.00,
                "supplier": "iterji.com / cosmetic supplier",
                "url": "https://iterji.com/",
                "use": "Blend with emulsifying wax and heat until uniform.",
                "storage": "Cool dark storage; discard if rancid odor appears.",
            },
            {
                "material": "Broad-spectrum preservative",
                "role": "Preservation",
                "pack": 100,
                "unit": "g",
                "price": 45.00,
                "density": 1.00,
                "supplier": "iterji.com / cosmetic supplier",
                "url": "https://iterji.com/",
                "use": "Required because cream contains water. Add during cool-down at supplier-approved temperature.",
                "storage": "Follow supplier temperature and shelf-life instructions.",
            },
        ])
    return rows


def add_inventory_sheet(wb, builder, product_type, project_name, conc_cost, alc_cost):
    ws = wb.create_sheet("Inventory & Links")
    widths(ws, {"A": 28, "B": 18, "C": 8, "D": 7, "E": 11, "F": 9, "G": 11,
                "H": 22, "I": 16, "J": 42, "K": 34})
    title(ws, "Product Materials, Prices & Links",
          "Only the materials used in this product are listed here. Perfume concentrate is treated as one finished input.")
    header(ws, 4, ["Material", "Role", "Pack", "Unit", "Price/pack", "Density", "SAR/g",
                   "Supplier", "Link", "How to use it", "Storage / safety"])
    for i, row in enumerate(product_inventory_rows(builder, product_type, project_name, conc_cost, alc_cost), start=5):
        put(ws, f"A{i}", row["material"], border=B_ALL, wrap=True)
        put(ws, f"B{i}", row["role"], font=F_MUTED, align="center", border=B_ALL, wrap=True)
        put(ws, f"C{i}", row["pack"], fmt=FMT_INT, align="center", border=B_ALL)
        put(ws, f"D{i}", row["unit"], font=F_MUTED, align="center", border=B_ALL)
        put(ws, f"E{i}", row["price"], fmt=FMT_SAR, align="center", border=B_ALL)
        put(ws, f"F{i}", row["density"], fmt="0.00", align="center", border=B_ALL)
        put(ws, f"G{i}", f'=IF(D{i}="ml",E{i}/(C{i}*F{i}),E{i}/C{i})', fmt=FMT_SAR, align="center", border=B_ALL)
        put(ws, f"H{i}", row["supplier"], font=F_MUTED, align="center", border=B_ALL, wrap=True)
        cell = put(ws, f"I{i}", "open" if row["url"] else "internal", font=F_LINK if row["url"] else F_MUTED,
                   align="center", border=B_ALL)
        if row["url"]:
            cell.hyperlink = row["url"]
        put(ws, f"J{i}", row["use"], font=F_LABEL, border=B_ALL, wrap=True)
        put(ws, f"K{i}", row["storage"], font=F_MUTED, border=B_ALL, wrap=True)
        ws.row_dimensions[i].height = 44
    ws.freeze_panes = "A5"
    unlock_sheet(ws)


def add_process_sheet(wb, product_type):
    ws = wb.create_sheet("Step-by-Step")
    widths(ws, {"A": 8, "B": 30, "C": 86})
    title(ws, "Detailed Preparation Method", "Weigh in grams, keep batch records, patch-test before use.")
    header(ws, 4, ["Step", "Action", "Detail"])
    if product_type == "body_spray":
        steps = [
            ("1", "Prepare the bench", "Work in ventilation, away from flame or hot tools. Wear gloves. Clean the scale, beaker, stir rod, funnel, and spray bottle with alcohol and let them dry."),
            ("2", "Tare and weigh concentrate", "Place a clean glass beaker on the scale and tare to zero. Weigh the exact perfume concentrate grams from the Recipe sheet. Do not count drops."),
            ("3", "Pre-mix the concentrate", "Stir the concentrate for 30-60 seconds. If it contains any visible crystals or haze, warm the closed concentrate bottle gently in a warm-water bath, then stir again."),
            ("4", "Add alcohol in portions", "Weigh SDA 40B alcohol in 3-4 small additions. Stir after each addition so the perfume concentrate opens into the alcohol evenly. Never use SDA 39C."),
            ("5", "Clarity check", "The liquid should be clear or lightly opalescent. If cloudy, cap the beaker or bottle and rest 12-24 hours, then check again before filtering."),
            ("6", "Bottle", "Use a funnel or pipette to transfer into the spray bottle. Leave headspace so the pump can work. Cap immediately to reduce alcohol loss."),
            ("7", "Rest / macerate", "Minimum rest is 48 hours. Better: 1-2 weeks in a cool dark place. Shake gently once per day for the first 3 days."),
            ("8", "Label and record", "Label product name, body spray strength, batch ID, date, grams made, and alcohol warning. Record the batch before use or gifting."),
            ("9", "Use guidance", "Spray on clothes or body from distance. Avoid eyes, broken skin, heat, flame, and children. Patch-test first."),
        ]
    else:
        steps = [
            ("1", "Prepare the bench", "Sanitize beakers, spatula, thermometer, scale pan, mixer head, and jar. Wear gloves. Cream contains water, so cleanliness matters."),
            ("2", "Weigh water phase", "Weigh distilled water into a heat-safe beaker. This is the balance ingredient and may be adjusted to keep the total at exactly 100 g."),
            ("3", "Weigh oil phase", "In a second beaker, weigh carrier oil and emulsifying wax. Heat until the wax is fully melted and the oil phase is uniform."),
            ("4", "Heat both phases", "Bring both phases to roughly 70 C. They should be close in temperature before combining, otherwise the emulsion can split."),
            ("5", "Emulsify", "Slowly pour the water phase into the oil phase while mixing. Mix 2-3 minutes, rest 1 minute, then mix again until glossy and even."),
            ("6", "Cool with stirring", "Stir occasionally while cooling. Do not add fragrance or preservative while too hot; heat can damage them."),
            ("7", "Add preservative", "Below the preservative supplier's maximum temperature, add the broad-spectrum preservative and mix thoroughly. This is required."),
            ("8", "Add perfume concentrate", "At cool-down, add perfume concentrate at 1.0% default. Do not exceed 1.2% for leave-on cream unless you verify safety limits."),
            ("9", "Final mix", "Mix gently but completely, scraping sides and bottom. Avoid whipping in air. Check that the texture is smooth and uniform."),
            ("10", "Jar and cure", "Fill a clean jar, tap to remove air pockets, cap, and label. Let stand 24 hours before judging final texture."),
            ("11", "Use guidance", "Patch-test before use. Do not use on irritated skin. Discard if odor, color, gas, separation, or mold appears."),
        ]
    for i, (step, action, detail) in enumerate(steps, start=5):
        put(ws, f"A{i}", step, font=F_LABEL_B, fill=FILL_IVORY_DK, align="center", border=B_ALL)
        put(ws, f"B{i}", action, font=F_LABEL_B, border=B_ALL)
        put(ws, f"C{i}", detail, font=F_LABEL, wrap=True, border=B_ALL)
        ws.row_dimensions[i].height = 34
    unlock_sheet(ws)


def add_recipe_sheet(wb, project_name, revision, product_type, conc_cost, alc_cost):
    ws = wb.active
    ws.title = "Recipe"
    widths(ws, {"A": 28, "B": 13, "C": 13, "D": 16, "E": 15, "F": 58, "G": 18, "H": 18})
    if product_type == "body_spray":
        title(ws, f"{project_name} Body Spray {revision}", "Alcohol body spray, default 100 g at 5% fragrance.")
        assumptions = [
            ("Batch size (g)", 100),
            ("Fragrance %", 0.05),
            ("Alcohol %", 0.95),
            ("Concentrate cost/g", conc_cost),
            ("Alcohol cost/g", alc_cost),
        ]
        band(ws, 4, "1 · LIVE ASSUMPTIONS")
        for i, (label, val) in enumerate(assumptions, start=5):
            put(ws, f"A{i}", label, font=F_LABEL_B, border=B_ALL)
            put(ws, f"B{i}", val, font=F_INPUT, fill=FILL_INPUT, fmt=FMT_PCT if "%" in label else FMT_SAR if "cost" in label else FMT_G,
                align="center", border=B_INPUT, unlocked=True)
        band(ws, 12, "2 · FORMULA")
        header(ws, 13, ["Component", "Percent", "Grams", "Cost/g", "Cost", "How to use this material"])
        rows = [
            ("Perfume concentrate", "=B6", "=B5*B14", "=B8", "=C14*D14",
             "Finished concentrate from the main suite. Weigh it first into the beaker; do not rebuild the perfume formula here."),
            ("Alcohol 190 proof SDA 40B", "=B7", "=B5*B15", "=B9", "=C15*D15",
             "Add slowly in portions while stirring. Alcohol carries the spray and self-preserves the product. Never use SDA 39C."),
            ("TOTAL", "=SUM(B14:B15)", "=SUM(C14:C15)", "", "=SUM(E14:E15)",
             "Must equal the batch size. If you change fragrance %, alcohol automatically balances."),
        ]
        for idx, row in enumerate(rows, start=14):
            for col, val in enumerate(row, start=1):
                put(ws, f"{get_column_letter(col)}{idx}", val, font=F_LABEL_B if row[0] == "TOTAL" else F_LABEL,
                    fmt=FMT_PCT if col == 2 else FMT_G if col == 3 else FMT_SAR if col in (4, 5) else None,
                    align="center" if col in (2, 3, 4, 5) else "left", border=B_ALL, wrap=True)
        band(ws, 19, "3 · COST")
        cost_rows = [
            ("Total batch cost", "=E16"),
            ("Cost per gram", "=B20/B5"),
            ("Cost per 100 ml approx.", "=B21*100*0.87"),
        ]
    else:
        title(ws, f"{project_name} Cream {revision}", "Leave-on cream, default 100 g at 1.0% fragrance.")
        assumptions = [
            ("Batch size (g)", 100),
            ("Fragrance %", 0.01),
            ("Concentrate cost/g", conc_cost),
            ("Water cost/g", 0.008),
            ("Emulsifying wax cost/g", 0.14),
            ("Carrier oil cost/g", 0.12),
            ("Preservative cost/g", 0.45),
        ]
        band(ws, 4, "1 · LIVE ASSUMPTIONS")
        for i, (label, val) in enumerate(assumptions, start=5):
            put(ws, f"A{i}", label, font=F_LABEL_B, border=B_ALL)
            put(ws, f"B{i}", val, font=F_INPUT, fill=FILL_INPUT, fmt=FMT_PCT if "%" in label else FMT_SAR if "cost" in label else FMT_G,
                align="center", border=B_INPUT, unlocked=True)
        band(ws, 14, "2 · FORMULA")
        header(ws, 15, ["Component", "Percent", "Grams", "Cost/g", "Cost", "How to use this material"])
        rows = [
            ("Perfume concentrate", "=B6", "=B5*B16", "=B7", "=C16*D16",
             "Cool-down ingredient. Add below 40 C. Leave-on cream default is 1.0%; do not exceed 1.2% without safety review."),
            ("Distilled water", "=1-SUM(B16,B18:B20)", "=B5*B17", "=B8", "=C17*D17",
             "Water phase and formula balance. Heat separately to about 70 C before emulsifying."),
            ("Emulsifying wax", 0.050, "=B5*B18", "=B9", "=C18*D18",
             "Oil phase emulsifier. Melt completely with the carrier oil before combining with water."),
            ("Carrier oil", 0.150, "=B5*B19", "=B10", "=C19*D19",
             "Oil phase. Gives slip and body to the cream; heat with emulsifying wax."),
            ("Broad-spectrum preservative", 0.008, "=B5*B20", "=B11", "=C20*D20",
             "Mandatory because this product contains water. Add during cool-down according to supplier temperature limits."),
            ("TOTAL", "=SUM(B16:B20)", "=SUM(C16:C20)", "", "=SUM(E16:E20)",
             "Must equal 100%. If you change fragrance, oil, wax, or preservative, water balances automatically."),
        ]
        for idx, row in enumerate(rows, start=16):
            for col, val in enumerate(row, start=1):
                put(ws, f"{get_column_letter(col)}{idx}", val, font=F_LABEL_B if row[0] == "TOTAL" else F_LABEL,
                    fmt=FMT_PCT if col == 2 else FMT_G if col == 3 else FMT_SAR if col in (4, 5) else None,
                    align="center" if col in (2, 3, 4, 5) else "left", border=B_ALL, wrap=True)
        band(ws, 24, "3 · COST")
        cost_rows = [
            ("Total batch cost", "=E21"),
            ("Cost per gram", "=B25/B5"),
            ("Cost per 100 g jar", "=B26*100"),
        ]
    start = 20 if product_type == "body_spray" else 25
    for i, (label, formula) in enumerate(cost_rows, start=start):
        put(ws, f"A{i}", label, font=F_LABEL_B, border=B_ALL)
        put(ws, f"B{i}", formula, font=F_LABEL_B, fill=FILL_GOLD_LT, fmt=FMT_SAR, align="center", border=B_ALL)
    ws.freeze_panes = "A4"
    unlock_sheet(ws)


def make_file(project_dir: Path, project_name: str, revision: str, product_type: str, out_path: Path):
    builder = load_builder(project_dir)
    conc_cost = source_value(project_dir, "Cost Analysis", "B7") or source_value(project_dir, "Pricing & Sales", "B15") / (50 * 0.85 * 0.28)
    alc_cost = source_value(project_dir, "Cost Analysis", "B10") or 0.1852
    wb = Workbook()
    add_recipe_sheet(wb, project_name, revision, product_type, conc_cost, alc_cost)
    add_inventory_sheet(wb, builder, product_type, project_name, conc_cost, alc_cost)
    add_process_sheet(wb, product_type)
    wb.properties.title = f"{project_name} {product_type.replace('_', ' ').title()} {revision}"
    wb.properties.creator = project_name
    out_path.parent.mkdir(parents=True, exist_ok=True)
    wb.save(out_path)
    return out_path


def scan_errors(path: Path):
    wb = load_workbook(path, data_only=True)
    bad = []
    errors = ("#REF!", "#DIV/0!", "#VALUE!", "#NAME?", "#N/A", "#NULL!", "#NUM!")
    for ws in wb.worksheets:
        for row in ws.iter_rows():
            for cell in row:
                if isinstance(cell.value, str) and any(e in cell.value for e in errors):
                    bad.append((ws.title, cell.coordinate, cell.value))
    wb.close()
    return bad


def main():
    jobs = [
        (ROOT / "ASMR", "ASMR", "007", ROOT / "ASMR" / "Perfume 007"),
        (ROOT / "SAMR", "SAMR", "008", ROOT / "SAMR" / "SAMR 008"),
    ]
    outputs = []
    for project_dir, project_name, revision, revision_dir in jobs:
        outputs.append(make_file(project_dir, project_name, revision, "body_spray",
                                 revision_dir / f"{project_name} Body Spray {revision}.xlsx"))
        outputs.append(make_file(project_dir, project_name, revision, "cream",
                                 revision_dir / f"{project_name} Cream {revision}.xlsx"))
    for path in outputs:
        bad = scan_errors(path)
        if bad:
            raise RuntimeError(f"{path} has formula errors: {bad[:5]}")
        print(f"written: {path}")


if __name__ == "__main__":
    main()
