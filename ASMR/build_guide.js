// ASMR — generates "ASMR Perfume - Master Method.docx"
// Run:  $env:NODE_PATH=(npm root -g); node build_guide.js
const fs = require("fs");
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  AlignmentType, LevelFormat, TableOfContents, HeadingLevel, BorderStyle,
  WidthType, ShadingType, PageBreak, Header, Footer, PageNumber,
} = require("docx");

const CHARCOAL = "3B3531", GOLD = "9C7B3C", MUTED = "6E6558", IVORY = "F5EFE3", GOLDLT = "EBDFC6", RED = "A93226";
const CW = 9026; // A4 content width with 1" margins

// ---------- helpers -------------------------------------------------------
const R = (text, opts = {}) => new TextRun({ text, font: "Arial", size: 22, color: CHARCOAL, ...opts });
const P = (children, opts = {}) =>
  new Paragraph({ children: Array.isArray(children) ? children : [R(children)], spacing: { after: 120 }, ...opts });
const H1 = (t) => new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun({ text: t, font: "Arial" })] });
const H2 = (t) => new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun({ text: t, font: "Arial" })] });
const bullet = (t, ref = "bullets") =>
  new Paragraph({ numbering: { reference: ref, level: 0 }, spacing: { after: 80 },
    children: [R(t)] });
const step = (t) =>
  new Paragraph({ numbering: { reference: "steps", level: 0 }, spacing: { after: 100 }, children: [R(t)] });

const border = { style: BorderStyle.SINGLE, size: 1, color: "CBBFa8" };
const borders = { top: border, bottom: border, left: border, right: border };
const cell = (content, w, opts = {}) => new TableCell({
  borders, width: { size: w, type: WidthType.DXA },
  margins: { top: 60, bottom: 60, left: 100, right: 100 },
  shading: opts.fill ? { fill: opts.fill, type: ShadingType.CLEAR } : undefined,
  children: [new Paragraph({ alignment: opts.align, children: [R(String(content), { size: opts.size || 20, bold: opts.bold, color: opts.color || CHARCOAL, italics: opts.italics })] })],
});
const hcell = (t, w) => cell(t, w, { fill: CHARCOAL, color: "FFFFFF", bold: true, size: 19 });
const mkTable = (widths, headerRow, rows) => new Table({
  width: { size: CW, type: WidthType.DXA }, columnWidths: widths,
  rows: [
    new TableRow({ tableHeader: true, children: headerRow.map((h, i) => hcell(h, widths[i])) }),
    ...rows,
  ],
});
const goldRule = () => new Paragraph({
  border: { bottom: { style: BorderStyle.SINGLE, size: 8, color: GOLD, space: 1 } },
  spacing: { after: 200 }, children: [],
});
const noteBox = (label, text, color = GOLD) => new Table({
  width: { size: CW, type: WidthType.DXA }, columnWidths: [CW],
  rows: [new TableRow({ children: [new TableCell({
    borders: { top: { style: BorderStyle.SINGLE, size: 12, color }, bottom: { style: BorderStyle.SINGLE, size: 12, color },
      left: { style: BorderStyle.SINGLE, size: 24, color }, right: { style: BorderStyle.SINGLE, size: 12, color } },
    width: { size: CW, type: WidthType.DXA }, shading: { fill: IVORY, type: ShadingType.CLEAR },
    margins: { top: 120, bottom: 120, left: 160, right: 160 },
    children: [
      new Paragraph({ children: [R(label, { bold: true, size: 20, color })] }),
      new Paragraph({ children: [R(text, { size: 20 })] }),
    ],
  })] })],
});

