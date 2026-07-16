"""
SAMR Production Suite — workbook generator.

Run:  python build_workbook.py
Out:  SAMR_Production_Suite.xlsx  (regenerated deterministically)

Pure openpyxl. Every calculated cell is a live Excel formula referencing
named input cells, so the workbook keeps working when inputs change in Excel.
"""

import datetime

from openpyxl import Workbook
from openpyxl.comments import Comment
from openpyxl.formatting.rule import FormulaRule
from openpyxl.styles import Alignment, Border, Font, PatternFill, Protection, Side
from openpyxl.utils import get_column_letter
from openpyxl.workbook.defined_name import DefinedName
from openpyxl.worksheet.datavalidation import DataValidation
from openpyxl.worksheet.properties import PageSetupProperties

OUT = "SAMR_Production_Suite.xlsx"

# ---------------------------------------------------------------- palette ---
CHARCOAL = "3B3531"
CHARCOAL_DK = "2C2825"
GOLD = "C4A566"
GOLD_DK = "9C7B3C"
GOLD_LT = "EBDFC6"
IVORY = "FBF8F1"
IVORY_DK = "F2EBDD"
MUTED = "8A8072"
WHITE = "FFFFFF"
RED_TX = "A93226"
RED_FILL = "F6D7D2"
GREEN_TX = "2E7D4F"
GREEN_FILL = "DCEBDC"
AMBER_FILL = "FBE9C9"
GREY_FILL = "E8E4DC"
INPUT_FILL = "F6EEDD"

ARIAL = "Arial"

F_TITLE = Font(name=ARIAL, size=18, bold=True, color=CHARCOAL)
F_SUB = Font(name=ARIAL, size=9.5, italic=True, color=MUTED)
F_SECT = Font(name=ARIAL, size=10, bold=True, color=IVORY)
F_HDR = Font(name=ARIAL, size=9, bold=True, color=IVORY)
F_LABEL = Font(name=ARIAL, size=10, color=CHARCOAL)
F_LABEL_B = Font(name=ARIAL, size=10, bold=True, color=CHARCOAL)
F_VALUE = Font(name=ARIAL, size=10, color=CHARCOAL)
F_INPUT = Font(name=ARIAL, size=10, bold=True, color=CHARCOAL)
F_MUTED = Font(name=ARIAL, size=9, italic=True, color=MUTED)
F_GOLD = Font(name=ARIAL, size=10, bold=True, color=GOLD_DK)
F_KPI = Font(name=ARIAL, size=14, bold=True, color=CHARCOAL)
F_KPI_LBL = Font(name=ARIAL, size=8.5, bold=True, color=MUTED)

FILL_SECT = PatternFill("solid", start_color=CHARCOAL)
FILL_HDR = PatternFill("solid", start_color=CHARCOAL_DK)
FILL_GOLD = PatternFill("solid", start_color=GOLD)
FILL_GOLD_LT = PatternFill("solid", start_color=GOLD_LT)
FILL_IVORY = PatternFill("solid", start_color=IVORY)
FILL_IVORY_DK = PatternFill("solid", start_color=IVORY_DK)
FILL_INPUT = PatternFill("solid", start_color=INPUT_FILL)
FILL_YELLOW = PatternFill("solid", start_color="FFF2B8")

THIN = Side(style="thin", color="DCD2BE")
GOLD_SIDE = Side(style="medium", color=GOLD)
B_ALL = Border(left=THIN, right=THIN, top=THIN, bottom=THIN)
B_GOLD_BOTTOM = Border(bottom=GOLD_SIDE)
B_INPUT = Border(left=Side(style="thin", color=GOLD), right=Side(style="thin", color=GOLD),
                 top=Side(style="thin", color=GOLD), bottom=Side(style="thin", color=GOLD))

FMT_G = '#,##0.00'
FMT_G3 = '#,##0.000'
FMT_G_DASH = '#,##0.00;-#,##0.00;"–"'
FMT_SAR = '#,##0.00'
FMT_PCT1 = '0.0%'
FMT_PCT2 = '0.00%'
FMT_DATE = 'yyyy-mm-dd'
FMT_INT = '0'
FMT_D1 = '0.0'

UNLOCKED = Protection(locked=False)


# ------------------------------------------------------------------- data ---
# (phase, material, pct_fraction, d10, optional, note)
FM_ROWS = [
    ("TOP", "Bergamot Accord", 0.045, False, False, "sun-warmed citrus — the first glance across the room"),
    ("TOP", "Pink Peppercorn", 0.010, True, False, "rosy-spicy spark over the opening"),
    ("TOP", "Aldehyde C-14 Peach", 0.020, False, False, "ripe peach skin — velvet, juicy, warm"),
    ("TOP", "Raspberry Accord", 0.010, False, False, "lip-gloss fruit — playful, kissable"),
    ("HEART", "Hedione (Firmenich)", 0.147, False, False, "radiant jasmine air — she fills the room"),
    ("HEART", "Jasmin Absolute Accord", 0.030, False, False, "the carnal white flower at body heat"),
    ("HEART", "Tuberose Accord", 0.015, False, False, "creamy narcotic petals"),
    ("HEART", "Methyl Alpha Ionone Iso", 0.040, False, False, "violet-iris powder — bare shoulders under silk"),
    ("HEART", "Benzyl Salicylate", 0.070, False, False, "solar balsamic glow — skin in the sun"),
    ("HEART", "Linalool", 0.015, False, False, "soft floral smoothing"),
    ("HEART", "Damascone Beta", 0.003, True, True, "velvet plum-rose glint — optional luxury"),
    ("BASE", "Vanillin Crystals", 0.065, False, False, "warm vanilla — the addiction itself"),
    ("BASE", "Ethyl Vanillin", 0.025, False, False, "deeper, creamier vanilla echo"),
    ("BASE", "Maltol (Crystals)", 0.020, True, False, "caramelised-sugar halo"),
    ("BASE", "Coumarin", 0.050, False, False, "tonka warmth — almond-hay softness"),
    ("BASE", "Heliotrope Accord", 0.025, False, False, "almond-powder tenderness"),
    ("BASE", "Aldehyde C-18 Coconut", 0.015, True, False, "a breath of coconut cream on skin"),
    ("BASE", "Ambroxan", 0.075, False, False, "ambergris radiance — the 'come closer' trail"),
    ("BASE", "Iso E Super", 0.095, False, False, "velvet-wood aura, second-skin halo"),
    ("BASE", "Cashmeran IFF", 0.030, False, False, "cashmere warmth — bedsheets and skin"),
    ("BASE", "Sandalore (Givaudan)", 0.035, False, False, "creamy sandalwood glow"),
    ("BASE", "Ethylene Brassylate", 0.075, False, False, "powdery intimate musk"),
    ("BASE", "Galaxolide", 0.055, False, False, "clean 'her skin' musk — freshly showered"),
    ("BASE", "Exaltolide Total (Firmenich)", 0.025, False, False, "warm skin-musk — the lingering embrace"),
    ("BASE", "Saffron Accord", 0.005, False, True, "saffron-suede whisper — optional luxury"),
]
FM_FIRST, FM_LAST = 7, 31          # sheet rows of the formula table
FM_TOTAL_ROW = 33

# (material, pack qty, unit, price SAR, density or None, note, assumed, product link)
INV_ROWS = [
    ("Bergamot Accord", 10, "ml", 18.75, 0.90,
     "shared with ASMR stock — photosafe accord", False, "https://iterji.com/perfumery-ingredients/aroma-accords/bergamot.html"),
    ("Pink Peppercorn", 10, "ml", 141.25, 0.90,
     "shared with ASMR · used as 10% D10", False, "https://iterji.com/perfumery-ingredients/natural-ingredients/pink-peppercorn.html"),
    ("Aldehyde C-14 Peach", 10, "ml", 16.74, 0.90,
     "NEW purchase", False, "https://iterji.com/perfumery-ingredients/aroma-chemicals/aldehyde-c-14-peach.html"),
    ("Raspberry Accord", 10, "ml", 22.50, 0.90,
     "NEW purchase", False, "https://iterji.com/perfumery-ingredients/aroma-accords/raspberry.html"),
    ("Hedione (Firmenich)", 30, "ml", 23.90, 0.90,
     "shared with ASMR", False, "https://iterji.com/perfumery-ingredients/aroma-chemicals/hedione-firmenich.html"),
    ("Jasmin Absolute Accord", 10, "ml", 45.00, 0.90,
     "NEW purchase — the heart of SAMR", False, "https://iterji.com/perfumery-ingredients/aroma-accords/jasmin-absolute.html"),
    ("Tuberose Accord", 10, "ml", 35.63, 0.90,
     "NEW purchase", False, "https://iterji.com/perfumery-ingredients/aroma-accords/tuberose.html"),
    ("Methyl Alpha Ionone Iso", 10, "ml", 17.46, 0.90,
     "shared with ASMR", False, "https://iterji.com/perfumery-ingredients/aroma-chemicals/methyl-alpha-ionone-iso.html"),
    ("Benzyl Salicylate", 10, "ml", 11.16, 0.90,
     "shared with ASMR", False, "https://iterji.com/perfumery-ingredients/aroma-chemicals/benzyl-salicylate.html"),
    ("Linalool", 10, "ml", 16.74, 0.90,
     "shared with ASMR", False, "https://iterji.com/perfumery-ingredients/aroma-chemicals/linalool.html"),
    ("Damascone Beta", 10, "ml", 98.75, 0.90,
     "NEW · POWERFUL — only ever weighed as its 10% D10", False, "https://iterji.com/perfumery-ingredients/aroma-chemicals/damascone-beta.html"),
    ("Vanillin Crystals", 10, "g", 14.65, None,
     "NEW · crystals — must dissolve fully", False, "https://iterji.com/perfumery-ingredients/aroma-chemicals/vanillin-crystals.html"),
    ("Ethyl Vanillin", 10, "g", 15.69, None,
     "NEW · crystals", False, "https://iterji.com/perfumery-ingredients/aroma-chemicals/ethyl-vanillin.html"),
    ("Maltol (Crystals)", 10, "g", 26.51, None,
     "NEW · used as 10% D10", False, "https://iterji.com/perfumery-ingredients/aroma-chemicals/maltol-crystals.html"),
    ("Coumarin", 500, "g", 150.00, None,
     "NEW · iterji sells it as a 500 g pack only (0.30 SAR/g)", False,
     "https://iterji.com/perfumery-ingredients/aroma-chemicals/coumarin-crystalline-powder.html"),
    ("Heliotrope Accord", 10, "ml", 33.75, 0.90,
     "NEW purchase", False, "https://iterji.com/perfumery-ingredients/aroma-accords/heliotrope.html"),
    ("Aldehyde C-18 Coconut", 10, "ml", 13.25, 0.90,
     "NEW · used as 10% D10", False, "https://iterji.com/perfumery-ingredients/aroma-chemicals/aldehyde-c-18-coconut.html"),
    ("Ambroxan", 10, "g", 133.75, None,
     "shared with ASMR (bought there as 'Amberxan') · the only amber material", False,
     "https://iterji.com/perfumery-ingredients/aroma-chemicals/ambroxan.html"),
    ("Iso E Super", 10, "ml", 13.60, 0.90,
     "shared with ASMR · the usual bottleneck — consider the 30 ml pack", False,
     "https://iterji.com/perfumery-ingredients/aroma-chemicals/iso-e-super.html"),
    ("Cashmeran IFF", 10, "ml", 55.86, 0.90,
     "shared with ASMR", False, "https://iterji.com/perfumery-ingredients/aroma-chemicals/cashmeran-iff.html"),
    ("Sandalore (Givaudan)", 10, "ml", 23.54, 0.90,
     "shared with ASMR", False, "https://iterji.com/perfumery-ingredients/aroma-chemicals/sandalore-givaudan.html"),
    ("Ethylene Brassylate", 10, "ml", 10.11, 0.90,
     "shared with ASMR · OUT OF STOCK at iterji (checked 2026-07) — you already own a pack; restock when relisted",
     False, "https://iterji.com/perfumery-ingredients/aroma-chemicals/ethylene-brassylate.html"),
    ("Galaxolide", 30, "ml", 27.00, 0.90,
     "NEW · smallest pack is 30 ml", False, "https://iterji.com/perfumery-ingredients/aroma-chemicals/galaxolide.html"),
    ("Exaltolide Total (Firmenich)", 10, "ml", 27.53, 0.90,
     "shared with ASMR", False, "https://iterji.com/perfumery-ingredients/aroma-chemicals/exaltolide-total-firmenich.html"),
    ("Saffron Accord", 10, "ml", 33.75, 0.90,
     "NEW purchase (optional material)", False, "https://iterji.com/perfumery-ingredients/aroma-accords/saffron.html"),
    ("DPG (Dipropylene Glycol)", 500, "ml", 50.00, 1.02,
     "carrier for the D10 dilutions · sold as 500 ml", False,
     "https://iterji.com/perfumery-ingredients/other-ingredients/dipropylene-glycol-dpg.html"),
    ("Alcohol 190 proof SDA 40B", 5000, "ml", 150.00, 0.81,
     "5-litre pack · phthalate-free (denatured with Bitrex)", False,
     "https://iterji.com/perfumery-ingredients/other-ingredients/alcohol-190-proof-sda-40b.html"),
]
INV_FIRST = 4
INV_LAST = INV_FIRST + len(INV_ROWS) - 1   # 30
NOT_IN_FORMULA = {"DPG (Dipropylene Glycol)", "Alcohol 190 proof SDA 40B"}

FORMATS = [
    # name, default conc, min, max, typical finished density g/ml
    ("Eau de Parfum", 0.20, 0.12, 0.30, 0.85),
    ("Extrait de Parfum", 0.28, 0.20, 0.35, 0.85),
    ("Alcohol Body Mist", 0.05, 0.03, 0.06, 0.87),
    ("Water-Based Mist", 0.025, 0.02, 0.03, 0.99),
    ("Cream Route 1 (scented base)", 0.01, 0.008, 0.012, 0.98),
    ("Cream Route 2 (from scratch)", 0.01, 0.008, 0.012, 0.98),
]
STATUSES = ["Macerating", "Filtering", "Bottled"]

BATCH_MAT_FIRST, BATCH_MAT_LAST = 29, 53
BATCH_TOTAL_ROW = 54
AUX_FIRST, AUX_LAST = 58, 68
BATCH_SUM_ROW = 69

LOG_FIRST, LOG_LAST = 5, 44

D10_MATS = ["Pink Peppercorn", "Damascone Beta", "Maltol (Crystals)", "Aldehyde C-18 Coconut"]


# ---------------------------------------------------------------- helpers ---
def put(ws, addr, value=None, font=F_VALUE, fill=None, fmt=None, align=None,
        border=None, wrap=False, unlocked=False, comment=None):
    c = ws[addr]
    if value is not None:
        c.value = value
    c.font = font
    if fill:
        c.fill = fill
    if fmt:
        c.number_format = fmt
    if align or wrap:
        c.alignment = Alignment(horizontal=align, vertical="center", wrap_text=wrap)
    else:
        c.alignment = Alignment(vertical="center")
    if border:
        c.border = border
    if unlocked:
        c.protection = UNLOCKED
    if comment:
        c.comment = Comment(comment, "SAMR Suite")
    return c


def merge(ws, rng):
    ws.merge_cells(rng)


def band(ws, row, c1, c2, text, fill=FILL_SECT, font=F_SECT):
    ws.merge_cells(start_row=row, start_column=c1, end_row=row, end_column=c2)
    for col in range(c1, c2 + 1):
        cell = ws.cell(row=row, column=col)
        cell.fill = fill
        cell.border = Border()
    c = ws.cell(row=row, column=c1)
    c.value = text
    c.font = font
    c.alignment = Alignment(vertical="center", indent=1)
    ws.row_dimensions[row].height = 18


def header_cells(ws, row, headers, start_col=1):
    for i, text in enumerate(headers):
        c = ws.cell(row=row, column=start_col + i)
        c.value = text
        c.font = F_HDR
        c.fill = FILL_HDR
        c.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
        c.border = B_ALL
    ws.row_dimensions[row].height = 24


def widths(ws, spec):
    for col, w in spec.items():
        ws.column_dimensions[col].width = w


def input_cell(ws, addr, value, fmt=None, comment=None):
    return put(ws, addr, value, font=F_INPUT, fill=FILL_INPUT, fmt=fmt,
               align="center", border=B_INPUT, unlocked=True, comment=comment)


def title_block(ws, last_col, title, subtitle, sub_cols=None):
    n = last_col
    ws.merge_cells(start_row=1, start_column=1, end_row=1, end_column=n)
    put(ws, "A1", title, font=F_TITLE)
    ws.row_dimensions[1].height = 28
    ws.merge_cells(start_row=2, start_column=1, end_row=2, end_column=sub_cols or n)
    put(ws, "A2", subtitle, font=F_SUB)
    for col in range(1, n + 1):
        ws.cell(row=2, column=col).border = B_GOLD_BOTTOM


def protect(ws):
    # User requested fully editable workbooks: no sheet protection and no locked cells.
    ws.protection.sheet = False
    ws.protection.formatCells = False
    ws.protection.formatColumns = False
    ws.protection.formatRows = False
    for row in ws.iter_rows():
        for cell in row:
            cell.protection = UNLOCKED


