/*
 * ASMR & SAMR — combined business feasibility study (.docx generator)
 *
 * Run:  $env:NODE_PATH=(npm root -g); node build_feasibility_study.js
 * Out:  ASMR & SAMR - Feasibility Study.docx
 *
 * Every figure is taken from the LATEST verified workbooks:
 *   ASMR\ASMR_Production_Suite.xlsx   (16 tabs, acceptance-checked)
 *   SAMR\SAMR_Production_Suite.xlsx       (17 tabs, 59/59 checks passed)
 *   SAMR\SAMR 008\SAMR Body Spray 008.xlsx / SAMR Cream 008.xlsx
 * Market figures are cited in footnotes.
 */
const fs = require("fs");
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  Header, Footer, AlignmentType, LevelFormat, TabStopType, TabStopPosition,
  TableOfContents, HeadingLevel, BorderStyle, WidthType, ShadingType,
  PageNumber, PageBreak, FootnoteReferenceRun,
} = require("docx");

// ---------------------------------------------------------------- palette --
const CHARCOAL = "3B3531";
const GOLD_DK = "9C7B3C";
const GOLD_LT = "EBDFC6";
const IVORY = "F7F3EA";
const MUTED = "6E665A";

const CONTENT = 9026; // A4, 1" margins

// ---------------------------------------------------------------- helpers --
const p = (text, opts = {}) =>
  new Paragraph({
    spacing: { after: opts.after ?? 120, before: opts.before ?? 0 },
    alignment: opts.align,
    children: [new TextRun({
      text, bold: opts.bold, italics: opts.italic,
      size: opts.size ?? 22, color: opts.color ?? CHARCOAL,
    })],
  });

const rich = (runs, opts = {}) =>
  new Paragraph({
    spacing: { after: opts.after ?? 120 },
    children: runs.map(r => (r instanceof FootnoteReferenceRun) ? r : new TextRun({
      text: r.t, bold: r.b, italics: r.i, size: r.size ?? 22, color: r.color ?? CHARCOAL,
    })),
  });

const h1 = t => new Paragraph({ heading: HeadingLevel.HEADING_1, pageBreakBefore: true, children: [new TextRun(t)] });
const h1s = t => new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun(t)] }); // no page break
const h2 = t => new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun(t)] });
const h3 = t => new Paragraph({ heading: HeadingLevel.HEADING_3, children: [new TextRun(t)] });

const bullet = (t, opts = {}) =>
  new Paragraph({
    numbering: { reference: "bullets", level: opts.level ?? 0 },
    spacing: { after: 60 },
    children: [new TextRun({ text: t, size: 22, bold: opts.bold, color: CHARCOAL })],
  });

const numbered = (t, ref) =>
  new Paragraph({
    numbering: { reference: ref, level: 0 },
    spacing: { after: 60 },
    children: [new TextRun({ text: t, size: 22, color: CHARCOAL })],
  });

const border = { style: BorderStyle.SINGLE, size: 1, color: "C9BFA8" };
const borders = { top: border, bottom: border, left: border, right: border };

function cell(content, w, opts = {}) {
  const runs = Array.isArray(content) ? content : [{ t: String(content) }];
  return new TableCell({
    borders, width: { size: w, type: WidthType.DXA },
    shading: opts.fill ? { fill: opts.fill, type: ShadingType.CLEAR } : undefined,
    margins: { top: 60, bottom: 60, left: 100, right: 100 },
    children: [new Paragraph({
      alignment: opts.align,
      children: runs.map(r => new TextRun({
        text: r.t, bold: r.b ?? opts.b, size: r.size ?? 20,
        color: r.color ?? opts.color ?? CHARCOAL, italics: r.i,
      })),
    })],
  });
}

/** rows: first row = header (auto gold). row = array of cells (string or {t,b,fill,align}) */
function tbl(colWidths, rows, opts = {}) {
  const total = colWidths.reduce((a, b) => a + b, 0);
  return new Table({
    width: { size: total, type: WidthType.DXA },
    columnWidths: colWidths,
    rows: rows.map((r, ri) => new TableRow({
      children: r.map((c, ci) => {
        const o = (typeof c === "object" && !Array.isArray(c)) ? c : { t: c };
        const isHdr = ri === 0 && !opts.noHeader;
        return cell(o.t ?? c, colWidths[ci], {
          b: o.b ?? isHdr,
          fill: o.fill ?? (isHdr ? GOLD_LT : (ri % 2 === 0 ? undefined : IVORY)),
          align: o.align ?? (ci === 0 ? AlignmentType.LEFT : AlignmentType.CENTER),
          color: o.color,
        });
      }),
    })),
  });
}

const gap = () => p("", { after: 80 });

// ---------------------------------------------------------------- document --
const children = [];

// ===== COVER ================================================================
children.push(
  new Paragraph({ spacing: { before: 2400, after: 0 } }),
  p("A U R A · 3 7      &      S A M R", { size: 52, bold: true, align: AlignmentType.CENTER, after: 200 }),
  p("a his-&-hers niche fragrance house", { size: 26, italic: true, color: MUTED, align: AlignmentType.CENTER, after: 600 }),
  new Paragraph({
    alignment: AlignmentType.CENTER, spacing: { after: 600 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 8, color: GOLD_DK, space: 8 } },
    children: [new TextRun({ text: "BUSINESS FEASIBILITY STUDY", size: 40, bold: true, color: GOLD_DK })],
  }),
  p("Extrait de Parfum  ·  Body Spray  ·  Body Cream", { size: 24, align: AlignmentType.CENTER, after: 200 }),
  p("Two brands, one production system, one supplier", { size: 22, color: MUTED, align: AlignmentType.CENTER, after: 1400 }),
  p("Prepared from the live, acceptance-tested production workbooks", { size: 20, color: MUTED, align: AlignmentType.CENTER, after: 60 }),
  p("All amounts in Saudi Riyals (SAR) unless stated otherwise", { size: 20, color: MUTED, align: AlignmentType.CENTER, after: 60 }),
  p("July 2026  ·  Private & Confidential", { size: 20, color: MUTED, align: AlignmentType.CENTER }),
  new Paragraph({ children: [new PageBreak()] }),
);

