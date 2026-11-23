import { formatMonth, formatMonthDe, tryParseMonth } from './dates';
import { INCOME_RANGES } from './income-range';

/**
 * Validation of inputs from link, file and browser storage (F9.5).
 * Protects against values that break the calculation (invalid months) or freeze the browser
 * (e.g. a term of 1,000,000 years). Invalid values are replaced by the default or the limit.
 */

export interface InputIssue {
  path: string;
  /** Short description, e.g. "auf 50 begrenzt". */
  reason: string;
}

/** Limits for numbers [min, max]. All other numbers: ±GENERIC_LIMIT. */
export const NUMBER_LIMITS: Record<string, [number, number]> = {
  'general.horizonYears': [1, 50],
  'general.opportunityRate': [-0.5, 1],
  'general.costIncrease': [-0.5, 1],
  'general.investIncrease': [-0.5, 1],
  'general.vat': [0, 1],
  'building.units': [1, 500],
  'building.constructionYear': [1500, 2100],
  'building.heatedArea': [10, 100000],
  'building.renovationYear': [0, 2100],
  'oldHeating.dhwShare': [0, 0.6],
  'oldHeating.cookingShare': [0, 0.3],
  'oldHeating.cookingSwitchCost': [0, 50000],
  'prices.cookingElecFactor': [0.1, 2],
  'oldHeating.consumption': [0, 1e7],
  'oldHeating.efficiency': [0.1, 1.5],
  'oldHeating.remainingLifeYears': [0, 100],
  'oldHeating.replacementEfficiency': [0.1, 1.5],
  'oldHeating.replacementLifeYears': [1, 100],
  'prices.gasIncrease': [-0.5, 1],
  'prices.oilIncrease': [-0.5, 1],
  'prices.oilKwhPerLiter': [1, 20],
  'heatPump.eligibleShare': [0, 1],
  'heatPump.jaz': [0.5, 10],
  'heatPump.lifeYears': [1, 100],
  'heatPump.elecIncrease': [-0.5, 1],
  'heatPump.pvKwp': [0, 100],
  'heatPump.pvYield': [300, 1500],
  'heatPump.batteryKwh': [0, 100],
  'heatPump.householdKwh': [0, 100000],
  'prices.currentBioShare': [0, 1],
  'financing.kfwRate358': [-0.1, 1],
  'financing.kfwRate359': [-0.1, 1],
  'financing.kfwTermYears': [1, 50],
  'financing.kfwGraceYears': [0, 50],
  'financing.kfwFixYears': [0, 50],
  'financing.followUpRate': [-0.1, 1],
  'financing.bankRate': [-0.1, 1],
  'financing.bankTermYears': [1, 50],
  'financing.bankGraceYears': [0, 50],
  'financing.subsidyDelayMonths': [0, 120],
  'financing.taxRefundMonth': [1, 12],
  'financing.kfwFeeAfterFix': [0, 1],
  'financing.bankPrepayFee': [0, 1],
  'financing.bankPrepayFeeShort': [0, 1],
  'financing.bankFreePrepayShare': [0, 1],
  'financing.bankFreePrepayAmount': [0, 1e7],
  // Expert funding/tax parameters: rates are fractions, amounts in €. Without these they would only be
  // clamped to ±1e9, which still allows nonsensical scenarios from a crafted link or import (F9.5).
  'funding.grundRate': [0, 1],
  'funding.grundRateNew': [0, 1],
  'funding.wsbRate': [0, 1],
  'funding.kgbRate': [0, 1],
  'funding.kgbStep': [0, 1],
  'funding.kgbMinGasAge': [0, 100],
  'funding.incomeLimit1': [0, 1e7],
  'funding.incomeRate1': [0, 1],
  'funding.incomeLimit2': [0, 1e7],
  'funding.incomeRate2': [0, 1],
  'funding.incomeLimit3': [0, 1e7],
  'funding.incomeRate3': [0, 1],
  'funding.incomeChildShift': [0, 1e7],
  'funding.maxRate': [0, 1],
  'funding.maxRateLowIncome': [0, 1],
  'funding.cap1': [0, 1e7],
  'funding.capStep': [0, 1e6],
  'funding.capFloor': [0, 1e7],
  'funding.cap2to6': [0, 1e7],
  'funding.cap7plus': [0, 1e7],
  'funding.loanMaxPerUnit': [0, 1e7],
  'funding.loan358IncomeLimit': [0, 1e7],
  'tax.rateYear1': [0, 1],
  'tax.rateYear2': [0, 1],
  'tax.rateYear3': [0, 1],
  'tax.maxBonus': [0, 1e6],
  'tax.maxCost': [0, 1e7],
  'tax.minBuildingAge': [0, 100],
  'compare.stepMonths': [1, 120],
  'compare.count': [1, 40],
};
export const GENERIC_LIMIT = 1e9;