// ---------- data: master concentrate (59.5 g = 5 × 50 ml bottles) ---------
const BASE = [
  ["1", "Iso E Super", "8.93", "neat", "Thin, transparent, pours fast — approach the target in stages. This is the canvas everything sits on."],
  ["2", "Amberxan (Ambroxan)", "4.76", "neat — CRYSTALS", "White crystals. Add second, right onto the Iso E Super, so it has maximum time to dissolve. It will fully dissolve during the marriage."],
  ["3", "Cashmeran IFF", "1.49", "neat", "Slightly viscous — give the pipette time to drain, don't rush the last drop."],
  ["4", "Sandal Spicatum Australia", "2.38", "neat", "The natural sandalwood. Smell it once from the bottle — learn what it contributes."],
  ["5", "Sandalore (Givaudan)", "1.79", "neat", "Easy pour. Builds the creamy sandal body with the EO."],
  ["6", "Javanol — OPTIONAL", "0.30", "10% dilution", "Weigh the DILUTION, not the neat. Extremely powerful — the dilution keeps it controllable."],
  ["7", "Globalide (Habanolide)", "3.87", "neat", "Can turn waxy/solid in cool rooms — warm the closed bottle in your hands or a 35 °C water bath until liquid."],
  ["8", "Helvetolide", "2.98", "neat", "Easy pour, fruity-musky. Part of the five-musk trail."],
  ["9", "Ambrettolide (Givaudan)", "1.49", "neat", "Seamless skin musk — you will barely smell it alone; trust the formula."],
  ["10", "Ethylene Brassylate", "2.08", "neat — THICK", "Syrupy. Pour patiently; let the stream thin out before the target and finish drop by drop."],
  ["11", "Exaltolide Total (Firmenich)", "1.19", "neat", "Warm, intimate musk. Some people are partially anosmic to single musks — the blend covers this."],
  ["12", "Cedarwood Virginia", "1.19", "neat", "Thin oil, easy. The dry backbone."],
  ["13", "Vetyveryle Acetate", "0.30", "neat — tiny", "Small amount: use a clean fine pipette and add drop by drop. Overshooting 0.1 g here is a real formula change."],
  ["14", "Safraleine", "0.60", "10% dilution", "Weigh the dilution. Adds the saffron-leather glint deep in the base."],
];
const HEART = [
  ["15", "Hedione (Firmenich)", "11.90", "neat", "The biggest single pour and the radiance engine. Thin liquid, fast pour — but it's 20% of the formula, so land it accurately."],
  ["16", "Orange Blossom Tunisia Absolute", "1.49", "neat — THICK", "Your most precious material. Stand the closed bottle in a 35–40 °C water bath for 10 minutes first so it flows. Zero waste: let the pipette drain fully back into the beaker."],
  ["17", "Methyl Alpha Ionone Iso", "2.38", "neat", "Powdery orris-violet velvet. Easy pour."],
  ["18", "Irone Alpha — OPTIONAL", "0.60", "10% dilution", "The luxury signature of the heart. Weigh the dilution. If you excluded optionals in the workbook, skip and use the recalculated sheet."],
  ["19", "Benzyl Salicylate", "1.79", "neat — viscous", "Almost odorless alone — it is a blender that makes everything else seamless. Trust it."],
  ["20", "Linalool", "0.60", "neat", "Fresh floral smoothing. Known allergen to declare if you ever sell."],
];
const TOP = [
  ["21", "Bergamot Accord", "5.36", "neat", "Bright and volatile — this is why TOP is weighed last. Work briskly, close the beaker between pours."],
  ["22", "Petitgrain Paraguay", "0.89", "neat", "Green-bitter citrus leaf. Easy pour."],
  ["23", "Neroli Accord", "0.60", "neat", "Orange-flower lift."],
  ["24", "Pink Peppercorn", "0.30", "10% dilution", "Weigh the dilution — a rosy-spicy glint, not a pepper bomb."],
  ["25", "Floralozone", "0.30", "10% dilution", "The 'clean air' note. Powerful; the dilution is the control."],
];
const ingTable = (rows) => mkTable(
  [500, 2400, 1000, 1600, 3526],
  ["#", "Ingredient", "Weigh (g)", "Form", "Handling & the trick"],
  rows.map((r, i) => new TableRow({ children: [
    cell(r[0], 500, { align: AlignmentType.CENTER, fill: i % 2 ? undefined : IVORY }),
    cell(r[1], 2400, { bold: true, fill: i % 2 ? undefined : IVORY }),
    cell(r[2], 1000, { align: AlignmentType.CENTER, bold: true, fill: i % 2 ? undefined : IVORY }),
    cell(r[3], 1600, { align: AlignmentType.CENTER, fill: i % 2 ? undefined : IVORY, italics: true }),
    cell(r[4], 3526, { fill: i % 2 ? undefined : IVORY }),
  ] })),
);

