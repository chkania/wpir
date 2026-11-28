import type { InstallComparison } from '../core/compare';
import { energyTotal, type EnergyMonth, type EnergyParts, type EnergyYear } from '../core/energy';
import type { PriceRow, RunResult } from '../core/simulation';
import { fmtEur, fmtMonth, fmtNum } from './format';

export type ChartId = 'cumulative' | 'annual' | 'prices' | 'install' | 'energy';

export const MONTH_SHORT = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];
/** Dataset labels of the energy chart (F29). */
export const energyLabels = (e: EnergyYear) => ({
  need: 'Bedarf (Nutzenergie)',
  old: e.fuel === 'gas' ? 'Gas – Altanlage' : 'Heizöl – Altanlage',
  hp: 'Strom – Wärmepumpe',
  hpGas: 'Gas zum Kochen – mit Wärmepumpe',
});

/** Tabular version of a chart (text alternative, WCAG 1.1.1). */
export interface ChartTable {
  caption: string;
  head: string[];
  rows: string[][];
}

/** Returns the same values as a table for every chart – also without canvas (e.g. screen readers, tests). */
export function chartTables(
  run: RunResult,
  prices: PriceRow[],
  cmp: InstallComparison,
  energy?: EnergyYear,
): Partial<Record<ChartId, ChartTable>> {
  const scen = [
    ['Ohne WP', run.ref],
    ['WP + KfW', run.kfw],
    [run.tax.feasible ? 'WP + Steuerbonus' : 'WP + Steuerbonus (nicht möglich)', run.tax],
  ] as const;
  const byYear = (key: 'cumulative' | 'total') =>
    run.ref.years.map((y, i) => [String(y.year), ...scen.map(([, s]) => fmtEur(s.years[i]?.[key] ?? 0))]);
  return {
    cumulative: { caption: 'Kumulierte Kosten je Jahr (Endwert inkl. Opportunitätszins)', head: ['Jahr', ...scen.map(([l]) => l)], rows: byYear('cumulative') },
    annual: { caption: 'Jährliche Kosten je Szenario', head: ['Jahr', ...scen.map(([l]) => l)], rows: byYear('total') },
    prices: {
      caption: 'Preisentwicklung: Kosten je kWh Nutzwärme und CO₂-Preis',
      head: ['Jahr', 'Wärme aus Altanlage (ct/kWh)', 'Wärme aus Wärmepumpe (ct/kWh)', 'CO₂-Preis (€/t)'],
      rows: prices.map((p) => [String(p.year), fmtNum(p.heatCtFossil, 1), fmtNum(p.heatCtWp, 1), fmtNum(p.co2Price, 0)]),
    },
    install: {
      caption: 'Gesamtkosten im Betrachtungszeitraum je Zeitpunkt der Umrüstung',
      head: ['Inbetriebnahme', 'WP + KfW', 'WP + Steuerbonus', 'Ohne WP'],
      rows: cmp.rows.map((r) => [fmtMonth(r.installMonth), fmtEur(r.kfwTotal), r.taxFeasible ? fmtEur(r.taxTotal) : 'nicht möglich', fmtEur(cmp.refTotal)]),
    },
    ...(energy ? { energy: energyTable(energy) } : {}),
  };
}

/** Table of the energy chart (F29): demand split by use, consumption of the old system and the heat pump, with annual total. */
function energyTable(e: EnergyYear): ChartTable {
  const L = energyLabels(e);
  const n = (x: number) => fmtNum(x, 0);
  // Cooking only appears if it runs on gas today (otherwise it is outside the calculation)
  const cooking = e.months.some((m) => m.need.cooking > 0);
  const row = (label: string, need: EnergyParts, old: number, hp: number, gas: number) => [
    label,
    n(need.space),
    n(need.dhw),
    ...(cooking ? [n(need.cooking)] : []),
    n(energyTotal(need)),
    n(old),
    n(hp),
    ...(e.cookingStaysGas ? [n(gas)] : []),
  ];
  const sumParts = (f: (m: EnergyMonth) => number) => e.months.reduce((a, m) => a + f(m), 0);
  return {
    caption: 'Energie je Monat im typischen Jahr (kWh): Bedarf für Heizen, Warmwasser und Kochen und der Verbrauch dafür',
    head: ['Monat', 'Bedarf Heizen', 'Bedarf Warmwasser', ...(cooking ? ['Bedarf Kochen'] : []), 'Bedarf gesamt', L.old, L.hp, ...(e.cookingStaysGas ? [L.hpGas] : [])],
    rows: [
      ...e.months.map((m) => row(MONTH_SHORT[m.month - 1], m.need, energyTotal(m.old), energyTotal(m.hp), m.hpCookingGas)),
      row('Jahr', { space: sumParts((m) => m.need.space), dhw: sumParts((m) => m.need.dhw), cooking: sumParts((m) => m.need.cooking) }, e.totals.old, e.totals.hp, e.totals.hpCookingGas),
    ],
  };
}