/** Month fields; true = may be empty. */
export const MONTH_FIELDS: Record<string, boolean> = {
  'general.startMonth': false,
  'oldHeating.installedMonth': false,
  'heatPump.installMonth': false,
  'heatPump.applicationMonth': true,
  'financing.windfallMonth': false,
  'financing.windfallRepayMonth': true,
  'tax.deadline': false,
  'funding.grundRateNewFrom': true,
  'funding.kgbDegressionStart': true,
  'funding.kgbEnd': true,
  'funding.capDegressionStart': true,
};
const MONTH_YEARS: [number, number] = [2000, 2150];
/** Years back from the check year for the commissioning of the heating (F1.8, Annahme A11). */
export const HEATING_MAX_AGE_YEARS = 40;
/** Years after the application year for the planned commissioning (F1.7, Nutzervorgabe A10). */
export const INSTALL_WINDOW_YEARS = 3;

/**
 * Allowed months of a month field as absolute months [first, last] (dates.ts: year × 12 + month − 1).
 * `today` is the check date (F1.8): the heating may date from 40 years back to the current year.
 */
export function monthBounds(path: string, today: Date): [number, number] {
  if (path === 'oldHeating.installedMonth') return heatingBounds(today);
  return [MONTH_YEARS[0] * 12, MONTH_YEARS[1] * 12 + 11];
}

/** Commissioning of the heating (F1.8): from January 40 years back to December of the check year. */
export function heatingBounds(today: Date): [number, number] {
  const y = today.getFullYear();
  return [(y - HEATING_MAX_AGE_YEARS) * 12, y * 12 + 11];
}

/**
 * Planned commissioning (F1.7) for a fixed application month (absolute): from the application month up to
 * December of the application year plus three. An automatic application month (commissioning − 4 months) always
 * satisfies this window, so only fixed application months need it.
 */
export function installBounds(application: number): [number, number] {
  const y = Math.floor(application / 12);
  return [application, (y + INSTALL_WINDOW_YEARS) * 12 + 11];
}

/** Range text for the error message: full years as "2000 und 2150", otherwise "03/2027 und 12/2030". */
export function monthRangeLabel([first, last]: [number, number]): string {
  const fullYears = first % 12 === 0 && last % 12 === 11;
  if (fullYears) return `${Math.floor(first / 12)} und ${Math.floor(last / 12)}`;
  return `${formatMonthDe(first)} und ${formatMonthDe(last)}`;
}

export const SELECT_VALUES: Record<string, readonly string[]> = {
  'oldHeating.fuel': ['gas', 'oil'],
  'oldHeating.cookingAfter': ['electric', 'gas'],
  'heatPump.source': ['air', 'ground'],
  'heatPump.emitter': ['floor', 'largeRadiators', 'radiators'],
  'building.renovationScope': ['partial', 'full'],
  'financing.windfallTarget': ['auto', 'kfw', 'bank'],
  'building.incomeRange': INCOME_RANGES.map((r) => r.code),
};

/** Maximum length for free text; other texts: 2,000 characters. */
export const TEXT_LIMITS: Record<string, number> = {
  'scenario.name': 200,
  'scenario.notes': 20000,
};
const GENERIC_TEXT_LIMIT = 2000;

/** Links to documents per scenario (F16.4): at most five, short titles, addresses up to 300 characters. */
export const MAX_DOCUMENTS = 5;
export const DOCUMENT_TITLE_MAX = 60;
export const DOCUMENT_URL_MAX = 300;

/**
 * Cleans the list of document links from link, file or storage (F16.4). Entries that are not objects with text fields,
 * or whose address is not http(s) or too long, are dropped; more than MAX_DOCUMENTS are cut off. Findings go to `issues`.
 */
