import type { Inputs } from './types';
import { deflateSync, Inflate } from 'fflate';
import { APP_VERSION } from '../version';
import { DEFAULTS_AS_OF } from './default-history';
import { formatMonth, formatMonthDe, parseMonth, tryParseMonth } from './dates';
import { AUTO_APPLICATION_LEAD_MONTHS } from './defaults';
import { incomeRangeOfAmount } from './income-range';
import { checkValue, cleanDocuments, TEXT_LIMITS, type InputIssue } from './validate';

type Obj = Record<string, unknown>;

const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);

/**
 * Merges a (partial, possibly foreign) data set into the defaults.
 * Only known keys with a matching type are adopted (F9.3); values are validated and
 * clamped or replaced by the default if necessary (F9.5). Findings end up in `issues`.
 */
export function mergeInputs(defaults: Inputs, data: unknown, issues: InputIssue[] = []): Inputs {
  const merged = mergeObj(defaults as unknown as Obj, migrate(defaults, data, issues), '', issues) as unknown as Inputs;
  return limitApplicationMonth(merged, issues);
}

/**
 * A fixed application month (Antragsmonat) after the commissioning month is moved to the commissioning month,
 * with a notice (F1.6). Empty (automatic) or invalid values are left to the field check.
 */
function limitApplicationMonth(inputs: Inputs, issues: InputIssue[]): Inputs {
  const app = tryParseMonth(inputs.heatPump.applicationMonth);
  if (app === null) return inputs;
  const install = parseMonth(inputs.heatPump.installMonth); // valid after the merge (checked before)
  if (app <= install) return inputs;
  issues.push({
    path: 'heatPump.applicationMonth',
    reason: `liegt nach der Inbetriebnahme (${formatMonthDe(install)}) – auf diesen Monat begrenzt`,
  });
  return { ...inputs, heatPump: { ...inputs.heatPump, applicationMonth: formatMonth(install) } };
}

/** Start month (absolute) of a raw data set, else of the defaults. */
function rawStart(defaults: Inputs, data: Obj): number {
  const g = isObj(data.general) ? data.general : {};
  return tryParseMonth(typeof g.startMonth === 'string' ? g.startMonth : null) ?? parseMonth(defaults.general.startMonth);
}

/**
 * Migrates older data sets: building age (years) → construction year (F17);
 * age of the heating (years) → commissioning month (Inbetriebnahme, F34), with a notice to check the month;
 * fixed PV share (PV-Anteil) → notice, because PV is now calculated from the PV system (F28).
 */
function migrate(defaults: Inputs, data: unknown, issues: InputIssue[]): unknown {
  data = migrateIncomeRange(defaults, data, issues);
  if (isObj(data) && isObj(data.oldHeating)) {
    const o = data.oldHeating;
    if (typeof o.ageYears === 'number' && Number.isFinite(o.ageYears) && o.installedMonth === undefined) {
      const years = Math.min(Math.max(o.ageYears, 0), 200);
      const installed = rawStart(defaults, data) - Math.round(years * 12);
      const installedMonth = formatMonth(installed);
      data = { ...data, oldHeating: { ...o, installedMonth } };
      issues.push({
        path: 'oldHeating.installedMonth',
        reason: `aus dem früheren „Alter der Heizung“ (${years.toLocaleString('de-DE')} Jahre) auf ${formatMonthDe(installed)} umgerechnet – bitte den genauen Monat der Inbetriebnahme prüfen (Typenschild, Schornsteinfeger-Protokoll)`,
      });
    }
  }
  data = migrateLeadMonths(defaults, data, issues);
  if (isObj(data) && isObj(data.heatPump)) {
    const share = data.heatPump.pvShare;
    if (typeof share === 'number' && share > 0 && data.heatPump.pvKwp === undefined) {
      issues.push({
        path: 'heatPump.pvKwp',
        reason: `der feste PV-Anteil (${Math.round(share * 100)} %) wird nicht mehr verwendet – bitte Leistung der PV-Anlage eintragen; bis dahin ohne PV gerechnet`,
      });
    }
  }
  if (!isObj(data) || !isObj(data.building)) return data;
  const b = data.building;
  if (typeof b.buildingAgeYears !== 'number' || b.constructionYear !== undefined || !Number.isFinite(b.buildingAgeYears)) return data;
  const startYear = Math.floor(rawStart(defaults, data) / 12);
  return { ...data, building: { ...b, constructionYear: Math.round(startYear - b.buildingAgeYears) } };
}