// ===== TOC ==================================================================
children.push(
  p("Table of Contents", { size: 32, bold: true, after: 240 }),
  new TableOfContents("Table of Contents", { hyperlink: true, headingStyleRange: "1-2" }),
);

// ===== 1 · EXECUTIVE SUMMARY ===============================================
children.push(
  h1("1. Executive Summary"),
  p("This study assesses the feasibility of turning two finished, production-ready fragrance formulas — ASMR (a luxury skin scent for him) and SAMR (a gourmand amber floral for her) — into a small commercial fragrance house selling three product lines per brand: Extrait de Parfum, alcohol Body Spray, and leave-on Body Cream."),
  p("The unusual starting position: the hard part is already done. Both formulas are complete, priced, and encoded in verified Excel production suites (59/59 automated checks passing on SAMR; the same engine drives ASMR). Every raw material is sourced from a single supplier — Majid Iterji Factory for Perfumes, Makkah — with a live product link and price per ingredient. Total capital already invested in materials: SAR 4,258."),
  h2("1.1 Key figures at a glance"),
  tbl([3200, 1940, 1940, 1946], [
    ["Indicator", "ASMR (him)", "SAMR (her)", "Combined"],
    ["Materials capital already invested", "2,680", "1,578", "4,258"],
    ["Concentrate cost (loaded, SAR/g)", "5.74", "3.38", "—"],
    ["Juice cost, 50 ml Extrait", "74.82", "41.65", "—"],
    ["Unit cost incl. packaging (50 ml)", "114.82", "81.65", "—"],
    ["Proposed launch price (50 ml, ex-VAT)", "380", "270", "—"],
    ["Gross margin at launch price", "≈70%", "≈70%", "≈70%"],
    ["Bottles possible from stock today", "5 × 50 ml", "7 × 50 ml", "12"],
    ["Bottles after scale-up purchase", "26", "132", "158"],
    ["Scale-up materials investment", "796", "3,091", "3,887"],
    ["Full-cycle revenue potential", "5,681", "28,040", "33,721"],
    ["Full-cycle gross profit potential", "2,696", "17,261", "19,957"],
  ]),
  gap(),
  h2("1.2 Verdict"),
  p("The venture is feasible with low risk and exceptional unit economics. A complete production cycle requires roughly SAR 11,700 of additional cash (materials + packaging + sundries) and can return roughly SAR 20,000 in gross profit at full sell-through — with break-even at approximately 50 bottles sold out of 158 produced. The niche fragrance segment in Saudi Arabia is the fastest-growing part of a USD 2.4 billion market. The recommended path is a three-phase scale-up: validate privately, produce the first full run, then formalise (SFDA, labelling, e-commerce) before scaling to quarterly production.", { bold: false }),
  p("Recommendation: PROCEED — start Phase 0 (validation) immediately; commit the SAR 3,887 scale-up purchase only after wear-test feedback; defer all commercial (non-private) sales until the regulatory checklist in section 5.7 is complete.", { bold: true }),
);

// ===== 2 · BUSINESS OVERVIEW ===============================================
children.push(
  h1("2. Business Overview"),
  h2("2.1 The concept"),
  p("A two-brand artisan fragrance house built around a single idea: scent as intimacy. ASMR is the his side — a refined, radiant skin scent. SAMR — named from Samrae, and from the Arabic word for late-night conversation — is the hers side: warm vanilla, white flowers, and skin musks composed to be irresistible at close range. Together they form a natural his-&-hers pair with a gifting story no mass brand can copy."),
  h2("2.2 Assets already in hand"),
  bullet("Two finished 25-material formulas, balanced to 100.00% and encoded as live Excel production suites (Formula Master, Batch Calculator, Dilution Prep, Inventory with supplier links, Production Log, Maceration Tracker, Cost Analysis, Yield & Capacity, Scale-Up Plan, Pricing & Sales, Selling Strategy, Process Reference, Safety Notes)."),
  bullet("Automated quality assurance: the SAMR suite passes 59/59 acceptance checks through a real Excel recalculation; ASMR runs on the same verified engine."),
  bullet("Single-supplier sourcing: every ingredient carries a live iterji.com product link and current price inside the Inventory tab."),
  bullet("Step-by-step preparation guides (Word documents) and per-product recipe workbooks for Body Spray and Cream."),
  bullet("SAR 4,258 of raw materials already purchased and on the shelf; 12 materials are shared between the two formulas, halving inventory risk."),
  bullet("Versioned backups of everything, locally and on Google Drive."),
  h2("2.3 Objectives"),
  numbered("Validate both scents with real wearers within one month (Phase 0).", "objectives"),
  numbered("Produce and sell the first full production cycle — 158 × 50 ml — within six months (Phase 1).", "objectives"),
  numbered("Become commercially compliant (SFDA, labelling, IFRA documentation) and open paid channels by month nine (Phase 2).", "objectives"),
  numbered("Reach a repeatable quarterly production rhythm of 300+ bottles with three product lines per brand by month eighteen (Phase 3).", "objectives"),
);

