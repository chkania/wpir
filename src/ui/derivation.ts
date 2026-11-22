import { yearOf } from '../core/dates';
import { kfwLoanVariant } from '../core/funding';
import { incomeRangeLabel, incomeRangeValue } from '../core/income-range';
import { createPriceModel, energySplit } from '../core/prices';
import { pvSummary } from '../core/pv';
import { decodeHash, mergeInputs } from '../core/serialize';
import { para14aFor, runAll, type RunResult } from '../core/simulation';
import type { CostBreakdown, Inputs, ScenarioResult } from '../core/types';
import type { TocEntry } from '../help';
import { derivationLink } from './derivation-link';
import { escapeHtml, fmtEur, fmtMonth, fmtNum, fmtPct } from './format';

export { DERIVATION_PAGE, derivationLink } from './derivation-link';

/**
 * Derivation page (Rechenweg, F32): shows how every key figure comes about, with the inputs inserted.
 * Nothing is calculated a second time – all values come from the same run of the calculation core
 * (`runAll` and the models it uses); this module only arranges them and adds explanatory text.
 */

/** Same storage key as the calculator (STORAGE_KEY in src/ui/app.ts, not imported so the page does not load the calculator; a test keeps both equal). */
export const CALCULATOR_STORAGE_KEY = 'wp-investitionsrechner:v1';

export type DerivationSource = 'hash' | 'storage' | 'default';

/** Inputs for the page: from the link ("#z=…"), otherwise the inputs saved by the calculator, otherwise the defaults. */
export function loadDerivationInputs(defaults: Inputs, hash: string, storage: Storage | null): { inputs: Inputs; source: DerivationSource } {
  const fromHash = decodeHash(defaults, hash);
  if (fromHash) return { inputs: fromHash, source: 'hash' };
  try {
    const raw = storage?.getItem(CALCULATOR_STORAGE_KEY);
    if (raw) return { inputs: mergeInputs(defaults, JSON.parse(raw)), source: 'storage' };
  } catch {
    /* storage unavailable or invalid */
  }
  return { inputs: mergeInputs(defaults, {}), source: 'default' };
}

// ---------- Formatting ----------

const kwh = (x: number) => `${fmtNum(x)} kWh`;
const ct = (x: number, d = 2) => `${fmtNum(x, d)} ct/kWh`;
const num = (x: number, d = 2) => fmtNum(x, d);
const pct = (x: number) => fmtPct(x, Math.round(x * 1000) % 10 === 0 ? 0 : 1);
/** Signed amount: expenses positive, income negative (as in the calculation core). */
const signed = (x: number) => (Math.abs(x) < 0.005 ? '0 €' : `${x < 0 ? '−' : ''}${fmtEur(Math.abs(x))}`);
const e = escapeHtml;

/** A calculation table: label, calculation with the values inserted, result. */
type CalcRow = [label: string, formula: string, result: string];

function calcTable(caption: string, rows: CalcRow[]): string {
  return `<div class="table-wrap"><table class="calc"><caption>${e(caption)}</caption>
    <thead><tr><th scope="col">Größe</th><th scope="col">Rechnung</th><th scope="col" class="num">Ergebnis</th></tr></thead>
    <tbody>${rows.map(([l, f, r]) => `<tr><th scope="row">${e(l)}</th><td class="calc-formula">${e(f)}</td><td class="num">${e(r)}</td></tr>`).join('')}</tbody>
  </table></div>`;
}

function section(toc: TocEntry[], id: string, title: string, body: string): string {
  toc.push({ id, text: title, level: 2 });
  return `<h2 id="${id}"><a class="anchor" href="#${id}" aria-hidden="true">#</a>${e(title)}</h2>${body}`;
}

const SCENARIO_NAMES: Record<ScenarioResult['kind'], string> = {
  ref: 'Ohne Wärmepumpe',
  kfw: 'WP + KfW-Zuschuss',
  tax: 'WP + Steuerbonus',
};

// ---------- Sections ----------

function overviewHtml(inp: Inputs, run: RunResult): string {
  const best = run.best === 'tax' ? run.tax : run.kfw;
  const r = inp.general.opportunityRate;
  const q = Math.pow(1 + r, 1 / 12) - 1;
  const rows: [string, (s: ScenarioResult) => string][] = [
    ['Gesamtkosten (mit Opportunitätszins)', (s) => (s.feasible || s.kind === 'ref' ? signed(s.totalCost) : 'nicht möglich')],
    ['Summe aller Zahlungen ohne Verzinsung', (s) => signed(s.nominalCost)],
    ['CO₂ im Zeitraum', (s) => `${fmtNum(s.co2Tons, 1)} t`],
    ['Inbetriebnahme WP', (s) => fmtMonth(s.installMonth)],
    ['Amortisation', (s) => (s.kind === 'ref' ? '–' : fmtMonth(s.kind === 'kfw' ? run.breakEvenKfw : run.breakEvenTax))],
  ];
  const all = [run.ref, run.kfw, run.tax];
  return `<p>Der Rechner simuliert jeden Monat des Betrachtungszeitraums (${fmtMonth(run.ref.months[0].month)} bis ${fmtMonth(run.ref.months.at(-1)!.month)}) für drei Szenarien: weiter mit der bisherigen Heizung, Wärmepumpe mit KfW-Zuschuss und Wärmepumpe mit Steuerbonus. Jeder Monat erhält Einnahmen und Ausgaben; aufsummiert ergeben sie die Gesamtkosten.</p>
    <div class="table-wrap"><table class="compact"><caption>Kennzahlen der drei Szenarien</caption>
      <thead><tr><th scope="col">Kennzahl</th>${all.map((s) => `<th scope="col" class="num">${SCENARIO_NAMES[s.kind]}</th>`).join('')}</tr></thead>
      <tbody>${rows.map(([l, f]) => `<tr><th scope="row">${e(l)}</th>${all.map((s) => `<td class="num">${e(f(s))}</td>`).join('')}</tr>`).join('')}</tbody>
    </table></div>
    ${calcTable('Vom Monatswert zu den Gesamtkosten', [
      ['Monatlicher Opportunitätszins q', `(1 + ${pct(r)})^(1/12) − 1`, `${fmtNum(q * 100, 4)} %`],
      ['Kumulierte Kosten nach Monat t', 'kumuliert(t−1) × (1 + q) + Summe des Monats t', 'siehe Abschnitt Kosten'],
      ['Gesamtkosten', 'kumulierte Kosten im letzten Monat', signed(best.totalCost)],
      ['Bester Weg', `${SCENARIO_NAMES.kfw} ${signed(run.kfw.totalCost)} gegen ${SCENARIO_NAMES.tax} ${run.tax.feasible ? signed(run.tax.totalCost) : 'nicht möglich'}`, run.best === 'tax' ? 'Steuerbonus' : 'KfW-Zuschuss'],
      ['Ersparnis mit Wärmepumpe', `${signed(run.ref.totalCost)} − ${signed(best.totalCost)}`, signed(run.ref.totalCost - best.totalCost)],
    ])}
    <p class="muted">Der Opportunitätszins steht für die Rendite, die Geld anderswo erzielt hätte: Eine frühe Ausgabe wiegt dadurch schwerer als eine späte. Bei 0 % sind Gesamtkosten und Summe ohne Verzinsung gleich.</p>`;
}