NAMES = []


def name(nm, ref):
    NAMES.append((nm, ref))


# ------------------------------------------------------------------ sheets --
def build_lists(wb):
    ws = wb.create_sheet("Lists")
    ws["A1"] = "Format"
    ws["B1"] = "Default conc"
    ws["C1"] = "Min"
    ws["D1"] = "Max"
    ws["E1"] = "Density g/ml"
    for i, (nm, d, lo, hi, dens) in enumerate(FORMATS):
        r = 2 + i
        ws[f"A{r}"] = nm
        ws[f"B{r}"] = d
        ws[f"C{r}"] = lo
        ws[f"D{r}"] = hi
        ws[f"E{r}"] = dens
    ws["G1"] = "Status"
    for i, s in enumerate(STATUSES):
        ws[f"G{2 + i}"] = s
    ws["H1"] = "YesNo"
    ws["H2"] = "YES"
    ws["H3"] = "NO"
    ws["I1"] = "Unit"
    ws["I2"] = "ml"
    ws["I3"] = "g"
    ws.sheet_state = "hidden"
    name("FormatList", "Lists!$A$2:$A$7")
    name("FormatDefaults", "Lists!$A$2:$E$7")
    name("StatusList", "Lists!$G$2:$G$4")
    name("YesNoList", "Lists!$H$2:$H$3")
    name("UnitList", "Lists!$I$2:$I$3")
    protect(ws)


def build_formula_master(wb):
    ws = wb.create_sheet("Formula Master")
    ws.sheet_view.showGridLines = False
    ws.sheet_properties.tabColor = CHARCOAL
    widths(ws, {"A": 9, "B": 30, "C": 10, "D": 7, "E": 9, "F": 10, "G": 40, "H": 13, "I": 9})
    title_block(ws, 9, "SAMR — MASTER FORMULA",
                "Concentrate = 100% by weight.  D10 = weighed as a 10% dilution in DPG — the % shown is the weight of the dilution.")

    merge(ws, "A4:B4")
    put(ws, "A4", "Include optional materials (Damascone Beta, Saffron Accord):", font=F_LABEL_B)
    input_cell(ws, "C4", "YES",
               comment="YES = full formula.\nNO = optionals removed and every remaining % is renormalised so the concentrate still sums to 100%.")
    put(ws, "H3", "Optionals Σ", font=F_KPI_LBL, align="right")
    put(ws, "I3", "=SUMIF($E$7:$E$31,\"OPT\",$C$7:$C$31)", fmt=FMT_PCT2, align="center")
    put(ws, "H4", "D10 Σ (active)", font=F_KPI_LBL, align="right")
    put(ws, "I4", "=SUMIF($D$7:$D$31,\"D10\",$F$7:$F$31)", fmt=FMT_PCT2, align="center",
        comment="Share of the (active) concentrate that is weighed as 10% DPG dilutions. Drives DPG consumption in Inventory.")

    header_cells(ws, 6, ["Phase", "Material", "Input %", "D10", "Optional",
                         "Active %", "Role in the accord", "SAR/g (as weighed)"])
    phase_fill = {"TOP": FILL_IVORY, "HEART": FILL_IVORY_DK, "BASE": FILL_IVORY}
    fill_opt = PatternFill("solid", start_color="F0DCB0")   # amber = optional/extra
    fill_dup = PatternFill("solid", start_color="DCE3E8")    # blue-grey = overlaps another

    opt_comment = {
        "Damascone Beta":
            "OPTIONAL — the velvet glint. A rose-ketone of extraordinary power: plum, "
            "blackcurrant, honeyed rose, a little tobacco.\n\n"
            "Expected result if INCLUDED: the fruit in the opening stops being 'cute' and "
            "turns velvety and expensive — the effect that makes classic seductive perfumes "
            "feel three-dimensional.\n\n"
            "If you LEAVE IT OUT: the peach + raspberry still read juicy and charming — "
            "just flatter. Set the toggle in C4 to NO and the workbook renormalises "
            "everything else to 100% automatically.\n\n"
            "SAFETY: only ever weigh the 10% dilution, never the neat material.",
        "Saffron Accord":
            "OPTIONAL — the saffron-suede whisper.\n\n"
            "Expected result if INCLUDED: a dry, golden, leather-suede warmth over the "
            "vanilla — the modern 'radiant amber' signature that reads as luxury.\n\n"
            "If you LEAVE IT OUT: the base stays creamy-vanilla and musky, slightly "
            "sweeter and simpler. Toggle C4 = NO renormalises automatically.",
    }
    dup_comment = {
        "Vanillin Crystals":
            "VANILLA ACCORD (1 of 3): the classic vanilla anchor. Ethyl Vanillin adds a "
            "deeper cream, Maltol adds the caramel halo. Overlapping on purpose — this "
            "double-vanilla-plus-caramel construction is the 'addictive' engine of the "
            "perfume.",
        "Ethyl Vanillin":
            "VANILLA ACCORD (2 of 3): ~3× stronger and creamier than vanillin. If you "
            "ever simplify, reduce this one first — keep Vanillin Crystals as the anchor.",
        "Jasmin Absolute Accord":
            "WHITE-FLORAL PAIR (1 of 2): the indolic, carnal jasmine. Tuberose adds the "
            "creamy narcotic volume. Intentional layering — together they smell like one "
            "living flower.",
        "Tuberose Accord":
            "WHITE-FLORAL PAIR (2 of 2): overlaps jasmine on purpose. If you simplify, "
            "drop this first — keep the jasmine.",
        "Galaxolide":
            "MUSK ACCORD: this, Ethylene Brassylate and Exaltolide Total build one "
            "skin-musk trail — clean (Galaxolide), powdery (Brassylate), warm-intimate "
            "(Exaltolide). Kept together for the 'still here after she leaves' effect.",
        "Exaltolide Total (Firmenich)":
            "MUSK ACCORD: overlaps Galaxolide + Ethylene Brassylate (all skin musks). "
            "If you cut cost later, these three are the group to review — but together "
            "they are the lingering trail.",
    }
    for i, (phase, mat, pct, d10, opt, note) in enumerate(FM_ROWS):
        r = FM_FIRST + i
        if opt:
            fill = fill_opt
        elif mat in dup_comment:
            fill = fill_dup
        else:
            fill = phase_fill[phase]
        put(ws, f"A{r}", phase, font=F_MUTED, fill=fill, align="center", border=B_ALL)
        put(ws, f"B{r}", mat, fill=fill, border=B_ALL,
            comment=opt_comment.get(mat) or dup_comment.get(mat))
        put(ws, f"C{r}", pct, font=F_INPUT, fill=FILL_INPUT, fmt=FMT_PCT1, align="center",
            border=B_INPUT, unlocked=True)
        put(ws, f"D{r}", "D10" if d10 else "", font=F_GOLD, fill=fill, align="center", border=B_ALL)
        put(ws, f"E{r}", "OPT" if opt else "", font=F_GOLD, fill=fill, align="center", border=B_ALL)
        put(ws, f"F{r}",
            f'=IF(IncludeOptionals="YES",C{r},IF($E{r}="OPT",0,C{r}/(1-OptPctSum)))',
            fill=fill, fmt=FMT_PCT2, align="center", border=B_ALL)
        put(ws, f"G{r}", note, font=F_MUTED, fill=fill, border=B_ALL)
        put(ws, f"H{r}",
            f'=IF($D{r}="D10",0.1*INDEX(Inv_PricePerG,MATCH($B{r},Inv_Mat,0))+0.9*DPGPricePerG,'
            f'INDEX(Inv_PricePerG,MATCH($B{r},Inv_Mat,0)))',
            fmt=FMT_SAR, align="center", border=B_ALL)

    r = FM_TOTAL_ROW
    put(ws, f"B{r}", "TOTALS", font=F_LABEL_B, align="right")
    put(ws, f"C{r}", f"=SUM(C{FM_FIRST}:C{FM_LAST})", font=F_LABEL_B, fmt=FMT_PCT2,
        align="center", border=B_GOLD_BOTTOM)
    put(ws, f"F{r}", f"=SUM(F{FM_FIRST}:F{FM_LAST})", font=F_LABEL_B, fmt=FMT_PCT2,
        align="center", border=B_GOLD_BOTTOM)
    merge(ws, "A34:H34")
    put(ws, "A34",
        f'=IF(AND(ROUND(C{r},6)=1,ROUND(F{r},6)=1),'
        f'"✓ BALANCED — input Σ = "&TEXT(C{r},"0.00%")&"   ·   active Σ = "&TEXT(F{r},"0.00%"),'
        f'"⚠ FORMULA DOES NOT SUM TO 100% — check the Input % column")',
        font=F_LABEL_B, align="center")
    ws.row_dimensions[34].height = 20
    ws.conditional_formatting.add("A34:H34",
        FormulaRule(formula=['LEFT($A$34,1)="✓"'], fill=PatternFill("solid", start_color=GREEN_FILL), stopIfTrue=True))
    ws.conditional_formatting.add("A34:H34",
        FormulaRule(formula=['LEFT($A$34,1)<>"✓"'], fill=PatternFill("solid", start_color=RED_FILL)))

    # legend for the ingredient highlights
    put(ws, "A36", "Legend:", font=F_LABEL_B)
    put(ws, "B36", "  OPTIONAL / extra  ", font=F_MUTED, fill=PatternFill("solid", start_color="F0DCB0"),
        align="center", border=B_ALL)
    merge(ws, "C36:D36")
    put(ws, "C36", "hover the cell comment for its expected effect", font=F_MUTED)
    put(ws, "B37", "  OVERLAPS another  ", font=F_MUTED, fill=PatternFill("solid", start_color="DCE3E8"),
        align="center", border=B_ALL)
    merge(ws, "C37:G37")
    put(ws, "C37", "shares a smell with a partner material — intentional layering, first to simplify", font=F_MUTED)
    merge(ws, "A38:H38")
    put(ws, "A38",
        "Every other ingredient is essential to the accord. There are NO wasted materials here — "
        "each phase (top / heart / base) needs its members to smell complete.",
        font=F_MUTED, wrap=True)
    ws.row_dimensions[38].height = 24

    dv = DataValidation(type="list", formula1="YesNoList", allow_blank=False)
    ws.add_data_validation(dv)
    dv.add("C4")
    dvp = DataValidation(type="decimal", operator="between", formula1="0", formula2="1",
                         allow_blank=False, error="Enter a fraction, e.g. 0.09 for 9%")
    ws.add_data_validation(dvp)
    dvp.add(f"C{FM_FIRST}:C{FM_LAST}")

    ws.freeze_panes = "A7"
    name("IncludeOptionals", "'Formula Master'!$C$4")
    name("OptPctSum", "'Formula Master'!$I$3")
    name("D10ActivePct", "'Formula Master'!$I$4")
    name("FM_Mat", f"'Formula Master'!$B${FM_FIRST}:$B${FM_LAST}")
    name("FM_InputPct", f"'Formula Master'!$C${FM_FIRST}:$C${FM_LAST}")
    name("FM_D10", f"'Formula Master'!$D${FM_FIRST}:$D${FM_LAST}")
    name("FM_Active", f"'Formula Master'!$F${FM_FIRST}:$F${FM_LAST}")
    name("FM_CostG", f"'Formula Master'!$H${FM_FIRST}:$H${FM_LAST}")
    protect(ws)