// ===== 3 · PRODUCTS & BRANDS ===============================================
children.push(
  h1("3. Products and Brands"),
  h2("3.1 The two brands"),
  tbl([1500, 3760, 3766], [
    ["", "ASMR — for him", "SAMR — for her"],
    ["Family", "Luxury skin scent — citrus, radiant jasmine air, velvet woods, amber, clean musks", "Gourmand amber floral — peach and raspberry over jasmine and tuberose, double vanilla, tonka, ambergris, skin musks"],
    ["Character", "Presence that stays: polished, quietly expensive, 'still here after he leaves'", "The scent he cannot forget: warm, addictive, made for close range"],
    ["Format", "Extrait de Parfum 28%", "Extrait de Parfum 28%"],
    ["Formula", "25 materials, 2 optional luxuries, verified to 100.00%", "25 materials, 2 optional luxuries, verified to 100.00%"],
    ["Signature materials", "Hedione 20%, Iso E Super 15%, Ambroxan, sandalwood trio, 5-musk accord", "Hedione 14.7%, double vanilla 9.5%, jasmine absolute accord, Ambroxan 7.5%, musk trio (coumarin held at 84% of its IFRA ceiling by design)"],
  ]),
  gap(),
  h2("3.2 The three product lines"),
  tbl([2100, 2300, 2300, 2326], [
    ["", "Extrait de Parfum", "Body Spray", "Body Cream"],
    ["Fragrance load", "28%", "5%", "1.0%"],
    ["Role", "The hero product and profit engine", "Volume product; daily use; entry price point", "Layering product; gift sets; longest skin wear"],
    ["Base", "Perfumer's alcohol (SDA 40B)", "Perfumer's alcohol", "Water + emulsifier + carrier oil (preserved)"],
    ["Production", "Master batch, 4–8 week maceration", "Blend, 1–2 week rest, filter", "70–75 °C emulsion, cool-down fragrance"],
    ["Made from", "The same concentrate", "The same concentrate", "The same concentrate"],
    ["Typical unit", "50 ml bottle", "100 ml bottle", "100 g jar"],
  ]),
  gap(),
  p("All three lines are fed by one shared concentrate per brand — one weighing session supplies the whole product family, which is what makes the portfolio operationally realistic for a one-person workshop.", { italic: true, color: MUTED }),
);

// ===== 4 · MARKET STUDY =====================================================
children.push(
  h1("4. Market Study"),
  h2("4.1 Market size and growth"),
  rich([
    { t: "Saudi Arabia is one of the world's most fragrance-intensive markets. The Kingdom's perfume market was valued at approximately USD 2.4 billion in 2025 and is projected to reach USD 3.6 billion by 2034 (CAGR ≈ 4.5%)" },
    new FootnoteReferenceRun(1),
    { t: ". Independent estimates place the same market at USD 1.95 billion (2025) growing to USD 2.7 billion by 2034" },
    new FootnoteReferenceRun(2),
    { t: ", and local capital-market data recorded SAR 7.7 billion in 2023 with a forecast of ≈ SAR 11.5 billion by 2027" },
    new FootnoteReferenceRun(3),
    { t: ". Whichever source is used, the direction is identical: large, growing, and culturally anchored." },
  ]),
  rich([
    { t: "Most relevant to this venture: the niche and artisanal segment — small houses selling story-driven, high-concentration fragrance — represents roughly 8–12% of market value and is the fastest-growing sub-category at 10–13% annual growth, while the premium price band of SAR 300–1,000 per bottle grows at 9–11% per year" },
    new FootnoteReferenceRun(4),
    { t: ". Both proposed launch prices (SAR 270 and 380 for 50 ml) sit squarely inside that band." },
  ]),
  h2("4.2 Demand drivers"),
  bullet("Deep cultural affinity: fragrance is a daily ritual and a social signal; oud, musk, amber and rose profiles dominate preference — SAMR's amber-musk DNA and ASMR's woody-amber DNA both align."),
  bullet("Premiumisation: consumers are trading up from mass to niche, seeking exclusivity and storytelling — precisely the positioning of a numbered, hand-made extrait."),
  bullet("Gifting economy: Eid, weddings, engagements and Valentine's create predictable demand spikes; the his-&-hers duo is a ready-made gift format."),
  bullet("E-commerce expansion (locally driven by platforms such as Salla and Zid) lowers the cost of reaching customers beyond the personal circle."),
  bullet("Vision 2030 policy support for local luxury manufacturing."),
  h2("4.3 Target customers"),
  tbl([2300, 3300, 3426], [
    ["Segment", "Who they are", "What they buy"],
    ["The couple (primary)", "Married adults 25–45; she wants to be noticed by him, he wants a signature", "50 ml extrait; His & Hers duo box"],
    ["The gifter", "Buying for spouse, engagement, Eid, anniversaries", "Gift sets, duo box, 30 ml + cream sets"],
    ["The fragrance lover", "Niche collectors bored of mall brands; active on fragrance social media", "Discovery sets first, then full bottles"],
    ["The layerer", "Body-care-first customers", "Body spray + cream; upgrade path to extrait"],
  ]),
  gap(),
  h2("4.4 Competition and positioning"),
  p("The Saudi market splits into: (a) international designer brands (SAR 300–700, department stores), (b) large local houses — Arabian Oud, Abdul Samad Al Qurashi, Lattafa and peers — strong in oud and value oriental lines, and (c) global niche (SAR 700–1,800, limited doors). The gap this venture occupies: a personal, story-first artisan extrait at true niche concentration (28%) priced below global niche — with a founder story (a perfume literally named for the founder's wife) that no corporate brand can imitate."),
  p("Positioning statement: hand-made extraits about intimacy — his scent and hers, made by one house, in small numbered batches.", { italic: true }),
);