function energyHtml(inp: Inputs, run: RunResult): string {
  const o = inp.oldHeating;
  const hp = inp.heatPump;
  const s = energySplit(inp);
  const pv = pvSummary(inp);
  const cookShare = o.fuel === 'gas' && o.cookingWithGas ? Math.max(0, o.cookingShare) : 0;
  const dhwShare = o.dhwViaHeating ? Math.max(0, o.dhwShare) : 0;
  const fuelName = o.fuel === 'gas' ? 'Gas' : 'Heizöl';
  const old: CalcRow[] = [
    o.fuel === 'gas'
      ? ['Verbrauch heute', 'Ihre Angabe', `${kwh(s.fuelTotal)} Gas`]
      : ['Verbrauch heute', `${fmtNum(o.consumption)} l × ${num(inp.prices.oilKwhPerLiter, 1)} kWh/l (Heizwert)`, `${kwh(s.fuelTotal)} Heizöl`],
  ];
  if (s.cookingFuel > 0) old.push(['davon Kochen', `${kwh(s.fuelTotal)} × ${pct(cookShare)}`, kwh(s.cookingFuel)]);
  old.push(['Heizenergie (ohne Kochen)', `${kwh(s.fuelTotal)} − ${kwh(s.cookingFuel)}`, kwh(s.heatingFuel)]);
  if (s.dhwFuel > 0) old.push(['davon Warmwasser', `${kwh(s.fuelTotal)} × ${pct(Math.min(dhwShare, 1 - cookShare))}`, kwh(s.dhwFuel)]);
  old.push(
    ['Nutzwärme Raumwärme', `(${kwh(s.heatingFuel)} − ${kwh(s.dhwFuel)}) × ${pct(o.efficiency)} Nutzungsgrad`, kwh(s.spaceHeat)],
    ['Nutzwärme Warmwasser', `${kwh(s.dhwFuel)} × ${pct(o.efficiency)}`, kwh(s.dhwHeat)],
    ['Nutzwärme gesamt', `${kwh(s.spaceHeat)} + ${kwh(s.dhwHeat)}`, kwh(s.spaceHeat + s.dhwHeat)],
  );
  const heat = s.spaceHeat + s.dhwHeat;
  const wp: CalcRow[] = [['Strom der Wärmepumpe', `${kwh(heat)} ÷ ${num(hp.jaz, 1)} (JAZ)`, kwh(pv.annualHp)]];
  if (hp.pvKwp > 0) {
    wp.push(
      ['davon aus der eigenen PV-Anlage', `Monatsmodell: PV-Ertrag ${kwh(pv.annualPv)} im Jahr, im Winter wenig für die Wärmepumpe`, `${kwh(pv.annualHpFromPv)} (${pct(pv.share)})`],
      ['Strom aus dem Netz', `${kwh(pv.annualHp)} − ${kwh(pv.annualHpFromPv)}`, kwh(pv.annualHp - pv.annualHpFromPv)],
    );
  }
  if (s.cookingFuel > 0) {
    wp.push(
      o.cookingAfter === 'gas'
        ? ['Kochen nach dem Umstieg', 'bleibt auf Gas (Gasanschluss mit Grundpreis bleibt)', `${kwh(s.cookingFuel)} Gas`]
        : ['Kochen nach dem Umstieg', `${kwh(s.cookingFuel)} Gas × ${num(inp.prices.cookingElecFactor)} (Induktion, Haushaltsstrom)`, `${kwh(s.cookingFuel * inp.prices.cookingElecFactor)} Strom`],
    );
  }
  const repl = run.ref.boilerPurchases[0];
  return `<p>Grundlage ist Ihr bisheriger Verbrauch. Er wird in Kochen, Warmwasser und Raumwärme aufgeteilt und über den Nutzungsgrad der alten Heizung in die Wärme umgerechnet, die das Haus tatsächlich braucht (Nutzwärme). Diese Wärme muss jede Heizung liefern – die alte mit ${fuelName}, die Wärmepumpe mit Strom.</p>
    ${calcTable('Jahresbedarf mit der bisherigen Heizung', old)}
    ${calcTable('Jahresbedarf mit der Wärmepumpe', wp)}
    <p>Auf die Monate verteilt der Rechner die Raumwärme nach einem typischen Heizprofil (viel im Winter, kaum im Sommer) und das Warmwasser fast gleichmäßig. Ein neuer Gas- bzw. Ölkessel braucht für dieselbe Nutzwärme ${kwh(heat)} ÷ ${pct(o.replacementEfficiency)} = ${kwh(heat / o.replacementEfficiency)} ${fuelName}${repl ? ` – im Szenario ohne Wärmepumpe ab ${fmtMonth(repl.month)}, wenn die Altanlage ihr Lebensende erreicht` : ''}.</p>`;
}

