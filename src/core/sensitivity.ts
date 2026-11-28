import { parsePath } from './prices';
import { numberRange } from './validate';
import { runAll, type RunResult } from './simulation';
import type { Inputs } from './types';

/**
 * Sensitivity analysis (Sensitivitätsanalyse) (F27): "What influences my result most?"
 * Each key assumption is varied a little lower and higher while all others stay unchanged; the result is the
 * saving with a heat pump (best way KfW or tax bonus (Steuerbonus), recalculated per variant) compared with the base case.
 * Sorted by the width of the range – the widest bar influences the result most (used by the KI export, F35.2).
 * The interactive sliders on the result page (F27.3–F27.12) are built by `sliders()` and `keyFigures()` below.
 */

export interface SensitivityItem {
  id: string;
  label: string;
  /** Base value of the assumption, formatted (e.g. "12,2 ct/kWh"). */
  base: string;
  /** Lower / higher value of the assumption, formatted. */
  lowValue: string;
  highValue: string;
  /** Saving with a heat pump with the lower / higher assumption (€). */
  low: number;
  high: number;
}

export interface Sensitivity {
  /** Saving with a heat pump in the base case (€). */
  base: number;
  /** Sorted by influence (largest range first). */
  items: SensitivityItem[];
}

interface Lever {
  id: string;
  label: string | ((i: Inputs) => string);
  /** Shown only if relevant for the base case. */
  show?: (run: RunResult) => boolean;
  value: (i: Inputs) => string;
  /** Applies the variation: dir = -1 (lower) or +1 (higher). */
  apply: (i: Inputs, dir: -1 | 1) => void;
}

const de = (x: number, d = 1) => x.toLocaleString('de-DE', { minimumFractionDigits: d, maximumFractionDigits: d });
const pct = (x: number) => `${de(x * 100)} %`;
/** Relative variation for prices and investment. */
export const REL = 0.2;
/** Absolute variation for growth and interest rates (percentage points). */
export const PP = 0.02;
export const RATE_PP = 0.01;
export const JAZ_STEP = 0.5;
/** Relative variation of the CO2 price path. */
export const CO2_REL = 0.3;

const isGas = (i: Inputs) => i.oldHeating.fuel === 'gas';

const LEVERS: Lever[] = [
  {
    id: 'fuelPrice',
    label: (i) => (isGas(i) ? 'Gaspreis heute' : 'Heizölpreis heute'),
    value: (i) => (isGas(i) ? `${de(i.prices.gasPriceCt)} ct/kWh` : `${de(i.prices.oilPriceEur, 2)} €/l`),
    apply: (i, d) => {
      if (isGas(i)) i.prices.gasPriceCt *= 1 + d * REL;
      else i.prices.oilPriceEur *= 1 + d * REL;
    },
  },
  {
    id: 'fuelIncrease',
    label: (i) => (isGas(i) ? 'Steigerung Gaspreis' : 'Steigerung Heizölpreis'),
    value: (i) => `${pct(isGas(i) ? i.prices.gasIncrease : i.prices.oilIncrease)} p. a.`,
    apply: (i, d) => {
      if (isGas(i)) i.prices.gasIncrease += d * PP;
      else i.prices.oilIncrease += d * PP;
    },
  },
  {
    id: 'elecPrice',
    label: 'Strompreis heute',
    value: (i) => `${de(i.heatPump.separateTariff ? i.heatPump.elecPriceCt : i.heatPump.householdPriceCt)} ct/kWh`,
    apply: (i, d) => {
      i.heatPump.elecPriceCt *= 1 + d * REL;
      i.heatPump.householdPriceCt *= 1 + d * REL;
    },
  },
  {
    id: 'elecIncrease',
    label: 'Steigerung Strompreis',
    value: (i) => `${pct(i.heatPump.elecIncrease)} p. a.`,
    apply: (i, d) => (i.heatPump.elecIncrease += d * PP),
  },
  {
    id: 'jaz',
    label: 'Jahresarbeitszahl (JAZ)',
    value: (i) => de(i.heatPump.jaz),
    apply: (i, d) => (i.heatPump.jaz = Math.max(1, i.heatPump.jaz + d * JAZ_STEP)),
  },
  {
    id: 'investment',
    label: 'Investition Wärmepumpe',
    value: (i) => `${Math.round(i.heatPump.investment).toLocaleString('de-DE')} €`,
    apply: (i, d) => (i.heatPump.investment *= 1 + d * REL),
  },
  {
    id: 'co2Price',
    label: 'CO₂-Preis',
    value: (i) => {
      const p = parsePath(i.prices.co2Path);
      return p.length ? `${Math.round(p[p.length - 1].value)} €/t (${p[p.length - 1].year})` : '–';
    },
    apply: (i, d) => {
      i.prices.co2Path = parsePath(i.prices.co2Path)
        .map((p) => `${p.year}:${Math.round(p.value * (1 + d * CO2_REL) * 100) / 100}`)
        .join(', ');
    },
  },
  {
    id: 'loanRate',
    label: 'Kreditzinsen',
    // Only relevant if a loan is needed at all
    show: (run) => run.kfw.loans.length + run.tax.loans.length > 0,
    value: (i) => `KfW ${pct(i.financing.kfwRate358)}, Bank ${pct(i.financing.bankRate)}`,
    apply: (i, d) => {
      const f = i.financing;
      f.kfwRate358 = Math.max(0, f.kfwRate358 + d * RATE_PP);
      f.kfwRate359 = Math.max(0, f.kfwRate359 + d * RATE_PP);
      f.bankRate = Math.max(0, f.bankRate + d * RATE_PP);
      f.followUpRate = Math.max(0, f.followUpRate + d * RATE_PP);
    },
  },
  {
    id: 'opportunityRate',
    label: 'Opportunitätszins',
    value: (i) => `${pct(i.general.opportunityRate)} p. a.`,
    apply: (i, d) => (i.general.opportunityRate = Math.max(0, i.general.opportunityRate + d * RATE_PP)),
  },
];

