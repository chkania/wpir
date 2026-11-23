import { formatMonthDe, monthOf, parseMonth, tryParseMonth } from './dates';
import { SPACE_PROFILE } from './defaults';
import { installBounds } from './validate';
import { createSimContext, simulate, type RunResult } from './simulation';
import type { Inputs, ScenarioResult } from './types';

/** Cost categories for explaining the cheapest point in time (F7.3). */
export type CostPart = 'energy' | 'maintenance' | 'investment' | 'financing' | 'subsidy' | 'taxBonus' | 'residual';

export const COST_PART_LABELS: Record<CostPart, string> = {
  energy: 'Energie- und Grundkosten',
  maintenance: 'Wartung',
  investment: 'Investition (Wärmepumpe, ggf. Ersatzkessel)',
  financing: 'Finanzierung (Kredit, Zinsen, Tilgung)',
  subsidy: 'KfW-Zuschuss',
  taxBonus: 'Steuerbonus',
  residual: 'Restwert am Ende',
};
const PARTS = Object.keys(COST_PART_LABELS) as CostPart[];

export interface InstallComparisonRow {
  installMonth: number;
  kfwTotal: number;
  kfwSubsidy: number;
  taxTotal: number;
  taxFeasible: boolean;
  taxBonus: number;
  best: 'kfw' | 'tax';
  bestTotal: number;
  /** Saving compared with the reference (positive = cheaper than without heat pump). */
  savingVsRef: number;
  /** Extra cost compared with the earliest point in time (positive = waiting costs money). */
  extraVsFirst: number;
  /** Total cost of the best path by cost category (incl. opportunity interest (Opportunitätszins)); sum = bestTotal. */
  parts: Record<CostPart, number>;
  /** KfW: subsidy rate (Fördersatz) of the owner-occupied (selbstgenutzt) unit, climate speed bonus (Klimageschwindigkeitsbonus), cap on eligible costs (Höchstbetrag förderfähiger Kosten). */
  kfwRate: number;
  kgbRate: number;
  capTotal: number;
  /** Cost of replacement boilers (Ersatzkessel) before the heat pump (best path, nominal). */
  boilerCost: number;
  warnings: string[];
}

export interface InstallComparison {
  refTotal: number;
  rows: InstallComparisonRow[];
  bestIndex: number;
  /** Last commissioning month allowed by a fixed application month (F1.7, AK5); null without a fixed month. */
  latestInstall: number | null;
}

/** Splits the compounded total cost by cost category (compounding is linear, so the parts add up to the sum). */
export function costParts(s: ScenarioResult, opportunityRate: number): Record<CostPart, number> {
  const q = Math.pow(1 + opportunityRate, 1 / 12) - 1;
  const out = Object.fromEntries(PARTS.map((p) => [p, 0])) as Record<CostPart, number>;
  for (const r of s.months) {
    for (const p of PARTS) out[p] *= 1 + q;
    out.energy += r.energy + r.fixed;
    out.maintenance += r.maintenance;
    out.investment += r.investment;
    out.financing += r.loanPayout + r.interest + r.principal + r.fees;
    out.subsidy += r.subsidy;
    out.taxBonus += r.taxBonus;
    out.residual += r.residual;
  }
  return out;
}

/**
 * Compares installation dates from the start month in fixed steps (F7).
 * @param run result of `runAll` for the same inputs – its reference scenario is reused
 */
export function compareInstallTimes(inp: Inputs, run?: RunResult): InstallComparison {
  const ctx = createSimContext(inp);
  const start = ctx.start;
  const end = start + Math.round(inp.general.horizonYears * 12);
  const step = Math.max(1, Math.round(inp.compare.stepMonths));
  const count = Math.max(1, Math.round(inp.compare.count));
  const ref = run?.ref ?? simulate(inp, 'ref', undefined, ctx);
  // F1.7 (AK5): with a fixed application month, points in time after its window are left out
  const fixedApplication = tryParseMonth(inp.heatPump.applicationMonth);
  const latestInstall = fixedApplication === null ? null : installBounds(fixedApplication)[1];
  const rows: InstallComparisonRow[] = [];
  for (let i = 0; i < count; i++) {
    const month = start + i * step;
    if (month >= end || (latestInstall !== null && month > latestInstall)) break;
    const kfw = simulate(inp, 'kfw', month, ctx);
    const tax = simulate(inp, 'tax', month, ctx);
    const best = tax.feasible && tax.totalCost < kfw.totalCost ? 'tax' : 'kfw';
    const bestRun = best === 'tax' ? tax : kfw;
    rows.push({
      installMonth: month,
      kfwTotal: kfw.totalCost,
      kfwSubsidy: kfw.kfw?.subsidy ?? 0,
      taxTotal: tax.totalCost,
      taxFeasible: tax.feasible,
      taxBonus: tax.tax?.total ?? 0,
      best,
      bestTotal: bestRun.totalCost,
      savingVsRef: ref.totalCost - bestRun.totalCost,
      extraVsFirst: 0,
      parts: costParts(bestRun, inp.general.opportunityRate),
      kfwRate: kfw.kfw?.ownerUnitRate ?? 0,
      kgbRate: kfw.kfw?.kgbRate ?? 0,
      capTotal: kfw.kfw?.capTotal ?? 0,
      boilerCost: bestRun.boilerPurchases.reduce((s, b) => s + b.cost, 0),
      warnings: [...new Set([...kfw.warnings, ...(best === 'tax' ? tax.warnings : [])])],
    });
  }
  const first = rows[0]?.bestTotal ?? 0;
  let bestIndex = 0;
  rows.forEach((r, i) => {
    r.extraVsFirst = r.bestTotal - first;
    if (r.bestTotal < rows[bestIndex].bestTotal) bestIndex = i;
  });
  return { refTotal: ref.totalCost, rows, bestIndex, latestInstall };
}