function pricesHtml(inp: Inputs, run: RunResult): string {
  const pm = createPriceModel(inp);
  const p = inp.prices;
  const hp = inp.heatPump;
  const fuel = inp.oldHeating.fuel;
  const vat = inp.general.vat;
  const factor = fuel === 'gas' ? p.gasCo2Factor : p.oilCo2Factor;
  const today = fuel === 'gas' ? p.gasPriceCt : (p.oilPriceEur * 100) / p.oilKwhPerLiter;
  const surcharge0 = pm.co2SurchargeCt(fuel, pm.startYear);
  const increase = fuel === 'gas' ? p.gasIncrease : p.oilIncrease;
  const rows: CalcRow[] = [
    fuel === 'gas'
      ? ['Gaspreis heute (inkl. CO₂)', 'Ihre Angabe', ct(today)]
      : ['Heizölpreis heute (inkl. CO₂)', `${num(p.oilPriceEur)} €/l × 100 ÷ ${num(p.oilKwhPerLiter, 1)} kWh/l`, ct(today)],
    [`CO₂-Aufschlag ${pm.startYear}`, `${fmtNum(pm.co2Price(pm.startYear))} €/t × ${num(factor, 3)} kg/kWh ÷ 10 × (1 + ${pct(vat)} MwSt.)`, ct(surcharge0)],
    ['Preis ohne CO₂ im Startmonat', `${ct(today)} − ${ct(surcharge0)}`, ct(today - surcharge0)],
    ['Preis im Monat t', `Preis ohne CO₂ × (1 + ${pct(increase)})^(Monate seit Start ÷ 12) + CO₂-Aufschlag des Jahres`, 'siehe Tabelle'],
    [
      'Strom für die Wärmepumpe',
      `${hp.separateTariff ? 'Wärmepumpentarif' : 'Haushaltsstrom'} ${ct(hp.separateTariff ? hp.elecPriceCt : hp.householdPriceCt)} × (1 + ${pct(hp.elecIncrease)})^(Monate ÷ 12)`,
      'siehe Tabelle',
    ],
    [
      'Grund- und Zählerkosten WP im Jahr',
      `${hp.separateTariff ? `Zählergrundpreis ${fmtEur(hp.meterFee)} (steigt wie der Strompreis)` : 'kein eigener Zähler'} + intelligentes Messsystem ${fmtEur(hp.smartMeterFee)} (fest) − § 14a-Pauschale ${fmtEur(para14aFor(hp))}`,
      signed((hp.separateTariff ? hp.meterFee : 0) + hp.smartMeterFee - para14aFor(hp)),
    ],
  ];
  if (p.bioEnabled) rows.push(['Bio-Aufpreis neuer Kessel', `(Pflichtanteil Bio − heutiger Bio-Anteil ${pct(pm.currentBioShare)}) × ${ct(p.bioPremiumCt)}`, 'siehe Tabelle']);
  const years = run.ref.years.map((y) => y.year);
  const isGas = fuel === 'gas';
  const head = ['Jahr', 'CO₂-Preis', 'CO₂-Aufschlag', `${isGas ? 'Gas' : 'Heizöl'} (inkl. CO₂)`, 'Bio-Aufpreis neuer Kessel', 'Strom WP', 'Haushaltsstrom', ...(isGas ? ['Gas-Grundpreis'] : []), 'Strommix'];
  const body = years
    .map((y) => {
      const m = Math.max(pm.startMonth, y * 12);
      const cells = [
        `${fmtNum(pm.co2Price(y))} €/t`,
        ct(pm.co2SurchargeCt(fuel, y)),
        ct(pm.fuelCt(fuel, m)),
        ct(pm.bioSurchargeCt(y)),
        ct(pm.elecCt(m)),
        ct(pm.householdCt(m)),
        ...(isGas ? [`${fmtEur(pm.gasBaseFee(m))}/Jahr`] : []),
        `${fmtNum(pm.gridCo2Kg(y) * 1000)} g/kWh`,
      ];
      return `<tr><th scope="row">${y}</th>${cells.map((c) => `<td class="num">${e(c)}</td>`).join('')}</tr>`;
    })
    .join('');
  return `<p>Der eingegebene Preis gilt für den Startmonat und enthält den CO₂-Preis. Der Rechner zieht den CO₂-Anteil ab, lässt den Rest jährlich steigen und schlägt den CO₂-Preis des jeweiligen Jahres wieder auf. So wirkt der steigende CO₂-Preis zusätzlich zur allgemeinen Preissteigerung.</p>
    ${calcTable('Preise und ihre Entwicklung', rows)}
    <div class="table-wrap"><table class="compact"><caption>Preise je Jahr (Stand Januar, im Startjahr Startmonat; gerechnet wird mit dem Wert jedes Monats)</caption>
      <thead><tr>${head.map((h, i) => `<th scope="col"${i ? ' class="num"' : ''}>${e(h)}</th>`).join('')}</tr></thead>
      <tbody>${body}</tbody></table></div>
    <p class="muted">Strommix: CO₂ je kWh Netzstrom${hp.greenElectricity ? ' – mit Ökostromtarif als 0 gerechnet' : ''}. Eigener PV-Strom wird mit der entgangenen Einspeisevergütung (${ct(hp.feedInCt, 1)}) bewertet.</p>`;
}

