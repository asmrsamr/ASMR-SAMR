# S A M R — سَمَر

**SAMR — سَمَر** is the working brand name for Samrae's perfume: short, intimate, Arabic-rooted, and bottle-ready. In Arabic, *samar* carries the feeling of late-night conversation and closeness after sunset.

## Five Name Options From Samrae

| Option | Arabic | Why it works |
|---|---|---|
| **SAMR** | سَمَر | Best balance: short, modern, from Samrae, and already means evening conversation. |
| **SAMRA** | سمراء | Closest to her name; feminine and direct, but more personal-name than brand. |
| **RAE** | راي | Minimal and international; softer, but less Arabic-rooted. |
| **SAMRAE 37** | سمراء 37 | Personal and premium; good if you want the full dedication visible. |
| **MARAE** | ماراي | Elegant invented name from the middle of Samrae; more abstract and brandable. |

**Recommendation:** use **SAMR سَمَر**. It carries her name without being too literal, and it has a real Arabic emotional meaning.

---

## Scent Direction

**Family:** Gourmand Amber Floral · warm-skin extrait  
**Format:** Eau de Parfum @ 20%  
**Built on:** the ASMR production system — same workbook engine, same master-batch method.

SAMR opens with sun-warmed bergamot, pink pepper, peach skin, and raspberry gloss. The heart is luminous Hedione, jasmine, tuberose, violet-iris powder, and solar balsamic warmth. The drydown is the signature: double vanilla, tonka, caramelised sugar, heliotrope, coconut cream, Ambroxan, Iso E Super, cashmeran, sandalwood, and skin musks.

This is designed to sit close: warm, feminine, memorable, and personal.

---

## Formula

Full live version is on the **Formula Master** tab. D10 = weighed as a 10% dilution in DPG.

| Phase | Material | % | Form |
|---|---|---:|---|
| TOP | Bergamot Accord | 4.5 | neat |
| TOP | Pink Peppercorn | 1.0 | D10 |
| TOP | Aldehyde C-14 Peach | 2.0 | neat |
| TOP | Raspberry Accord | 1.0 | neat |
| HEART | Hedione (Firmenich) | 14.7 | neat |
| HEART | Jasmin Absolute Accord | 3.0 | neat |
| HEART | Tuberose Accord | 1.5 | neat |
| HEART | Methyl Alpha Ionone Iso | 4.0 | neat |
| HEART | Benzyl Salicylate | 7.0 | neat |
| HEART | Linalool | 1.5 | neat |
| HEART | Damascone Beta *(optional)* | 0.3 | D10 |
| BASE | Vanillin Crystals | 7.0 | neat |
| BASE | Ethyl Vanillin | 2.5 | neat |
| BASE | Maltol (Crystals) | 2.0 | D10 |
| BASE | Coumarin | 4.5 | neat |
| BASE | Heliotrope Accord | 2.5 | neat |
| BASE | Aldehyde C-18 Coconut | 1.5 | D10 |
| BASE | Ambroxan | 7.5 | neat |
| BASE | Iso E Super | 9.5 | neat |
| BASE | Cashmeran IFF | 3.0 | neat |
| BASE | Sandalore (Givaudan) | 3.5 | neat |
| BASE | Ethylene Brassylate | 7.5 | neat |
| BASE | Galaxolide | 5.5 | neat |
| BASE | Exaltolide Total (Firmenich) | 2.5 | neat |
| BASE | Saffron Accord *(optional)* | 0.5 | neat |
| | **TOTAL** | **100.0** | |

The two optionals can be removed with the YES/NO toggle on the Formula Master. The workbook renormalises everything else to 100% automatically.

---

## Workbook

`SAMR_Production_Suite.xlsx` is generated from `build_workbook.py`. Every output is a live Excel formula, so changing inputs updates the connected sheets.

Key tabs:

- **Dashboard** — top-level production status.
- **The Scent** — SAMR story and note pyramid.
- **Formula Master** — editable formula with optional toggle.
- **Batch Calculator** — printable batch sheet.
- **Inventory** — editable packs, prices, density, stock, alerts, and product links.
- **Yield & Capacity** — live bottleneck and bottle-count analysis.
- **Scale-Up Plan** — target maximum production, required grams, shortage, packs to buy, and added cost.
- **Pricing & Sales** — cost-plus pricing model.
- **Selling Strategy** — proposed launch prices, channels, and go/no-go checklist.
- **Process Reference** and **Safety Notes** — bench SOP and safety rules.

Commands:

```powershell
python build_workbook.py
python check_workbook.py
python distribute.py
```

Versioning creates permanent `SAMR NNN` folders locally and, when available, under `G:\My Drive\SAMR\`.

---

## Safety

- Damascone Beta is used only as D10.
- Use one amber material only.
- Alcohol products self-preserve.
- Water-containing products require preservative.
- Creams are stricter than fine fragrance; keep fragrance at or below 1.2%.
- Weigh in grams, never drops.
- Verify against current IFRA before any commercial sale.
- For Saudi sale: check SFDA registration, Arabic/English label, allergen declaration, and VAT requirements.