// ===== 5 · TECHNICAL STUDY ==================================================
children.push(
  h1("5. Technical Feasibility"),
  h2("5.1 Production method (proven and documented)"),
  p("Both brands use the professional master-batch method, fully documented in the Process Reference tabs and the SAMR Preparation Guide:"),
  numbered("Prepare D10 dilutions (10% in DPG) for the trace materials, one day ahead.", "process"),
  numbered("Weigh ONE master concentrate for the whole run (BASE → HEART → TOP) on a 0.01 g scale.", "process"),
  numbered("Marry 24–48 h in the dark; confirm all crystalline materials fully dissolved.", "process"),
  numbered("Add perfumer's alcohol (190-proof SDA 40B) into the concentrate; one vessel, filled to the shoulder.", "process"),
  numbered("Macerate 4–8 weeks (42-day default, tracked automatically per batch).", "process"),
  numbered("Cold-crash 24 h at ~4 °C, filter cold, and divide into bottles BY WEIGHT (42.5 g per 50 ml).", "process"),
  p("Body Spray: the same concentrate at 5% in alcohol; 1–2 week rest; filter; bottle. Body Cream: 1.0% fragrance added below 40 °C to a preserved oil-in-water emulsion (documented Route 1 with a purchased base, and Route 2 from scratch)."),
  h2("5.2 Capacity"),
  tbl([3400, 2800, 2826], [
    ["Capacity measure", "ASMR", "SAMR"],
    ["Concentrate possible from stock today", "60 g", "94.7 g"],
    ["50 ml extrait bottles today", "5", "7"],
    ["Bottleneck material (both brands)", "Iso E Super", "Iso E Super"],
    ["Target after scale-up purchase", "26 bottles", "132 bottles"],
    ["Concentrate required at target", "325.7 g", "1,653.5 g"],
    ["Extra packs to buy (from Scale-Up tab)", "20 packs — SAR 796", "92 packs — SAR 3,091"],
  ]),
  gap(),
  p("One production cycle (weigh, marry, macerate, bottle) fits comfortably in a home workshop: the weighing session is a single afternoon per brand; maceration is passive; bottling 158 bottles by weight is roughly two working days. The 5-litre alcohol pack supports ≈ 132 × 50 ml bottles; alcohol is the natural ceiling of each cycle and is deliberately used as the scale-up target in the workbooks."),
  h2("5.3 Equipment and facility"),
  tbl([4200, 1900, 2926], [
    ["Item", "Est. cost (SAR)", "Note"],
    ["Precision scale 0.01 g (have)", "0", "already owned; buy a 0.001 g jewel scale later for D10s"],
    ["Glass beakers, rods, funnels, amber maceration bottles", "250–400", "iterji sells amber bottles/jars"],
    ["Coffee filters / 0.45 µm filters, pipettes, gloves", "100–150", "consumables per cycle"],
    ["Fridge space for cold-crash (have)", "0", "household"],
    ["Label printer or printed label sheets", "150–300", "phase 1: printed sheets suffice"],
    ["Ventilated, flame-free workspace corner", "0", "safety requirement, not a purchase"],
    ["TOTAL new equipment", { t: "≈ 500–850", b: true }, "one-time"],
  ]),
  gap(),
  h2("5.4 Supply chain"),
  bullet("Single supplier: Majid Iterji Factory for Perfumes (iterji.com), Makkah — every material has a live product link and price in each workbook's Inventory tab; catalogue prices have matched actual purchases exactly."),
  bullet("Known risk actively tracked: Ethylene Brassylate is currently out of stock at the supplier (a pack is already owned); the Inventory tab flags it. Mitigation: keep one spare pack of each backbone material, and qualify one backup supplier during Phase 2."),
  bullet("Cost-reduction lever: moving the five biggest-volume materials (Iso E Super, Hedione, Benzyl Salicylate, Ethylene Brassylate, Vanillin) from 10 ml to 100/500 ml packs typically cuts their per-gram cost by 30–60% — the workbooks reprice everything automatically when pack sizes are edited."),
  h2("5.5 Quality control"),
  bullet("The workbook engine is itself the QC system: formulas must sum to 100.00% (live check), batch sheets are printed with tick-boxes, every batch is logged, inventory depletes automatically, and maceration is date-tracked."),
  bullet("The SAMR suite passes 59/59 automated acceptance checks (formula sums, renormalisation, batch mathematics, inventory depletion, capacity and pricing logic, link integrity) through real Excel recalculation."),
  bullet("Per-batch discipline: retained sample, patch test, 24 h clarity check, wear test before release; one master batch means every bottle in a run is identical."),
  h2("5.6 Safety (from the Safety Notes tabs)"),
  bullet("Alcohol is flammable — no flame, ventilate, closed containers."),
  bullet("Every water-containing product (cream, water mist) requires a broad-spectrum preservative — non-negotiable."),
  bullet("Restricted materials are dose-controlled in the formula (e.g., Damascone Beta only as a 10% dilution; coumarin held within the IFRA fine-fragrance ceiling; cream fragrance ≤ 1.2%)."),
  h2("5.7 Regulatory path to commercial sale"),
  numbered("Verify both formulas against the CURRENT IFRA standard for each product category (fine fragrance vs. leave-on cream) and keep the calculation on file.", "reg"),
  numbered("Register/notify the products with the SFDA (Saudi Food & Drug Authority) cosmetics system before non-private sales.", "reg"),
  numbered("Compliant labelling: Arabic + English, ingredient/allergen declaration, batch number, volume, responsible entity.", "reg"),
  numbered("VAT: 15% applies once VAT-registered; the pricing tabs show ex-VAT and inc-VAT side by side.", "reg"),
  numbered("Trademark both brand names at SAIP when revenue justifies it (Phase 2–3).", "reg"),
);