function investHtml(inp: Inputs, run: RunResult): string {
  const v = run.kfw.invest ?? run.tax.invest;
  if (!v) return '<p>Die Wärmepumpe liegt außerhalb des Betrachtungszeitraums – es gibt keine Investition.</p>';
  const hp = inp.heatPump;
  const g = `× ${num(v.growth, 4)} (Preissteigerung bis ${fmtMonth(v.month)})`;
  const rows: CalcRow[] = [
    ['Wärmepumpe', `${fmtEur(hp.investment)} ${g}`, fmtEur(v.heatPump)],
    ['davon förderfähig', `${fmtEur(v.heatPump)} × ${pct(hp.eligibleShare)}${hp.meterSetupEligible && v.meterSetup > 0 ? ` + Zählerplatz ${fmtEur(v.meterSetup)}` : ''}`, fmtEur(v.eligible)],
  ];
  if (v.meterSetup > 0) rows.push(['Zählerplatz für WP-Tarif', `${fmtEur(hp.meterSetupCost)} ${g}${hp.meterSetupEligible ? ', förderfähig' : ', nicht förderfähig'}`, fmtEur(v.meterSetup)]);
  if (hp.extraCost > 0 || (!hp.meterSetupEligible && v.meterSetup > 0)) rows.push(['Nicht förderfähige Zusatzkosten', `Zusatzkosten ${fmtEur(hp.extraCost)} ${g}${!hp.meterSetupEligible && v.meterSetup > 0 ? ' + Zählerplatz' : ''}`, fmtEur(v.extra)]);
  rows.push(['Investition gesamt', 'Wärmepumpe + Zusatzkosten + Zählerplatz', fmtEur(v.total)]);
  if (v.cooktop > 0) rows.push(['Neues Kochfeld (aus eigenen Mitteln)', `${fmtEur(inp.oldHeating.cookingSwitchCost)} ${g}`, fmtEur(v.cooktop)]);
  for (const s of [run.kfw, run.tax]) {
    if (!s.invest) continue;
    rows.push([`Eigenkapital ${SCENARIO_NAMES[s.kind]}`, 'Ihre Angabe, höchstens die Investition', fmtEur(s.invest.equity)]);
  }
  return `<p>Die Investition fällt im Monat der Inbetriebnahme an. Preise aus dem Angebot steigen bis dahin mit der angenommenen Preissteigerung für Investitionen (${pct(inp.general.investIncrease)} im Jahr). Was nicht aus Eigenkapital bezahlt wird, finanziert ein Kredit.</p>
    ${calcTable(`Investition bei Inbetriebnahme ${fmtMonth(v.month)}`, rows)}`;
}

/** Explanation of the application month (F1.5, F32.2): automatic (lead time) or fixed. Months as MM/JJJJ like the rest of the Rechenweg. */
function applicationExplanation(inp: Inputs, appMonth: number, install: number): string {
  if (inp.heatPump.applicationMonth === '') {
    return `automatisch: Inbetriebnahme ${fmtMonth(install)} minus ${install - appMonth} Monate = ${fmtMonth(appMonth)}`;
  }
  return `festgelegt: ${fmtMonth(appMonth)}`;
}

function kfwHtml(inp: Inputs, run: RunResult): string {
  const k = run.kfw.kfw;
  if (!k) return '<p>Kein KfW-Zuschuss: Die Wärmepumpe liegt außerhalb des Betrachtungszeitraums.</p>';
  const f = inp.funding;
  const units = Math.max(1, Math.floor(inp.building.units));
  const base = k.grundRate + k.wsbRate;
  const sum = base + k.kgbRate + k.incomeRate;
  const rows: CalcRow[] = [
    ['Antragsmonat', applicationExplanation(inp, k.appMonth, run.kfw.installMonth!), fmtMonth(k.appMonth)],
    ['Grundförderung', 'Satz im Antragsmonat', pct(k.grundRate)],
  ];
  if (k.wsbRate > 0) rows.push(['Wertschöpfungs-Bonus', 'Wärmepumpe mit EU-Ursprung', pct(k.wsbRate)]);
  rows.push(
    ['Klimageschwindigkeitsbonus', k.kgbRate > 0 ? 'Satz im Antragsmonat (sinkt halbjährlich)' : 'entfällt (siehe Hinweise)', pct(k.kgbRate)],
    ['Einkommensbonus', `zu versteuerndes Haushaltseinkommen ${incomeRangeLabel(inp.building.incomeRange)}${inp.building.hasChild ? ', mit Kind' : ''}`, pct(k.incomeRate)],
    ['Fördersatz', `${pct(base)} + ${pct(k.kgbRate)} + ${pct(k.incomeRate)} = ${pct(sum)}, höchstens ${pct(k.maxRate)}`, pct(k.ownerUnitRate)],
    ['Höchstbetrag förderfähiger Kosten', units > 1 ? `${units} Wohneinheiten, Staffel im Antragsmonat` : 'erste Wohneinheit, Höchstbetrag im Antragsmonat', fmtEur(k.capTotal)],
    ['Förderfähige Kosten', `min(${fmtEur(run.kfw.invest?.eligible ?? 0)}; ${fmtEur(k.capTotal)})`, fmtEur(k.eligibleCosts)],
  );
  if (inp.building.ownerOccupied && units > 1) {
    const share = k.eligibleCosts / units;
    rows.push(['Zuschuss', `${pct(base)} × (${fmtEur(k.eligibleCosts)} − ${fmtEur(share)}) + ${pct(k.ownerUnitRate)} × ${fmtEur(share)} (selbstgenutzte Einheit)`, fmtEur(k.subsidy)]);
  } else {
    rows.push(['Zuschuss', `${pct(k.ownerUnitRate)} × ${fmtEur(k.eligibleCosts)}`, fmtEur(k.subsidy)]);
  }
  if (run.kfw.subsidyMonth !== undefined) {
    const loan = run.kfw.loans.find((l) => l.extras.some((x) => x.label === 'Zuschuss' && x.applied > 0));
    rows.push(['Auszahlung', `Inbetriebnahme + ${Math.round(inp.financing.subsidyDelayMonths)} Monate${loan ? `, als Sondertilgung des ${loan.name.replace(/^(KfW-Kredit|Bankkredit)/, '$1s')}` : ''}`, fmtMonth(run.kfw.subsidyMonth)]);
  }
  return `<p>Der Zuschuss der KfW (Programm 458) ist ein Prozentsatz der förderfähigen Kosten. Die Sätze hängen vom Antragsmonat ab – der Antrag muss vor dem Vertrag gestellt werden, deshalb rechnet der Rechner mit dem eingetragenen Antragsmonat, sonst mit 4 Monaten vor der Inbetriebnahme.${inp.building.ownerOccupied ? '' : ' Boni gibt es nur bei Selbstnutzung.'} Grenzwerte: Höchstsatz ${pct(f.maxRate)}, bei niedrigem Einkommen ${pct(f.maxRateLowIncome)}.</p>
    ${calcTable('KfW-Zuschuss', rows)}
    ${notesHtml(k.notes)}`;
}

