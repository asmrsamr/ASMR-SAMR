from pathlib import Path

from docx import Document
from docx.enum.table import WD_CELL_VERTICAL_ALIGNMENT
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Inches, Pt, RGBColor


OUT = Path("SAMR Preparation Guide.docx")


BLUE = RGBColor(46, 116, 181)
DARK = RGBColor(45, 45, 45)
MUTED = RGBColor(90, 90, 90)
FILL = "E8EEF5"
GOLD_FILL = "F7E8BC"


def set_font(run, size=11, bold=False, italic=False, color=DARK, name="Calibri"):
    run.font.name = name
    run._element.rPr.rFonts.set(qn("w:ascii"), name)
    run._element.rPr.rFonts.set(qn("w:hAnsi"), name)
    run._element.rPr.rFonts.set(qn("w:cs"), name)
    run.font.size = Pt(size)
    run.bold = bold
    run.italic = italic
    run.font.color.rgb = color


def shade_cell(cell, fill):
    tc_pr = cell._tc.get_or_add_tcPr()
    shd = OxmlElement("w:shd")
    shd.set(qn("w:fill"), fill)
    tc_pr.append(shd)


def set_cell_text(cell, text, bold=False, fill=None):
    cell.text = ""
    p = cell.paragraphs[0]
    p.paragraph_format.space_after = Pt(0)
    run = p.add_run(str(text))
    set_font(run, size=9.5, bold=bold, color=DARK)
    cell.vertical_alignment = WD_CELL_VERTICAL_ALIGNMENT.CENTER
    if fill:
        shade_cell(cell, fill)


def add_heading(doc, text, level=1):
    p = doc.add_paragraph(style=f"Heading {level}")
    p.paragraph_format.space_before = Pt(14 if level == 1 else 10)
    p.paragraph_format.space_after = Pt(6)
    run = p.add_run(text)
    set_font(run, size=16 if level == 1 else 13, bold=True, color=BLUE)
    return p


def add_para(doc, text, bold=False, italic=False):
    p = doc.add_paragraph()
    p.paragraph_format.space_after = Pt(6)
    p.paragraph_format.line_spacing = 1.25
    run = p.add_run(text)
    set_font(run, bold=bold, italic=italic)
    return p


def add_bullet(doc, text):
    p = doc.add_paragraph(style="List Bullet")
    p.paragraph_format.space_after = Pt(4)
    p.paragraph_format.line_spacing = 1.25
    run = p.add_run(text)
    set_font(run)


def add_number(doc, text):
    p = doc.add_paragraph(style="List Number")
    p.paragraph_format.space_after = Pt(4)
    p.paragraph_format.line_spacing = 1.25
    run = p.add_run(text)
    set_font(run)


def add_table(doc, headers, rows, widths=None):
    table = doc.add_table(rows=1, cols=len(headers))
    table.style = "Table Grid"
    table.autofit = False
    for i, header in enumerate(headers):
        set_cell_text(table.rows[0].cells[i], header, bold=True, fill=FILL)
    for row in rows:
        cells = table.add_row().cells
        for i, value in enumerate(row):
            set_cell_text(cells[i], value)
    if widths:
        for row in table.rows:
            for i, width in enumerate(widths):
                row.cells[i].width = Inches(width)
    doc.add_paragraph().paragraph_format.space_after = Pt(2)
    return table