const D10 = [
  ["Pink Peppercorn", "1.0", "9.0"], ["Floralozone", "1.0", "9.0"], ["Safraleine", "1.0", "9.0"],
  ["Irone Alpha (optional)", "1.0", "9.0"], ["Javanol (optional)", "1.0", "9.0"],
];
const FILL = [
  ["10 ml", "8.5 g", "travel / tester"], ["20 ml", "17.0 g", "gifts"],
  ["30 ml", "25.5 g", "compact daily bottle"], ["50 ml", "42.5 g", "the signature size"],
  ["70 ml", "59.5 g", "generous personal bottle"], ["100 ml", "85.0 g", "grand format"],
];
const TROUBLE = [
  ["Juice is cloudy after dilution", "Waxes/insolubles from naturals (normal)", "Finish maceration, cold-crash 24 h at 4 °C, filter cold. Repeat once if needed."],
  ["Smells harsh / alcoholic in week 1", "It is simply young", "Do nothing. This is what weeks 2–6 are for. Judge nothing before week 4."],
  ["Top notes feel dull after months", "Oxidation from air in the bottle", "Store cool and dark; keep maceration vessels filled to the shoulder; decant to smaller bottles as levels drop."],
  ["A material won't pour", "Viscous or crystallized (Globalide, absolutes)", "Water bath 35–40 °C for 10 minutes. Never microwave, never open flame."],
  ["Overshot a weight by a lot", "Poured too fast", "Do NOT scoop back (contamination). Note the actual gram weight, then scale every remaining ingredient up proportionally — the workbook % column is your map."],
  ["Scent too intimate, want more presence", "Style, not fault", "This is a skin-scent by design. To push projection, a future version can raise Bergamot Accord + Hedione slightly — change one variable per batch."],
];