function taxHtml(inp: Inputs, run: RunResult): string {
  const t = run.tax.tax;
  if (!t) return '<p>Kein Steuerbonus: Die Wärmepumpe liegt außerhalb des Betrachtungszeitraums.</p>';
  const p = inp.tax;
  if (!t.eligible) return `<p>Der Steuerbonus ist in diesem Fall nicht möglich.</p>${notesHtml(t.notes)}`;
  const cost = run.tax.invest?.eligible ?? 0;
  const base = Math.max(0, Math.min(cost, p.maxCost));
  const rates = [p.rateYear1, p.rateYear2, p.rateYear3];
  const rows: CalcRow[] = [['Bemessungsgrundlage', `min(${fmtEur(cost)}; ${fmtEur(p.maxCost)})`, fmtEur(base)]];
  (run.tax.taxRefunds ?? []).forEach((y, i) => {
    rows.push([`Steuerjahr ${y.year}`, `${fmtEur(base)} × ${pct(rates[i])}, höchstens Restbetrag von ${fmtEur(p.maxBonus)}${inp.building.incomeTax > 0 ? ` und Steuerschuld ${fmtEur(inp.building.incomeTax)}` : ''}; erstattet ${fmtMonth(y.month)}`, fmtEur(y.amount)]);
  });
  rows.push(['Steuerbonus gesamt', 'Summe der drei Jahre', fmtEur(t.total)]);
  return `<p>Der Steuerbonus nach § 35c EStG mindert die Einkommensteuer im Jahr des Abschlusses und in den zwei folgenden Jahren. Das Geld kommt mit dem Steuerbescheid, also im Folgejahr – der Rechner setzt die Erstattung in den Monat ${Math.round(inp.financing.taxRefundMonth)} des Folgejahres. KfW-Zuschuss und Steuerbonus schließen sich aus.</p>
    ${calcTable('Steuerbonus', rows)}
    ${notesHtml(t.notes)}`;
}

function loansHtml(inp: Inputs, run: RunResult): string {
  const parts = [run.kfw, run.tax].map((s) => {
    if (s.loans.length === 0) return `<h3>${SCENARIO_NAMES[s.kind]}</h3><p>Kein Kredit – die Investition ist aus Eigenkapital bezahlt.</p>`;
    const rows = s.loans.map((l) => {
      const cells = [
        fmtEur(l.principal),
        `${fmtNum(l.rate * 100, 2)} %`,
        fmtMonth(l.startMonth),
        l.repaymentStartMonth === null ? 'sofort' : fmtMonth(l.repaymentStartMonth),
        l.fixEndMonth === null ? '–' : `${fmtMonth(l.fixEndMonth)}, danach ${fmtNum(l.followUpRate * 100, 2)} %`,
        fmtEur(l.totalInterest),
        fmtEur(l.totalFees),
        l.payoffMonth === null ? 'nach dem Zeitraum' : fmtMonth(l.payoffMonth),
        fmtEur(l.balanceAtEnd),
      ];
      return `<tr><th scope="row">${e(l.name)}</th>${cells.map((c) => `<td class="num">${e(c)}</td>`).join('')}</tr>`;
    });
    const extras = s.loans.flatMap((l) =>
      l.extras.map((x) => `<li>${e(l.name)}, ${e(x.label ?? "Sondertilgung")} ${e(fmtMonth(x.month))}: ${e(fmtEur(x.applied))} getilgt${x.freeAmount ? `, davon ${e(fmtEur(x.freeAmount))} im kostenfreien Kontingent` : ''}${x.fee > 0 ? `, Gebühr ${e(fmtEur(x.fee))}` : ''}${x.status === 'rejected' ? ` – nicht möglich: ${e(x.reason ?? '')}` : x.status === 'partial' ? ` – nur teilweise: ${e(x.reason ?? '')}` : ''}</li>`),
    );
    return `<h3>${SCENARIO_NAMES[s.kind]}</h3>
      <div class="table-wrap"><table class="compact"><caption>Kredite im Szenario ${SCENARIO_NAMES[s.kind]}</caption>
        <thead><tr><th scope="col">Kredit</th>${['Betrag', 'Zins', 'Auszahlung', 'Tilgung ab', 'Zinsbindung bis', 'Zinsen im Zeitraum', 'Gebühren', 'abbezahlt', 'Restschuld am Ende'].map((h) => `<th scope="col" class="num">${h}</th>`).join('')}</tr></thead>
        <tbody>${rows.join('')}</tbody></table></div>
      ${extras.length ? `<p>Sondertilgungen:</p><ul>${extras.join('')}</ul>` : ''}`;
  });
  const variant = kfwLoanVariant(inp.building.ownerOccupied, inp.building.units, incomeRangeValue(inp.building.incomeRange), inp.funding);
  const kfwText = inp.financing.useKfwLoan
    ? `deckt zuerst der KfW-Ergänzungskredit ${variant} (höchstens die förderfähigen Kosten) den Bedarf, den Rest ein Bankkredit`
    : 'deckt ein Bankkredit den Bedarf';
  return `<p>Kreditbedarf = Investition − Eigenkapital. Im KfW-Szenario ${kfwText}; im Steuerbonus-Szenario ein Bankkredit. Jeder Kredit wird als Annuitätendarlehen Monat für Monat gerechnet: Die Rate bleibt gleich, der Zinsanteil sinkt, der Tilgungsanteil steigt. Eine Restschuld am Ende des Zeitraums wird als Ablösung im letzten Monat gezahlt. Zinsen und Tilgung je Monat stehen in den Spalten der Kostentabelle.</p>
    ${parts.join('')}`;
}