/**
 * Migrates the former lead time in months (heatPump.leadMonths, F1.5, F9.5): 4 months (the default) becomes an
 * empty, automatic application month; any other value becomes a fixed application month
 * (commissioning month minus the lead time), reported. An existing `applicationMonth` takes precedence.
 */
function migrateLeadMonths(defaults: Inputs, data: unknown, issues: InputIssue[]): unknown {
  if (!isObj(data) || !isObj(data.heatPump)) return data;
  const h = data.heatPump;
  if (h.leadMonths === undefined || h.applicationMonth !== undefined) return data;
  const path = 'heatPump.applicationMonth';
  const lead = h.leadMonths;
  if (typeof lead !== 'number' || !Number.isFinite(lead)) {
    issues.push({ path, reason: 'ungültiger Wert, Standardwert verwendet' });
    return data;
  }
  const months = Math.min(Math.max(Math.round(lead), 0), 120);
  if (months === AUTO_APPLICATION_LEAD_MONTHS) return { ...data, heatPump: { ...h, applicationMonth: '' } };
  const install = tryParseMonth(typeof h.installMonth === 'string' ? h.installMonth : null) ?? parseMonth(defaults.heatPump.installMonth);
  const fixed = install - months;
  issues.push({
    path,
    reason: `aus dem früheren Vorlauf (${months} Monate) auf den festen Antragsmonat ${formatMonthDe(fixed)} umgerechnet – bitte prüfen`,
  });
  return { ...data, heatPump: { ...h, applicationMonth: formatMonth(fixed) } };
}

/**
 * Migrates the former exact household income (building.householdIncome, F9.5) to an income range code (F5.4).
 * A finite number without `incomeRange` is assigned to the range that contains it, without a notice; a negative
 * value is noted. Any other value (text, object, null, boolean) gives the default with a notice. An existing
 * `incomeRange` takes precedence and `householdIncome` is ignored.
 */
function migrateIncomeRange(defaults: Inputs, data: unknown, issues: InputIssue[]): unknown {
  if (!isObj(data) || !isObj(data.building)) return data;
  const b = data.building;
  if (b.incomeRange !== undefined || b.householdIncome === undefined) return data;
  const path = 'building.incomeRange';
  const old = b.householdIncome;
  if (typeof old !== 'number' || !Number.isFinite(old)) {
    issues.push({ path, reason: 'ungültiger Wert, Standardwert verwendet' });
    return { ...data, building: { ...b, incomeRange: defaults.building.incomeRange } };
  }
  if (old < 0) issues.push({ path, reason: 'unter 0, dem ersten Bereich zugeordnet' });
  return { ...data, building: { ...b, incomeRange: incomeRangeOfAmount(old) } };
}

function mergeObj(base: Obj, data: unknown, prefix: string, issues: InputIssue[]): Obj {
  const out: Obj = {};
  const src = isObj(data) ? data : {};
  for (const [k, def] of Object.entries(base)) {
    const path = prefix ? `${prefix}.${k}` : k;
    const v = Object.prototype.hasOwnProperty.call(src, k) ? src[k] : undefined;
    if (isObj(def)) {
      out[k] = mergeObj(def, v, path, issues);
      continue;
    }
    if (path === 'scenario.documents') {
      out[k] = cleanDocuments(v, issues, path);
      continue;
    }
    const typeOk = typeof def === 'number' ? typeof v === 'number' && Number.isFinite(v) : v !== undefined && typeof v === typeof def;
    if (!typeOk) {
      if (v !== undefined) issues.push({ path, reason: 'ungültiger Wert, Standardwert verwendet' });
      out[k] = def;
      continue;
    }
    if (path === 'version') {
      out[k] = def;
      continue;
    }
    const r = checkValue(path, v, def);
    if (r.issue) issues.push(r.issue);
    out[k] = r.value;
  }
  return out;
}

/** Only the differences from the defaults (for short links). */
export function diffInputs(defaults: Inputs, inputs: Inputs): Obj {
  return diffObj(defaults as unknown as Obj, inputs as unknown as Obj);
}