/** Saving with a heat pump: reference minus the best heat pump way. */
export function savingOf(inp: Inputs, run: RunResult = runAll(inp)): number {
  const best = run.best === 'tax' ? run.tax : run.kfw;
  return run.ref.totalCost - best.totalCost;
}

/**
 * Sensitivity analysis (F27.1) for the KI export.
 * @param baseRun result of `runAll` for the same inputs – avoids simulating the base case twice
 */
export function sensitivity(inp: Inputs, baseRun: RunResult = runAll(inp)): Sensitivity {
  const base = savingOf(inp, baseRun);
  const items: SensitivityItem[] = [];
  for (const l of LEVERS) {
    if (l.show && !l.show(baseRun)) continue;
    const variant = (dir: -1 | 1) => {
      const v = structuredClone(inp);
      l.apply(v, dir);
      return v;
    };
    const lo = variant(-1);
    const hi = variant(1);
    items.push({
      id: l.id,
      label: typeof l.label === 'string' ? l.label : l.label(inp),
      base: l.value(inp),
      lowValue: l.value(lo),
      highValue: l.value(hi),
      low: savingOf(lo),
      high: savingOf(hi),
    });
  }
  items.sort((a, b) => Math.abs(b.high - b.low) - Math.abs(a.high - a.low));
  return { base, items };
}

/* ---------- Sliders on the result page (F27.3–F27.12) ---------- */

/** Ids of the sliders in the order of the card (F27.3). */
export type SliderId = 'fuelIncrease' | 'elecIncrease' | 'jaz' | 'investment' | 'co2Price' | 'loanRate' | 'opportunityRate';

/**
 * One slider (Regler). `values` are the positions in ascending order, in the unit of the assumption
 * (fraction for percentages, € for the investment, factor for the CO₂ path, change in fraction for the loan rates).
 * `base` is the index of the entry in the form (Voreinstellung); `apply` writes a position into a copy of the inputs.
 */
export interface Slider {
  id: SliderId;
  /** Label as in the form (F27.3). */
  label: string;
  /** Short name in the summary of moved sliders (F27.8), e.g. "Steigerung Strompreis". */
  short: string;
  values: number[];
  base: number;
  /** Text of a position, e.g. "5,0 % p. a.", also used as aria-valuetext (F27.13). */
  format: (value: number) => string;
  /** Meaning, value of the form entry and span (F27.7). */
  hint: string;
  apply: (inputs: Inputs, value: number) => void;
}