def build():
    doc = Document()
    section = doc.sections[0]
    section.top_margin = Inches(1)
    section.bottom_margin = Inches(1)
    section.left_margin = Inches(1)
    section.right_margin = Inches(1)

    styles = doc.styles
    normal = styles["Normal"]
    normal.font.name = "Calibri"
    normal.font.size = Pt(11)
    normal.paragraph_format.space_after = Pt(6)
    normal.paragraph_format.line_spacing = 1.25

    title = doc.add_paragraph()
    title.alignment = WD_ALIGN_PARAGRAPH.CENTER
    title.paragraph_format.space_after = Pt(4)
    run = title.add_run("SAMR سَمَر Preparation Guide")
    set_font(run, size=24, bold=True, color=DARK)

    subtitle = doc.add_paragraph()
    subtitle.alignment = WD_ALIGN_PARAGRAPH.CENTER
    subtitle.paragraph_format.space_after = Pt(16)
    run = subtitle.add_run("Extrait de Parfum production, scale-up, and selling readiness")
    set_font(run, size=12, italic=True, color=MUTED)

    add_heading(doc, "Name Decision", 1)
    add_para(doc, "Recommendation: use SAMR سَمَر. It comes from Samrae and also means late-night conversation, which fits the warm, intimate skin-scent direction.")
    add_table(
        doc,
        ["Option", "Arabic", "Use case"],
        [
            ["SAMR", "سَمَر", "Primary recommendation: short, modern, Arabic-rooted."],
            ["SAMRA", "سمراء", "Most direct link to Samrae; personal and feminine."],
            ["RAE", "راي", "Minimal international mark; less Arabic feeling."],
            ["SAMRAE 37", "سمراء 37", "Full dedication; more explicit and premium."],
            ["MARAE", "ماراي", "Abstract luxury name derived from Samrae."],
        ],
        widths=[1.35, 1.2, 3.8],
    )

    add_heading(doc, "Production Target", 1)
    add_para(doc, "The SAMR workbook now includes a Scale-Up Plan tab. Its default target is the maximum 50 ml extrait output supported by current alcohol stock.")
    add_table(
        doc,
        ["Metric", "Current workbook value"],
        [
            ["Current bottleneck", "Iso E Super"],
            ["Current max output", "About 7 x 50 ml extrait bottles"],
            ["Scale-up target", "132 x 50 ml extrait bottles"],
            ["Target concentrate", "About 1,653.47 g"],
            ["Alcohol required", "About 4,039.20 g"],
            ["Extra packs flagged", "92 packs across shortage rows"],
            ["Estimated added materials cost", "About SAR 3,090.95"],
        ],
        widths=[2.4, 3.9],
    )
    add_para(doc, "Buy the red rows in Scale-Up Plan first. Once those shortages are covered, alcohol becomes the production ceiling.")

    add_heading(doc, "Before You Start", 1)
    add_para(doc, "Prepare the workspace before opening any aroma material. The goal is to make the batch calmly, with one clean chain of custody from formula to bottle.")
    for item in [
        "Use a calibrated 0.01 g scale, clean glass beakers, pipettes, amber glass storage, labels, gloves, and ventilation.",
        "Weigh in grams only. Do not count drops.",
        "Use Bergamot Accord for on-skin products.",
        "Use one amber material only: Ambroxan in this formula.",
        "Damascone Beta, Maltol, Pink Peppercorn, and Aldehyde C-18 Coconut are prepared and weighed as D10 where shown.",
        "Verify the formula against current IFRA before any commercial sale.",
    ]:
        add_bullet(doc, item)
    add_table(
        doc,
        ["Station", "What to place there", "Why it matters"],
        [
            ["Scale station", "Scale, weigh boats/beaker, pipettes, alcohol wipes", "Keeps every weighing repeatable and clean."],
            ["Formula station", "Printed Batch Calculator, pen, tick boxes", "You tick each material only after it is weighed."],
            ["Dilution station", "D10 bottles, DPG, labels", "D10 materials are easy to overdose if handled casually."],
            ["Maceration station", "Amber bottle, batch label, storage box", "The finished dilution needs dark, cool, stable storage."],
        ],
        widths=[1.45, 2.35, 2.55],
    )

    add_heading(doc, "D10 Dilution Prep", 1)
    add_para(doc, "D10 means a 10% dilution in DPG. For any D10 material:")
    add_para(doc, "X g of D10 = 0.1X g neat material + 0.9X g DPG", bold=True)
    add_para(doc, "Example: if the Batch Calculator asks for 0.30 g of D10, weigh 0.30 g of the prepared dilution. That 0.30 g contains 0.03 g neat material and 0.27 g DPG.")
    add_table(
        doc,
        ["Material", "Default D10 batch", "Neat", "DPG"],
        [
            ["Pink Peppercorn", "10.00 g", "1.00 g", "9.00 g"],
            ["Damascone Beta", "10.00 g", "1.00 g", "9.00 g"],
            ["Maltol (Crystals)", "10.00 g", "1.00 g", "9.00 g"],
            ["Aldehyde C-18 Coconut", "10.00 g", "1.00 g", "9.00 g"],
        ],
        widths=[2.2, 1.35, 1.2, 1.2],
    )

    add_heading(doc, "Concentrate Build", 1)
    add_para(doc, "Make the concentrate first. Do not add alcohol during the material-weighing stage. The concentrate should become one uniform blend before dilution.")
    for step in [
        "Open the workbook, set the desired format, size, concentration, density, and optional-material toggle.",
        "Print the Batch Calculator sheet. Write the batch ID on the printed page and on the empty concentrate bottle before weighing.",
        "Place the empty concentrate vessel on the scale and tare to 0.00 g.",
        "Weigh BASE materials first, then HEART, then TOP. Tare after each material and tick the printed line immediately.",
        "For D10 materials, weigh the D10 dilution amount shown by the calculator, not the neat-material amount.",
        "For crystalline materials, swirl patiently and allow complete dissolution before adding alcohol later.",
        "After the final top note, cap the concentrate and roll/swirling mix for one minute. Do not shake violently if it introduces bubbles.",
        "Rest the concentrate 24-48 hours before alcohol dilution. This short marriage makes the dilution smoother.",
        "Label the concentrate with brand, batch ID, formula version, date, optional status, and total concentrate grams.",
    ]:
        add_number(doc, step)
    add_table(
        doc,
        ["Order", "Materials", "Handling note"],
        [
            ["1. BASE", "Vanilla, tonka/coumarin, musks, woods, Ambroxan, Iso E Super", "Heavy materials define the drydown. Give crystals time to dissolve."],
            ["2. HEART", "Hedione, jasmine, tuberose, ionones, benzyl salicylate, linalool", "This is the body of the perfume; keep the beaker covered between additions."],
            ["3. TOP", "Bergamot, pepper, peach, raspberry", "Volatile materials go last so less is lost to air."],
        ],
        widths=[1.0, 3.2, 2.1],
    )

    add_heading(doc, "Dilution, Maceration, and Bottling", 1)
    for step in [
        "Set the final concentration. SAMR defaults to 28% extrait; 50 ml at density 0.85 g/ml equals 42.5 g finished perfume.",
        "Calculate alcohol from the Batch Calculator. For 50 ml extrait at 28%, the workbook target is 11.9 g concentrate and 30.6 g alcohol.",
        "Add alcohol slowly down the side of the vessel, cap, then roll the bottle until the blend is visually uniform.",
        "Log the batch immediately in Production Log: date, batch ID, format, size, concentration, concentrate grams, alcohol grams, maceration start, and status.",
        "Macerate 4-8 weeks in a dark, cool place. Two weeks is the minimum; six weeks is the standard target.",
        "During week one, swirl once daily. After that, leave it alone unless checking clarity.",
        "If haze or sediment appears, cold crash 24-48 hours, then filter using a clean perfume-safe filter setup.",
        "Bottle by weight, not by eye. For 50 ml at 0.85 g/ml, fill to 42.5 g finished perfume.",
        "Record bottle count and retained sample. Keep one retained sample from every batch, especially if any bottles are sold.",
        "Because the workbook is dynamic, changing pack count or pack size updates Inventory, Yield & Capacity, Scale-Up Plan, and Selling Strategy.",
    ]:
        add_number(doc, step)

    add_heading(doc, "Selling Readiness", 1)
    add_para(doc, "The Selling Strategy tab proposes launch prices from live cost data. Current 50 ml hero pricing defaults to about SAR 270 ex-VAT and SAR 310.50 inc-VAT after the launch buffer.")
    for item in [
        "Replace packaging costs with real supplier quotes before using the prices.",
        "Keep private-circle sales first; use samples only where feedback or conversion is likely.",
        "Do not use retail/boutique channels until IFRA, SFDA, label, allergen, and VAT readiness are complete.",
        "Keep one retained sample and full batch record for every batch sold.",
    ]:
        add_bullet(doc, item)

    add_heading(doc, "Safety Checklist", 1)
    for item in [
        "Patch-test every finished product.",
        "Alcohol is flammable: work ventilated, away from flame or heat.",
        "Water-containing products need broad-spectrum preservative.",
        "Leave-on creams are stricter than fine fragrance; keep fragrance at or below 1.2%.",
        "Store raw materials dark, cool, and tightly closed.",
    ]:
        add_bullet(doc, item)

    doc.save(OUT)
    print(OUT)


if __name__ == "__main__":
    build()