// ===== 6 · FINANCIAL STUDY ==================================================
children.push(
  h1("6. Financial Feasibility"),
  p("All figures below are live outputs of the Cost Analysis, Scale-Up Plan and Selling Strategy tabs; they update automatically inside the workbooks when prices or quantities change.", { italic: true, color: MUTED }),
  h2("6.1 Capital position"),
  tbl([4200, 2400, 2426], [
    ["Item", "Amount (SAR)", "Note"],
    ["ASMR materials purchased", "2,329", "27+ materials incl. shipping allocation base"],
    ["SAMR materials purchased", "1,227", "13 new materials; 12 shared with ASMR"],
    ["Shipping (allocated in cost/g)", "702", "351 per order, both orders"],
    ["Capital already deployed", { t: "4,258", b: true }, "sunk — already on the shelf"],
    ["Scale-up purchase (next cycle)", "3,887", "AURA 796 + SAMR 3,091 (Scale-Up tabs)"],
    ["Packaging for 158 bottles", "≈ 6,320", "≈ 40/bottle: bottle, pump, box, label"],
    ["Equipment & sundries", "≈ 1,500", "section 5.3 + labels + misc"],
    ["Cash needed for the full first cycle", { t: "≈ 11,700", b: true }, "excluding already-deployed capital"],
  ]),
  gap(),
  h2("6.2 Unit economics — Extrait 50 ml (the hero)"),
  tbl([3200, 2900, 2926], [
    ["Per 50 ml bottle", "ASMR", "SAMR"],
    ["Juice cost (concentrate + alcohol)", "74.82", "41.65"],
    ["Packaging (bottle, pump, box, label)", "40.00", "40.00"],
    ["Total unit cost", { t: "114.82", b: true }, { t: "81.65", b: true }],
    ["Launch price (ex-VAT)", { t: "380", b: true }, { t: "270", b: true }],
    ["Price inc. 15% VAT", "437", "310.50"],
    ["Gross profit per bottle", "265", "188"],
    ["Gross margin", "≈ 70%", "≈ 70%"],
  ]),
  gap(),
  h2("6.3 Unit economics — Body Spray and Body Cream"),
  tbl([2800, 1550, 1550, 1550, 1576], [
    ["Product (per unit)", "Cost — juice", "Cost — packaged", "Proposed price", "Margin"],
    ["ASMR Body Spray 100 ml", "41.41", "≈ 53", "99", "≈ 46%"],
    ["SAMR Body Spray 100 ml", "18.44", "≈ 30", "79", "≈ 62%"],
    ["ASMR Body Cream 100 g", "9.46–13.66", "≈ 20", "79", "≈ 75%"],
    ["SAMR Body Cream 100 g", "7.10–11.29", "≈ 17", "69", "≈ 75%"],
  ]),
  gap(),
  p("Note: the dedicated SAMR Body Spray workbook prices a batch conservatively at 35.06 per 100 g when alcohol is bought in small bottles; with the 5-litre alcohol pack the suite cost falls to 18.44. Cream costs shown span Route 2 (from scratch) to Route 1 (purchased base). Sprays and creams are volume-and-loyalty products: they lower the entry price, feed gift sets, and reuse the same concentrate."),
  h2("6.4 Proposed retail price ladders (from the Selling Strategy tabs)"),
  tbl([1400, 1900, 1900, 1900, 1926], [
    ["Size", "ASMR launch", "ASMR inc-VAT", "SAMR launch", "SAMR inc-VAT"],
    ["10 ml", "90", "103.50", "70", "80.50"],
    ["30 ml", "250", "287.50", "190", "218.50"],
    ["50 ml", { t: "380", b: true }, "437", { t: "270", b: true }, "310.50"],
    ["70 ml", "510", "586.50", "360", "414"],
    ["100 ml", "680", "782", "460", "529"],
  ]),
  gap(),
  p("Every rung holds a ≈ 70% gross margin. The ladder deliberately keeps SAMR below ASMR: her bottle is the volume seller and the gift entry point; his is the premium anchor."),
  h2("6.5 First full cycle — projected profit and loss"),
  tbl([3800, 1700, 1700, 1826], [
    ["First production cycle (158 × 50 ml)", "ASMR", "SAMR", "Combined"],
    ["Bottles produced", "26", "132", "158"],
    ["— sold privately (full price)", "13 @ 342", "93 @ 243", "106"],
    ["— sold via boutique (35% commission)", "5 @ 380", "31 @ 270", "36"],
    ["— samples / testers (investment)", "8", "8", "16"],
    ["Revenue (net of commission)", "5,681", "28,040", { t: "33,721", b: true }],
    ["Cost of goods (juice + packaging)", "2,985", "10,778", "13,763"],
    ["Gross profit", { t: "2,696", b: true }, { t: "17,261", b: true }, { t: "19,957", b: true }],
  ]),
  gap(),
  p("Private prices above include the 10% launch-discount buffer from the Selling Strategy tabs (AURA 342 vs 380 list; SAMR 243 vs 270 list) — friends-and-family pricing is already priced in, not a margin surprise."),
  h2("6.6 Sensitivity and break-even"),
  tbl([3200, 1900, 1900, 2026], [
    ["Sell-through of the 142 sellable bottles", "50%", "75%", "100%"],
    ["Bottles sold", "71", "107", "142"],
    ["Gross profit (SAR)", "≈ 9,200", "≈ 14,700", "≈ 19,957"],
    ["Cycle cash (≈11,700) recovered?", "≈ 79%", "fully + profit", "fully + profit"],
  ]),
  gap(),
  bullet("Break-even on the cycle cash (≈ SAR 11,700): ≈ 50 bottles sold at blended net revenue of ≈ 237/bottle.", { bold: false }),
  bullet("Break-even on every riyal spent since day one (≈ SAR 15,960 incl. the 4,258 already deployed): ≈ 68 bottles — less than half the run."),
  bullet("Unsold bottles are not losses: extrait improves with age and remains sellable stock; concentrate can also be diverted into sprays and creams."),
  h2("6.7 Financial assumptions"),
  bullet("Packaging at SAR 40/bottle is a planning estimate — replace with real quotes before committing (flagged in the workbook Go/No-Go checklist)."),
  bullet("Prices are ex-VAT; VAT applies only once registered."),
  bullet("Labour is not costed in Phase 0–1 (founder-operated); include it from Phase 2 via the Pricing & Sales labour input."),
  bullet("No marketing spend is assumed beyond samples; channels in Phase 1 are organic."),
);