def build_batch_calculator(wb):
    ws = wb.create_sheet("Batch Calculator")
    ws.sheet_view.showGridLines = False
    ws.sheet_properties.tabColor = GOLD
    widths(ws, {"A": 11, "B": 14, "C": 24, "D": 12, "E": 12, "F": 13, "G": 11, "H": 9})
    title_block(ws, 8, "SAMR — BATCH CALCULATOR",
                "All quantities in grams. Weighing order: BASE → HEART → TOP.  Champagne cells are inputs.")

    # --- 1 · inputs ---
    band(ws, 3, 1, 8, "1 · BATCH INPUTS")
    inputs = [
        (4, "Product format", None, ""),
        (5, "Batch size", 50, ""),
        (6, "Size unit (ml / g)", "ml", ""),
        (7, "Concentrate %", 0.20, ""),
        (8, "Finished density (g/ml)", 0.85, ""),
        (9, "Optionals included?", None, "change on the Formula Master tab"),
    ]
    for r, lbl, _, _n in inputs:
        merge(ws, f"A{r}:B{r}")
        put(ws, f"A{r}", lbl, font=F_LABEL_B)
    input_cell(ws, "C4", "Extrait de Parfum")
    input_cell(ws, "C5", 50, fmt=FMT_G)
    input_cell(ws, "C6", "ml")
    input_cell(ws, "C7", 0.28, fmt=FMT_PCT1,
               comment="Enter as a fraction (0.28 = 28%). Extrait default is 28% for maximum longevity. "
                       "Suggested defaults per format are shown to the right.")
    input_cell(ws, "C8", 0.85, fmt='0.00',
               comment="Used to convert ml ↔ g. Typical: EDP/Extrait 0.85, alcohol mist 0.87, water mist 0.99, cream 0.98.")
    put(ws, "C9", '=IncludeOptionals', font=F_GOLD, align="center", border=B_ALL)
    merge(ws, "D4:H4")
    put(ws, "D4", "choose one of the six product formats", font=F_MUTED)
    merge(ws, "D5:H5")
    put(ws, "D5", "in the unit chosen below", font=F_MUTED)
    merge(ws, "D6:H6")
    put(ws, "D6", 'ml is converted to grams with the density cell below', font=F_MUTED)
    merge(ws, "D7:H7")
    put(ws, "D7",
        '="Suggested for this format: "&TEXT(VLOOKUP(BatchFormat,FormatDefaults,2,FALSE),"0.0%")'
        '&"   (range "&TEXT(VLOOKUP(BatchFormat,FormatDefaults,3,FALSE),"0.0%")'
        '&" – "&TEXT(VLOOKUP(BatchFormat,FormatDefaults,4,FALSE),"0.0%")&")"',
        font=F_MUTED)
    merge(ws, "D8:H8")
    put(ws, "D8",
        '="Typical for this format: "&TEXT(VLOOKUP(BatchFormat,FormatDefaults,5,FALSE),"0.00")&" g/ml"',
        font=F_MUTED)
    merge(ws, "D9:H9")
    put(ws, "D9", "optionals: Damascone Beta, Saffron Accord — set on Formula Master", font=F_MUTED)

    # --- 2 · format parameters ---
    band(ws, 11, 1, 8, "2 · FORMAT PARAMETERS  (each is used only by the format named)")
    params = [
        (12, "Distilled water % (EDP)", 0.0, FMT_PCT1, "EDP / Extrait — optional, max 3%"),
        (13, "Glycerin % (alc. mist)", 0.02, FMT_PCT1, "Alcohol Body Mist — optional 2–3%"),
        (14, "Water % (alc. mist)", 0.05, FMT_PCT1, "Alcohol Body Mist — optional 5–10%"),
        (15, "Solubilizer × fragrance", 4, FMT_D1, "Water Mist — Polysorbate 20 = 4–6 × fragrance wt"),
        (16, "Glycerin % (W-mist)", 0.025, FMT_PCT1, "Water-Based Mist"),
        (17, "Preservative % (W-mist)", 0.008, FMT_PCT1, "Water-Based Mist — broad-spectrum, REQUIRED"),
        (18, "Vitamin E % (cream 2)", 0.005, FMT_PCT1, "Cream Route 2 — cool-down antioxidant"),
    ]
    for r, lbl, val, fmt, note in params:
        merge(ws, f"A{r}:B{r}")
        put(ws, f"A{r}", lbl, font=F_LABEL)
        input_cell(ws, f"C{r}", val, fmt=fmt)
        put(ws, f"D{r}", note, font=F_MUTED)
    merge(ws, "E12:G12")
    put(ws, "E12", "CREAM ROUTE 2 — PHASE %", font=F_KPI_LBL, fill=FILL_GOLD_LT, align="center")
    cream = [
        (13, "Glycerin (water phase)", 0.03),
        (14, "Emulsifying Wax NF", 0.05),
        (15, "Cetearyl alcohol", 0.02),
        (16, "Carrier oil (light)", 0.15),
        (17, "Shea / mango butter", 0.05),
        (18, "Preservative", 0.01),
    ]
    for r, lbl, val in cream:
        merge(ws, f"E{r}:F{r}")
        put(ws, f"E{r}", lbl, font=F_LABEL)
        input_cell(ws, f"G{r}", val, fmt=FMT_PCT1)

    # --- 3 · totals ---
    band(ws, 20, 1, 8, "3 · BATCH TOTALS")
    totals = [
        (21, "Total batch mass (g)", '=IF(BatchUnit="g",BatchSize,BatchSize*FinishedDensity)', FMT_G,
         "batch size converted to grams"),
        (22, "Batch volume (ml, approx.)", '=IF(BatchUnit="ml",BatchSize,BatchSize/FinishedDensity)', FMT_G,
         "for cost-per-ml"),
        (23, "Fragrance concentrate (g)", '=TotalMassG*ConcPct', FMT_G,
         "total to weigh from the table below"),
        (24, "Estimated batch cost (SAR)", '=ConcG*ConcCostPerGLoaded+SUMPRODUCT(AuxGrams,AuxCostPerG)', FMT_SAR,
         "materials incl. shipping allocation — see Cost Analysis"),
        (25, "Cost per ml (SAR)", '=IF(BatchVolMl=0,"",BatchCostSAR/BatchVolMl)', FMT_SAR, ""),
    ]
    for r, lbl, f, fmt, note in totals:
        merge(ws, f"A{r}:B{r}")
        put(ws, f"A{r}", lbl, font=F_LABEL_B)
        put(ws, f"C{r}", f, font=F_LABEL_B, fill=FILL_IVORY_DK, fmt=fmt, align="center", border=B_ALL)
        merge(ws, f"D{r}:H{r}")
        put(ws, f"D{r}", note, font=F_MUTED)

    # --- 4 · weighing table ---
    band(ws, 27, 1, 8, "4 · CONCENTRATE WEIGHING  (weigh in this order: BASE → HEART → TOP)")
    header_cells(ws, 28, ["Phase", "Material", "", "% of conc.", "Weigh (g)", "Form", "Neat (g)", "✓"])
    order = [row for row in FM_ROWS if row[0] == "BASE"] + \
            [row for row in FM_ROWS if row[0] == "HEART"] + \
            [row for row in FM_ROWS if row[0] == "TOP"]
    phase_fill = {"BASE": FILL_IVORY, "HEART": FILL_IVORY_DK, "TOP": FILL_IVORY}
    for i, (phase, mat, _pct, _d10, _opt, _note) in enumerate(order):
        r = BATCH_MAT_FIRST + i
        fill = phase_fill[phase]
        put(ws, f"A{r}", phase, font=F_MUTED, fill=fill, align="center", border=B_ALL)
        merge(ws, f"B{r}:C{r}")
        put(ws, f"B{r}", mat, fill=fill, border=B_ALL)
        ws[f"C{r}"].border = B_ALL
        put(ws, f"D{r}", f'=INDEX(FM_Active,MATCH($B{r},FM_Mat,0))',
            fill=fill, fmt=FMT_PCT2, align="center", border=B_ALL)
        put(ws, f"E{r}", f'=ConcG*D{r}', font=F_LABEL_B, fill=fill, fmt=FMT_G_DASH,
            align="center", border=B_ALL)
        put(ws, f"F{r}", f'=IF(INDEX(FM_D10,MATCH($B{r},FM_Mat,0))="D10","10% in DPG","neat")',
            font=F_MUTED, fill=fill, align="center", border=B_ALL)
        put(ws, f"G{r}", f'=E{r}*IF(INDEX(FM_D10,MATCH($B{r},FM_Mat,0))="D10",0.1,1)',
            font=F_MUTED, fill=fill, fmt=FMT_G3, align="center", border=B_ALL)
        put(ws, f"H{r}", "", fill=fill, border=B_ALL, unlocked=True)
    r = BATCH_TOTAL_ROW
    merge(ws, f"A{r}:D{r}")
    put(ws, f"A{r}", "CONCENTRATE TOTAL (must equal the concentrate above)", font=F_LABEL_B, align="right")
    put(ws, f"E{r}", f"=SUM(E{BATCH_MAT_FIRST}:E{BATCH_MAT_LAST})", font=F_LABEL_B,
        fill=FILL_GOLD_LT, fmt=FMT_G, align="center", border=B_ALL)
    put(ws, f"F{r}", f'=IF(ABS(E{r}-ConcG)<0.005,"✓","⚠")', font=F_LABEL_B,
        align="center", border=B_ALL)
    put(ws, f"G{r}", f"=SUM(G{BATCH_MAT_FIRST}:G{BATCH_MAT_LAST})", font=F_MUTED, fmt=FMT_G3,
        align="center", border=B_ALL)

    # --- 5 · aux components ---
    band(ws, 56, 1, 8, "5 · SOLVENT & AUXILIARY COMPONENTS")
    header_cells(ws, 57, ["Component", "", "", "Grams", "Note", "", "", ""])
    merge(ws, "A57:C57")
    merge(ws, "E57:H57")
    F = 'BatchFormat'
    T = 'TotalMassG'
    C = 'ConcG'
    edp = f'OR({F}="Eau de Parfum",{F}="Extrait de Parfum")'
    aux = [
        ("Alcohol 190 proof SDA 40B",
         f'=IF({edp},{T}-{C}-{T}*WaterPct,IF({F}="Alcohol Body Mist",{T}-{C}-{T}*MistGlyPct-{T}*MistWaterPct,0))',
         "EDP / Extrait / Alcohol Mist only — flammable"),
        ("Distilled water",
         f'=IF({edp},{T}*WaterPct,IF({F}="Alcohol Body Mist",{T}*MistWaterPct,'
         f'IF({F}="Water-Based Mist",{T}-{C}-{C}*SolubRatio-{T}*WMGlyPct-{T}*WMPresPct,'
         f'IF({F}="Cream Route 2 (from scratch)",{T}-{C}-{T}*(CR2GlyPct+CR2EwaxPct+CR2CetPct+CR2OilPct+CR2ButterPct+CR2PresPct+VitEPct),0))))',
         "remainder in Water Mist & Cream Route 2"),
        ("Glycerin",
         f'=IF({F}="Alcohol Body Mist",{T}*MistGlyPct,IF({F}="Water-Based Mist",{T}*WMGlyPct,'
         f'IF({F}="Cream Route 2 (from scratch)",{T}*CR2GlyPct,0)))',
         "humectant"),
        ("Polysorbate 20 (solubilizer)",
         f'=IF({F}="Water-Based Mist",{C}*SolubRatio,0)',
         "mix with fragrance FIRST, then add water"),
        ("Preservative (broad-spectrum)",
         f'=IF({F}="Water-Based Mist",{T}*WMPresPct,IF({F}="Cream Route 2 (from scratch)",{T}*CR2PresPct,0))',
         "REQUIRED in every water-containing product"),
        ("Unscented cream base (preserved)",
         f'=IF({F}="Cream Route 1 (scented base)",{T}-{C},0)',
         "Cream Route 1 — stir fragrance in cold"),
        ("Emulsifying Wax NF",
         f'=IF({F}="Cream Route 2 (from scratch)",{T}*CR2EwaxPct,0)', "oil phase, 70–75 °C"),
        ("Cetearyl alcohol",
         f'=IF({F}="Cream Route 2 (from scratch)",{T}*CR2CetPct,0)', "oil phase"),
        ("Carrier oil (light)",
         f'=IF({F}="Cream Route 2 (from scratch)",{T}*CR2OilPct,0)', "oil phase"),
        ("Shea / mango butter",
         f'=IF({F}="Cream Route 2 (from scratch)",{T}*CR2ButterPct,0)', "oil phase"),
        ("Vitamin E",
         f'=IF({F}="Cream Route 2 (from scratch)",{T}*VitEPct,0)', "cool-down, below 40 °C"),
    ]
    for i, (lbl, f, note) in enumerate(aux):
        r = AUX_FIRST + i
        merge(ws, f"A{r}:C{r}")
        put(ws, f"A{r}", lbl, border=B_ALL)
        ws[f"B{r}"].border = B_ALL
        ws[f"C{r}"].border = B_ALL
        put(ws, f"D{r}", f, font=F_LABEL_B, fill=FILL_IVORY, fmt=FMT_G_DASH, align="center", border=B_ALL)
        merge(ws, f"E{r}:H{r}")
        put(ws, f"E{r}", note, font=F_MUTED, border=B_ALL)
        for col in "FGH":
            ws[f"{col}{r}"].border = B_ALL
    r = BATCH_SUM_ROW
    merge(ws, f"A{r}:C{r}")
    put(ws, f"A{r}", "TOTAL BATCH (g)", font=F_LABEL_B, align="right")
    put(ws, f"D{r}", f"=ConcG+SUM(D{AUX_FIRST}:D{AUX_LAST})", font=F_LABEL_B, fill=FILL_GOLD_LT,
        fmt=FMT_G, align="center", border=B_ALL)
    merge(ws, f"E{r}:H{r}")
    put(ws, f"E{r}", f'=IF(ABS(D{r}-TotalMassG)<0.005,"✓ equals batch mass","⚠ mismatch — check inputs")',
        font=F_LABEL_B)

    # --- bench line + verification ---
    for col, lbl in [("A", "Batch ID:"), ("C", "Date:"), ("E", "Operator:"), ("G", "Checked:")]:
        put(ws, f"{col}71", lbl, font=F_MUTED, align="right")
    for col in ("B", "D", "F", "H"):
        put(ws, f"{col}71", "", border=Border(bottom=Side(style="thin", color=CHARCOAL)), unlocked=True)

    band(ws, 73, 1, 8, "WORKED VERIFICATION — 50 ml EXTRAIT @ 28%, density 0.85 (fixed example)",
         fill=FILL_GOLD, font=Font(name=ARIAL, size=9, bold=True, color=CHARCOAL_DK))
    ver = [
        (74, "Total mass = 50 ml × 0.85 g/ml", "=50*0.85", "expect ≈ 42.5 g"),
        (75, "Concentrate = 42.5 g × 28%", "=50*0.85*0.28", "expect ≈ 11.9 g"),
        (76, "Alcohol = total − concentrate", "=50*0.85-50*0.85*0.28", "expect ≈ 30.6 g"),
    ]
    for r, lbl, f, note in ver:
        merge(ws, f"A{r}:C{r}")
        put(ws, f"A{r}", lbl, font=F_LABEL)
        put(ws, f"D{r}", f, font=F_LABEL_B, fmt=FMT_G, align="center", border=B_ALL)
        merge(ws, f"E{r}:H{r}")
        put(ws, f"E{r}", note, font=F_MUTED)

    # validations
    dv_fmt = DataValidation(type="list", formula1="FormatList", allow_blank=False)
    dv_unit = DataValidation(type="list", formula1="UnitList", allow_blank=False)
    dv_size = DataValidation(type="decimal", operator="between", formula1="1", formula2="100000")
    dv_conc = DataValidation(type="decimal", operator="between", formula1="0.005", formula2="0.35",
                             error="Enter a fraction between 0.5% and 35%, e.g. 0.20")
    dv_dens = DataValidation(type="decimal", operator="between", formula1="0.5", formula2="1.2")
    dv_small = DataValidation(type="decimal", operator="between", formula1="0", formula2="0.2")
    dv_ratio = DataValidation(type="decimal", operator="between", formula1="3", formula2="6")
    for dv in (dv_fmt, dv_unit, dv_size, dv_conc, dv_dens, dv_small, dv_ratio):
        ws.add_data_validation(dv)
    dv_fmt.add("C4")
    dv_size.add("C5")
    dv_unit.add("C6")
    dv_conc.add("C7")
    dv_dens.add("C8")
    dv_small.add("C12:C14")
    dv_ratio.add("C15")
    dv_small.add("C16:C18")
    dv_small.add("G13:G18")

    ws.freeze_panes = "A29"
    ws.print_area = "A1:H76"
    ws.page_setup.orientation = "portrait"
    ws.page_setup.paperSize = ws.PAPERSIZE_A4
    ws.page_setup.fitToWidth = 1
    ws.page_setup.fitToHeight = 1
    ws.sheet_properties.pageSetUpPr = PageSetupProperties(fitToPage=True)
    ws.oddFooter.center.text = "SAMR — Batch Sheet"
    ws.oddFooter.center.size = 8

    name("BatchFormat", "'Batch Calculator'!$C$4")
    name("BatchSize", "'Batch Calculator'!$C$5")
    name("BatchUnit", "'Batch Calculator'!$C$6")
    name("ConcPct", "'Batch Calculator'!$C$7")
    name("FinishedDensity", "'Batch Calculator'!$C$8")
    name("WaterPct", "'Batch Calculator'!$C$12")
    name("MistGlyPct", "'Batch Calculator'!$C$13")
    name("MistWaterPct", "'Batch Calculator'!$C$14")
    name("SolubRatio", "'Batch Calculator'!$C$15")
    name("WMGlyPct", "'Batch Calculator'!$C$16")
    name("WMPresPct", "'Batch Calculator'!$C$17")
    name("VitEPct", "'Batch Calculator'!$C$18")
    name("CR2GlyPct", "'Batch Calculator'!$G$13")
    name("CR2EwaxPct", "'Batch Calculator'!$G$14")
    name("CR2CetPct", "'Batch Calculator'!$G$15")
    name("CR2OilPct", "'Batch Calculator'!$G$16")
    name("CR2ButterPct", "'Batch Calculator'!$G$17")
    name("CR2PresPct", "'Batch Calculator'!$G$18")
    name("TotalMassG", "'Batch Calculator'!$C$21")
    name("BatchVolMl", "'Batch Calculator'!$C$22")
    name("ConcG", "'Batch Calculator'!$C$23")
    name("BatchCostSAR", "'Batch Calculator'!$C$24")
    name("CostPerMl", "'Batch Calculator'!$C$25")
    name("AuxGrams", f"'Batch Calculator'!$D${AUX_FIRST}:$D${AUX_LAST}")
    name("AlcoholG", "'Batch Calculator'!$D$58")
    name("WaterG", "'Batch Calculator'!$D$59")
    name("GlycerinG", "'Batch Calculator'!$D$60")
    name("PolysorbateG", "'Batch Calculator'!$D$61")
    name("PreservativeG", "'Batch Calculator'!$D$62")
    name("CreamBaseG", "'Batch Calculator'!$D$63")
    protect(ws)


def build_dilution_prep(wb):
    ws = wb.create_sheet("Dilution Prep (D10)")
    ws.sheet_view.showGridLines = False
    ws.sheet_properties.tabColor = CHARCOAL
    widths(ws, {"A": 26, "B": 10, "C": 11, "D": 10, "E": 10, "F": 12, "G": 12, "H": 40})
    title_block(ws, 8, "D10 DILUTIONS — 10% IN DPG",
                "Default batch: 10 g of solution = 1.0 g neat material + 9.0 g DPG. Prepare at least 24 h before blending.")
    header_cells(ws, 4, ["Material", "Strength", "Batch (g)", "Neat (g)", "DPG (g)",
                         "Date made", "Remaining (g)", "Label / notes"])
    for i, mat in enumerate(D10_MATS):
        r = 5 + i
        put(ws, f"A{r}", mat, border=B_ALL)
        input_cell(ws, f"B{r}", 0.10, fmt=FMT_PCT1)
        input_cell(ws, f"C{r}", 10, fmt=FMT_G)
        put(ws, f"D{r}", f"=C{r}*B{r}", font=F_LABEL_B, fmt=FMT_G, align="center", border=B_ALL)
        put(ws, f"E{r}", f"=C{r}-D{r}", font=F_LABEL_B, fmt=FMT_G, align="center", border=B_ALL)
        put(ws, f"F{r}", "", fmt=FMT_DATE, align="center", border=B_ALL, unlocked=True)
        put(ws, f"G{r}", "", fmt=FMT_G, align="center", border=B_ALL, unlocked=True)
        put(ws, f"H{r}", f'="SAMR · "&A{r}&" · 10% in DPG · "&IF(F{r}="","(date)",TEXT(F{r},"yyyy-mm-dd"))',
            font=F_MUTED, border=B_ALL)
    sop = [
        "1 · Tare a clean 12–15 ml glass bottle on the scale (0.01 g resolution or better).",
        "2 · Weigh the NEAT material first, then add DPG up to the total. Cap tightly and shake 1 minute.",
        "3 · Label with the text in the last column. Store dark and cool. Dilutions keep 12+ months.",
        "4 · When a dilution runs low, make a fresh 10 g batch and update 'Date made' and 'Remaining'.",
    ]
    for i, line in enumerate(sop):
        r = 11 + i
        merge(ws, f"A{r}:H{r}")
        put(ws, f"A{r}", line, font=F_MUTED)
    dvs = DataValidation(type="decimal", operator="between", formula1="0.05", formula2="0.2")
    dvb = DataValidation(type="decimal", operator="between", formula1="1", formula2="100")
    ws.add_data_validation(dvs)
    ws.add_data_validation(dvb)
    dvs.add("B5:B8")
    dvb.add("C5:C8")
    ws.freeze_panes = "A5"
    protect(ws)