// ---------- document ------------------------------------------------------
const children = [
  // cover
  new Paragraph({ spacing: { before: 2400, after: 0 }, alignment: AlignmentType.CENTER,
    children: [R("A U R A · 3 7", { size: 72, bold: true })] }),
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 60 },
    children: [R("THE MASTER METHOD", { size: 32, bold: true, color: GOLD })] }),
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 2000 },
    children: [R("Extrait de Parfum 28% · the complete art, step by step, ingredient by ingredient", { size: 22, italics: true, color: MUTED })] }),
  new Paragraph({ alignment: AlignmentType.CENTER,
    children: [R("One master batch. One maceration. Five identical bottles.", { size: 24, color: CHARCOAL })] }),
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 200 },
    children: [R("Companion to the ASMR Production Suite workbook", { size: 18, color: MUTED })] }),
  new Paragraph({ children: [new PageBreak()] }),

  H1("Contents"),
  new TableOfContents("Contents", { hyperlink: true, headingStyleRange: "1-2" }),
  new Paragraph({ children: [new PageBreak()] }),

  // 1
  H1("1 · The Idea and the Method"),
  goldRule(),
  P("ASMR is a luxury skin scent: it does not shout across a hall — it makes a room notice, and it stays after you leave. Transparent jasmine radiance (Hedione) spreads it; a woody-amber halo (Iso E Super + Ambroxan) and a five-musk accord keep saying “still here” on skin, on collars, in the room."),
  P([R("The method in this book is the "), R("master batch", { bold: true }), R(" — what perfume houses call the mother juice. You weigh the concentrate ONCE for the whole production run, marry and macerate it in ONE vessel, and only divide it into bottles at the very end.")]),
  H2("Why the master batch makes a better perfume, not just a faster one"),
  bullet("Accuracy: your smallest ingredient jumps from 0.06 g (one bottle) to 0.30 g (master) — a 0.01 g scale error falls from 17% of the pour to 3%. The tiny materials are exactly where accuracy matters most."),
  bullet("Identity: every bottle comes from the same liquid — bottle 5 is identical to bottle 1. That consistency IS a signature scent."),
  bullet("One maceration, one story: the whole run ages together in one vessel, so there is one quality to judge, one batch record, one filtration."),
  bullet("Less loss: beaker walls, pipettes and filters steal a fixed amount whether you make 12 g or 60 g. Making it once, you pay that tax once."),
  noteBox("QUALITY VERDICT", "Dividing after maceration does not harm the perfume in any way — liquid is liquid. The only real risk of a large batch is air sitting above it for weeks, and Stage 4 solves that with one rule: vessels filled to the shoulder."),

  // 2
  H1("2 · Before You Begin"),
  goldRule(),
  H2("The bench"),
  bullet("Scale reading 0.01 g (calibrate with its test weight; let it warm up 10 minutes; shield it from drafts and phone fans)."),
  bullet("Two clean glass beakers (100–150 ml) + one amber glass bottle ~250 ml for maceration (the master fills it to the shoulder — perfect)."),
  bullet("Disposable glass or PP pipettes — ideally one per ingredient. Never let rubber bulbs touch the liquids."),
  bullet("Small funnel, coffee filters (or 0.45 µm), nitrile gloves, eye protection, paper smelling strips, labels and a fine marker."),
  bullet("Ventilated space, no open flame anywhere (190-proof alcohol), a fridge with room for the vessel later."),
  H2("The materials check"),
  P("Your current inventory covers exactly one full master batch. One number deserves attention: the master needs 8.93 g of Iso E Super and you own ~9.0 g — a 0.07 g margin. One spilled pipette ends the batch."),
  noteBox("CHEAP INSURANCE — 13.60 SAR", "Order one spare 10 ml Iso E Super before you begin. It is the least expensive material in the base and the single point of failure of this batch. (While ordering: a second Bergamot Accord, 18.75 SAR, unlocks the NEXT master batch — see the workbook's Yield & Capacity tab.)"),
  H2("The sanitation ritual"),
  step("Wash beakers, funnel and the maceration bottle with hot water and unscented soap; rinse thoroughly."),
  step("Rinse with a splash of your perfumer's alcohol; drain upside-down until fully dry. Alcohol residue is fine — water residue is not."),
  step("Wipe the bench, lay out ingredients in weighing order (the printed Batch Sheet is the order), caps loosened but on."),

  // 3
  H1("3 · The Golden Rules"),
  goldRule(),
  bullet("Grams, never drops. Drop size changes with viscosity and pipette; grams are forever reproducible."),
  bullet("Weigh in the printed order (BASE → HEART → TOP) and tick every line. The order protects volatile notes and builds the accord bottom-up."),
  bullet("Record the ACTUAL weight you landed, next to the target, on the printed sheet. Your real formula is what you actually weighed."),
  bullet("Never pour excess back into a stock bottle — contamination ruins stock forever. Small overshoots stay in the batch (see Troubleshooting for big ones)."),
  bullet("One pipette per ingredient, or wash and dry between. Cross-contamination is invisible until it isn't."),
  bullet("Change one variable per batch — one ingredient, one percentage, one time. Otherwise you learn nothing."),
  bullet("Label everything the moment liquid enters glass: ASMR · content · strength · date · batch."),
  bullet("Patience is an ingredient. The formula is 25 materials; the 26th is six weeks of silence in a dark cupboard."),

  // 4
  H1("4 · Stage 0 — The D10 Dilutions (one day ahead)"),
  goldRule(),
  P("Five ingredients are too concentrated to weigh sanely at master-batch scale, so they enter the formula as 10% solutions in DPG. Prepare them at least 24 hours before the master so they are fully homogeneous."),
  mkTable([3200, 1400, 1400, 3026], ["Material", "Neat (g)", "DPG (g)", "Result"],
    D10.map((d, i) => new TableRow({ children: [
      cell(d[0], 3200, { bold: true, fill: i % 2 ? undefined : IVORY }),
      cell(d[1], 1400, { align: AlignmentType.CENTER, fill: i % 2 ? undefined : IVORY }),
      cell(d[2], 1400, { align: AlignmentType.CENTER, fill: i % 2 ? undefined : IVORY }),
      cell("10 g of 10% solution", 3026, { fill: i % 2 ? undefined : IVORY }),
    ] }))),
  P(""),
  step("Tare a clean 12–15 ml bottle. Weigh the NEAT material first (1.00 g), then add DPG to 10.00 g total."),
  step("Cap and shake a full minute. Label: ASMR · [material] · 10% in DPG · date."),
  step("Trick: if you overshoot the neat (say 1.13 g), don't fight it — just add 9× that weight of DPG (10.17 g total). The ratio is what matters."),
  P("Dilutions keep 12+ months in the dark. Log them on the workbook's Dilution Prep tab."),

  // 5
  H1("5 · Stage 1 — Weighing the Master Concentrate (59.5 g)"),
  goldRule(),
  P([R("Print the Batch Sheet first: Batch Calculator → Extrait de Parfum → 250 ml → 28%. It shows this exact table with live checkboxes. Targets below are for the full five-bottle master ("), R("59.5 g concentrate", { bold: true }), R("); land each within ±0.05 g and the checksum will forgive you.")]),
  H2("The weighing technique"),
  bullet("Set the beaker on the scale, TARE, pour ingredient #1 to target, record actual, TARE again, next ingredient. One beaker, twenty-five tares."),
  bullet("Approach every target from below: pour to ~90%, then finish in drops. You can always add; you can never remove."),
  bullet("Close each stock bottle immediately — before you reach for the next. This one habit prevents both oxidation and knocked-over bottles."),
  H2("BASE — the foundation (weigh first)"),
  ingTable(BASE),
  P(""),
  H2("HEART — the character"),
  ingTable(HEART),
  P(""),
  H2("TOP — the first impression (weigh last)"),
  ingTable(TOP),
  P(""),
  noteBox("CHECKSUM", "Total on the scale: 59.50 g target (±0.10 g is acceptable; the rounded line items sum to 59.55). Stir gently 2–3 minutes with a clean glass rod until visually uniform. If you excluded the optionals, print the renormalised Batch Sheet — the workbook recalculates every line to keep the concentrate at exactly 100%."),

  // 6
  H1("6 · Stage 2 — The Marriage (24–48 hours)"),
  goldRule(),
  P("Cap the beaker (or transfer to a small bottle — less air) and rest it 24–48 hours in the dark. Perfumers call this marrying: the raw materials begin bonding into one accord before alcohol arrives. Skip it and the perfume still forms — but the blend enters the alcohol as 25 strangers instead of a family."),
  bullet("Check the Amberxan: the liquid must be completely clear, no crystals at the bottom, before Stage 3. If crystals remain, swirl and give it 12 more hours."),
  bullet("Smell the neat concentrate on a strip now and write down your impression — this is your reference point for everything that follows."),

  // 7
  H1("7 · Stage 3 — Dilution to Extrait (28%)"),
  goldRule(),
  P([R("Weigh "), R("153.0 g of alcohol", { bold: true }), R(" (190-proof SDA 40B) INTO the concentrate — always alcohol into concentrate, never the reverse; the first drops of a backwards pour shock-dilute unevenly. Total juice: "), R("212.5 g ≈ 250 ml", { bold: true }), R(" — your five 50 ml bottles plus nothing wasted.")]),
  step("Pour the concentrate into the ~250 ml amber maceration bottle via the funnel; rinse the beaker with a first splash of the weighed alcohol and pour that in too (zero loss)."),
  step("Add the remaining alcohol, cap tightly, invert gently ten times. No water in this formula — 190-proof needs none and clarity stays perfect."),
  step("Label the vessel: ASMR · Extrait 28% · MASTER 001 · [date]. Log it in the Production Log (concentrate 59.5 g, alcohol 153 g)."),

  // 8
  H1("8 · Stage 4 — Maceration (4–8 weeks, the patient stage)"),
  goldRule(),
  P("Store the vessel dark and cool (a cupboard, 15–25 °C, never sunlight). The bottle should be filled to the shoulder — minimal air means no oxidation over the weeks. This is the master batch's only demand."),
  bullet("Week 1: swirl gently once a day. The juice may look slightly hazy — ignore it."),
  bullet("Week 2: first strip test. Alcohol bite fading, top notes loud, base still shy."),
  bullet("Week 4: the ready window opens (the workbook's Maceration Tracker turns green). The musks and woods have knitted; the scent is wearable."),
  bullet("Week 6 (the default target): noticeably deeper drydown. At 28% these extra weeks are where the extrait earns its name."),
  bullet("Week 8: past this point improvement flattens — bottle it."),
  P("Write one line in a journal at every smell check: date, three words, one number out of ten. In a year this journal is your perfumery education."),

  // 9
  H1("9 · Stage 5 — Cold Crash and Filtration"),
  goldRule(),
  step("Place the whole vessel in the fridge (~4 °C) for 24 hours. Natural waxes (sandalwood EO, orange blossom absolute) clump and drop out at cold temperature."),
  step("Filter COLD, in one pass, through a coffee filter (or 0.45 µm) into a clean dry vessel. Work reasonably quickly — condensation is the only enemy here."),
  step("Admire it: the juice should be jewel-clear. If any haze survives, repeat the crash-and-filter once."),

  // 10
  H1("10 · Stage 6 — Division into Bottles"),
  goldRule(),
  P("Now the answer to the production question: divide by WEIGHT, not by eye. Set each empty bottle on the scale, tare, and fill through the funnel to its gram target:"),
  mkTable([2200, 2200, 4626], ["Bottle size", "Fill weight (juice)", "Suggested use"],
    FILL.map((f, i) => new TableRow({ children: [
      cell(f[0], 2200, { align: AlignmentType.CENTER, bold: true, fill: i % 2 ? undefined : IVORY }),
      cell(f[1], 2200, { align: AlignmentType.CENTER, bold: true, fill: i % 2 ? undefined : IVORY }),
      cell(f[2], 4626, { fill: i % 2 ? undefined : IVORY }),
    ] }))),
  P(""),
  bullet("The 212.5 g master = five 50 ml bottles, or any mix summing to ≤212 g (e.g. three 50 ml + two 30 ml + one 10 ml tester)."),
  bullet("For spray bottles, fill to the shoulder, never the brim — the atomiser tube needs headspace."),
  bullet("Keep a 5–10 ml retained sample of every batch, labelled and dated. It is your reference, your proof, and your comparison for batch 002."),
  bullet("Label every bottle: ASMR · Extrait de Parfum 28% · batch · date. Then set the batch to 'Bottled' in the Production Log."),

  // 11
  H1("11 · Evaluating Like a Perfumer"),
  goldRule(),
  bullet("Strips first, skin second: spray one strip, write the time on it, and smell at 5 minutes (top), 45 minutes (heart), 4 hours and next morning (drydown)."),
  bullet("On skin: one spray on the inner forearm after a patch test. Judge projection at 30 minutes by asking someone at conversation distance — your own nose adapts within minutes."),
  bullet("Expect from ASMR: a bright bergamot-air opening that calms within the hour, a radiant jasmine-orris heart through the afternoon, and the woody-amber-musk skin glow lasting 8–12+ hours (longer on fabric)."),
  bullet("Never judge the whole perfume in week 1 or on a bad-weather nose (illness, spicy food, chlorine). Re-test twice before concluding anything."),

  // 12
  H1("12 · Troubleshooting"),
  goldRule(),
  mkTable([2800, 2800, 3426], ["Symptom", "Cause", "Fix"],
    TROUBLE.map((t, i) => new TableRow({ children: [
      cell(t[0], 2800, { bold: true, fill: i % 2 ? undefined : IVORY }),
      cell(t[1], 2800, { fill: i % 2 ? undefined : IVORY }),
      cell(t[2], 3426, { fill: i % 2 ? undefined : IVORY }),
    ] }))),

  // 13
  H1("13 · The Batch Record"),
  goldRule(),
  P("Fill one of these per master batch (the Production Log holds the live version; this is your paper backup on the printed sheet):"),
  bullet("Batch ID (ASMR-MASTER-001) · date weighed · optionals included? YES/NO"),
  bullet("Actual concentrate total (g) · actual alcohol (g) · deviations noted per ingredient"),
  bullet("Marriage start/end · maceration start · cold-crash date · filtration date · bottling date"),
  bullet("Bottles produced (sizes × counts) · retained sample location · strip-test journal lines"),
  P(""),
  noteBox("SAFETY — ALWAYS", "Flammable alcohol: no flame, ventilate. Gloves and eye protection with neat materials. Patch-test the finished perfume. The Bergamot ACCORD in this formula is photosafe — the separate Bergamot Essential Oil you own is phototoxic and stays out of skin products. Keep everything from children. Full list: the workbook's Safety Notes tab.", RED),
  P(""),
  goldRule(),
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 200 },
    children: [R("ASMR — I am here, and still here even when I am gone.", { italics: true, size: 22, color: GOLD })] }),
];