// ===== 7 · MARKETING STRATEGY ===============================================
children.push(
  h1("7. Marketing Strategy"),
  h2("7.1 Brand story and positioning"),
  p("Sell the feeling, not the ingredient list. The house story is real and unrepeatable: a husband built a perfume house around his wife — her scent (SAMR) designed to be unforgettable to him, his scent (ASMR) designed to linger after he leaves the room. Every asset — bottle copy, posts, packaging — should retell that story in one sentence."),
  bullet("Tagline direction (SAMR): 'the scent he cannot forget.'"),
  bullet("Tagline direction (ASMR): 'presence that stays.'"),
  bullet("Category frame: numbered, small-batch extraits (28%) — stronger than department-store EDPs, priced below global niche."),
  h2("7.2 The 4 Ps"),
  tbl([1500, 7526], [
    ["P", "Strategy"],
    ["Product", "Hero: 50 ml Extrait. Support: 10 ml travel, Body Spray 100 ml, Body Cream 100 g, Discovery Set (2 ml pair), His & Hers Duo Box, trio gift sets. Numbered bottles (e.g., 07/132) on every run."],
    ["Price", "Ladders in section 6.4 (≈70% margin). Duo Box: AURA 50 + SAMR 50 at SAR 599 (vs 650 separately). Trio set (extrait + spray + cream): SAMR 379, AURA 499. Discovery Set 60, redeemable against a full bottle."],
    ["Place", "Phase 1: personal network, WhatsApp/Instagram DM sales, pop-up tables at events. Phase 2: own e-store (Salla/Zid), 2–3 boutique consignments. Phase 3: wholesale, GCC shipping."],
    ["Promotion", "Founder-story content; 'does he notice?' testimonial engine; unboxing of numbered bottles; scent-of-the-occasion posts for Eid/weddings/Valentine's; micro-influencer seeding with discovery sets (cost ≈ 8/unit juice)."],
  ]),
  gap(),
  h2("7.3 Launch calendar"),
  tbl([2200, 3300, 3526], [
    ["Window", "Occasion", "Push"],
    ["Months 1–2", "Private launch", "Wear tests → testimonials → first 50 private sales"],
    ["Month 3+", "Eid / seasonal gifting", "Duo Box + gift wrap; pre-orders funded by deposits"],
    ["Ongoing", "Weddings & engagements", "His & Hers Duo as the default engagement gift"],
    ["February", "Valentine's", "SAMR hero campaign; 'the scent he cannot forget'"],
    ["Q4", "National Day / winter season", "ASMR push; oud-adjacent woody-amber messaging"],
  ]),
  gap(),
  h2("7.4 Channel economics (from the Selling Strategy tabs)"),
  tbl([2800, 1500, 1500, 1500, 1726], [
    ["Channel", "Price kept", "Margin quality", "Volume", "When"],
    ["Private circle / DM", "100%", "Highest", "Low–mid", "Phase 1"],
    ["Own e-store", "≈ 95%", "High", "Mid", "Phase 2"],
    ["Pop-ups & events", "≈ 90%", "High", "Bursts", "Phase 1–2"],
    ["Boutique consignment", "65%", "Medium", "Mid", "Phase 2"],
    ["Wholesale", "≈ 50%", "Low per unit", "High", "Phase 3"],
  ]),
  gap(),
  h2("7.5 KPIs"),
  bullet("Wear-test conversion: % of testers who buy a full bottle (target ≥ 40%)."),
  bullet("Sell-through of each numbered run within 90 days (target ≥ 75%)."),
  bullet("Repeat/gift rate: % of buyers who buy again or gift within 6 months (target ≥ 30%)."),
  bullet("Attach rate of spray/cream to extrait orders (target ≥ 25% from Phase 2)."),
  bullet("Blended gross margin ≥ 65% after discounts and commissions."),
);