def build_inventory(wb):
    ws = wb.create_sheet("Inventory")
    ws.sheet_view.showGridLines = False
    ws.sheet_properties.tabColor = CHARCOAL
    widths(ws, {"A": 30, "B": 9, "C": 6, "D": 7, "E": 9, "F": 11, "G": 11, "H": 11,
                "I": 9, "J": 10, "K": 11, "L": 10, "M": 8, "N": 13, "O": 12, "P": 4, "Q": 4})
    ws.column_dimensions["P"].hidden = True
    ws.column_dimensions["Q"].hidden = True
    title_block(ws, 15, "INVENTORY",
                "On hand = purchases − usage from the Production Log.  SAMR shares several "
                "jars with ASMR — each workbook tracks its own usage, so split the stock "
                "or deduct shared use manually.", sub_cols=5)
    merge(ws, "F2:G2")
    put(ws, "F2", "Conc / batch (g):", font=F_KPI_LBL, align="right")
    put(ws, "H2", "=50*0.85*0.28", font=F_GOLD, fmt=FMT_G, align="center",
        comment="Low-stock alert basis: concentrate grams in one default Extrait batch "
                "(50 ml @ 28%, density 0.85). Red rows = on hand below TWO such batches.")
    merge(ws, "I2:J2")
    put(ws, "I2", "Alcohol / batch (g):", font=F_KPI_LBL, align="right")
    put(ws, "K2", "=50*0.85*0.72", font=F_GOLD, fmt=FMT_G, align="center")

    header_cells(ws, 3, ["Material", "Pack", "Unit", "Packs", "Density g/ml", "Grams bought",
                         "Price/pack SAR", "Paid SAR", "SAR/g", "Used (g)", "On hand (g)",
                         "Alert < (g)", "Status", "Product Link", "50 ml bottles", ""])
    ws["E3"].comment = Comment(
        "For ml-sold items grams = ml × density. Default 0.9 g/ml — refine per material. Alcohol 190 proof: 0.81.",
        "SAMR Suite")
    ws["J3"].comment = Comment(
        "Usage = Σ concentrate logged in the Production Log × the material's CURRENT active % "
        "(D10 items count 10% neat; DPG counts the 90% carrier). Alcohol = Σ of the log's alcohol column.",
        "SAMR Suite")

    F_LINK = Font(name=ARIAL, size=9, underline="single", color="1F6FBF")
    for i, (mat, qty, unit, price, dens, note, assumed, link) in enumerate(INV_ROWS):
        r = INV_FIRST + i
        put(ws, f"A{r}", mat, border=B_ALL, comment=note or None)
        fill = FILL_YELLOW if assumed else FILL_INPUT
        put(ws, f"B{r}", qty, font=F_INPUT, fill=fill, fmt=FMT_INT, align="center",
            border=B_INPUT, unlocked=True,
            comment=("ASSUMED pack content — edit to the real amount." if assumed else None))
        put(ws, f"C{r}", unit, font=F_MUTED, align="center", border=B_ALL)
        put(ws, f"D{r}", 1, font=F_INPUT, fill=FILL_INPUT, fmt=FMT_INT, align="center",
            border=B_INPUT, unlocked=True)
        if dens is not None:
            put(ws, f"E{r}", dens, font=F_INPUT, fill=FILL_INPUT, fmt='0.00', align="center",
                border=B_INPUT, unlocked=True)
        else:
            put(ws, f"E{r}", "", font=F_MUTED, align="center", border=B_ALL)
        put(ws, f"F{r}", f'=IF(C{r}="ml",B{r}*D{r}*E{r},B{r}*D{r})', fmt=FMT_G, align="center", border=B_ALL)
        put(ws, f"G{r}", price, font=F_INPUT, fill=FILL_INPUT, fmt=FMT_SAR, align="center",
            border=B_INPUT, unlocked=True)
        put(ws, f"H{r}", f"=G{r}*D{r}", fmt=FMT_SAR, align="center", border=B_ALL)
        put(ws, f"I{r}", f'=IF(F{r}=0,0,H{r}/F{r})', fmt=FMT_SAR, align="center", border=B_ALL)
        if mat == "DPG (Dipropylene Glycol)":
            put(ws, f"J{r}", "=TotalConcUsedG*D10ActivePct*0.9", fmt=FMT_G, align="center", border=B_ALL)
            put(ws, f"L{r}", "=2*DefaultBatchConcG*D10ActivePct*0.9", fmt=FMT_G, align="center", border=B_ALL)
        elif mat == "Alcohol 190 proof SDA 40B":
            put(ws, f"J{r}", "=AlcoholUsedG", fmt=FMT_G, align="center", border=B_ALL)
            put(ws, f"L{r}", "=2*DefaultBatchAlcG", fmt=FMT_G, align="center", border=B_ALL)
        else:
            lookup = f'INDEX(FM_Active,MATCH($A{r},FM_Mat,0))*IF(INDEX(FM_D10,MATCH($A{r},FM_Mat,0))="D10",0.1,1)'
            put(ws, f"J{r}", f"=TotalConcUsedG*{lookup}", fmt=FMT_G, align="center", border=B_ALL)
            put(ws, f"L{r}", f"=2*DefaultBatchConcG*{lookup}", fmt=FMT_G, align="center", border=B_ALL)
        put(ws, f"K{r}", f"=F{r}-J{r}", font=F_LABEL_B, fmt=FMT_G, align="center", border=B_ALL)
        put(ws, f"M{r}", f'=IF(K{r}<L{r},"LOW","OK")', font=F_MUTED, align="center", border=B_ALL)
        link_cell = put(ws, f"N{r}", "iterji.com ↗", font=F_LINK, align="center", border=B_ALL)
        link_cell.hyperlink = link
        if mat == "DPG (Dipropylene Glycol)":
            bottles = f'=IFERROR(FLOOR((MAX(K{r},0)/(D10ActivePct*0.9))/(50*YC_Density*YC_ConcPct),1),"")'
        elif mat == "Alcohol 190 proof SDA 40B":
            bottles = f'=IFERROR(FLOOR(MAX(K{r},0)/(50*YC_Density*(1-YC_ConcPct)),1),"")'
        else:
            bottles = (f'=IFERROR(FLOOR((MAX(K{r},0)/(INDEX(FM_Active,MATCH($A{r},FM_Mat,0))*'
                       f'IF(INDEX(FM_D10,MATCH($A{r},FM_Mat,0))="D10",0.1,1)))'
                       f'/(50*YC_Density*YC_ConcPct),1),"")')
        put(ws, f"O{r}", bottles, font=F_LABEL_B, fmt=FMT_INT, align="center", border=B_ALL,
            comment="Dynamic 50 ml bottle count from this row's on-hand grams. Change Packs/Pack/Inventory and it updates.")
        put(ws, f"P{r}", f'=IF(K{r}<L{r},A{r},"")', font=F_MUTED)
        if r == INV_FIRST:
            put(ws, f"Q{r}", f"=P{r}", font=F_MUTED)
        else:
            put(ws, f"Q{r}", f'=IF(P{r}="",Q{r - 1},IF(Q{r - 1}="",P{r},Q{r - 1}&",  "&P{r}))',
                font=F_MUTED)

    r = INV_LAST + 1
    merge(ws, f"A{r}:G{r}")
    put(ws, f"A{r}", "TOTAL PAID (SAR)", font=F_LABEL_B, align="right")
    put(ws, f"H{r}", f"=SUM(H{INV_FIRST}:H{INV_LAST})", font=F_LABEL_B, fmt=FMT_SAR,
        align="center", border=B_GOLD_BOTTOM)

    ws.conditional_formatting.add(
        f"A{INV_FIRST}:O{INV_LAST}",
        FormulaRule(formula=[f"AND($F{INV_FIRST}>0,$K{INV_FIRST}<$L{INV_FIRST})"],
                    fill=PatternFill("solid", start_color=RED_FILL)))
    dvd = DataValidation(type="decimal", operator="between", formula1="0.5", formula2="1.2")
    dvp = DataValidation(type="whole", operator="between", formula1="0", formula2="99")
    ws.add_data_validation(dvd)
    ws.add_data_validation(dvp)
    dvd.add(f"E{INV_FIRST}:E{INV_LAST}")
    dvp.add(f"D{INV_FIRST}:D{INV_LAST}")

    ws.freeze_panes = "B4"
    name("Inv_Mat", f"Inventory!$A${INV_FIRST}:$A${INV_LAST}")
    name("Inv_GramsBought", f"Inventory!$F${INV_FIRST}:$F${INV_LAST}")
    name("Inv_TotalPaid", f"Inventory!$H${INV_FIRST}:$H${INV_LAST}")
    name("Inv_PricePerG", f"Inventory!$I${INV_FIRST}:$I${INV_LAST}")
    name("Inv_OnHand", f"Inventory!$K${INV_FIRST}:$K${INV_LAST}")
    name("Inv_Threshold", f"Inventory!$L${INV_FIRST}:$L${INV_LAST}")
    name("Inv_LowNames", f"Inventory!$P${INV_FIRST}:$P${INV_LAST}")
    name("Inv_LowJoined", f"Inventory!$Q${INV_LAST}")
    name("DefaultBatchConcG", "Inventory!$H$2")
    name("DefaultBatchAlcG", "Inventory!$K$2")
    protect(ws)


def build_production_log(wb):
    ws = wb.create_sheet("Production Log")
    ws.sheet_view.showGridLines = False
    ws.sheet_properties.tabColor = CHARCOAL
    widths(ws, {"A": 11, "B": 16, "C": 26, "D": 8, "E": 6, "F": 8, "G": 13, "H": 11,
                "I": 12, "J": 12, "K": 12, "L": 32, "M": 4})
    ws.column_dimensions["M"].hidden = True
    title_block(ws, 12, "PRODUCTION LOG",
                "One row per batch. Copy 'Concentrate (g)' and 'Alcohol (g)' from the Batch Calculator — "
                "Inventory and the Maceration Tracker update automatically.")
    merge(ws, "A3:B3")
    put(ws, "A3", "Maceration default (days):", font=F_KPI_LBL, align="right")
    input_cell(ws, "C3", 42, fmt=FMT_INT,
               comment="Target end = maceration start + this many days. 42 days = 6 weeks (ready window is 4–8 weeks).")
    merge(ws, "D3:E3")
    put(ws, "D3", "Σ concentrate used (g):", font=F_KPI_LBL, align="right")
    put(ws, "F3", "=SUM(LogConcG)", font=F_GOLD, fmt=FMT_G, align="center")
    merge(ws, "G3:H3")
    put(ws, "G3", "Σ alcohol used (g):", font=F_KPI_LBL, align="right")
    put(ws, "I3", "=SUM(LogAlcG)", font=F_GOLD, fmt=FMT_G, align="center")

    header_cells(ws, 4, ["Date", "Batch ID", "Format", "Size", "Unit", "Conc %",
                         "Concentrate (g)", "Alcohol (g)", "Macer. start", "Target end", "Status", "Notes"])
    ws["B4"].comment = Comment("Suggested ID: SAMR-YYYYMMDD-01", "SAMR Suite")
    for r in range(LOG_FIRST, LOG_LAST + 1):
        put(ws, f"A{r}", "", fmt=FMT_DATE, align="center", border=B_ALL, unlocked=True)
        put(ws, f"B{r}", "", align="center", border=B_ALL, unlocked=True)
        put(ws, f"C{r}", "", border=B_ALL, unlocked=True)
        put(ws, f"D{r}", "", fmt=FMT_G, align="center", border=B_ALL, unlocked=True)
        put(ws, f"E{r}", "", align="center", border=B_ALL, unlocked=True)
        put(ws, f"F{r}", "", fmt=FMT_PCT1, align="center", border=B_ALL, unlocked=True)
        put(ws, f"G{r}", "", fmt=FMT_G, align="center", border=B_ALL, unlocked=True)
        put(ws, f"H{r}", "", fmt=FMT_G, align="center", border=B_ALL, unlocked=True)
        put(ws, f"I{r}", "", fmt=FMT_DATE, align="center", border=B_ALL, unlocked=True)
        put(ws, f"J{r}", f'=IF($I{r}="","",$I{r}+MacDays)', fmt=FMT_DATE, align="center",
            border=B_ALL, unlocked=True)
        put(ws, f"K{r}", "", align="center", border=B_ALL, unlocked=True)
        put(ws, f"L{r}", "", border=B_ALL, unlocked=True)
        put(ws, f"M{r}", f'=IF(AND($K{r}="Macerating",$I{r}<>""),$I{r},"")', font=F_MUTED)
    ws["J5"].comment = Comment("Pre-filled as start + default days. Type a date over it to override.", "SAMR Suite")

    dv_fmt = DataValidation(type="list", formula1="FormatList", allow_blank=True)
    dv_unit = DataValidation(type="list", formula1="UnitList", allow_blank=True)
    dv_status = DataValidation(type="list", formula1="StatusList", allow_blank=True)
    dv_conc = DataValidation(type="decimal", operator="between", formula1="0", formula2="0.35")
    for dv in (dv_fmt, dv_unit, dv_status, dv_conc):
        ws.add_data_validation(dv)
    dv_fmt.add(f"C{LOG_FIRST}:C{LOG_LAST}")
    dv_unit.add(f"E{LOG_FIRST}:E{LOG_LAST}")
    dv_status.add(f"K{LOG_FIRST}:K{LOG_LAST}")
    dv_conc.add(f"F{LOG_FIRST}:F{LOG_LAST}")

    ws.freeze_panes = "C5"
    name("MacDays", "'Production Log'!$C$3")
    name("TotalConcUsedG", "'Production Log'!$F$3")
    name("AlcoholUsedG", "'Production Log'!$I$3")
    name("LogID", f"'Production Log'!$B${LOG_FIRST}:$B${LOG_LAST}")
    name("LogConcG", f"'Production Log'!$G${LOG_FIRST}:$G${LOG_LAST}")
    name("LogAlcG", f"'Production Log'!$H${LOG_FIRST}:$H${LOG_LAST}")
    name("LogStart", f"'Production Log'!$I${LOG_FIRST}:$I${LOG_LAST}")
    name("LogEnd", f"'Production Log'!$J${LOG_FIRST}:$J${LOG_LAST}")
    name("LogStatus", f"'Production Log'!$K${LOG_FIRST}:$K${LOG_LAST}")
    name("LogMacStart", f"'Production Log'!$M${LOG_FIRST}:$M${LOG_LAST}")
    protect(ws)


def build_maceration(wb):
    ws = wb.create_sheet("Maceration Tracker")
    ws.sheet_view.showGridLines = False
    ws.sheet_properties.tabColor = CHARCOAL
    widths(ws, {"A": 16, "B": 26, "C": 12, "D": 12, "E": 12, "F": 12, "G": 9, "H": 12, "I": 30})
    title_block(ws, 9, "MACERATION TRACKER",
                "Auto-view of the Production Log.  Amber = early (< 2 weeks) · Green = ready window (4–8 weeks).")
    header_cells(ws, 4, ["Batch ID", "Format", "Start", "Target end", "Days elapsed",
                         "Days remaining", "Weeks", "Status", "Readiness"])
    for i in range(LOG_LAST - LOG_FIRST + 1):
        r = 5 + i
        lr = LOG_FIRST + i
        put(ws, f"A{r}", f"=IF('Production Log'!B{lr}=\"\",\"\",'Production Log'!B{lr})",
            align="center", border=B_ALL)
        put(ws, f"B{r}", f"=IF('Production Log'!C{lr}=\"\",\"\",'Production Log'!C{lr})",
            border=B_ALL)
        put(ws, f"C{r}", f"=IF('Production Log'!I{lr}=\"\",\"\",'Production Log'!I{lr})",
            fmt=FMT_DATE, align="center", border=B_ALL)
        put(ws, f"D{r}", f"=IF('Production Log'!J{lr}=\"\",\"\",'Production Log'!J{lr})",
            fmt=FMT_DATE, align="center", border=B_ALL)
        put(ws, f"E{r}", f'=IF($C{r}="","",TODAY()-$C{r})', fmt=FMT_INT, align="center", border=B_ALL)
        put(ws, f"F{r}", f'=IF($D{r}="","",$D{r}-TODAY())', fmt=FMT_INT, align="center", border=B_ALL)
        put(ws, f"G{r}", f'=IF($C{r}="","",(TODAY()-$C{r})/7)', fmt=FMT_D1, align="center", border=B_ALL)
        put(ws, f"H{r}", f"=IF('Production Log'!K{lr}=\"\",\"\",'Production Log'!K{lr})",
            align="center", border=B_ALL)
        put(ws, f"I{r}",
            f'=IF($A{r}="","",IF($H{r}="Bottled","BOTTLED ✓",IF($C{r}="","awaiting start date",'
            f'IF(TODAY()-$C{r}>=56,"PAST WINDOW — bottle now",IF(TODAY()-$C{r}>=28,"READY WINDOW (4–8 wk)",'
            f'IF(TODAY()-$C{r}>=14,"developing","early — keep dark & cool"))))))',
            font=F_MUTED, border=B_ALL)
    rng = f"A5:I{5 + LOG_LAST - LOG_FIRST}"
    ws.conditional_formatting.add(rng, FormulaRule(
        formula=['$H5="Bottled"'], fill=PatternFill("solid", start_color=GREY_FILL), stopIfTrue=True))
    ws.conditional_formatting.add(rng, FormulaRule(
        formula=['AND($C5<>"",TODAY()-$C5>=28)'], fill=PatternFill("solid", start_color=GREEN_FILL)))
    ws.conditional_formatting.add(rng, FormulaRule(
        formula=['AND($C5<>"",TODAY()-$C5<14)'], fill=PatternFill("solid", start_color=AMBER_FILL)))
    ws.freeze_panes = "B5"
    protect(ws)