const doc = new Document({
  styles: {
    default: { document: { run: { font: "Arial", size: 22, color: CHARCOAL } } },
    paragraphStyles: [
      { id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 32, bold: true, font: "Arial", color: CHARCOAL },
        paragraph: { spacing: { before: 320, after: 120 }, outlineLevel: 0 } },
      { id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 25, bold: true, font: "Arial", color: GOLD },
        paragraph: { spacing: { before: 220, after: 100 }, outlineLevel: 1 } },
    ],
  },
  numbering: { config: [
    { reference: "bullets", levels: [{ level: 0, format: LevelFormat.BULLET, text: "–",
      alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 540, hanging: 300 } } } }] },
    { reference: "steps", levels: [{ level: 0, format: LevelFormat.DECIMAL, text: "%1.",
      alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 540, hanging: 300 } } } }] },
  ] },
  sections: [{
    properties: { page: { size: { width: 11906, height: 16838 },
      margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 } } },
    headers: { default: new Header({ children: [new Paragraph({ alignment: AlignmentType.RIGHT,
      children: [R("ASMR · The Master Method", { size: 16, color: MUTED })] })] }) },
    footers: { default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.CENTER,
      children: [new TextRun({ children: [PageNumber.CURRENT], font: "Arial", size: 16, color: MUTED })] })] }) },
    children,
  }],
});

Packer.toBuffer(doc).then((buffer) => {
  fs.writeFileSync("ASMR Perfume - Master Method.docx", buffer);
  console.log("written: ASMR Perfume - Master Method.docx");
});