export function cleanDocuments(value: unknown, issues: InputIssue[] = [], path = 'scenario.documents'): { title: string; url: string }[] {
  if (value === undefined) return [];
  if (!Array.isArray(value)) {
    issues.push({ path, reason: 'ungültiger Wert, keine Unterlagen übernommen' });
    return [];
  }
  const out: { title: string; url: string }[] = [];
  for (const item of value) {
    const rec = typeof item === 'object' && item !== null ? (item as Record<string, unknown>) : null;
    if (!rec || typeof rec.url !== 'string' || (rec.title !== undefined && typeof rec.title !== 'string')) {
      issues.push({ path, reason: 'Eintrag ohne gültige Adresse entfernt' });
      continue;
    }
    const url = rec.url.trim();
    let protocol = '';
    try {
      protocol = new URL(url).protocol;
    } catch {
      /* not an address */
    }
    if (protocol !== 'https:' && protocol !== 'http:') {
      issues.push({ path, reason: 'Adresse ohne http:// oder https:// entfernt' });
      continue;
    }
    if (url.length > DOCUMENT_URL_MAX) {
      issues.push({ path, reason: `Adresse länger als ${DOCUMENT_URL_MAX} Zeichen entfernt` });
      continue;
    }
    let title = typeof rec.title === 'string' ? rec.title.trim() : '';
    if (title.length > DOCUMENT_TITLE_MAX) {
      title = title.slice(0, DOCUMENT_TITLE_MAX);
      issues.push({ path, reason: `Titel auf ${DOCUMENT_TITLE_MAX} Zeichen gekürzt` });
    }
    out.push({ title, url });
  }
  if (out.length > MAX_DOCUMENTS) {
    issues.push({ path, reason: `auf ${MAX_DOCUMENTS} Unterlagen begrenzt` });
    return out.slice(0, MAX_DOCUMENTS);
  }
  return out;
}

const fmt = (x: number) => x.toLocaleString('de-DE');

export function numberRange(path: string): [number, number] {
  return NUMBER_LIMITS[path] ?? [-GENERIC_LIMIT, GENERIC_LIMIT];
}

/** Validates a month value (YYYY-MM) against the range of its field (monthBounds, F1.8 relative to `today`). */
export function validMonth(path: string, v: string, today: Date): boolean {
  if (v === '') return MONTH_FIELDS[path] === true;
  const m = tryParseMonth(v);
  if (m === null) return false;
  const [first, last] = monthBounds(path, today);
  return m >= first && m <= last;
}

/** Heating commissioning before or after the window of F1.8: moved to the nearest month of the window, with notice (F9.5, AK4). */
function clampHeating(value: string, today: Date, path: string): { value: string; issue?: InputIssue } {
  const m = tryParseMonth(value)!;
  const [first, last] = heatingBounds(today);
  const clamped = Math.min(Math.max(m, first), last);
  if (clamped === m) return { value };
  const to = formatMonthDe(clamped);
  return {
    value: formatMonth(clamped),
    issue: { path, reason: `${formatMonthDe(m)} liegt außerhalb des Zeitraums ${formatMonthDe(first)} bis ${formatMonthDe(last)}, auf ${to} begrenzt` },
  };
}

/**
 * Validates a single value (type already matches). Returns the cleaned value and a finding if any.
 * `fallback` is the default for values that cannot be repaired.
 */
export function checkValue(path: string, value: unknown, fallback: unknown, today: Date = new Date()): { value: unknown; issue?: InputIssue } {
  if (typeof value === 'number') {
    const [min, max] = numberRange(path);
    if (value < min) return { value: min, issue: { path, reason: `${fmt(value)} unter dem Mindestwert, auf ${fmt(min)} gesetzt` } };
    if (value > max) return { value: max, issue: { path, reason: `${fmt(value)} über dem Höchstwert, auf ${fmt(max)} begrenzt` } };
    return { value };
  }
  if (typeof value === 'string') {
    if (path in MONTH_FIELDS) {
      const v = value.trim();
      if (path === 'oldHeating.installedMonth' && tryParseMonth(v) !== null) return clampHeating(v, today, path);
      return validMonth(path, v, today) ? { value: v } : { value: fallback, issue: { path, reason: 'kein gültiger Monat, Standardwert verwendet' } };
    }
    const allowed = SELECT_VALUES[path];
    if (allowed) {
      return allowed.includes(value) ? { value } : { value: fallback, issue: { path, reason: 'unbekannter Wert, Standardwert verwendet' } };
    }
    const max = TEXT_LIMITS[path] ?? GENERIC_TEXT_LIMIT;
    if (value.length > max) return { value: value.slice(0, max), issue: { path, reason: `auf ${fmt(max)} Zeichen gekürzt` } };
    return { value };
  }
  return { value };
}