// ===== 8 · SCALE-UP PLAN ====================================================
children.push(
  h1("8. Detailed Scale-Up Plan"),
  p("The plan is phased so that each investment is unlocked by evidence from the previous phase — the workbooks' Scale-Up Plan tabs recalculate every quantity automatically when the target changes.", { italic: true, color: MUTED }),
  h2("Phase 0 — Validate (month 0–1) · cash ≈ SAR 300"),
  bullet("Bottle the 12 bottles possible from today's stock (5 AURA + 7 SAMR) plus 2 ml testers."),
  bullet("Run 16 structured wear tests (8 per brand): longevity, projection, partner reaction, purchase intent."),
  bullet("Collect real packaging quotes to replace the SAR 40 estimate; photograph prototypes."),
  bullet("Gate to Phase 1: ≥ 40% of testers say they would buy at the proposed price."),
  h2("Phase 1 — First full cycle (months 1–3 production, 3–6 selling) · cash ≈ SAR 11,700"),
  bullet("Execute the Scale-Up purchases exactly as listed in each workbook: SAMR +92 packs (SAR 3,091 — the big items: Ambroxan 1,605, Cashmeran 279, Iso E Super 231, Jasmine Absolute 225, Hedione 215); ASMR +20 packs (SAR 796 — Ambroxan 268, Iso E Super 68)."),
  bullet("Take pre-orders/deposits during the 6-week maceration to fund packaging."),
  bullet("Produce one master batch per brand → 158 numbered bottles; sell via private + pop-up channels only."),
  bullet("Gate to Phase 2: ≥ 75 bottles sold (cycle cash recovered) and testimonials in hand."),
  h2("Phase 2 — Formalise & extend (months 3–9) · cash ≈ SAR 6,000–9,000"),
  bullet("Regulatory: SFDA registration, compliant AR/EN labels, IFRA documentation, allergen declarations; trademark filings at SAIP."),
  bullet("Open the e-store (Salla/Zid) and 2–3 boutique consignments."),
  bullet("Launch Body Spray and Body Cream lines (minimal capital: they reuse the concentrate; cream needs ≈ SAR 200–400 of emulsifiers and jars)."),
  bullet("Switch the five backbone materials to 100/500 ml packs — target: cut concentrate cost 30–50% (SAMR extrait juice cost falls from ≈ 41.6 toward ≈ 25–30)."),
  bullet("Introduce the Duo Box and trio sets; begin monthly (not one-off) master batches."),
  bullet("Gate to Phase 3: two consecutive months of ≥ SAR 10,000 revenue with ≥ 65% blended margin."),
  h2("Phase 3 — Scale (months 9–18) · cash ≈ SAR 15,000–25,000"),
  bullet("Dedicated workshop space with proper ventilation and flammables storage; second scale; bulk maceration vessels."),
  bullet("Quarterly production of 300–500 bottles across both brands; wholesale price list activated."),
  bullet("GCC e-commerce shipping; evaluate a third scent (the workbook engine makes any new formula a two-day build)."),
  bullet("Evaluate contract filling for sprays/creams to free founder time for sales."),
  h2("8.1 Operational scaling notes"),
  bullet("The bottleneck is always visible: Yield & Capacity and Scale-Up tabs highlight the limiting material (currently Iso E Super for both brands) and cost the fix."),
  bullet("Alcohol defines cycle size: each 5 L pack ≈ 132 × 50 ml; order one pack per planned run."),
  bullet("Maceration is the time bottleneck (4–8 weeks): a monthly batch rhythm creates a continuous pipeline after the first quarter."),
  bullet("12 shared materials mean one purchase order serves both brands; the Inventory tabs must be updated per brand when shared jars are drawn down."),
);

// ===== 9 · RISKS & SWOT =====================================================
children.push(
  h1("9. Risk Analysis"),
  tbl([2600, 1200, 1200, 4026], [
    ["Risk", "Likelihood", "Impact", "Mitigation"],
    ["Single-supplier dependence (e.g., Ethylene Brassylate already out of stock)", "Medium", "High", "Hold one spare pack of each backbone material; qualify a second supplier in Phase 2; workbooks flag stock-outs"],
    ["Selling commercially before SFDA/IFRA compliance", "Low (controlled)", "High", "Hard gate: Go/No-Go checklist in the Selling Strategy tabs; private sales only until complete"],
    ["Slow sell-through of first run", "Medium", "Medium", "Pre-orders during maceration; extrait ages well; concentrate divertible to sprays/creams; break-even at only 50/142"],
    ["Price resistance", "Medium", "Medium", "10% launch buffer already in prices; discovery sets as low-risk entry; ladder offers 10 ml at 70–90"],
    ["Ingredient price inflation (Ambroxan already rose 81→134/10 g)", "Medium", "Medium", "Live cost engine reprices instantly; bulk packs hedge; 70% margin absorbs shocks"],
    ["Founder key-person dependence", "High", "Medium", "Everything is documented (suites, guides, checklists); processes are executable by a trained assistant"],
    ["Flammable materials at home", "Low", "High", "Safety Notes discipline; small volumes; Phase 3 moves to a proper workshop"],
    ["Counterfeit/imitation once visible", "Low", "Low", "Numbered bottles, story-led brand, trademark in Phase 2"],
  ]),
  gap(),
  h2("9.1 SWOT"),
  tbl([4513, 4513], [
    [{ t: "STRENGTHS", fill: GOLD_LT }, { t: "WEAKNESSES", fill: GOLD_LT }],
    ["Verified formulas + automated production system; 70% margins; authentic story; single-supplier simplicity; two brands from one inventory", "One founder; no commercial track record; home production ceiling; brand unknown; supplier concentration"],
    [{ t: "OPPORTUNITIES", fill: GOLD_LT }, { t: "THREATS", fill: GOLD_LT }],
    ["Niche segment growing 10–13%/yr; gifting culture; e-commerce rails (Salla/Zid); line extensions already costed; GCC expansion", "Ingredient inflation; regulatory tightening; large houses moving into 'artisan' positioning; discretionary-spend downturns"],
  ], { noHeader: true }),
);

// ===== 10 · CONCLUSION ======================================================
children.push(
  h1("10. Conclusion and Recommendations"),
  p("This is a rare feasibility profile: the product, the production system, the supplier chain, the cost model and the quality controls already exist and are verified. The remaining work is validation, compliance and selling — not invention. Unit economics (≈70% gross margin), a tiny break-even (≈50 bottles of a 158-bottle run), and a market whose niche segment grows at 10–13% a year support a clear PROCEED."),
  h2("Immediate next actions"),
  numbered("Bottle today's stock and run the 16 wear tests (Phase 0).", "actions"),
  numbered("Get three real packaging quotes and update the Pricing & Sales tabs.", "actions"),
  numbered("On a positive gate: place the SAR 3,887 scale-up order from the Scale-Up tabs' shopping lists.", "actions"),
  numbered("Open pre-orders during maceration; sell the first numbered run privately.", "actions"),
  numbered("Start SFDA/IFRA/trademark work in parallel — it is the longest lead item before public selling.", "actions"),
  gap(),
  p("Go / No-Go before any commercial sale (from the workbooks):", { bold: true }),
  bullet("Formulas verified against the current IFRA standard for each category."),
  bullet("SFDA registration and compliant Arabic/English labels with allergen declarations."),
  bullet("Real packaging quotes replacing estimates in the cost model."),
  bullet("At least one fully macerated batch passed on-skin wear testing."),
);