/** Steigerungen: ±20 percentage points, step 0.1 pp (F27.5, F27.6). */
export const SLIDER_GROWTH_SPAN = 0.2;
/** Zinsen: ±5 percentage points, step 0.1 pp (F27.5, F27.6). */
export const SLIDER_RATE_SPAN = 0.05;
export const SLIDER_PP_STEP = 0.001;
/** Investment: ±20 % relative, step 100 € (F27.5, F27.6). */
export const SLIDER_INVEST_REL = 0.2;
export const SLIDER_INVEST_STEP = 100;
/** JAZ: ±2, step 0.1, lower limit 1.0 (F27.5, F27.6). */
export const SLIDER_JAZ_SPAN = 2;
export const SLIDER_JAZ_STEP = 0.1;
export const SLIDER_JAZ_MIN = 1;
/** CO₂ factor 70 % to 130 %, step 5 percentage points (F27.5, F27.6). */
export const SLIDER_CO2_MIN = 0.7;
export const SLIDER_CO2_MAX = 1.3;
export const SLIDER_CO2_STEP = 0.05;

/** Rounds away floating-point noise so that a position equals the typed value (e.g. 0.22). */
const clean = (x: number) => Math.round(x * 1e9) / 1e9;
const EPS = 1e-9;

/**
 * Positions base + k × step inside [lo, hi] (F27.6): the grid is anchored at the form value, so the form value is
 * always reachable. Returns the positions and the index of the base (k = 0).
 */
function grid(base: number, step: number, lo: number, hi: number): { values: number[]; index: number } {
  const kMin = Math.ceil((lo - base) / step - EPS);
  const kMax = Math.floor((hi - base) / step + EPS);
  const values: number[] = [];
  for (let k = kMin; k <= kMax; k++) values.push(k === 0 ? base : clean(base + k * step));
  return { values, index: -kMin };
}

/** Number with one decimal place, two if the value lies between the 0.1 steps (e.g. 2,05). */
function smartNum(x: number): string {
  const tenths = x * 10;
  const d = Math.abs(Math.round(tenths) - tenths) < 1e-6 ? 1 : 2;
  return de(x, d);
}
/** Percentage from a fraction: "3,0 %", "2,05 %". */
const smartPct = (x: number) => `${smartNum(x * 100)} %`;
/** Signed change in percentage points: "+1,0", "−5,0", "±0,0". */
const signedPp = (x: number) => (Math.abs(x) < 1e-9 ? '±0,0' : `${x > 0 ? '+' : '−'}${smartNum(Math.abs(x) * 100)}`);
const eurInt = (x: number) => `${Math.round(x).toLocaleString('de-DE')} €`;

/** Interest rates whose change the loan slider moves (KfW 358, KfW 359, Bank, Anschlusszins). */
const LOAN_RATE_KEYS = ['kfwRate358', 'kfwRate359', 'bankRate', 'followUpRate'] as const;

/** New rate for a change: not below 0 % (or its form value if that is already lower), not above 100 %. */
export function shiftedRate(base: number, change: number, limit: number): number {
  return Math.min(Math.max(limit, base), Math.max(Math.min(0, base), base + change));
}

/** Growth slider (Steigerung) for prices, in fractions per year (F27.5). */
function growthSlider(
  id: SliderId,
  label: string,
  short: string,
  path: string,
  read: (i: Inputs) => number,
  write: (i: Inputs, v: number) => void,
  inp: Inputs,
  span: number,
  note = '',
): Slider {
  const b = read(inp);
  const limit = numberRange(path)[1];
  // Lower limit 0 %, or the form value if it is already below 0 % (F27.5)
  const lo = Math.max(b - span, Math.min(0, b));
  const hi = Math.max(b, Math.min(b + span, limit));
  const g = grid(b, SLIDER_PP_STEP, lo, hi);
  const first = g.values[0];
  const last = g.values[g.values.length - 1];
  return {
    id,
    label,
    short,
    values: g.values,
    base: g.index,
    format: (v) => `${smartPct(v)} p. a.`,
    hint: `Ihre Eingabe: ${smartPct(b)} p. a. Spanne: ${smartPct(first)} bis ${smartPct(last)} (Prozentpunkte)${note ? `, ${note}` : '.'}`,
    apply: (x, v) => write(x, v),
  };
}