const COLUMNS: [keyof CostBreakdown, string][] = [
  ['energy', 'Energie'],
  ['fixed', 'Grund-/Zählerkosten'],
  ['maintenance', 'Wartung'],
  ['investment', 'Investition'],
  ['loanPayout', 'Kreditauszahlung'],
  ['interest', 'Zinsen'],
  ['principal', 'Tilgung'],
  ['fees', 'Gebühren'],
  ['subsidy', 'Zuschuss'],
  ['taxBonus', 'Steuerbonus'],
  ['residual', 'Restwert'],
  ['total', 'Summe'],
];

const SYSTEM: Record<'old' | 'new' | 'wp', string> = { old: 'Altanlage', new: 'neuer Kessel', wp: 'Wärmepumpe' };

/** Cost columns that are not zero in any month of the scenario (the sum is always shown). */
function usedColumns(s: ScenarioResult): [keyof CostBreakdown, string][] {
  return COLUMNS.filter(([k]) => k === 'total' || s.months.some((m) => Math.abs(m[k]) >= 0.005));
}

/** Year rows with expandable month rows (F32.3). */
export function costTableHtml(s: ScenarioResult): string {
  const cols = usedColumns(s);
  const head = ['Heizung', 'Wärme', 'CO₂', ...cols.map(([, l]) => l), 'Kumuliert'];
  const groups = s.years.map((y) => {
    const ms = s.months.map((m, i) => ({ m, i })).filter(({ m }) => yearOf(m.month) === y.year);
    const heat = ms.reduce((a, { m }) => a + m.heatKWh, 0);
    const co2 = ms.reduce((a, { m }) => a + m.co2Kg, 0);
    const systems = [...new Set(ms.map(({ m }) => SYSTEM[m.system]))].join(' / ');
    const id = `${s.kind}-${y.year}`;
    const yearRow = `<tr class="year-row"><th scope="row"><button type="button" class="link-btn" aria-expanded="false" aria-controls="${id}" data-year-toggle="${id}">${y.year}</button></th>
      <td>${e(systems)}</td><td class="num">${e(kwh(heat))}</td><td class="num">${e(`${fmtNum(co2)} kg`)}</td>${cols.map(([k]) => `<td class="num">${e(signed(y[k]))}</td>`).join('')}<td class="num">${e(signed(y.cumulative))}</td></tr>`;
    const monthRows = ms
      .map(
        ({ m, i }) =>
          `<tr class="month-row" data-year-of="${id}" hidden><th scope="row">${e(fmtMonth(m.month))}</th><td>${e(SYSTEM[m.system])}${m.pvKWh > 0 ? ` <small class="muted">(${e(kwh(m.pvKWh))} PV)</small>` : ''}</td><td class="num">${e(kwh(m.heatKWh))}</td><td class="num">${e(`${fmtNum(m.co2Kg)} kg`)}</td>${cols.map(([k]) => `<td class="num">${e(signed(m[k]))}</td>`).join('')}<td class="num">${e(signed(s.cumulative[i]))}</td></tr>`,
      )
      .join('');
    return `<tbody id="${id}">${yearRow}${monthRows}</tbody>`;
  });
  return `<div class="table-wrap"><table class="compact cost-table"><caption>Kosten je Jahr – ${SCENARIO_NAMES[s.kind]}. Jahreszahl anklicken für die Monate.</caption>
    <thead><tr><th scope="col">Jahr</th>${head.map((h, i) => `<th scope="col"${i ? ' class="num"' : ''}>${e(h)}</th>`).join('')}</tr></thead>
    ${groups.join('')}</table></div>`;
}