// ===== APPENDIX =============================================================
children.push(
  h1("Appendix — Data Sources"),
  h2("A. Internal (live workbooks — the numbers in this study)"),
  bullet("ASMR\\ASMR_Production_Suite.xlsx — Cost Analysis, Yield & Capacity, Scale-Up Plan, Pricing & Sales, Selling Strategy tabs."),
  bullet("SAMR\\SAMR_Production_Suite.xlsx — same tabs; 59/59 acceptance checks passing (July 2026)."),
  bullet("SAMR\\SAMR 008\\SAMR Body Spray 008.xlsx and SAMR Cream 008.xlsx — per-product recipes and costs."),
  bullet("SAMR Preparation Guide.docx — bench method; Process Reference tabs — SOPs for all six product routes."),
  bullet("Supplier links and prices: Inventory tab of each suite (one iterji.com link per material)."),
  h2("B. Market references (footnoted in section 4)"),
  bullet("Research and Markets, 'Saudi Arabia Perfume Market Report 2026–2034' (April 2026)."),
  bullet("IMARC Group, 'Saudi Arabia Perfume Market' (2025 baseline)."),
  bullet("CMA Saudi Arabia data via Statista, market size 2018–2023 with 2027 forecast."),
  bullet("IndexBox, 'Saudi Arabia Fragrance Market — Analysis and Forecast to 2035' (2026)."),
  gap(),
  p("Prepared July 2026. All internal figures recalculate automatically inside the workbooks; treat this document as the narrative layer over that live model.", { italic: true, color: MUTED }),
);

// ---------------------------------------------------------------- build ----
const doc = new Document({
  styles: {
    default: { document: { run: { font: "Arial", size: 22 } } },
    paragraphStyles: [
      { id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 32, bold: true, font: "Arial", color: GOLD_DK },
        paragraph: { spacing: { before: 240, after: 200 }, outlineLevel: 0 } },
      { id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 26, bold: true, font: "Arial", color: CHARCOAL },
        paragraph: { spacing: { before: 200, after: 140 }, outlineLevel: 1 } },
      { id: "Heading3", name: "Heading 3", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 23, bold: true, font: "Arial", color: MUTED },
        paragraph: { spacing: { before: 160, after: 100 }, outlineLevel: 2 } },
    ],
  },
  numbering: {
    config: [
      { reference: "bullets",
        levels: [
          { level: 0, format: LevelFormat.BULLET, text: "•", alignment: AlignmentType.LEFT,
            style: { paragraph: { indent: { left: 640, hanging: 320 } } } },
          { level: 1, format: LevelFormat.BULLET, text: "–", alignment: AlignmentType.LEFT,
            style: { paragraph: { indent: { left: 1080, hanging: 320 } } } },
        ] },
      ...["objectives", "process", "reg", "actions"].map(ref => ({
        reference: ref,
        levels: [{ level: 0, format: LevelFormat.DECIMAL, text: "%1.", alignment: AlignmentType.LEFT,
          style: { paragraph: { indent: { left: 640, hanging: 360 } } } }],
      })),
    ],
  },
  footnotes: {
    1: { children: [new Paragraph("Research and Markets, 'Saudi Arabia Perfume Market Report by Type, Value, Gender and Company Analysis 2026–2034', April 2026: USD 2.43 B (2025) to USD 3.62 B (2034), CAGR 4.52%.")] },
    2: { children: [new Paragraph("IMARC Group, 'Saudi Arabia Perfume Market': USD 1.95 B (2025) to USD 2.71 B (2034), CAGR 3.7%.")] },
    3: { children: [new Paragraph("CMA Saudi Arabia via Statista: SAR 7.7 B (2023), forecast ≈ SAR 11.5 B (2027).")] },
    4: { children: [new Paragraph("IndexBox, 'Saudi Arabia Fragrance Market — Analysis and Forecast to 2035', 2026: niche/artisanal ≈ 8–12% of value growing 10–13% CAGR; SAR 300–1,000 premium band growing 9–11% CAGR.")] },
  },
  sections: [{
    properties: {
      page: {
        size: { width: 11906, height: 16838 }, // A4
        margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 },
      },
    },
    headers: {
      default: new Header({
        children: [new Paragraph({
          tabStops: [{ type: TabStopType.RIGHT, position: TabStopPosition.MAX }],
          border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: GOLD_DK, space: 4 } },
          children: [
            new TextRun({ text: "ASMR & SAMR", bold: true, size: 18, color: GOLD_DK }),
            new TextRun({ text: "\tFeasibility Study · Private & Confidential", size: 18, color: MUTED }),
          ],
        })],
      }),
    },
    footers: {
      default: new Footer({
        children: [new Paragraph({
          tabStops: [{ type: TabStopType.RIGHT, position: TabStopPosition.MAX }],
          children: [
            new TextRun({ text: "July 2026", size: 18, color: MUTED }),
            new TextRun({ text: "\tPage ", size: 18, color: MUTED }),
            new TextRun({ children: [PageNumber.CURRENT], size: 18, color: MUTED }),
            new TextRun({ text: " of ", size: 18, color: MUTED }),
            new TextRun({ children: [PageNumber.TOTAL_PAGES], size: 18, color: MUTED }),
          ],
        })],
      }),
    },
    children,
  }],
});

Packer.toBuffer(doc).then(buf => {
  fs.writeFileSync("ASMR & SAMR - Feasibility Study.docx", buf);
  console.log("written: ASMR & SAMR - Feasibility Study.docx");
});