/** Interest-rate slider: change in percentage points for all four rates (F27.5). */
function loanSlider(inp: Inputs): Slider {
  const g = grid(0, SLIDER_PP_STEP, -SLIDER_RATE_SPAN, SLIDER_RATE_SPAN);
  const f = inp.financing;
  const entries = [
    ['KfW 358', f.kfwRate358],
    ['KfW 359', f.kfwRate359],
    ['Bank', f.bankRate],
    ['Anschlusszins', f.followUpRate],
  ] as const;
  const rates = entries.map(([n, v]) => `${n} ${smartPct(v)}`).join(', ');
  return {
    id: 'loanRate',
    label: 'Kreditzinsen',
    short: 'Kreditzinsen',
    values: g.values,
    base: g.index,
    format: (d) => `${signedPp(d)} Prozentpunkte`,
    hint: `Ihre Eingabe: ${rates}. Spanne: ${signedPp(g.values[0])} bis ${signedPp(g.values[g.values.length - 1])} Prozentpunkte, für alle vier Zinsen gleich; kein Zins unter 0 %.`,
    apply: (x, d) => {
      for (const k of LOAN_RATE_KEYS) x.financing[k] = shiftedRate(x.financing[k], d, numberRange(`financing.${k}`)[1]);
    },
  };
}

/**
 * All sliders for the given inputs and their result (F27.3). Sliders for CO₂ and loans appear only if the
 * CO₂ path has a support point (F27.3, F27.1) or a loan runs in the base case (`run`).
 */
export function sliders(inp: Inputs, run: RunResult): Slider[] {
  const gas = isGas(inp);
  const list: Slider[] = [
    growthSlider(
      'fuelIncrease',
      gas ? 'Steigerung Gaspreis (ohne CO₂)' : 'Steigerung Ölpreis (ohne CO₂)',
      gas ? 'Steigerung Gaspreis' : 'Steigerung Ölpreis',
      gas ? 'prices.gasIncrease' : 'prices.oilIncrease',
      (i) => (isGas(i) ? i.prices.gasIncrease : i.prices.oilIncrease),
      (i, v) => {
        if (isGas(i)) i.prices.gasIncrease = v;
        else i.prices.oilIncrease = v;
      },
      inp,
      SLIDER_GROWTH_SPAN,
      'durchschnittliche jährliche Steigerung im Betrachtungszeitraum.',
    ),
    growthSlider(
      'elecIncrease',
      'Steigerung Strompreis',
      'Steigerung Strompreis',
      'heatPump.elecIncrease',
      (i) => i.heatPump.elecIncrease,
      (i, v) => (i.heatPump.elecIncrease = v),
      inp,
      SLIDER_GROWTH_SPAN,
      'durchschnittliche jährliche Steigerung im Betrachtungszeitraum.',
    ),
  ];

  const jb = inp.heatPump.jaz;
  const jLo = Math.max(jb - SLIDER_JAZ_SPAN, Math.min(SLIDER_JAZ_MIN, jb));
  const jHi = Math.max(jb, Math.min(jb + SLIDER_JAZ_SPAN, numberRange('heatPump.jaz')[1]));
  const jg = grid(jb, SLIDER_JAZ_STEP, jLo, jHi);
  list.push({
    id: 'jaz',
    label: 'Jahresarbeitszahl (JAZ)',
    short: 'JAZ',
    values: jg.values,
    base: jg.index,
    format: (v) => smartNum(v),
    hint: `Ihre Eingabe: ${smartNum(jb)}. Spanne: ${smartNum(jg.values[0])} bis ${smartNum(jg.values[jg.values.length - 1])} (absolut).`,
    apply: (x, v) => (x.heatPump.jaz = v),
  });

  const ib = inp.heatPump.investment;
  const iLo = Math.min(ib, ib * (1 - SLIDER_INVEST_REL));
  const iHi = Math.max(ib, Math.min(ib * (1 + SLIDER_INVEST_REL), numberRange('heatPump.investment')[1]));
  const ig = grid(ib, SLIDER_INVEST_STEP, iLo, iHi);
  const noRange = ig.values.length === 1;
  list.push({
    id: 'investment',
    label: 'Investition gesamt (brutto)',
    short: 'Investition',
    values: ig.values,
    base: ig.index,
    format: (v) => eurInt(v),
    hint: noRange
      ? `Ihre Eingabe: ${eurInt(ib)}. Keine Spanne.`
      : `Ihre Eingabe: ${eurInt(ib)}. Spanne: ${eurInt(ig.values[0])} bis ${eurInt(ig.values[ig.values.length - 1])} (relativ).`,
    apply: (x, v) => (x.heatPump.investment = v),
  });

  const path = parsePath(inp.prices.co2Path);
  if (path.length) {
    const lastPoint = path[path.length - 1];
    const cg = grid(1, SLIDER_CO2_STEP, SLIDER_CO2_MIN, SLIDER_CO2_MAX);
    list.push({
      id: 'co2Price',
      label: 'CO₂-Preis',
      short: 'CO₂-Preis',
      values: cg.values,
      base: cg.index,
      // Factor applied to the whole path; the last support point is shown (F27.5)
      format: (f) => `${Math.round(lastPoint.value * f)} €/t (${lastPoint.year})`,
      hint: `Ihre Eingabe: ${Math.round(lastPoint.value)} €/t (${lastPoint.year}). Spanne: ${Math.round(lastPoint.value * SLIDER_CO2_MIN)} bis ${Math.round(lastPoint.value * SLIDER_CO2_MAX)} €/t (relativ, 70 % bis 130 % des Pfads).`,
      apply: (x, f) => {
        // Factor 1 keeps the path text unchanged (the form value stays exact)
        if (f === 1) return;
        x.prices.co2Path = parsePath(x.prices.co2Path)
          .map((p) => `${p.year}:${Math.round(p.value * f * 100) / 100}`)
          .join(', ');
      },
    });
  }

  if (run.kfw.loans.length + run.tax.loans.length > 0) list.push(loanSlider(inp));

  list.push(
    growthSlider(
      'opportunityRate',
      'Opportunitätszins',
      'Opportunitätszins',
      'general.opportunityRate',
      (i) => i.general.opportunityRate,
      (i, v) => (i.general.opportunityRate = v),
      inp,
      SLIDER_RATE_SPAN,
    ),
  );
  return list;
}