function diffObj(base: Obj, cur: Obj): Obj {
  const out: Obj = {};
  for (const [k, def] of Object.entries(base)) {
    const v = cur[k];
    if (isObj(def) && isObj(v)) {
      const d = diffObj(def, v);
      if (Object.keys(d).length > 0) out[k] = d;
    } else if (Array.isArray(def) ? JSON.stringify(v) !== JSON.stringify(def) : v !== def) {
      // Lists (document links) are compared by content, not by reference
      out[k] = v;
    }
  }
  return out;
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlToBytes(s: string): Uint8Array {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

/** Upper limit for the unpacked link content – protects against "zip bombs" in manipulated links. */
export const MAX_LINK_JSON_BYTES = 256 * 1024;

/** Inflates raw DEFLATE data, aborting as soon as the output exceeds the limit. */
function inflateLimited(data: Uint8Array): Uint8Array {
  const chunks: Uint8Array[] = [];
  let total = 0;
  const inflater = new Inflate((chunk) => {
    total += chunk.length;
    if (total > MAX_LINK_JSON_BYTES) throw new Error('Link-Inhalt zu groß');
    chunks.push(chunk);
  });
  inflater.push(data, true);
  const out = new Uint8Array(total);
  let pos = 0;
  for (const c of chunks) {
    out.set(c, pos);
    pos += c.length;
  }
  return out;
}

/**
 * Creates the URL hash "#z=…" (F9.2): differences from the defaults as JSON, compressed (raw DEFLATE) and
 * Base64URL-encoded – about half as long as the former uncompressed "#s=…" (short enough for a QR code, F30.3).
 */
export function encodeHash(defaults: Inputs, inputs: Inputs): string {
  const json = new TextEncoder().encode(JSON.stringify(diffInputs(defaults, inputs)));
  return '#z=' + bytesToBase64Url(deflateSync(json, { level: 9 }));
}

/** Reads a URL hash ("#z=…" compressed or older "#s=…" uncompressed); null for missing/invalid content. */
export function decodeHash(defaults: Inputs, hash: string, issues: InputIssue[] = []): Inputs | null {
  const m = /[#&]([sz])=([A-Za-z0-9_-]+)/.exec(hash);
  if (!m) return null;
  try {
    const raw = base64UrlToBytes(m[2]);
    if (m[1] === 's' && raw.length > MAX_LINK_JSON_BYTES) return null;
    const data = JSON.parse(new TextDecoder().decode(m[1] === 'z' ? inflateLimited(raw) : raw));
    if (!isObj(data)) return null;
    return mergeInputs(defaults, data, issues);
  } catch {
    return null;
  }
}

/** File-name-safe part of the scenario name (umlauts transliterated, max. 60 characters). */
export function fileSlug(text: string): string {
  return text
    .normalize('NFC')
    .replace(/Ä/g, 'Ae').replace(/Ö/g, 'Oe').replace(/Ü/g, 'Ue')
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Za-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
    .replace(/-+$/g, '');
}

/** Export file name: waermepumpe-rechner[-name]-YYYY-MM.json (F16.2). */
export function exportFileName(inputs: Inputs, now: Date): string {
  const slug = fileSlug(inputs.scenario?.name ?? '');
  const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  return `waermepumpe-rechner-${slug ? slug + '-' : ''}${month}.json`;
}

/**
 * Scenario name (F37.3, F9.5): without spaces at the edges, at most 200 characters. Not a string → '' (no name).
 * Used for saved scenarios (F37).
 */
export function cleanScenarioName(value: unknown): string {
  if (typeof value !== 'string') return '';
  return value.trim().slice(0, TEXT_LIMITS['scenario.name']).trim();
}

/**
 * Export format (F9.3). `defaultsAsOf` is the version of the defaults (F22.4); saved scenarios pass the
 * version of the stored data while the notice on new defaults is still open.
 */
export function exportJson(inputs: Inputs, defaultsAsOf: string = DEFAULTS_AS_OF): string {
  // App version for traceability (N9); ignored on import.
  const { version, ...rest } = inputs;
  return JSON.stringify({ version, appVersion: APP_VERSION, defaultsAsOf, ...rest }, null, 2);
}

/** Imports a JSON file; throws on invalid content (F9.3). */
export function importJson(defaults: Inputs, text: string, issues: InputIssue[] = []): Inputs {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error('Die Datei enthält kein gültiges JSON.');
  }
  if (!isObj(data) || data.version !== 1) {
    throw new Error('Die Datei ist kein Datensatz dieses Rechners (version 1).');
  }
  return mergeInputs(defaults, data, issues);
}