def build_cost_analysis(wb):
    ws = wb.create_sheet("Cost Analysis")
    ws.sheet_view.showGridLines = False
    ws.sheet_properties.tabColor = CHARCOAL
    widths(ws, {"A": 30, "B": 10, "C": 13, "D": 10, "E": 10, "F": 9, "G": 10, "H": 12, "I": 12})
    title_block(ws, 9, "COST ANALYSIS",
                "Shipping is allocated proportionally over all materials via the load factor. All figures update live.")

    band(ws, 3, 1, 9, "A · CAPITAL")
    rows = [
        (4, "Materials purchased (SAR)", "=SUM(Inv_TotalPaid)", FMT_SAR, False, "from Inventory"),
        (5, "International shipping (SAR)", 351, FMT_SAR, True,
         "estimate copied from the ASMR order — edit to this order's actual"),
        (6, "TOTAL CAPITAL (SAR)", "=C4+C5", FMT_SAR, False, ""),
        (7, "Shipping load factor", "=1+ShippingSAR/MaterialsTotalSAR", "0.000", False,
         "multiplier applied to material costs"),
    ]
    for r, lbl, val, fmt, is_input, note in rows:
        merge(ws, f"A{r}:B{r}")
        put(ws, f"A{r}", lbl, font=F_LABEL_B if r == 6 else F_LABEL)
        if is_input:
            input_cell(ws, f"C{r}", val, fmt=fmt)
        else:
            put(ws, f"C{r}", val, font=F_LABEL_B, fill=FILL_IVORY_DK, fmt=fmt, align="center", border=B_ALL)
        merge(ws, f"D{r}:I{r}")
        put(ws, f"D{r}", note, font=F_MUTED)

    band(ws, 9, 1, 9, "B · CONCENTRATE COST")
    rows = [
        (10, "DPG price (SAR/g)", '=INDEX(Inv_PricePerG,MATCH("DPG (Dipropylene Glycol)",Inv_Mat,0))',
         FMT_SAR, "carrier for the D10 dilutions"),
        (11, "Concentrate cost (SAR/g)", "=SUMPRODUCT(FM_Active,FM_CostG)", FMT_SAR,
         "formula-weighted from Inventory prices; D10 lines = 10% neat + 90% DPG"),
        (12, "… incl. shipping (SAR/g)", "=ConcCostPerG*ShipLoad", FMT_SAR,
         "used everywhere costs are quoted"),
    ]
    for r, lbl, f, fmt, note in rows:
        merge(ws, f"A{r}:B{r}")
        put(ws, f"A{r}", lbl, font=F_LABEL)
        put(ws, f"C{r}", f, font=F_LABEL_B, fill=FILL_IVORY_DK, fmt=fmt, align="center", border=B_ALL)
        merge(ws, f"D{r}:I{r}")
        put(ws, f"D{r}", note, font=F_MUTED)

    band(ws, 14, 1, 9, "C · AUXILIARY COSTS (SAR/g — editable estimates)")
    merge(ws, "A15:B15")
    put(ws, "A15", "Component", font=F_HDR, fill=FILL_HDR, border=B_ALL)
    put(ws, "C15", "SAR/g", font=F_HDR, fill=FILL_HDR, align="center", border=B_ALL)
    merge(ws, "D15:I15")
    put(ws, "D15", "Note", font=F_HDR, fill=FILL_HDR, border=B_ALL)
    aux_costs = [
        ("Alcohol 190 proof SDA 40B", None, "from Inventory × shipping load"),
        ("Distilled water", 0.01, "estimate — edit to actual"),
        ("Glycerin", 0.05, "estimate — edit to actual"),
        ("Polysorbate 20", 0.10, "estimate — edit to actual"),
        ("Preservative (broad-spectrum)", 0.40, "estimate — edit to actual"),
        ("Unscented cream base", 0.08, "estimate — edit to actual"),
        ("Emulsifying Wax NF", 0.15, "estimate — edit to actual"),
        ("Cetearyl alcohol", 0.10, "estimate — edit to actual"),
        ("Carrier oil (light)", 0.06, "estimate — edit to actual"),
        ("Shea / mango butter", 0.08, "estimate — edit to actual"),
        ("Vitamin E", 0.50, "estimate — edit to actual"),
    ]
    for i, (lbl, val, note) in enumerate(aux_costs):
        r = 16 + i
        merge(ws, f"A{r}:B{r}")
        put(ws, f"A{r}", lbl, border=B_ALL)
        ws[f"B{r}"].border = B_ALL
        if val is None:
            put(ws, f"C{r}",
                '=INDEX(Inv_PricePerG,MATCH("Alcohol 190 proof SDA 40B",Inv_Mat,0))*ShipLoad',
                fmt=FMT_SAR, align="center", border=B_ALL)
        else:
            input_cell(ws, f"C{r}", val, fmt=FMT_SAR)
        merge(ws, f"D{r}:I{r}")
        put(ws, f"D{r}", note, font=F_MUTED, border=B_ALL)

    band(ws, 28, 1, 9, "D · COST PER BOTTLE / JAR (finished product)")
    header_cells(ws, 29, ["Product", "Size", "Unit", "Density", "Total (g)", "Conc %",
                          "Conc (g)", "Cost SAR", "SAR per ml / g"])
    CL = "ConcCostPerGLoaded"
    bottle = [
        ("Eau de Parfum", 30, "ml", 0.85, 0.20, "edp"),
        ("Eau de Parfum", 50, "ml", 0.85, 0.20, "edp"),
        ("Eau de Parfum", 100, "ml", 0.85, 0.20, "edp"),
        ("Extrait de Parfum", 50, "ml", 0.85, 0.28, "edp"),
        ("Alcohol Body Mist", 100, "ml", 0.87, 0.05, "mist"),
        ("Water-Based Mist", 100, "g", None, 0.025, "wmist"),
        ("Cream Route 1", 100, "g", None, 0.01, "cream1"),
        ("Cream Route 2", 100, "g", None, 0.01, "cream2"),
    ]
    for i, (prod, size, unit, dens, conc, kind) in enumerate(bottle):
        r = 30 + i
        put(ws, f"A{r}", prod, border=B_ALL)
        put(ws, f"B{r}", size, fmt=FMT_INT, align="center", border=B_ALL)
        put(ws, f"C{r}", unit, font=F_MUTED, align="center", border=B_ALL)
        if dens is not None:
            input_cell(ws, f"D{r}", dens, fmt='0.00')
        else:
            put(ws, f"D{r}", "", font=F_MUTED, align="center", border=B_ALL)
        put(ws, f"E{r}", f'=IF(C{r}="ml",B{r}*D{r},B{r})', fmt=FMT_G, align="center", border=B_ALL)
        input_cell(ws, f"F{r}", conc, fmt=FMT_PCT1)
        put(ws, f"G{r}", f"=E{r}*F{r}", fmt=FMT_G, align="center", border=B_ALL)
        if kind == "edp":
            f = f"=G{r}*{CL}+(E{r}-G{r})*$C$16"
        elif kind == "mist":
            f = (f"=G{r}*{CL}+(E{r}-G{r}-E{r}*0.02-E{r}*0.05)*$C$16"
                 f"+E{r}*0.02*$C$18+E{r}*0.05*$C$17")
        elif kind == "wmist":
            f = (f"=G{r}*{CL}+G{r}*4*$C$19+E{r}*0.025*$C$18+E{r}*0.008*$C$20"
                 f"+(E{r}-G{r}-G{r}*4-E{r}*0.025-E{r}*0.008)*$C$17")
        elif kind == "cream1":
            f = f"=G{r}*{CL}+(E{r}-G{r})*$C$21"
        else:
            f = (f"=G{r}*{CL}+E{r}*(0.03*$C$18+0.05*$C$22+0.02*$C$23+0.15*$C$24"
                 f"+0.05*$C$25+0.01*$C$20+0.005*$C$26)+(E{r}-G{r}-E{r}*0.315)*$C$17")
        put(ws, f"H{r}", f, font=F_LABEL_B, fill=FILL_IVORY_DK, fmt=FMT_SAR, align="center", border=B_ALL)
        put(ws, f"I{r}", f"=H{r}/B{r}", fmt=FMT_SAR, align="center", border=B_ALL)

    band(ws, 39, 1, 9, "E · REMAINING STOCK VALUE")
    merge(ws, "A40:B40")
    put(ws, "A40", "Stock value at purchase prices (SAR)", font=F_LABEL)
    put(ws, "C40", "=SUMPRODUCT(Inv_OnHand,Inv_PricePerG)", font=F_LABEL_B, fill=FILL_IVORY_DK,
        fmt=FMT_SAR, align="center", border=B_ALL)
    merge(ws, "A41:B41")
    put(ws, "A41", "… incl. shipping allocation (SAR)", font=F_LABEL)
    put(ws, "C41", "=StockValueSAR*ShipLoad", font=F_LABEL_B, fill=FILL_IVORY_DK,
        fmt=FMT_SAR, align="center", border=B_ALL)

    name("MaterialsTotalSAR", "'Cost Analysis'!$C$4")
    name("ShippingSAR", "'Cost Analysis'!$C$5")
    name("TotalCapital", "'Cost Analysis'!$C$6")
    name("ShipLoad", "'Cost Analysis'!$C$7")
    name("DPGPricePerG", "'Cost Analysis'!$C$10")
    name("ConcCostPerG", "'Cost Analysis'!$C$11")
    name("ConcCostPerGLoaded", "'Cost Analysis'!$C$12")
    name("AuxCostPerG", "'Cost Analysis'!$C$16:$C$26")
    name("AlcCostPerG", "'Cost Analysis'!$C$16")
    name("StockValueSAR", "'Cost Analysis'!$C$40")
    protect(ws)


def build_dashboard(wb):
    ws = wb.create_sheet("Dashboard", 0)
    ws.sheet_view.showGridLines = False
    ws.sheet_properties.tabColor = GOLD
    widths(ws, {"A": 2.5, "B": 19, "C": 19, "D": 19, "E": 19, "F": 19, "G": 19, "H": 2.5})

    merge(ws, "B2:G2")
    put(ws, "B2", "S A M R", font=Font(name=ARIAL, size=24, bold=True, color=CHARCOAL),
        align="center")
    ws.row_dimensions[2].height = 34
    merge(ws, "B3:G3")
    put(ws, "B3", "سَمَر · evening warmth, vanilla, white flowers, warm musk · made for her skin",
        font=F_SUB, align="center")
    for col in range(2, 8):
        ws.cell(row=4, column=col).fill = FILL_GOLD
    ws.row_dimensions[4].height = 3

    kpis = [
        ("B", "INVESTED (SAR)", "=TotalCapital", FMT_SAR),
        ("C", "STOCK VALUE (SAR)", "=StockValueSAR", FMT_SAR),
        ("D", "CONCENTRATE (SAR/g)", "=ConcCostPerGLoaded", FMT_SAR),
        ("E", "BATCHES LOGGED", '=SUMPRODUCT((LogID<>"")*1)', FMT_INT),
        ("F", "MACERATING NOW", '=COUNTIF(LogStatus,"Macerating")', FMT_INT),
        ("G", "LOW-STOCK ITEMS", "=SUMPRODUCT((Inv_OnHand<Inv_Threshold)*1)", FMT_INT),
    ]
    for col, lbl, f, fmt in kpis:
        put(ws, f"{col}6", lbl, font=F_KPI_LBL, align="center")
        put(ws, f"{col}7", f, font=F_KPI, fill=FILL_IVORY, fmt=fmt, align="center", border=B_ALL)
        ws.row_dimensions[7].height = 26
    ws.conditional_formatting.add("G7:G7", FormulaRule(
        formula=["$G$7>0"], font=Font(name=ARIAL, size=14, bold=True, color=RED_TX),
        fill=PatternFill("solid", start_color=RED_FILL)))

    band(ws, 9, 2, 4, "CURRENT BATCH — quick launch")
    left = [
        ("Format", "=BatchFormat", None),
        ("Batch", '=BatchSize&" "&BatchUnit', None),
        ("Concentrate to weigh (g)", "=ConcG", FMT_G),
        ("Alcohol (g)", "=AlcoholG", FMT_G_DASH),
        ("Estimated cost (SAR)", "=BatchCostSAR", FMT_SAR),
        ("Cost per ml (SAR)", "=CostPerMl", FMT_SAR),
    ]
    for i, (lbl, f, fmt) in enumerate(left):
        r = 10 + i
        put(ws, f"B{r}", lbl, font=F_LABEL)
        merge(ws, f"C{r}:D{r}")
        put(ws, f"C{r}", f, font=F_LABEL_B, fill=FILL_IVORY, fmt=fmt or "General",
            align="center", border=B_ALL)

    band(ws, 9, 5, 7, "MACERATION MILESTONES")
    right = [
        ("Next ready window opens",
         '=IF(COUNTIFS(LogStatus,"Macerating",LogStart,"<>")=0,"—",'
         'TEXT(MIN(LogMacStart)+28,"yyyy-mm-dd"))', None),
        ("Next maceration complete",
         '=IF(COUNTIFS(LogStatus,"Macerating",LogStart,"<>")=0,"—",'
         'TEXT(MIN(LogMacStart)+MacDays,"yyyy-mm-dd"))', None),
        ("Batches in ready window",
         '=SUMPRODUCT((LogStatus="Macerating")*(LogStart<>"")*((TODAY()-LogStart)>=28))', FMT_INT),
        ("Concentrate used to date (g)", "=TotalConcUsedG", FMT_G),
        ("Alcohol used to date (g)", "=AlcoholUsedG", FMT_G),
        ("Maceration target (days)", "=MacDays", FMT_INT),
    ]
    for i, (lbl, f, fmt) in enumerate(right):
        r = 10 + i
        merge(ws, f"E{r}:F{r}")
        put(ws, f"E{r}", lbl, font=F_LABEL)
        put(ws, f"G{r}", f, font=F_LABEL_B, fill=FILL_IVORY, fmt=fmt or "General",
            align="center", border=B_ALL)

    band(ws, 17, 2, 7, "INVENTORY ALERTS")
    merge(ws, "B18:G18")
    put(ws, "B18",
        '=IF($G$7=0,"✓ All materials stocked for at least two default batches.",'
        '"⚠ Low stock — reorder:  "&Inv_LowJoined)',
        font=F_LABEL_B, fill=FILL_IVORY, align="center", border=B_ALL, wrap=True)
    ws.row_dimensions[18].height = 30
    ws.conditional_formatting.add("B18:G18", FormulaRule(
        formula=["$G$7>0"], font=Font(name=ARIAL, size=10, bold=True, color=RED_TX),
        fill=PatternFill("solid", start_color=RED_FILL)))

    band(ws, 20, 2, 7, "WORKFLOW")
    steps = [
        "1 · Set format, size and concentration in the Batch Calculator — print it and take it to the bench.",
        "2 · Weigh BASE → HEART → TOP, marry the concentrate 24–48 h, then dilute and start maceration.",
        "3 · Log the batch in the Production Log — Inventory and the Maceration Tracker update themselves.",
    ]
    for i, s in enumerate(steps):
        merge(ws, f"B{21 + i}:G{21 + i}")
        put(ws, f"B{21 + i}", s, font=F_MUTED)
    merge(ws, "B25:G25")
    put(ws, "B25", "SAMR personal production suite · verify against current IFRA standards before any commercial use",
        font=Font(name=ARIAL, size=8, italic=True, color=MUTED), align="center")
    protect(ws)