function costsHtml(run: RunResult): string {
  const order = [run.ref, run.kfw, run.tax];
  return `<p>Jede Zeile ist die Summe der Einnahmen und Ausgaben eines Jahres; mit einem Klick auf die Jahreszahl klappen die Monate auf. Positive Beträge sind Ausgaben, negative Einnahmen (Kreditauszahlung, Zuschuss, Steuerbonus, Restwert). Die Kreditauszahlung gleicht die Investition aus; die Kosten des Kredits erscheinen als Zinsen und Tilgung. „Kumuliert“ enthält den Opportunitätszins und ergibt im letzten Monat die Gesamtkosten. Spalten ohne Beträge sind ausgeblendet. Die Monatswerte lassen sich als CSV-Datei laden, z. B. zum Nachrechnen in einer Tabellenkalkulation.</p>
    ${order
      .map(
        (s) => `<details class="scenario-costs"${s.kind === run.best || s.kind === 'ref' ? ' open' : ''}>
      <summary>${SCENARIO_NAMES[s.kind]}${s.kind === run.best ? ' (bester Weg)' : ''} – Gesamtkosten ${e(signed(s.totalCost))}${s.feasible || s.kind === 'ref' ? '' : ' (nicht möglich)'}</summary>
      <p><button type="button" data-csv="${s.kind}">Monatswerte als CSV herunterladen</button></p>
      ${costTableHtml(s)}
    </details>`,
      )
      .join('')}`;
}

function breakEvenHtml(run: RunResult): string {
  const parts = (['kfw', 'tax'] as const).map((kind) => {
    const s = run[kind];
    if (!s.feasible) return `<li>${SCENARIO_NAMES[kind]}: nicht möglich.</li>`;
    const be = kind === 'kfw' ? run.breakEvenKfw : run.breakEvenTax;
    if (be === null) return `<li>${SCENARIO_NAMES[kind]}: Bis zum Ende des Zeitraums liegen die kumulierten Kosten mit Wärmepumpe nicht dauerhaft unter denen ohne – keine Amortisation im Zeitraum (am Ende: ${e(signed(s.totalCost))} gegen ${e(signed(run.ref.totalCost))}).</li>`;
    const i = be - run.ref.months[0].month;
    const at = (j: number) => `${fmtMonth(run.ref.months[j].month)}: mit WP ${signed(s.cumulative[j])}, ohne WP ${signed(run.ref.cumulative[j])}`;
    return `<li>${SCENARIO_NAMES[kind]}: Amortisation ${e(fmtMonth(be))}. ${i > 0 ? `Davor ${e(at(i - 1))}; ` : ''}ab dann ${e(at(i))} – und bis zum Ende bleibt es dabei.</li>`;
  });
  return `<p>Amortisation ist der erste Monat, ab dem die kumulierten Kosten mit Wärmepumpe bis zum Ende des Zeitraums nie mehr über denen ohne Wärmepumpe liegen. Ein kurzer Vorsprung, der später wieder verloren geht (z. B. durch eine Ersatz-Wärmepumpe), zählt nicht.</p><ul>${parts.join('')}</ul>`;
}

function co2Html(inp: Inputs, run: RunResult): string {
  const p = inp.prices;
  const factor = inp.oldHeating.fuel === 'gas' ? p.gasCo2Factor : p.oilCo2Factor;
  const rows: CalcRow[] = [
    ['Bisherige Heizung je Monat', `Brennstoff (kWh) × (1 − Bio-Anteil ${pct(Math.min(1, Math.max(0, p.currentBioShare)))}) × ${num(factor, 3)} kg/kWh`, 'siehe Spalte CO₂'],
    ['Neuer Kessel', 'wie oben, Bio-Anteil mindestens der gesetzliche Pflichtanteil des Jahres', 'siehe Spalte CO₂'],
    ['Wärmepumpe je Monat', `Netzstrom (kWh) × Strommix des Jahres${inp.heatPump.greenElectricity ? ' (Ökostrom: 0)' : ''}; PV-Strom zählt als 0`, 'siehe Spalte CO₂'],
  ];
  for (const s of [run.ref, run.kfw, run.tax]) rows.push([`Summe ${SCENARIO_NAMES[s.kind]}`, 'Summe aller Monate ÷ 1000', `${fmtNum(s.co2Tons, 1)} t`]);
  const best = run.best === 'tax' ? run.tax : run.kfw;
  rows.push(['CO₂-Einsparung', `${fmtNum(run.ref.co2Tons, 1)} t − ${fmtNum(best.co2Tons, 1)} t`, `${fmtNum(run.ref.co2Tons - best.co2Tons, 1)} t`]);
  return `<p>Die CO₂-Bilanz zählt die direkten Emissionen beim Heizen und Kochen. Bio-Anteile gelten wie im Brennstoffemissionshandelsgesetz als klimaneutral.</p>${calcTable('CO₂-Bilanz', rows)}`;
}

function residualHtml(inp: Inputs, run: RunResult): string {
  if (!inp.general.residualValue) return '<p>Restwert ist ausgeschaltet: Anlagen, die am Ende noch laufen, werden nicht angerechnet.</p>';
  const rows: CalcRow[] = [run.ref, run.kfw, run.tax].map((s) => [SCENARIO_NAMES[s.kind], 'Summe der Restwerte im letzten Monat', signed(s.months.at(-1)!.residual)]);
  return `<p>Läuft eine Anlage am Ende des Zeitraums noch, wird ihr Restwert gutgeschrieben: Kaufpreis × verbleibende Lebensdauer ÷ gesamte Lebensdauer (linear). Das betrifft die Wärmepumpe (Lebensdauer ${fmtNum(inp.heatPump.lifeYears)} Jahre) und einen neuen Kessel im Szenario ohne Wärmepumpe (${fmtNum(inp.oldHeating.replacementLifeYears)} Jahre).</p>${calcTable('Restwert am Ende des Zeitraums', rows)}`;
}

function notesHtml(notes: string[]): string {
  return notes.length ? `<ul class="calc-notes">${notes.map((n) => `<li>${e(n)}</li>`).join('')}</ul>` : '';
}