/** Comparison of the cheapest point in time with a neighbour (F7.3). */
export interface BestComparison {
  other: number;
  direction: 'earlier' | 'later';
  /** Extra cost of the other point in time (positive = the cheapest one saves this much). */
  diff: number;
  /** Per cost category: extra cost of the other point in time (positive = advantage of the cheapest). */
  parts: Record<CostPart, number>;
  /** Cost category with the largest advantage (main reason). */
  mainReason: CostPart | null;
  /** Explanatory facts (heating season, subsidy rate (Fördersatz), tax bonus (Steuerbonus), replacement boiler (Ersatzkessel)). */
  facts: string[];
}

export interface BestExplanation {
  month: number;
  best: 'kfw' | 'tax';
  comparisons: BestComparison[];
}

/** Share of the annual space-heating demand in the months [a, b). */
export function heatShareBetween(a: number, b: number): number {
  let s = 0;
  for (let m = a; m < b; m++) s += SPACE_PROFILE[monthOf(m) - 1];
  return s;
}

const pct = (x: number) => `${Math.round(x * 100)} %`;
const eur = (x: number) => `${Math.round(x).toLocaleString('de-DE')} €`;
const pathLabel = (p: 'kfw' | 'tax') => (p === 'tax' ? 'Steuerbonus' : 'KfW-Zuschuss');

function compareWith(best: InstallComparisonRow, other: InstallComparisonRow, inp: Inputs): BestComparison {
  const direction = other.installMonth < best.installMonth ? 'earlier' : 'later';
  const parts = Object.fromEntries(PARTS.map((p) => [p, other.parts[p] - best.parts[p]])) as Record<CostPart, number>;
  const top = PARTS.filter((p) => parts[p] > 0.5).sort((a, b) => parts[b] - parts[a])[0] ?? null;
  const facts: string[] = [];
  const [a, b] = direction === 'earlier' ? [other.installMonth, best.installMonth] : [best.installMonth, other.installMonth];
  const months = b - a;
  const share = heatShareBetween(a, b);
  facts.push(
    `Zwischen ${formatMonthDe(a)} und ${formatMonthDe(b)} (${months} Monate) fallen ca. ${pct(share)} eines Jahresheizbedarfs an – ` +
      `so lange heizt beim späteren Zeitpunkt noch die alte Heizung.`,
  );
  if (other.best !== best.best) facts.push(`Bester Weg dort: ${pathLabel(other.best)} statt ${pathLabel(best.best)}.`);
  if (Math.abs(other.kfwSubsidy - best.kfwSubsidy) >= 1) {
    const reasons: string[] = [];
    if (Math.abs(other.kfwRate - best.kfwRate) > 1e-9) reasons.push(`Fördersatz ${pct(other.kfwRate)} statt ${pct(best.kfwRate)}`);
    if (Math.abs(other.kgbRate - best.kgbRate) > 1e-9)
      reasons.push(`Klimageschwindigkeitsbonus ${pct(other.kgbRate)} statt ${pct(best.kgbRate)}`);
    if (Math.abs(other.capTotal - best.capTotal) >= 1)
      reasons.push(`förderfähige Kosten höchstens ${eur(other.capTotal)} statt ${eur(best.capTotal)}`);
    facts.push(
      `KfW-Zuschuss dort ${eur(other.kfwSubsidy)} statt ${eur(best.kfwSubsidy)}` + (reasons.length ? ` (${reasons.join(', ')}).` : '.'),
    );
  }
  if (other.taxFeasible !== best.taxFeasible) {
    facts.push(
      other.taxFeasible
        ? 'Dort ist der Steuerbonus noch möglich.'
        : `Dort ist der Steuerbonus nicht mehr möglich (Abschluss nach ${formatMonthDe(parseMonth(inp.tax.deadline))}).`,
    );
  }
  if (Math.abs(other.boilerCost - best.boilerCost) >= 1) {
    facts.push(
      other.boilerCost > best.boilerCost
        ? `Dort ist vor der Wärmepumpe noch ein Ersatzkessel nötig (${eur(other.boilerCost - best.boilerCost)}).`
        : `Beim günstigsten Zeitpunkt ist vorher ein Ersatzkessel nötig (${eur(best.boilerCost - other.boilerCost)}), der sich dennoch rechnet.`,
    );
  }
  if (Math.abs(parts.investment) >= 1 && inp.general.investIncrease !== 0) {
    facts.push(`Investitionskosten steigen bis zum Kauf um ${pct(inp.general.investIncrease)} pro Jahr (Annahme „Steigerung Investitionskosten“).`);
  }
  if (Math.abs(parts.residual) >= 1) {
    facts.push(
      `Restwert am Ende: Beim späteren Einbau ist die Wärmepumpe am Ende des Betrachtungszeitraums jünger und noch mehr wert (Unterschied ca. ${eur(Math.abs(parts.residual))}).`,
    );
  }
  return { other: other.installMonth, direction, diff: other.bestTotal - best.bestTotal, parts, mainReason: top, facts };
}

/**
 * Explains why the cheapest point in time is cheaper than the previous and the next one (F7.3).
 * null if there is only one point in time.
 */
export function explainBest(cmp: InstallComparison, inp: Inputs): BestExplanation | null {
  if (cmp.rows.length < 2) return null;
  const i = cmp.bestIndex;
  const best = cmp.rows[i];
  const comparisons: BestComparison[] = [];
  if (i > 0) comparisons.push(compareWith(best, cmp.rows[i - 1], inp));
  if (i < cmp.rows.length - 1) comparisons.push(compareWith(best, cmp.rows[i + 1], inp));
  return { month: best.installMonth, best: best.best, comparisons };
}