def build_process_reference(wb):
    ws = wb.create_sheet("Process Reference")
    ws.sheet_view.showGridLines = False
    ws.sheet_properties.tabColor = MUTED
    widths(ws, {"A": 5, "B": 14, "C": 14, "D": 14, "E": 14, "F": 14, "G": 14, "H": 14, "I": 14})
    title_block(ws, 9, "PROCESS REFERENCE — SOPs",
                "Concise bench procedures. Work clean, work in grams, label everything.")
    sections = [
        ("GOLDEN RULES", [
            "Weigh in GRAMS on a 0.01 g scale — never count drops. Record every weight as you go.",
            "Sanitize glassware and tools with alcohol before each session. Change one variable at a time between trials.",
            "Label every container: SAMR · content · strength · date. Store everything dark and cool.",
        ]),
        ("EXTRAIT DE PARFUM 28% — MASTER BATCH METHOD (the standard)", [
            "THE METHOD: weigh ONE master concentrate for the whole production run, marry and macerate it in ONE vessel, "
            "then divide into bottles at the end. This is how professional houses work (the 'mother juice'): every bottle is "
            "identical, the tiny weights become 5× larger and more accurate, and you do the work once. "
            "The technique is identical to ASMR's Master Method document — same tools, same steps, this formula.",
            "STEP 1 · PREP D10 DILUTIONS (a day ahead). Four ingredients are weighed as a 10%-in-DPG dilution: "
            "Pink Peppercorn, Maltol, Aldehyde C-18 Coconut, and (if kept) Damascone Beta. For each: 1.0 g neat + 9.0 g DPG = 10 g. See the Dilution Prep tab.",
            "STEP 2 · SET THE MASTER BATCH. On the Batch Calculator choose Extrait de Parfum, 250 ml, 28% "
            "(= 212.5 g juice: 59.5 g concentrate + 153 g alcohol — your full 5-bottle run). Print the Batch Sheet.",
            "STEP 3 · WEIGH THE CONCENTRATE, base first. Tare a clean glass beaker on a 0.01 g scale. Weigh BASE → HEART → TOP "
            "exactly as printed, taring between each and ticking every line. D10 items: weigh the DILUTION weight shown.",
            "STEP 4 · MARRY. Stir gently 2–3 min. Cap and rest the neat concentrate 24–48 h in the dark — the accord blooms "
            "before it meets alcohol. SAMR carries crystalline materials (Ambroxan, Vanillin, Ethyl Vanillin, Coumarin) — "
            "stir until the liquid is completely clear; a warm-water bath (≤40 °C, 10 min) speeds dissolution.",
            "STEP 5 · DILUTE. Weigh the alcohol (190 proof SDA 40B) INTO the concentrate — not the reverse. Stir 1–2 min, cap.",
            "STEP 6 · MACERATE 4–8 weeks in ONE amber bottle filled to the shoulder (minimal air = no oxidation), dark and cool. "
            "Swirl once a day the first week. At 28% the extra weeks genuinely deepen the drydown — do not rush.",
            "STEP 7 · COLD-CRASH. Chill the whole vessel 24 h in the fridge (~4 °C) so waxes/insolubles drop out.",
            "STEP 8 · FILTER cold through a coffee filter (or 0.45 µm) into a clean vessel.",
            "STEP 9 · DIVIDE BY WEIGHT into the final bottles: 42.5 g per 50 ml bottle (8.5 g per 10 ml, 17 g per 20 ml, "
            "25.5 g per 30 ml, 59.5 g per 70 ml, 85 g per 100 ml). Label each: SAMR · Extrait 28% · batch ID · date.",
            "STEP 10 · LOG the ONE master batch in the Production Log (concentrate 59.5 g, alcohol 153 g) and set it to "
            "'Bottled' when divided. Patch-test before regular wear.",
        ]),
        ("ALCOHOL BODY MIST", [
            "1 · Same juice at ~5%. Weigh concentrate, add optional glycerin (2–3%) and distilled water (5–10%), then alcohol.",
            "2 · Macerate 1–2 weeks minimum (longer is smoother), cold-crash, filter, bottle.",
        ]),
        ("WATER-BASED MIST (alcohol-free)", [
            "1 · Weigh fragrance concentrate into a clean bottle.",
            "2 · Add Polysorbate 20 at 4–6 × the fragrance weight. Mix until completely uniform — THIS ORDER MATTERS.",
            "3 · Add glycerin, then the distilled water slowly while swirling.",
            "4 · Add the broad-spectrum preservative at its recommended dose (default 0.8%). Shake well.",
            "5 · Check clarity after 24 h — if cloudy, increase solubilizer toward 6×. Patch-test. Use within 6–12 months.",
        ]),
        ("CREAM — ROUTE 1 (scent an unscented base)", [
            "1 · Weigh the preserved unscented cream base. Add fragrance at 0.8–1.2% (default 1.0%).",
            "2 · Stir in COLD, thoroughly, with a clean spatula. No heat — the base is already preserved and emulsified.",
            "3 · Rest 24 h, check scent and texture, jar and label.",
        ]),
        ("CREAM — ROUTE 2 (from scratch, 100 g)", [
            "1 · Water phase: distilled water + glycerin. Oil phase: E-wax NF, cetearyl alcohol, carrier oil, butter.",
            "2 · Heat BOTH phases to 70–75 °C, within 5 °C of each other.",
            "3 · Combine and stick-blend 2–3 min until a uniform emulsion forms. Stir while cooling.",
            "4 · Below 40 °C add: preservative (1%), fragrance (1%), vitamin E (0.5%). Blend briefly.",
            "5 · Check pH — target 5.0–5.5 (adjust with a drop of lactic/citric acid solution if high).",
            "6 · Jar, label, patch-test. Water-containing cream = preservative is NON-NEGOTIABLE.",
        ]),
    ]
    r = 4
    for title, steps in sections:
        band(ws, r, 1, 9, title)
        r += 1
        for s in steps:
            ws.merge_cells(start_row=r, start_column=2, end_row=r, end_column=9)
            put(ws, f"B{r}", s, font=F_LABEL, wrap=True)
            ws.row_dimensions[r].height = max(16, 14 * (1 + len(s) // 105))
            r += 1
        r += 1
    protect(ws)


def build_safety(wb):
    ws = wb.create_sheet("Safety Notes")
    ws.sheet_view.showGridLines = False
    ws.sheet_properties.tabColor = "A93226"
    widths(ws, {"A": 12, "B": 14, "C": 14, "D": 14, "E": 14, "F": 14, "G": 14, "H": 14, "I": 14})
    title_block(ws, 9, "SAFETY NOTES",
                "Read before every production session.")
    notes = [
        ("CRITICAL", "Alcohol is FLAMMABLE. No open flame, no smoking, ventilate the workspace, keep containers closed."),
        ("CRITICAL", "Every WATER-containing product (water-based mist, from-scratch cream) REQUIRES a "
                     "broad-spectrum preservative. Alcohol-based products (EDP, Extrait, alcohol mist) do not."),
        ("CRITICAL", "Damascone Beta is IFRA-RESTRICTED and extremely powerful. Weigh it ONLY as the 10% D10 "
                     "dilution and never raise it above the 0.3% line (≈0.008% of the finished extrait)."),
        ("RULE", "Use only ONE amber material — Ambroxan. Do not add a second ambroxan-type material."),
        ("RULE", "Coumarin at 5.0% of the concentrate ≈ 1.4% of a 28% extrait — inside the IFRA fine-fragrance "
                 "ceiling. Do not push it higher without re-checking the current IFRA standard."),
        ("RULE", "Vanillin and Ethyl Vanillin tint the juice amber, and it deepens with maceration — normal for "
                 "true vanilla perfumes. Avoid spraying directly on white fabric."),
        ("RULE", "Leave-on creams are a stricter IFRA category than fine fragrance: keep cream fragrance ≤ 1.2% "
                 "and verify the final formula against the CURRENT IFRA standards for the product category "
                 "before any commercial use."),
        ("RULE", "Always PATCH-TEST the finished, diluted product on a small skin area for 24–48 h before regular wear."),
        ("RULE", "Weigh in grams — never count drops. Drop size varies by pipette and viscosity; grams are reproducible."),
        ("NOTE", "The Bergamot ACCORD used here is photosafe. If you ever substitute real bergamot essential oil, "
                 "it is PHOTOTOXIC — fabric scenting only."),
        ("NOTE", "Alcohol choice: SDA 40B is phthalate-free (denatured with Bitrex). SDA 39C contains diethyl "
                 "phthalate — that is why 40B was chosen."),
        ("NOTE", "Handle neat aroma chemicals with nitrile gloves and eye protection; avoid inhaling vapors; "
                 "wipe spills immediately with alcohol."),
        ("NOTE", "Keep all materials and finished products away from children and pets. Never store near food."),
    ]
    tag_font = {
        "CRITICAL": Font(name=ARIAL, size=9, bold=True, color=WHITE),
        "RULE": Font(name=ARIAL, size=9, bold=True, color=CHARCOAL_DK),
        "NOTE": Font(name=ARIAL, size=9, bold=True, color=IVORY),
    }
    tag_fill = {
        "CRITICAL": PatternFill("solid", start_color=RED_TX),
        "RULE": PatternFill("solid", start_color=GOLD),
        "NOTE": PatternFill("solid", start_color=MUTED),
    }
    r = 4
    for tag, text in notes:
        put(ws, f"A{r}", tag, font=tag_font[tag], fill=tag_fill[tag], align="center")
        ws.merge_cells(start_row=r, start_column=2, end_row=r, end_column=9)
        put(ws, f"B{r}", text, font=F_LABEL, wrap=True)
        ws.row_dimensions[r].height = max(18, 14 * (1 + len(text) // 105))
        r += 2
    protect(ws)


def build_yield_capacity(wb):
    ws = wb.create_sheet("Yield & Capacity")
    ws.sheet_view.showGridLines = False
    ws.sheet_properties.tabColor = GOLD
    widths(ws, {"A": 27, "B": 13, "C": 13, "D": 14, "E": 13, "F": 11, "G": 14, "H": 15, "I": 22})
    title_block(ws, 9, "YIELD & CAPACITY",
                "How many bottles your CURRENT inventory can make. Every cell is live — it "
                "updates as you log batches and as prices change.", sub_cols=9)

    # --- 1 · assumptions ---
    band(ws, 3, 1, 9, "1 · ASSUMPTIONS")
    rows = [
        (4, "Concentrate %", 0.28, FMT_PCT1, "28% = Extrait (default). Set 20% to model EDP."),
        (5, "Finished density (g/ml)", 0.85, '0.00', "converts bottle ml → grams"),
        (6, "Bench-loss allowance %", 0.0, FMT_PCT1, "residue lost in beakers/pipettes; try 5% for realism"),
        (7, "Stock basis", "On hand", None, "‘On hand’ = live remaining stock · ‘Purchased’ = total bought"),
    ]
    for r, lbl, val, fmt, note in rows:
        merge(ws, f"A{r}:B{r}")
        put(ws, f"A{r}", lbl, font=F_LABEL_B)
        input_cell(ws, f"C{r}", val, fmt=fmt)
        merge(ws, f"D{r}:I{r}")
        put(ws, f"D{r}", note, font=F_MUTED)
    merge(ws, "G8:H8")
    put(ws, "G8", "Ingredient-table bottle ml", font=F_LABEL_B, align="right")
    input_cell(ws, "I8", 50, fmt=FMT_INT,
               comment="Change this and the material table's 'Bottles @ ml' column updates.")

    # --- 2 · current limits (KPI strip) ---
    band(ws, 9, 1, 9, "2 · CURRENT LIMITS")
    kpis = [
        ("B", "MAX CONCENTRATE (g)", "=MIN($F$27:$F$52)", FMT_G),
        ("C", "USABLE AFTER LOSS (g)", "=$B$11*(1-YC_Loss)", FMT_G),
        ("D", "ALCOHOL ON HAND (g)",
         '=IF(YC_Basis="On hand",INDEX(Inv_OnHand,MATCH("Alcohol 190 proof SDA 40B",Inv_Mat,0)),'
         'INDEX(Inv_GramsBought,MATCH("Alcohol 190 proof SDA 40B",Inv_Mat,0)))', FMT_G),
        ("E", "DPG ON HAND (g)",
         '=IF(YC_Basis="On hand",INDEX(Inv_OnHand,MATCH("DPG (Dipropylene Glycol)",Inv_Mat,0)),'
         'INDEX(Inv_GramsBought,MATCH("DPG (Dipropylene Glycol)",Inv_Mat,0)))', FMT_G),
    ]
    for col, lbl, f, fmt in kpis:
        put(ws, f"{col}10", lbl, font=F_KPI_LBL, align="center")
        put(ws, f"{col}11", f, font=F_KPI, fill=FILL_IVORY, fmt=fmt, align="center", border=B_ALL)
    ws.row_dimensions[11].height = 26
    put(ws, "F10", "LIMITING MATERIAL", font=F_KPI_LBL, align="center")
    merge(ws, "F11:I11")
    put(ws, "F11", '=IF(COUNT($F$27:$F$52)=0,"—",INDEX($A$27:$A$52,MATCH($B$11,$F$27:$F$52,0)))',
        font=F_GOLD, fill=FILL_GOLD_LT, align="center", border=B_ALL)

    # --- 3 · bottle yield ---
    band(ws, 13, 1, 9, "3 · BOTTLE YIELD")
    merge(ws, "A14:I14")
    put(ws, "A14",
        '="At "&TEXT(YC_ConcPct,"0%")&" concentrate ('
        '"&IF(YC_ConcPct>=0.25,"Extrait",IF(YC_ConcPct>=0.15,"EDP","light"))&"), '
        '"&TEXT(YC_Density,"0.00")&" g/ml, "&TEXT(YC_Loss,"0%")&" bench loss, stock basis: "&YC_Basis',
        font=F_MUTED)
    header_cells(ws, 15, ["Bottle size (ml)", "Conc / bottle (g)", "Alcohol / bottle (g)",
                          "Bottles by conc.", "Bottles by alcohol", "BOTTLES",
                          "Cost / bottle (SAR)", "Batch materials (SAR)", "Limiting factor"])
    sizes = [10, 20, 30, 50, 70, 100]
    for i, s in enumerate(sizes):
        r = 16 + i
        put(ws, f"A{r}", s, font=F_LABEL_B, fill=FILL_IVORY_DK, fmt=FMT_INT, align="center", border=B_ALL)
        put(ws, f"B{r}", f"=$A{r}*YC_Density*YC_ConcPct", fmt=FMT_G, align="center", border=B_ALL)
        put(ws, f"C{r}", f"=$A{r}*YC_Density*(1-YC_ConcPct)", fmt=FMT_G, align="center", border=B_ALL)
        put(ws, f"D{r}", f'=IF(B{r}=0,"",YC_UsableConc/B{r})', fmt=FMT_D1, align="center", border=B_ALL)
        put(ws, f"E{r}", f'=IF(C{r}=0,"",YC_AlcOnHand/C{r})', fmt=FMT_D1, align="center", border=B_ALL)
        put(ws, f"F{r}", f'=FLOOR(MIN(D{r},E{r}),1)', font=F_KPI, fill=FILL_GOLD_LT,
            fmt=FMT_INT, align="center", border=B_ALL)
        put(ws, f"G{r}", f"=B{r}*ConcCostPerGLoaded+C{r}*AlcCostPerG", fmt=FMT_SAR, align="center", border=B_ALL)
        put(ws, f"H{r}", f"=F{r}*G{r}", fmt=FMT_SAR, align="center", border=B_ALL)
        put(ws, f"I{r}", f'=IF(D{r}<=E{r},"concentrate ("&YC_LimitMat&")","alcohol")',
            font=F_MUTED, align="center", border=B_ALL)
    ws.conditional_formatting.add("A16:I21", FormulaRule(
        formula=["$F16=0"], fill=PatternFill("solid", start_color=RED_FILL)))
    merge(ws, "A22:I22")
    put(ws, "A22",
        '="To make more, buy more "&YC_LimitMat&" — it runs out first. '
        'See the material-by-material table below for the next bottlenecks."',
        font=F_MUTED)

    # --- 4 · material-by-material capacity ---
    band(ws, 24, 1, 9, "4 · MATERIAL-BY-MATERIAL CAPACITY  (which runs out first)")
    header_cells(ws, 26, ["Material", "Phase", "Active %", "Stock (g)", "Neat / g conc",
                          "Max concentrate (g)", "Max 50 ml btls", "Bottle ml", "Bottles @ ml"])
    basis_stock = ('IF(YC_Basis="On hand",INDEX(Inv_OnHand,MATCH($A{r},Inv_Mat,0)),'
                   'INDEX(Inv_GramsBought,MATCH($A{r},Inv_Mat,0)))')
    for i in range(len(FM_ROWS)):
        r = 27 + i
        fmrow = FM_FIRST + i
        put(ws, f"A{r}", f"='Formula Master'!$B${fmrow}", border=B_ALL)
        put(ws, f"B{r}", f"='Formula Master'!$A${fmrow}", font=F_MUTED, align="center", border=B_ALL)
        put(ws, f"C{r}", f"='Formula Master'!$F${fmrow}", fmt=FMT_PCT2, align="center", border=B_ALL)
        put(ws, f"D{r}", "=" + basis_stock.format(r=r), fmt=FMT_G, align="center", border=B_ALL)
        put(ws, f"E{r}", f'=C{r}*IF(\'Formula Master\'!$D${fmrow}="D10",0.1,1)',
            fmt=FMT_G3, align="center", border=B_ALL)
        put(ws, f"F{r}", f'=IF(E{r}<=0,"",MAX(D{r},0)/E{r})', font=F_LABEL_B, fmt=FMT_G,
            align="center", border=B_ALL)
        put(ws, f"G{r}", f'=IF(F{r}="","",FLOOR(F{r}/(50*YC_Density*YC_ConcPct),1))',
            font=F_MUTED, fmt=FMT_INT, align="center", border=B_ALL)
        put(ws, f"H{r}", "=YC_MatBottleMl", fmt=FMT_INT, align="center", border=B_ALL)
        put(ws, f"I{r}", f'=IF(F{r}="","",FLOOR(F{r}/(YC_MatBottleMl*YC_Density*YC_ConcPct),1))',
            font=F_LABEL_B, fmt=FMT_INT, align="center", border=B_ALL)
    r = 52  # DPG carrier row
    put(ws, f"A{r}", "DPG (Dipropylene Glycol)", font=F_MUTED, border=B_ALL)
    put(ws, f"B{r}", "carrier", font=F_MUTED, align="center", border=B_ALL)
    put(ws, f"C{r}", "=D10ActivePct", fmt=FMT_PCT2, align="center", border=B_ALL)
    put(ws, f"D{r}", "=YC_DPGOnHand", fmt=FMT_G, align="center", border=B_ALL)
    put(ws, f"E{r}", "=D10ActivePct*0.9", fmt=FMT_G3, align="center", border=B_ALL)
    put(ws, f"F{r}", f'=IF(E{r}<=0,"",MAX(D{r},0)/E{r})', font=F_LABEL_B, fmt=FMT_G,
        align="center", border=B_ALL)
    put(ws, f"G{r}", f'=IF(F{r}="","",FLOOR(F{r}/(50*YC_Density*YC_ConcPct),1))',
        font=F_MUTED, fmt=FMT_INT, align="center", border=B_ALL)
    put(ws, f"H{r}", "=YC_MatBottleMl", fmt=FMT_INT, align="center", border=B_ALL)
    put(ws, f"I{r}", f'=IF(F{r}="","",FLOOR(F{r}/(YC_MatBottleMl*YC_Density*YC_ConcPct),1))',
        font=F_LABEL_B, fmt=FMT_INT, align="center", border=B_ALL)
    ws.conditional_formatting.add("A27:I52", FormulaRule(
        formula=['AND($F27<>"",$F27=$B$11)'], fill=PatternFill("solid", start_color=RED_FILL)))

    # validations
    dv_conc = DataValidation(type="decimal", operator="between", formula1="0.02", formula2="0.35",
                             error="Enter a fraction between 2% and 35%, e.g. 0.28")
    dv_dens = DataValidation(type="decimal", operator="between", formula1="0.5", formula2="1.2")
    dv_loss = DataValidation(type="decimal", operator="between", formula1="0", formula2="0.3")
    dv_basis = DataValidation(type="list", formula1='"On hand,Purchased"', allow_blank=False)
    dv_bottle = DataValidation(type="whole", operator="between", formula1="1", formula2="1000")
    for dv in (dv_conc, dv_dens, dv_loss, dv_basis, dv_bottle):
        ws.add_data_validation(dv)
    dv_conc.add("C4")
    dv_dens.add("C5")
    dv_loss.add("C6")
    dv_basis.add("C7")
    dv_bottle.add("I8")

    ws.freeze_panes = "A16"
    name("YC_ConcPct", "'Yield & Capacity'!$C$4")
    name("YC_Density", "'Yield & Capacity'!$C$5")
    name("YC_Loss", "'Yield & Capacity'!$C$6")
    name("YC_Basis", "'Yield & Capacity'!$C$7")
    name("YC_MaxConc", "'Yield & Capacity'!$B$11")
    name("YC_UsableConc", "'Yield & Capacity'!$C$11")
    name("YC_AlcOnHand", "'Yield & Capacity'!$D$11")
    name("YC_DPGOnHand", "'Yield & Capacity'!$E$11")
    name("YC_LimitMat", "'Yield & Capacity'!$F$11")
    name("YC_MatBottleMl", "'Yield & Capacity'!$I$8")
    protect(ws)


def build_scale_up_plan(wb):
    ws = wb.create_sheet("Scale-Up Plan")
    ws.sheet_view.showGridLines = False
    ws.sheet_properties.tabColor = GOLD
    widths(ws, {"A": 28, "B": 12, "C": 11, "D": 13, "E": 13, "F": 12, "G": 11,
                "H": 10, "I": 12, "J": 14, "K": 20})
    title_block(ws, 11, "SCALE-UP PLAN",
                "Target the maximum production level your alcohol can support, then show every "
                "material shortage, extra packs to buy, and added cost. Champagne cells are editable.",
                sub_cols=11)

    band(ws, 3, 1, 11, "1 · TARGET PRODUCTION")
    rows = [
        (4, "Target 50 ml bottles", '=FLOOR(YC_AlcOnHand/(50*$C$6*(1-$C$5)),1)', FMT_INT,
         "Default = maximum 50 ml bottles supported by current alcohol. Type your own target to override."),
        (5, "Concentrate %", 0.28, FMT_PCT1, "28% Extrait default. Set 20% for EDP."),
        (6, "Finished density (g/ml)", 0.85, '0.00', "Converts bottle ml to grams."),
        (7, "Bench-loss allowance %", 0.05, FMT_PCT1, "Extra concentrate to cover beaker, filter, and pipette losses."),
        (8, "Stock basis", "On hand", None, "On hand = live after Production Log. Purchased = total packs bought."),
    ]
    for r, lbl, val, fmt, note in rows:
        merge(ws, f"A{r}:B{r}")
        put(ws, f"A{r}", lbl, font=F_LABEL_B)
        input_cell(ws, f"C{r}", val, fmt=fmt)
        merge(ws, f"D{r}:K{r}")
        put(ws, f"D{r}", note, font=F_MUTED)

    band(ws, 10, 1, 11, "2 · SCALE-UP SUMMARY")
    kpis = [
        ("B", "TARGET CONC (g)", "=$C$4*50*$C$6*$C$5/(1-$C$7)", FMT_G),
        ("C", "ALCOHOL NEEDED (g)", "=$C$4*50*$C$6*(1-$C$5)", FMT_G),
        ("D", "CURRENT MAX CONC (g)", "=YC_MaxConc", FMT_G),
        ("E", "CURRENT 50 ml BTLS", "=FLOOR(YC_UsableConc/(50*$C$6*$C$5),1)", FMT_INT),
        ("F", "ALCOHOL-MAX BTLS", '=FLOOR(YC_AlcOnHand/(50*$C$6*(1-$C$5)),1)', FMT_INT),
        ("G", "EXTRA PACKS", "=SUM($H$27:$H$53)", FMT_INT),
        ("H", "BUY COST (SAR)", "=SUM($I$27:$I$53)", FMT_SAR),
        ("I", "BOTTLENECK NOW", "=YC_LimitMat", None),
    ]
    for col, lbl, formula, fmt in kpis:
        put(ws, f"{col}11", lbl, font=F_KPI_LBL, align="center")
        put(ws, f"{col}12", formula, font=F_KPI if col != "I" else F_GOLD,
            fill=FILL_IVORY if col != "H" else FILL_GOLD_LT, fmt=fmt, align="center", border=B_ALL)
    merge(ws, "I12:K12")
    ws.row_dimensions[12].height = 28

    merge(ws, "A14:K15")
    put(ws, "A14",
        '="Plan: "&TEXT($C$4,"0")&" × 50 ml at "&TEXT($C$5,"0%")&" needs "'
        '&TEXT($B$12,"0.0")&" g concentrate. Buy the red rows below first; once they are covered, '
        'alcohol becomes the ceiling."',
        font=F_LABEL_B, fill=FILL_IVORY, border=B_ALL, align="center", wrap=True)

    band(ws, 17, 1, 11, "3 · MATERIALS TO INCREASE")
    header_cells(ws, 18, ["Material", "Phase", "Active %", "Stock (g)", "Required (g)",
                          "Shortage (g)", "Pack g", "Add packs", "Add cost", "Status", "Why"])

    stock = ('IF($C$8="On hand",INDEX(Inv_OnHand,MATCH($A{r},Inv_Mat,0)),'
             'INDEX(Inv_GramsBought,MATCH($A{r},Inv_Mat,0)))')
    pack_g = ('IF(INDEX(Inventory!$C$4:$C$30,MATCH($A{r},Inv_Mat,0))="ml",'
              'INDEX(Inventory!$B$4:$B$30,MATCH($A{r},Inv_Mat,0))*INDEX(Inventory!$E$4:$E$30,MATCH($A{r},Inv_Mat,0)),'
              'INDEX(Inventory!$B$4:$B$30,MATCH($A{r},Inv_Mat,0)))')
    pack_price = 'INDEX(Inventory!$G$4:$G$30,MATCH($A{r},Inv_Mat,0))'

    for i in range(len(FM_ROWS)):
        r = 19 + i
        fmrow = FM_FIRST + i
        put(ws, f"A{r}", f"='Formula Master'!$B${fmrow}", border=B_ALL)
        put(ws, f"B{r}", f"='Formula Master'!$A${fmrow}", font=F_MUTED, align="center", border=B_ALL)
        put(ws, f"C{r}", f"='Formula Master'!$F${fmrow}", fmt=FMT_PCT2, align="center", border=B_ALL)
        put(ws, f"D{r}", "=" + stock.format(r=r), fmt=FMT_G, align="center", border=B_ALL)
        put(ws, f"E{r}", f'=$B$12*C{r}*IF(\'Formula Master\'!$D${fmrow}="D10",0.1,1)',
            fmt=FMT_G, align="center", border=B_ALL)
        put(ws, f"F{r}", f"=MAX(E{r}-D{r},0)", font=F_LABEL_B, fmt=FMT_G, align="center", border=B_ALL)
        put(ws, f"G{r}", "=" + pack_g.format(r=r), fmt=FMT_G, align="center", border=B_ALL)
        put(ws, f"H{r}", f'=IF(F{r}=0,0,CEILING(F{r}/G{r},1))', font=F_LABEL_B,
            fmt=FMT_INT, align="center", border=B_ALL)
        put(ws, f"I{r}", f"=H{r}*{pack_price.format(r=r)}", fmt=FMT_SAR, align="center", border=B_ALL)
        put(ws, f"J{r}", f'=IF(H{r}>0,"BUY","OK")', font=F_MUTED, align="center", border=B_ALL)
        put(ws, f"K{r}", f'=IF(H{r}>0,"Increase to hit target","Enough for target")',
            font=F_MUTED, align="center", border=B_ALL)

    for r, mat, phase, pct_formula, req_formula in [
        (52, "DPG (Dipropylene Glycol)", "carrier", "=D10ActivePct", "=$B$12*D10ActivePct*0.9"),
        (53, "Alcohol 190 proof SDA 40B", "solvent", '=1-$C$5', "=$C$12"),
    ]:
        put(ws, f"A{r}", mat, border=B_ALL)
        put(ws, f"B{r}", phase, font=F_MUTED, align="center", border=B_ALL)
        put(ws, f"C{r}", pct_formula, fmt=FMT_PCT2, align="center", border=B_ALL)
        put(ws, f"D{r}", "=" + stock.format(r=r), fmt=FMT_G, align="center", border=B_ALL)
        put(ws, f"E{r}", req_formula, fmt=FMT_G, align="center", border=B_ALL)
        put(ws, f"F{r}", f"=MAX(E{r}-D{r},0)", font=F_LABEL_B, fmt=FMT_G, align="center", border=B_ALL)
        put(ws, f"G{r}", "=" + pack_g.format(r=r), fmt=FMT_G, align="center", border=B_ALL)
        put(ws, f"H{r}", f'=IF(F{r}=0,0,CEILING(F{r}/G{r},1))', font=F_LABEL_B,
            fmt=FMT_INT, align="center", border=B_ALL)
        put(ws, f"I{r}", f"=H{r}*{pack_price.format(r=r)}", fmt=FMT_SAR, align="center", border=B_ALL)
        put(ws, f"J{r}", f'=IF(H{r}>0,"BUY","OK")', font=F_MUTED, align="center", border=B_ALL)
        put(ws, f"K{r}", f'=IF(H{r}>0,"Increase to hit target","Enough for target")',
            font=F_MUTED, align="center", border=B_ALL)

    ws.conditional_formatting.add("A19:K53", FormulaRule(
        formula=["$H19>0"], fill=PatternFill("solid", start_color=RED_FILL),
        font=Font(name=ARIAL, size=10, color=RED_TX)))

    dv_bottles = DataValidation(type="whole", operator="between", formula1="1", formula2="100000")
    dv_conc = DataValidation(type="decimal", operator="between", formula1="0.02", formula2="0.35")
    dv_dens = DataValidation(type="decimal", operator="between", formula1="0.5", formula2="1.2")
    dv_loss = DataValidation(type="decimal", operator="between", formula1="0", formula2="0.3")
    dv_basis = DataValidation(type="list", formula1='"On hand,Purchased"', allow_blank=False)
    for dv in (dv_bottles, dv_conc, dv_dens, dv_loss, dv_basis):
        ws.add_data_validation(dv)
    dv_bottles.add("C4")
    dv_conc.add("C5")
    dv_dens.add("C6")
    dv_loss.add("C7")
    dv_basis.add("C8")

    ws.freeze_panes = "A19"
    name("ScaleTargetBottles50", "'Scale-Up Plan'!$C$4")
    name("ScaleTargetConcG", "'Scale-Up Plan'!$B$12")
    name("ScaleBuyCostSAR", "'Scale-Up Plan'!$H$12")
    protect(ws)


def build_pricing(wb):
    ws = wb.create_sheet("Pricing & Sales")
    ws.sheet_view.showGridLines = False
    ws.sheet_properties.tabColor = GOLD
    widths(ws, {"A": 22, "B": 13, "C": 13, "D": 12, "E": 13, "F": 15, "G": 15, "H": 13, "I": 12})
    title_block(ws, 9, "PRICING & SALES",
                "What to charge for the extra bottles. Juice cost is live from Cost Analysis; "
                "you set packaging and margin. Extrait de Parfum only.", sub_cols=9)

    # --- 1 · assumptions ---
    band(ws, 3, 1, 9, "1 · PRICING ASSUMPTIONS  (champagne cells are yours to set)")
    rows = [
        (4, "Concentrate %", 0.28, FMT_PCT1, "28% Extrait — matches your product"),
        (5, "Finished density (g/ml)", 0.85, '0.00', "ml → grams"),
        (6, "Labour + overhead / bottle (SAR)", 0.0, FMT_SAR, "value your time; 0 = ignore for now"),
        (7, "Target price multiple (× cost)", 3.0, '0.0"×"', "retail = total cost × this. 2.5–4× is typical for indie/luxury"),
        (8, "VAT % (Saudi Arabia)", 0.15, FMT_PCT1, "added on top of the ex-VAT price if you are VAT-registered"),
    ]
    for r, lbl, val, fmt, note in rows:
        merge(ws, f"A{r}:B{r}")
        put(ws, f"A{r}", lbl, font=F_LABEL_B)
        input_cell(ws, f"C{r}", val, fmt=fmt)
        merge(ws, f"D{r}:I{r}")
        put(ws, f"D{r}", note, font=F_MUTED)

    # --- 2 · price per bottle ---
    band(ws, 10, 1, 9, "2 · COST → RETAIL PER BOTTLE")
    header_cells(ws, 11, ["Bottle size (ml)", "Juice cost", "Packaging", "Labour+OH",
                          "TOTAL COST", "Retail ex-VAT", "Retail inc-VAT",
                          "Profit / bottle", "Gross margin"])
    juice = ('$A{r}*PR_Density*PR_ConcPct*ConcCostPerGLoaded'
             '+$A{r}*PR_Density*(1-PR_ConcPct)*AlcCostPerG')
    pack_default = {30: 30, 50: 40, 100: 55}
    for i, s in enumerate([30, 50, 100]):
        r = 12 + i
        put(ws, f"A{r}", s, font=F_LABEL_B, fill=FILL_IVORY_DK, fmt=FMT_INT, align="center", border=B_ALL)
        put(ws, f"B{r}", "=" + juice.format(r=r), fmt=FMT_SAR, align="center", border=B_ALL)
        input_cell(ws, f"C{r}", pack_default[s], fmt=FMT_SAR,
                   comment="Bottle + atomiser/pump + cap + box + label. Edit to your real supplier cost." if s == 50 else None)
        put(ws, f"D{r}", "=PR_Labour", fmt=FMT_SAR, align="center", border=B_ALL)
        put(ws, f"E{r}", f"=B{r}+C{r}+D{r}", font=F_LABEL_B, fill=FILL_GOLD_LT, fmt=FMT_SAR,
            align="center", border=B_ALL)
        put(ws, f"F{r}", f"=E{r}*PR_Mult", font=F_KPI, fill=FILL_IVORY, fmt=FMT_SAR,
            align="center", border=B_ALL)
        put(ws, f"G{r}", f"=F{r}*(1+PR_Vat)", fmt=FMT_SAR, align="center", border=B_ALL)
        put(ws, f"H{r}", f"=F{r}-E{r}", fmt=FMT_SAR, align="center", border=B_ALL)
        put(ws, f"I{r}", f'=IF(F{r}=0,"",(F{r}-E{r})/F{r})', fmt=FMT_PCT1, align="center", border=B_ALL)

    # --- 3 · multiple reference (50 ml) ---
    band(ws, 16, 1, 9, "3 · WHAT DIFFERENT MULTIPLES GIVE  (50 ml, ex-VAT)")
    header_cells(ws, 17, ["Multiple", "×2 (friends)", "×2.5", "×3 (fair indie)", "×4 (luxury)",
                          "", "", "", ""])
    merge(ws, "F17:I17")
    put(ws, "F17", "market: a 50 ml niche extrait often retails 400–900+ SAR", font=F_HDR,
        fill=FILL_HDR, align="center", border=B_ALL)
    put(ws, "A18", "Retail (SAR)", font=F_LABEL_B, border=B_ALL)
    put(ws, "B18", "=$E$13*2", fmt=FMT_SAR, align="center", border=B_ALL)
    put(ws, "C18", "=$E$13*2.5", fmt=FMT_SAR, align="center", border=B_ALL)
    put(ws, "D18", "=$E$13*3", fmt=FMT_SAR, align="center", border=B_ALL)
    put(ws, "E18", "=$E$13*4", fmt=FMT_SAR, align="center", border=B_ALL)
    merge(ws, "F18:I18")
    put(ws, "F18", '="Your total cost for a 50 ml = "&TEXT($E$13,"0.00")&" SAR"', font=F_MUTED, border=B_ALL)

    # --- 4 · batch economics ---
    band(ws, 20, 1, 9, "4 · BATCH ECONOMICS  (50 ml bottles at your target price)")
    econ = [
        (21, "Bottles to sell", 4, FMT_INT, "you can make ~7 × 50 ml — keep some, sell the rest (see Yield & Capacity)"),
        (22, "Revenue ex-VAT (SAR)", "=PR_NSell*$F$13", FMT_SAR, "bottles × retail ex-VAT"),
        (23, "Your cost (SAR)", "=PR_NSell*$E$13", FMT_SAR, "bottles × total cost"),
        (24, "Gross profit (SAR)", "=PR_NSell*($F$13-$E$13)", FMT_SAR, "before VAT, fees, selling costs"),
        (25, "Break-even price / bottle", "=$E$13", FMT_SAR, "sell below this and you lose money"),
    ]
    for r, lbl, val, fmt, note in econ:
        merge(ws, f"A{r}:B{r}")
        put(ws, f"A{r}", lbl, font=F_LABEL_B if r in (24,) else F_LABEL)
        if r == 21:
            input_cell(ws, f"C{r}", val, fmt=fmt)
        else:
            put(ws, f"C{r}", val, font=F_LABEL_B, fill=FILL_IVORY_DK, fmt=fmt, align="center", border=B_ALL)
        merge(ws, f"D{r}:I{r}")
        put(ws, f"D{r}", note, font=F_MUTED)

    # --- 5 · before you sell ---
    band(ws, 27, 1, 9, "5 · BEFORE YOU SELL — PLEASE READ", fill=PatternFill("solid", start_color=RED_TX),
         font=Font(name=ARIAL, size=10, bold=True, color=WHITE))
    notes = [
        "These prices are a COST-PLUS framework, not a valuation. What the market pays is your test — start with people who already love it.",
        "Juice cost here does NOT include packaging until you enter it. Packaging on a luxury 50 ml can easily be 30–80 SAR — get real quotes.",
        "Selling commercially is different from personal use: verify the formula against CURRENT IFRA limits for fine fragrance before ANY sale.",
        "Saudi Arabia: cosmetics for sale generally require SFDA registration, compliant Arabic/English labelling, and an allergen declaration.",
        "VAT in KSA is 15%. If you are VAT-registered you must charge and remit it — the inc-VAT column shows the shelf price.",
        "Keep a batch record (the Production Log) and a retained sample of every batch you sell. Consider product-liability cover.",
    ]
    for i, line in enumerate(notes):
        r = 28 + i
        merge(ws, f"A{r}:I{r}")
        put(ws, f"A{r}", ("•  " + line), font=F_MUTED, wrap=True)
        ws.row_dimensions[r].height = max(16, 14 * (1 + len(line) // 115))

    dv_c = DataValidation(type="decimal", operator="between", formula1="0.02", formula2="0.35")
    dv_d = DataValidation(type="decimal", operator="between", formula1="0.5", formula2="1.2")
    dv_money = DataValidation(type="decimal", operator="between", formula1="0", formula2="100000")
    dv_mult = DataValidation(type="decimal", operator="between", formula1="1", formula2="20")
    dv_vat = DataValidation(type="decimal", operator="between", formula1="0", formula2="0.3")
    dv_n = DataValidation(type="whole", operator="between", formula1="0", formula2="100000")
    for dv in (dv_c, dv_d, dv_money, dv_mult, dv_vat, dv_n):
        ws.add_data_validation(dv)
    dv_c.add("C4")
    dv_d.add("C5")
    dv_money.add("C6")
    dv_mult.add("C7")
    dv_vat.add("C8")
    dv_money.add("C12:C14")
    dv_n.add("C21")

    ws.freeze_panes = "A12"
    name("PR_ConcPct", "'Pricing & Sales'!$C$4")
    name("PR_Density", "'Pricing & Sales'!$C$5")
    name("PR_Labour", "'Pricing & Sales'!$C$6")
    name("PR_Mult", "'Pricing & Sales'!$C$7")
    name("PR_Vat", "'Pricing & Sales'!$C$8")
    name("PR_NSell", "'Pricing & Sales'!$C$21")
    protect(ws)


def build_selling_strategy(wb):
    ws = wb.create_sheet("Selling Strategy")
    ws.sheet_view.showGridLines = False
    ws.sheet_properties.tabColor = GOLD
    widths(ws, {"A": 24, "B": 13, "C": 13, "D": 14, "E": 14, "F": 14, "G": 14,
                "H": 16, "I": 22})
    title_block(ws, 9, "SELLING STRATEGY",
                "Proposed launch pricing and channel plan connected to live cost, yield, VAT, "
                "and scale-up assumptions.", sub_cols=9)

    band(ws, 3, 1, 9, "1 · STRATEGY INPUTS")
    rows = [
        (4, "Launch 50 ml bottles", "=ScaleTargetBottles50", FMT_INT,
         "Default follows the Scale-Up Plan target. Type a smaller launch if you want a soft release."),
        (5, "Samples / testers", "=MIN(8,$C$4)", FMT_INT, "Give only to people likely to buy or influence buyers."),
        (6, "Retailer commission %", 0.35, FMT_PCT1, "Use only if a shop takes a cut."),
        (7, "Launch discount buffer %", 0.10, FMT_PCT1, "Price cushion for bundles, friends, or early buyers."),
        (8, "VAT %", "=PR_Vat", FMT_PCT1, "Linked to Pricing & Sales."),
    ]
    for r, lbl, val, fmt, note in rows:
        merge(ws, f"A{r}:B{r}")
        put(ws, f"A{r}", lbl, font=F_LABEL_B)
        input_cell(ws, f"C{r}", val, fmt=fmt)
        merge(ws, f"D{r}:I{r}")
        put(ws, f"D{r}", note, font=F_MUTED)
    band(ws, 10, 1, 9, "2 · PROPOSED PRICE LADDER")
    header_cells(ws, 11, ["Bottle", "Cost", "Base retail", "Launch price", "Inc VAT",
                          "Profit", "Margin", "Positioning", "Recommendation"])
    pricing_rows = [(12, 30, 12), (13, 50, 13), (14, 100, 14)]
    for r, size, pr_row in pricing_rows:
        put(ws, f"A{r}", f"{size} ml", font=F_LABEL_B, fill=FILL_IVORY_DK, align="center", border=B_ALL)
        put(ws, f"B{r}", f"='Pricing & Sales'!$E${pr_row}", fmt=FMT_SAR, align="center", border=B_ALL)
        put(ws, f"C{r}", f"='Pricing & Sales'!$F${pr_row}", fmt=FMT_SAR, align="center", border=B_ALL)
        put(ws, f"D{r}", f"=CEILING(C{r}*(1+$C$7),10)", font=F_KPI, fill=FILL_GOLD_LT,
            fmt=FMT_SAR, align="center", border=B_ALL)
        put(ws, f"E{r}", f"=D{r}*(1+$C$8)", fmt=FMT_SAR, align="center", border=B_ALL)
        put(ws, f"F{r}", f"=D{r}-B{r}", fmt=FMT_SAR, align="center", border=B_ALL)
        put(ws, f"G{r}", f'=IF(D{r}=0,"",F{r}/D{r})', fmt=FMT_PCT1, align="center", border=B_ALL)
        positioning = "Discovery" if size == 30 else ("Hero SKU" if size == 50 else "Gift / collector")
        recommendation = "Use as entry bottle" if size == 30 else ("Lead with this" if size == 50 else "Limited upsell")
        put(ws, f"H{r}", positioning, font=F_MUTED, align="center", border=B_ALL)
        put(ws, f"I{r}", recommendation, font=F_MUTED, align="center", border=B_ALL)

    band(ws, 16, 1, 9, "3 · CHANNEL PLAN  (50 ml hero bottle)")
    header_cells(ws, 17, ["Channel", "Units", "Price ex-VAT", "Commission", "Net revenue",
                          "Unit cost", "Gross profit", "Action", "Notes"])
    channels = [
        (18, "Private circle", "=MAX($C$4-B19-B20,0)", "=$D$13*(1-$C$7)", 0.0,
         "Start with warm demand; keep it personal."),
        (19, "Samples / testers", "=MIN($C$5,$C$4)", 0.0, 0.0,
         "Only for feedback and proof, not giveaways without intent."),
        (20, "Retail / boutique", "=ROUND(MAX($C$4-B19,0)*0.25,0)", "=$D$13", "=$C$6",
         "Only after IFRA/SFDA/commercial readiness."),
    ]
    for r, channel, units, price, commission, note in channels:
        put(ws, f"A{r}", channel, font=F_LABEL_B, border=B_ALL)
        put(ws, f"B{r}", units, fmt=FMT_INT, align="center", border=B_ALL)
        put(ws, f"C{r}", price, fmt=FMT_SAR, align="center", border=B_ALL)
        put(ws, f"D{r}", commission, fmt=FMT_PCT1 if isinstance(commission, str) else FMT_PCT1,
            align="center", border=B_ALL)
        put(ws, f"E{r}", f"=B{r}*C{r}*(1-D{r})", fmt=FMT_SAR, align="center", border=B_ALL)
        put(ws, f"F{r}", "='Pricing & Sales'!$E$13", fmt=FMT_SAR, align="center", border=B_ALL)
        put(ws, f"G{r}", f"=E{r}-B{r}*F{r}", fmt=FMT_SAR, align="center", border=B_ALL)
        action = "Sell first" if r == 18 else ("Track feedback" if r == 19 else "Defer")
        put(ws, f"H{r}", action, font=F_MUTED, align="center", border=B_ALL)
        put(ws, f"I{r}", note, font=F_MUTED, wrap=True, border=B_ALL)

    band(ws, 23, 1, 9, "4 · GO / NO-GO CHECK")
    checks = [
        "Formula checked against current IFRA before any commercial sale.",
        "SFDA registration, Arabic/English label, allergen declaration, and batch records are ready.",
        "Packaging cost in Pricing & Sales is replaced with real supplier quotes.",
        "At least one macerated batch has passed skin wear testing in Riyadh heat.",
    ]
    for i, line in enumerate(checks):
        r = 24 + i
        merge(ws, f"A{r}:I{r}")
        put(ws, f"A{r}", "□  " + line, font=F_MUTED, wrap=True)

    dv_units = DataValidation(type="whole", operator="between", formula1="0", formula2="100000")
    dv_pct = DataValidation(type="decimal", operator="between", formula1="0", formula2="0.9")
    ws.add_data_validation(dv_units)
    ws.add_data_validation(dv_pct)
    dv_units.add("C4:C5")
    dv_pct.add("C6:C8")
    ws.freeze_panes = "A12"
    name("StrategyLaunchUnits", "'Selling Strategy'!$C$4")
    name("StrategyHeroPrice", "'Selling Strategy'!$D$13")
    protect(ws)


def build_the_scent(wb):
    ws = wb.create_sheet("The Scent")
    ws.sheet_view.showGridLines = False
    ws.sheet_properties.tabColor = GOLD
    widths(ws, {"A": 3, "B": 17, "C": 17, "D": 17, "E": 17, "F": 17, "G": 17, "H": 3})

    merge(ws, "B2:G2")
    put(ws, "B2", "S A M R", font=Font(name=ARIAL, size=26, bold=True, color=CHARCOAL), align="center")
    ws.row_dimensions[2].height = 36
    merge(ws, "B3:G3")
    put(ws, "B3", "Extrait de Parfum 28% · Gourmand Amber Floral · a warm-skin scent",
        font=F_SUB, align="center")
    for col in range(2, 8):
        ws.cell(row=4, column=col).fill = FILL_GOLD
    ws.row_dimensions[4].height = 3

    def para(row, text, italic=False, bold=False, lines=None):
        ws.merge_cells(start_row=row, start_column=2, end_row=row, end_column=7)
        f = Font(name=ARIAL, size=10, italic=italic, bold=bold, color=CHARCOAL)
        put(ws, f"B{row}", text, font=f, wrap=True)
        ws.row_dimensions[row].height = 14 * (lines or (1 + len(text) // 92))

    r = 6
    band(ws, r, 2, 7, "THE NAME"); r += 1
    para(r, "SAMR — سَمَر — comes from Samrae and from the Arabic idea of late-night conversation: "
            "warmth after sunset, closeness, and the voice you want to keep hearing. The brand mark "
            "keeps the name short, intimate, and easy to put on a bottle while still carrying her name "
            "inside it."); r += 2

    band(ws, r, 2, 7, "THE IDEA"); r += 1
    para(r, "SAMR is a private extrait built around warmth on skin: soft fruit at the opening, white "
            "flowers at body temperature, vanilla, tonka, ambergris radiance, velvet woods, and a "
            "five-layer musk trail. The goal is not room-filling noise; it is a close, memorable "
            "signature that feels personal when someone is allowed near."); r += 2

    band(ws, r, 2, 7, "THE OPENING — the first glance"); r += 1
    para(r, "Sun-warmed bergamot and a spark of pink pepper sit over ripe peach skin and raspberry "
            "gloss. Bright, juicy, and playful, the opening lasts long enough to catch attention, then "
            "melts into the warmer heart."); r += 2

    band(ws, r, 2, 7, "THE HEART — the embrace"); r += 1
    para(r, "A cloud of Hedione makes the heart luminous while jasmine and tuberose bring creamy white "
            "flower warmth. Violet-iris powder softens the edges, and benzyl salicylate gives a solar, "
            "skin-in-the-sun glow. This is the center of SAMR: radiant, feminine, and close."); r += 2

    band(ws, r, 2, 7, "THE DRYDOWN — the addiction"); r += 1
    para(r, "The base is where SAMR becomes memorable. A double vanilla — vanillin anchored by its "
            "creamier ethyl echo — melts into tonka and a caramelised-sugar halo, warmed by almond "
            "heliotrope and a single breath of coconut cream. Ambroxan throws its radiant, mineral "
            "ambergris aura for hours; Iso E Super and cashmeran wrap it in velvet wood, sandalwood "
            "glows underneath, and three musks — clean, powdery, intimate — fuse it all to her skin. "
            "The optional glints are plum-rose damascone and a saffron-suede whisper."); r += 2

    band(ws, r, 2, 7, "HOW SHE WEARS IT"); r += 1
    para(r, "Extrait de parfum at 28% — apply low and close: pulse of the wrists, the hollow of the "
            "throat, behind the ears, a touch at the collarbone. One spray in the hair carries the "
            "trail. It blooms with body heat, so the best projection is exactly at conversation "
            "distance — this perfume is not for the room, it is for the person allowed close."); r += 2

    band(ws, r, 2, 7, "NOTES AT A GLANCE"); r += 1
    para(r, "Top: bergamot · pink pepper · peach · raspberry", bold=True, lines=1); r += 1
    para(r, "Heart: jasmine absolute · tuberose · Hedione · violet-iris · solar balsam", bold=True, lines=1); r += 1
    para(r, "Base: double vanilla · tonka & caramel · heliotrope · coconut cream · ambergris · "
            "velvet woods · sandalwood · skin musks · (damascone plum-rose · saffron suede)", bold=True); r += 2
    para(r, "Concentrate = 100% on the Formula Master tab. Weighing, dilutions, maceration and "
            "bottling: Batch Calculator + Process Reference.", italic=True)
    protect(ws)


# -------------------------------------------------------------------- main --
def main():
    wb = Workbook()
    wb.remove(wb.active)

    build_lists(wb)
    build_formula_master(wb)
    build_batch_calculator(wb)
    build_dilution_prep(wb)
    build_inventory(wb)
    build_production_log(wb)
    build_maceration(wb)
    build_cost_analysis(wb)
    build_yield_capacity(wb)
    build_scale_up_plan(wb)
    build_pricing(wb)
    build_selling_strategy(wb)
    build_process_reference(wb)
    build_safety(wb)
    build_the_scent(wb)
    build_dashboard(wb)

    for nm, ref in NAMES:
        wb.defined_names[nm] = DefinedName(nm, attr_text=ref)

    order = ["Dashboard", "The Scent", "Formula Master", "Batch Calculator", "Dilution Prep (D10)",
             "Inventory", "Production Log", "Maceration Tracker", "Cost Analysis",
             "Yield & Capacity", "Scale-Up Plan", "Pricing & Sales", "Selling Strategy",
             "Process Reference", "Safety Notes", "Lists"]
    wb._sheets = [wb[n] for n in order]
    wb.active = 0

    wb.calculation.fullCalcOnLoad = True
    wb.properties.title = "SAMR Production Suite"
    wb.properties.creator = "SAMR"
    fixed = datetime.datetime(2026, 1, 1)
    wb.properties.created = fixed
    wb.properties.modified = fixed

    wb.save(OUT)
    print(f"written: {OUT}  ({len(NAMES)} named ranges)")

    # optional: cache computed values via Excel so every distributed copy opens populated
    try:
        import os
        import subprocess
        ps1 = os.path.join(os.path.dirname(os.path.abspath(__file__)), "tools", "excel_recalc.ps1")
        r = subprocess.run(["powershell.exe", "-NoProfile", "-ExecutionPolicy", "Bypass",
                            "-File", ps1, "-Path", os.path.abspath(OUT)],
                           capture_output=True, text=True, timeout=300)
        print("recalc:", "ok" if "RECALC_OK" in r.stdout else "skipped (Excel unavailable)")
    except Exception as e:
        print(f"recalc skipped: {e}")

    try:
        import distribute
        distribute.main()
    except Exception as e:
        print(f"distribute skipped: {e}")


if __name__ == "__main__":
    main()