function warningsHtml(run: RunResult): string {
  const items = [run.ref, run.kfw, run.tax].filter((s) => s.warnings.length > 0);
  if (items.length === 0) return '<p>Keine Hinweise.</p>';
  return items.map((s) => `<h3>${SCENARIO_NAMES[s.kind]}</h3>${notesHtml([...new Set(s.warnings)])}`).join('');
}

const SOURCE_TEXT: Record<DerivationSource, string> = {
  hash: 'Grundlage sind die Eingaben aus dem Link.',
  storage: 'Grundlage sind die Eingaben, die der Rechner in diesem Browser gespeichert hat. Haben Sie sie inzwischen geändert, laden Sie diese Seite neu.',
  default: 'Im Browser sind keine Eingaben gespeichert – gezeigt wird der Rechenweg mit den Standardwerten.',
};

/** Content of the derivation page with its table of contents. */
export function derivationHtml(inputs: Inputs, source: DerivationSource): { html: string; toc: TocEntry[]; title: string; run: RunResult } {
  const run = runAll(inputs);
  const toc: TocEntry[] = [];
  const name = inputs.scenario.name.trim();
  const intro = `<div class="doc-intro">
      <p><strong>${name ? `Szenario „${e(name)}“. ` : ''}</strong>${e(SOURCE_TEXT[source])} Alle Werte stammen aus derselben Rechnung wie im Rechner; diese Seite ordnet sie nur und erklärt sie. Beträge sind brutto und gerundet – kleine Abweichungen in der letzten Stelle sind Rundung.</p>
      <p><button type="button" id="dw-copy">Link zu diesem Rechenweg kopieren</button> <span id="dw-copy-status" role="status" aria-live="polite"></span></p>
      <p class="muted small">Der Link enthält alle Eingaben, auch persönliche Angaben wie das Haushaltseinkommen, die Steuerschuld und den Verbrauch. Wer ihn erhält, sieht diese Werte. Geben Sie ihn nur weiter, wenn Sie damit einverstanden sind – etwa für eine Fehlermeldung.</p>
    </div>`;
  const body = [
    section(toc, 'ergebnis', 'Ergebnis im Überblick', overviewHtml(inputs, run)),
    section(toc, 'energie', 'Energiebedarf', energyHtml(inputs, run)),
    section(toc, 'preise', 'Energiepreise', pricesHtml(inputs, run)),
    section(toc, 'investition', 'Investition', investHtml(inputs, run)),
    section(toc, 'kfw-zuschuss', 'KfW-Zuschuss', kfwHtml(inputs, run)),
    section(toc, 'steuerbonus', 'Steuerbonus', taxHtml(inputs, run)),
    section(toc, 'finanzierung', 'Finanzierung', loansHtml(inputs, run)),
    section(toc, 'kosten', 'Kosten je Jahr und Monat', costsHtml(run)),
    section(toc, 'amortisation', 'Amortisation', breakEvenHtml(run)),
    section(toc, 'co2', 'CO₂-Bilanz', co2Html(inputs, run)),
    section(toc, 'restwert', 'Restwert', residualHtml(inputs, run)),
    section(toc, 'hinweise', 'Hinweise der Berechnung', warningsHtml(run)),
  ];
  return { html: `<h1>Rechenweg</h1>${intro}${body.join('')}`, toc, title: 'Rechenweg', run };
}

/** Monthly values of a scenario as CSV (semicolon, decimal comma, for spreadsheets with German settings). */
export function monthsCsv(s: ScenarioResult): string {
  const n = (x: number) => x.toFixed(2).replace('.', ',');
  const head = ['Monat', 'Heizung', 'Wärme kWh', 'PV-Strom WP kWh', 'CO₂ kg', ...COLUMNS.map(([, l]) => `${l} €`), 'Kumuliert €'];
  const rows = s.months.map((m, i) => [fmtMonth(m.month), SYSTEM[m.system], n(m.heatKWh), n(m.pvKWh), n(m.co2Kg), ...COLUMNS.map(([k]) => n(m[k])), n(s.cumulative[i])]);
  return '﻿' + [head, ...rows].map((r) => r.join(';')).join('\r\n') + '\r\n';
}

export interface DerivationEnv {
  inputs: Inputs;
  defaults: Inputs;
  run: RunResult;
  /** Address of this page without hash. */
  pageUrl: string;
  today?: Date;
}

/** Interactions of the derivation page: expand months, CSV download, copy link. */
export function bindDerivation(root: HTMLElement, env: DerivationEnv): void {
  const status = root.querySelector<HTMLElement>('#dw-copy-status');
  root.addEventListener('click', (ev) => {
    const btn = (ev.target as HTMLElement).closest<HTMLButtonElement>('button');
    if (!btn) return;
    if (btn.dataset.yearToggle) {
      const open = btn.getAttribute('aria-expanded') !== 'true';
      btn.setAttribute('aria-expanded', String(open));
      root.querySelectorAll<HTMLElement>(`[data-year-of="${btn.dataset.yearToggle}"]`).forEach((r) => (r.hidden = !open));
    } else if (btn.dataset.csv) {
      const s = env.run[btn.dataset.csv as 'ref' | 'kfw' | 'tax'];
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([monthsCsv(s)], { type: 'text/csv;charset=utf-8' }));
      a.download = `rechenweg-${s.kind}-${(env.today ?? new Date()).toLocaleDateString('sv-SE')}.csv`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    } else if (btn.id === 'dw-copy') {
      const link = derivationLink(env.pageUrl, env.defaults, env.inputs);
      const done = (text: string) => status && (status.textContent = text);
      navigator.clipboard?.writeText(link).then(
        () => done('Link kopiert.'),
        () => done(`Kopieren nicht möglich – Link: ${link}`),
      ) ?? done(`Kopieren nicht möglich – Link: ${link}`);
    }
  });
}