/**
 * Inputs with the given slider positions applied to one copy (F27.12); the form inputs stay unchanged.
 * `positions` holds the index per slider; sliders at their base are not applied.
 */
export function sliderInputs(inp: Inputs, list: Slider[], positions: Partial<Record<SliderId, number>>): Inputs {
  const copy = structuredClone(inp);
  for (const s of list) {
    const index = positions[s.id] ?? s.base;
    if (index !== s.base) s.apply(copy, s.values[index]);
  }
  return copy;
}

/** Summary of the moved sliders in the fixed order (F27.8), e.g. "Steigerung Strompreis 5,0 % p. a., JAZ 3,0"; "keine Änderung" if none is moved. */
export function movedSummary(list: Slider[], positions: Partial<Record<SliderId, number>>): string {
  const moved = list.filter((s) => (positions[s.id] ?? s.base) !== s.base);
  if (!moved.length) return 'keine Änderung';
  return moved.map((s) => `${s.short} ${s.format(s.values[positions[s.id] ?? s.base])}`).join(', ');
}

/** The six key figures of the header (F27.8), from one run; the header and the sliders use the same values. */
export interface KeyFigures {
  /** Total cost without heat pump (€). */
  ref: number;
  /** Total cost with heat pump and KfW grant (€). */
  kfw: number;
  /** Total cost with heat pump and tax bonus (€); null if not possible. */
  tax: number | null;
  /** Saving with heat pump, best way (€); negative = extra cost. */
  saving: number;
  /** Month of the amortisation; null = not within the period. */
  breakEven: number | null;
  /** Commissioning month of the best way. */
  installMonth: number | null;
  /** CO₂ saving in tonnes; negative = extra emission. */
  co2Saved: number;
}

export function keyFigures(run: RunResult): KeyFigures {
  const best = run.best === 'tax' ? run.tax : run.kfw;
  return {
    ref: run.ref.totalCost,
    kfw: run.kfw.totalCost,
    tax: run.tax.feasible ? run.tax.totalCost : null,
    saving: run.ref.totalCost - best.totalCost,
    breakEven: run.best === 'tax' ? run.breakEvenTax : run.breakEvenKfw,
    installMonth: best.installMonth,
    co2Saved: run.ref.co2Tons - best.co2Tons,
  };
}
