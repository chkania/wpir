import { COST_PART_LABELS, compareInstallTimes, explainBest, type CostPart, type InstallComparison } from '../core/compare';
import { keyEvents, type KeyEvent, type KeyEvents } from '../core/events';
import { parseMonth, tryParseMonth } from '../core/dates';
import { APP_VERSION } from '../version';
import { AUTO_APPLICATION_LEAD_MONTHS, createDefaults, FUNDING_SOURCE_DATE } from '../core/defaults';
import { assumptionsAgeMonths, assumptionsStale } from '../core/freshness';
import { applyNewDefaults, DEFAULTS_AS_OF, outdatedDefaults, savedDefaultsAsOf, type OutdatedDefault } from '../core/default-history';
import { DEFAULT_SOURCES, OFFICIAL_REFS, SOURCE_KIND_LABEL } from '../core/sources';
import { priceRows, runAll, type RunResult } from '../core/simulation';
import { tariffComparison } from '../core/tariff';
import { EFFICIENCY_CLASSES, rateHouse } from '../core/house';
import { estimateJaz, type JazEstimate } from '../core/jaz';
import { energyYear, type EnergyYear } from '../core/energy';
import { pvSummary } from '../core/pv';
import { reportHtml } from './report';
import { burdenHtml } from './burden';
import { MAX_VARIANTS, variantName, variantResult, type Variant } from '../core/variants';
import { VARIANTS_LIMIT_TEXT, variantCurves, variantCurvesTableHtml, variantDiffsHtml, variantsTableHtml } from './variants';
import { sensitivity, type Sensitivity } from '../core/sensitivity';
import { energySplit } from '../core/prices';
import { cleanScenarioName, decodeHash, encodeHash, exportFileName, exportJson, importJson, mergeInputs } from '../core/serialize';
import {
  findScenario,
  parseScenarioFile,
  putScenario,
  removeScenarioAt,
  scenarioEntry,
  scenarioViews,
  SCENARIOS_KEY,
  serializeScenarioFile,
  setScenarioAt,
  viewScenario,
  type ScenarioView,
} from '../core/scenario-store';
import { SCENARIO_TEXT, UNNAMED, savedPickHtml, scenarioListHtml } from './scenarios';
import type { Inputs, ScenarioKind, ScenarioResult } from '../core/types';
import { cleanDocuments, DOCUMENT_TITLE_MAX, DOCUMENT_URL_MAX, installBounds, MAX_DOCUMENTS, monthBounds, monthRangeLabel, NUMBER_LIMITS, numberRange, TEXT_LIMITS, validMonth, type InputIssue } from '../core/validate';
import { chartTables, type ChartId } from './charts';

/** Chart.js module, loaded on demand so that it does not delay the first display (N14). */
type ChartLib = typeof import('./chart-render');
let chartLib: ChartLib | null = null;
let chartLibLoading: Promise<ChartLib> | null = null;
const loadChartLib = (): Promise<ChartLib> => (chartLibLoading ??= import('./chart-render').then((m) => (chartLib = m)));
/** Runs fn with the chart module – immediately when loaded, otherwise after loading. */
function withChartLib(fn: (lib: ChartLib) => void): void {
  if (chartLib) fn(chartLib);
  else void loadChartLib().then(fn, () => undefined);
}
import { SECTIONS, getPath, setPath, type Field } from './fields';
import { escapeHtml, fmtDuration, fmtEur, fmtMonth, fmtNum, fmtPct, safeHref } from './format';
import { RECOMMEND_SUBJECT, RECOMMEND_TEXT, calculatorUrl, recommendLinks, shareBaseUrl } from './share';
import { logoSvg } from '../logo';
import { BUG_REPORT_URL, BUY_ME_A_COFFEE_URL, PAGE_TITLE, CONTRIBUTING_URL, DONATION_ACCOUNT, FEATURE_REQUEST_URL, PAYPAL_URL, REPO_URL } from '../project';
import { compactIban, epcPayload, formatIban } from './donate';
import { qrSvg } from './qr';
import { DERIVATION_PAGE, derivationLink } from './derivation-link';

export const STORAGE_KEY = 'wp-investitionsrechner:v1';
/** Former design choice (modern/classic, F14); only the modern design remains, the stored value is removed. */
export const LEGACY_DESIGN_KEY = 'wp-investitionsrechner:design';
/** Light/dark: 'auto' follows the browser/system setting, 'light'/'dark' override it (F14.5). */
export const THEME_KEY = 'wp-investitionsrechner:theme';
export type ThemeChoice = 'auto' | 'light' | 'dark';
/** Set once the introduction (F20) was closed; it is then no longer shown automatically. */
export const INTRO_KEY = 'wp-investitionsrechner:intro-seen';
/** Set when the notice on personal data before sharing/exporting (F9.7) should no longer be shown. */
export const PRIVACY_ACK_KEY = 'wp-investitionsrechner:personal-data-notice-off';

/**
 * Confirmation notices: before passing on the inputs (personal data, F9.7) and before overwriting them (F9.8:
 * import, reset, taking over a variant).
 * Only the personal data notice can be switched off; the overwrite warning always appears.
 */
const EXPORT_CHOICE =
  '„Datei (JSON)“ speichert alle Eingaben – zum Sichern, für ein anderes Gerät und zum späteren Import. „Für KI (Markdown)“ speichert zusätzlich Ergebnisse, Standardwerte mit Herkunft und den Rechenweg – zum Auswerten mit einem KI-Assistenten.';
interface ConfirmNotice {
  title: string;
  text: string;
  ok: string;
  /** Second action button (e.g. the Markdown export next to the JSON export). */
  alt?: string;
  /** Text when the notice is switched off; with it the dialog still opens (it offers a choice). */
  brief?: string;
}
const CONFIRM_NOTICE: Record<'share' | 'export' | 'import' | 'variant' | 'reset' | 'recall' | 'overwrite' | 'delete' | 'clear', ConfirmNotice> = {
  share: {
    title: 'Link mit Ihren Eingaben teilen?',
    text: 'Der Link enthält Ihre Eingaben – auch persönliche Angaben wie Haushaltseinkommen und Einkommensteuer, Angaben zu Haus und Heizung sowie Bezeichnung und Bemerkungen des Szenarios. Jede Person, die den Link erhält, kann sie sehen. Teilen Sie ihn nur mit Personen, die diese Angaben sehen dürfen.',
    ok: 'Link kopieren',
  },
  export: {
    title: 'Eingaben exportieren',
    text: `${EXPORT_CHOICE} Beide Dateien enthalten alle Eingaben – auch persönliche Angaben wie Haushaltseinkommen und Einkommensteuer, Angaben zu Haus und Heizung sowie Bezeichnung und Bemerkungen des Szenarios. Geben Sie sie nur an Personen weiter, die diese Angaben sehen dürfen. Wenn Sie die KI-Datei bei einem KI-Dienst hochladen, erhält dessen Anbieter diese Angaben; entfernen Sie vorher, was Sie nicht weitergeben möchten.`,
    ok: 'Datei (JSON)',
    alt: 'Für KI (Markdown)',
    /** Shown instead of `text` when the personal data notice is switched off: the dialog still offers the choice (F35.1). */
    brief: EXPORT_CHOICE,
  },
  import: {
    title: 'Eingaben aus einer Datei laden?',
    text: 'Der Import ersetzt alle aktuellen Eingaben im Rechner durch die Werte aus der Datei. Ihre bisherigen Eingaben gehen dabei verloren. Sichern Sie sie vorher bei Bedarf per „Export“.',
    ok: 'Datei wählen',
  },
  variant: {
    title: 'Variante in den Rechner übernehmen?',
    text: 'Die Eingaben im Rechner werden durch „{name}“ ersetzt. Ihre bisherigen Eingaben gehen dabei verloren. Sichern Sie sie vorher bei Bedarf per „Export“.',
    ok: 'Übernehmen',
  },
  reset: {
    title: 'Alle Eingaben zurücksetzen?',
    text: 'Alle Eingaben werden durch die Standardwerte ersetzt. Ihre bisherigen Eingaben gehen dabei verloren. Sichern Sie sie vorher bei Bedarf per „Export“.',
    ok: 'Zurücksetzen',
  },
  // Saved scenarios (F37.6–F37.8, F37.11): never switched off (F37.9); an empty text is hidden
  recall: {
    title: 'Gespeichertes Szenario abrufen?',
    text: 'Die Eingaben im Rechner werden durch „{name}“ ersetzt. Ihre bisherigen Eingaben gehen dabei verloren. Sichern Sie sie vorher bei Bedarf per „Gespeicherte Szenarien“ oder „Export“.',
    ok: 'Abrufen',
  },
  overwrite: { title: 'Gespeicherten Stand „{name}“ mit den aktuellen Eingaben überschreiben?', text: '', ok: 'Überschreiben' },
  delete: { title: '„{name}“ endgültig löschen?', text: '', ok: 'Löschen' },
  clear: { title: 'Alle gespeicherten Szenarien endgültig löschen?', text: '', ok: 'Leeren' },
};
type ConfirmKind = keyof typeof CONFIRM_NOTICE;
/** Notices that can be switched off with "Diesen Hinweis nicht mehr anzeigen". */
const SKIPPABLE: readonly ConfirmKind[] = ['share', 'export'];
type AgentExportLib = typeof import('./agent-export');
let agentExportLoading: Promise<AgentExportLib> | null = null;
/** The export for AI agents (F35) is loaded on demand, like the charts (N14). */
const loadAgentExport = (): Promise<AgentExportLib> => (agentExportLoading ??= import('./agent-export'));

export interface AppEnv {
  storage?: Storage | null;
  today?: Date;
  /** Can be disabled for tests. */
  debounceMs?: number;
}

export interface AppController {
  getInputs(): Inputs;
  setInputs(i: Inputs): void;
  recalc(): void;
  lastResult(): { run: RunResult; cmp: InstallComparison; events: KeyEvents; sens: Sensitivity } | null;
  getTheme(): ThemeChoice;
  setTheme(t: ThemeChoice): void;
  /** Opens the introduction dialog (F20). */
  showIntro(): void;
  /** Builds the printable report (F30) and returns its element (null without result). */
  buildReport(): HTMLElement | null;
  /** Names of the variants in the comparison (F31). */
  getVariants(): string[];
}

const CHART_TABS: [ChartId, string][] = [
  ['cumulative', 'Kumulierte Kosten'],
  ['annual', 'Jährliche Kosten'],
  ['prices', 'Preisentwicklung'],
  ['install', 'Zeitpunkt der Umrüstung'],
  ['energy', 'Energie je Monat'],
  ['sensitivity', 'Einflussgrößen'],
];

/**
 * Opens a modal dialog with the close button at the top focused and the content at the top. Without this the browser
 * focuses the first control, which on small screens can be a button at the bottom of a long dialog, and scrolls down to it.
 */
function showDialog(dlg: HTMLDialogElement): void {
  if (typeof dlg.showModal === 'function') dlg.showModal();
  else dlg.setAttribute('open', '');
  // The close button at the top is focused; a heading would show a focus ring after a tap on some browsers (F20.3)
  dlg.querySelector<HTMLElement>('[data-dialog-first]')?.focus({ preventScroll: true });
  dlg.scrollTop = 0;
  dlg.querySelector<HTMLElement>('.intro-body')?.scrollTo?.(0, 0);
}

export function mountApp(root: HTMLElement, env: AppEnv = {}): AppController {
  const storage = env.storage === undefined ? safeStorage() : env.storage;
  const defaults = createDefaults(env.today ?? new Date());
  /** Check date for the commissioning windows (F1.7, F1.8): the same date as the defaults. */
  const checkDate = env.today ?? new Date();
  const initial = loadInitial(defaults, storage, checkDate);
  let inputs = initial.inputs;
  // Shared link while own inputs exist: do not silently overwrite them (F9.6)
  let sharedView = initial.source === 'hash' && initial.storedRaw !== null;
  let loadIssues: { origin: string; issues: InputIssue[] } | null = initial.issues.length
    ? { origin: initial.source === 'hash' ? 'dem Link' : 'den gespeicherten Eingaben', issues: initial.issues }
    : null;
  /** Fields that still hold a former default (F22.4); until answered, the old defaults version is kept in storage. */
  let newDefaults: { origin: 'storage' | 'file' | 'scenario'; asOf: string; list: OutdatedDefault[] } | null = null;
  const checkDefaults = (origin: 'storage' | 'file', raw: unknown): void => {
    const asOf = savedDefaultsAsOf(raw);
    const list = outdatedDefaults(inputs, defaults, asOf);
    newDefaults = list.length ? { origin, asOf, list } : null;
  };
  if (initial.source === 'storage') checkDefaults('storage', parseJson(initial.storedRaw));
  let last: { run: RunResult; cmp: InstallComparison; events: KeyEvents; sens: Sensitivity } | null = null;
  let tableKind: ScenarioKind = 'kfw';
  let activeChart: ChartId = 'cumulative';

  root.innerHTML = layout();
  const $ = <T extends HTMLElement>(sel: string) => root.querySelector(sel) as T;
  const form = $<HTMLElement>('#inputs');
  form.innerHTML = sectionsToggleHtml() + SECTIONS.map((s) => sectionHtml(s)).join('');
  // Expand/collapse all input sections at once (F24)
  form.querySelectorAll<HTMLButtonElement>('[data-sections]').forEach((b) =>
    b.addEventListener('click', () => {
      const open = b.dataset.sections === 'open';
      form.querySelectorAll<HTMLDetailsElement>('details.section').forEach((d) => (d.open = open));
    }),
  );

  const canvases = Object.fromEntries(
    CHART_TABS.map(([id]) => [id, $<HTMLCanvasElement>(`canvas[data-chart="${id}"]`)]),
  ) as Record<ChartId, HTMLCanvasElement>;
  let charts: InstanceType<ChartLib['Charts']> | null = null;
  /** Draws the result charts with the latest result (after loading Chart.js if needed). */
  const drawCharts = () =>
    withChartLib((lib) => {
      if (!last) return;
      charts ??= new lib.Charts(canvases);
      charts.update(last.run, priceRows(inputs), last.cmp, last.events, last.sens, energyYear(inputs));
    });

  // ---------- Links to documents (F16.4) ----------
  /**
   * One row of the list, built from the same parts as the other fields (label row, .control, .field-error);
   * a row is only stored in the inputs while its address is valid.
   */
  let docSeq = 0;
  const docRowHtml = (d: { title: string; url: string }): string => {
    const id = `doc-${++docSeq}`;
    return `<div class="doc-row" role="group" aria-label="Unterlage">
      <div class="label-row"><label for="${id}-title">Titel</label><button type="button" class="link-btn doc-remove" data-doc-remove>Entfernen</button></div>
      <div class="control"><input type="text" id="${id}-title" data-doc-title maxlength="${DOCUMENT_TITLE_MAX}" value="${escapeHtml(d.title)}" placeholder="z. B. Angebot Heizungsbau"></div>
      <label for="${id}-url">Adresse</label>
      <div class="control"><input type="url" id="${id}-url" data-doc-url maxlength="${DOCUMENT_URL_MAX}" value="${escapeHtml(d.url)}" placeholder="https://…" spellcheck="false" aria-describedby="${id}-err"></div>
      <small class="field-error doc-error" id="${id}-err" aria-live="polite" hidden></small>
    </div>`;
  };

  /** Builds the list as the last field of the scenario section from the stored links (F16.4). */
  function renderDocLinks(): void {
    form.querySelector('.doc-links')?.remove();
    const fields = form.querySelector<HTMLElement>('details.section .fields');
    if (!fields) return;
    const wrap = document.createElement('div');
    wrap.className = 'field doc-links';
    wrap.innerHTML = `<div class="label-row"><span class="doc-links-title" id="doc-links-title">Unterlagen und Links</span></div>
      <div class="doc-rows" role="group" aria-labelledby="doc-links-title">${inputs.scenario.documents.map(docRowHtml).join('')}</div>
      <button type="button" class="doc-add" data-doc-add>+ Unterlage hinzufügen</button>
      <small class="help">Links zu Angeboten, Datenblättern oder Förderunterlagen, z. B. für Installateur oder Energieberatung. Sie reisen mit dem geteilten Link und der Export-Datei und erscheinen im Bericht mit QR-Code. Bis zu ${MAX_DOCUMENTS} Einträge, nur Adressen mit http:// oder https://.</small>`;
    fields.appendChild(wrap);
    updateDocControls();
  }

  function updateDocControls(): void {
    const rows = form.querySelectorAll('.doc-row').length;
    const add = form.querySelector<HTMLButtonElement>('[data-doc-add]');
    if (add) add.disabled = rows >= MAX_DOCUMENTS;
  }

  /** Stores all rows with a valid address in the inputs; other rows only show a hint. */
  function syncDocLinks(): void {
    const stored: { title: string; url: string }[] = [];
    for (const row of form.querySelectorAll<HTMLElement>('.doc-row')) {
      const title = row.querySelector<HTMLInputElement>('[data-doc-title]')!.value.trim();
      const url = row.querySelector<HTMLInputElement>('[data-doc-url]')!.value.trim();
      const err = row.querySelector<HTMLElement>('.doc-error')!;
      const valid = cleanDocuments([{ title, url }]).length === 1;
      const empty = title === '' && url === '';
      err.hidden = valid || empty;
      err.textContent = `Bitte eine Adresse mit http:// oder https:// eintragen (höchstens ${DOCUMENT_URL_MAX} Zeichen).`;
      if (valid) stored.push({ title, url });
    }
    inputs.scenario.documents = stored.slice(0, MAX_DOCUMENTS);
    persist();
    updateDocControls();
  }

  // ---------- Form ----------
  const fieldByPath = new Map<string, Field>();
  for (const s of SECTIONS) for (const f of s.fields) fieldByPath.set(f.path, f);

  function writeForm(): void {
    for (const el of form.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>('[data-path]')) {
      const f = fieldByPath.get(el.dataset.path!)!;
      const v = getPath(inputs, f.path);
      if (el instanceof HTMLInputElement && f.type === 'checkbox') el.checked = Boolean(v);
      else if (f.type === 'percent') el.value = String(round(Number(v) * 100, 6));
      else el.value = String(v ?? '');
      setFieldError(el, null);
    }
    refreshVisibility();
    renderScenarioName();
    renderDocLinks();
  }

  /** Name above the results and in the window title (F16.1). */
  function renderScenarioName(): void {
    const name = inputs.scenario.name.trim();
    const el = $<HTMLElement>('#scenario-name');
    el.textContent = name;
    el.hidden = name === '';
    document.title = name ? `${name} – Wärmepumpen-Investitionsrechner` : PAGE_TITLE;
  }

  function refreshVisibility(): void {
    for (const wrap of form.querySelectorAll<HTMLElement>('[data-field]')) {
      const f = fieldByPath.get(wrap.dataset.field!)!;
      wrap.hidden = f.show ? !f.show(inputs) : false;
      if (typeof f.unit === 'function') {
        const u = wrap.querySelector('.unit');
        if (u) u.textContent = f.unit(inputs);
      }
      const note = wrap.querySelector<HTMLElement>('.field-note');
      if (note && f.note && !wrap.hidden) note.textContent = f.note(inputs);
    }
    renderJazCheck();
  }

  // ---------- SPF (JAZ) check after changes that affect the estimate (F26.4) ----------
  /** Field whose change shifted the SPF (JAZ) estimate, with the estimate before the first such change. */
  let jazCheck: { path: string; before: JazEstimate } | null = null;
  const sameEstimate = (a: JazEstimate, b: JazEstimate) => a.low === b.low && a.mid === b.mid && a.high === b.high;
  function renderJazCheck(): void {
    for (const el of form.querySelectorAll('.jaz-check')) el.remove();
    if (!jazCheck) return;
    const now = estimateJaz(inputs);
    if (sameEstimate(now, jazCheck.before)) {
      jazCheck = null;
      return;
    }
    const wrap = form.querySelector<HTMLElement>(`[data-field="${jazCheck.path}"]`);
    if (!wrap || wrap.hidden) return;
    const d1 = (x: number) => fmtNum(x, 1);
    const p = document.createElement('p');
    p.className = 'jaz-check';
    p.setAttribute('role', 'status');
    p.innerHTML = `Die JAZ-Schätzung hat sich geändert: jetzt ${d1(now.low)}–${d1(now.high)} (vorher ${d1(jazCheck.before.low)}–${d1(jazCheck.before.high)}). Ihr eingetragener Wert ist ${d1(inputs.heatPump.jaz)} – bitte die JAZ prüfen. <button type="button" class="link-btn" data-jaz-goto>Zur JAZ</button>`;
    wrap.after(p);
  }
  form.addEventListener('click', (e) => {
    if (!(e.target as HTMLElement).closest('[data-jaz-goto]')) return;
    const jaz = form.querySelector<HTMLInputElement>('[data-path="heatPump.jaz"]');
    if (!jaz) return;
    const section = jaz.closest('details');
    if (section) section.open = true;
    jaz.scrollIntoView({ block: 'center', behavior: 'smooth' });
    jaz.focus({ preventScroll: true });
  });

  // Links to documents (F16.4): add a row, remove a row, edit a row (delegated, the list is rebuilt on load and reset)
  form.addEventListener('click', (e) => {
    const t = e.target as HTMLElement;
    if (t.closest('[data-doc-add]')) {
      const rows = form.querySelector<HTMLElement>('.doc-rows');
      if (!rows || form.querySelectorAll('.doc-row').length >= MAX_DOCUMENTS) return;
      rows.insertAdjacentHTML('beforeend', docRowHtml({ title: '', url: '' }));
      rows.lastElementChild!.querySelector<HTMLInputElement>('[data-doc-title]')!.focus();
      updateDocControls();
      return;
    }
    if (t.closest('[data-doc-remove]')) {
      t.closest('.doc-row')?.remove();
      syncDocLinks();
    }
  });
  form.addEventListener('input', (e) => {
    if ((e.target as HTMLElement).closest('.doc-rows')) syncDocLinks();
  });

  /** Mark errors as text and for screen readers (WCAG 3.3.1, 1.4.1). */
  function setFieldError(el: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement, msg: string | null): void {
    el.classList.toggle('invalid', msg !== null);
    if (msg === null) el.removeAttribute('aria-invalid');
    else el.setAttribute('aria-invalid', 'true');
    const err = form.querySelector<HTMLElement>(`#${el.id}-err`);
    if (err) {
      err.textContent = msg ?? '';
      err.hidden = msg === null;
    }
  }

  /**
   * Allowed months of a month field (F1.7, F1.8): the commissioning month lies in the window of a fixed application
   * month; otherwise the field's own range (monthBounds, relative to the check date).
   */
  function monthRange(path: string): [number, number] {
    const app = tryParseMonth(inputs.heatPump.applicationMonth);
    if (path === 'heatPump.installMonth' && app !== null) return installBounds(app);
    return monthBounds(path, checkDate);
  }
  function readField(el: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement): void {
    const f = fieldByPath.get(el.dataset.path!)!;
    const prev = getPath(inputs, f.path);
    let value: unknown;
    let valid = true;
    let partialInput = false;
    if (f.type === 'checkbox') value = (el as HTMLInputElement).checked;
    else if (f.type === 'number' || f.type === 'percent') {
      const n = Number(String(el.value).replace(',', '.'));
      value = f.type === 'percent' ? n / 100 : n;
      const [min, max] = numberRange(f.path);
      // Limits from input validation (F9.5), so that typos cannot freeze the browser either
      valid = el.value.trim() !== '' && Number.isFinite(n) && (value as number) >= min && (value as number) <= max;
    } else if (f.type === 'month') {
      value = el.value.trim();
      // A browser gives an empty value for an impossible or incomplete month: it must not count as "automatic" (F1.6)
      partialInput = f.path === 'heatPump.applicationMonth' && el.validity?.badInput === true;
      valid = !partialInput && validMonth(f.path, value as string, checkDate) && inMonthRange(value as string, monthRange(f.path));
    } else value = el.value;
    // A partly entered month gets its own text (F1.6); other failures name the allowed range (F1.7, F1.8)
    let error: string | null = partialInput ? PARTIAL_MONTH_TEXT : valid ? null : f.type === 'month' ? monthErrorText(monthRange(f.path)) : fieldErrorText(f);
    // F1.6: the application month must not lie after the commissioning month (same month is allowed)
    if (valid && f.path === 'heatPump.applicationMonth' && value !== '' && parseMonth(value as string) > parseMonth(inputs.heatPump.installMonth)) {
      valid = false;
      error = `Der Antragsmonat darf nicht nach der Inbetriebnahme liegen.${KEEP_TEXT}`;
    } else if (valid && f.path === 'heatPump.applicationMonth' && value !== '' && parseMonth(inputs.heatPump.installMonth) > installBounds(parseMonth(value as string))[1]) {
      // F1.7 (AK2): a fixed application month that puts the commissioning beyond its window
      valid = false;
      error = `Mit diesem Antragsmonat liegt die Inbetriebnahme außerhalb des Zeitraums (bis ${fmtMonth(installBounds(parseMonth(value as string))[1])}).${KEEP_TEXT}`;
    }
    setFieldError(el, error);
    if (!valid) return;
    const jazBefore = f.path === 'heatPump.jaz' ? null : estimateJaz(inputs);
    setPath(inputs, f.path, value);
    if (f.path === 'heatPump.jaz') jazCheck = null;
    else if (jazBefore && !sameEstimate(jazBefore, estimateJaz(inputs))) jazCheck = { path: f.path, before: jazCheck?.before ?? jazBefore };
    f.onChange?.(inputs, prev);
    if (f.onChange) writeForm();
    refreshVisibility();
    persist();
    if (f.noRecalc) renderScenarioName();
    else schedule();
  }

  // ---------- Notices on load: shared link, invalid values (F9.5, F9.6) ----------
  const notice = $<HTMLElement>('#notice');
  let staleDismissed = false;
  function renderNotice(): void {
    const parts: string[] = [];
    if (sharedView) {
      parts.push(`<div class="notice-shared">
        <p><strong>Geteiltes Szenario geöffnet.</strong> Ihre eigenen gespeicherten Eingaben bleiben unverändert, bis Sie dieses Szenario übernehmen. Änderungen wirken nur auf den Link.</p>
        <div class="notice-actions">
          <button type="button" data-notice="adopt">Als meine Eingaben übernehmen</button>
          <button type="button" data-notice="own" class="ghost">Eigene Eingaben laden</button>
        </div></div>`);
    }
    if (loadIssues) {
      parts.push(`<div class="notice-issues">
        <p><strong>${loadIssues.issues.length === 1 ? 'Ein Wert' : `${loadIssues.issues.length} Werte`} aus ${escapeHtml(loadIssues.origin)} ${loadIssues.issues.length === 1 ? 'wurde' : 'wurden'} angepasst:</strong></p>
        <ul>${loadIssues.issues
          .slice(0, 12)
          .map((x) => `<li>${escapeHtml(fieldByPath.get(x.path)?.label ?? x.path)}: ${escapeHtml(x.reason)}</li>`)
          .join('')}${loadIssues.issues.length > 12 ? `<li>… und ${loadIssues.issues.length - 12} weitere</li>` : ''}</ul>
        <button type="button" data-notice="dismiss" class="ghost">Ausblenden</button></div>`);
    }
    // F22.4: new defaults since the data was saved
    if (newDefaults) {
      const since =
        newDefaults.origin === 'file' ? 'Seit die Datei erstellt wurde'
        : newDefaults.origin === 'scenario' ? 'Seit das Szenario gespeichert wurde'
        : 'Seit Ihre Eingaben gespeichert wurden';
      parts.push(`<div class="notice-defaults">
        <p><strong>Neue Standardwerte.</strong> ${since}, wurden Standardwerte aktualisiert. Diese Felder stehen noch auf dem früheren Standard:</p>
        <ul>${newDefaults.list
          .map((x) => {
            const f = fieldByPath.get(x.path);
            const label = f?.label ?? x.path;
            const fmt = (v: unknown) => (f ? formatValue(f, v, inputs) : String(v));
            return `<li>${escapeHtml(label)}: ${escapeHtml(fmt(x.previous))} → ${escapeHtml(fmt(x.current))}</li>`;
          })
          .join('')}</ul>
        <div class="notice-actions">
          <button type="button" data-notice="defaults-apply">Neue Standardwerte übernehmen</button>
          <button type="button" data-notice="defaults-keep" class="ghost">Bisherige Werte behalten</button>
        </div></div>`);
    }
    // F22: assumptions not reviewed for a long time
    const today = env.today ?? new Date();
    if (assumptionsStale(today) && !staleDismissed) {
      parts.push(`<div class="notice-stale">
        <p><strong>Annahmen möglicherweise veraltet.</strong> Förderbedingungen, Preise und Zinsen wurden zuletzt am ${FUNDING_SOURCE_DATE.split('-').reverse().join('.')} geprüft (vor ${assumptionsAgeMonths(today)} Monaten). Prüfen Sie wichtige Werte vor einer Entscheidung bei KfW, Ihrem Energieversorger oder einer Energieberatung. Ist Ihnen ein veralteter Wert aufgefallen? <a href="${safeHref(BUG_REPORT_URL)}" target="_blank" rel="noopener">Hier melden</a>.</p>
        <button type="button" data-notice="stale" class="ghost">Ausblenden</button></div>`);
    }
    notice.innerHTML = parts.join('');
    notice.hidden = parts.length === 0;
  }
  /** Leave the link view: remove the hash, allow saving again. */
  function leaveShared(): void {
    sharedView = false;
    if (/^#[sz]=/.test(location.hash)) history.replaceState(null, '', location.pathname + location.search);
  }
  notice.addEventListener('click', (e) => {
    const action = (e.target as HTMLElement).closest<HTMLElement>('[data-notice]')?.dataset.notice;
    if (action === 'stale') {
      staleDismissed = true;
      renderNotice();
      return;
    }
    if (action === 'defaults-apply' || action === 'defaults-keep') {
      const apply = action === 'defaults-apply' && newDefaults;
      if (apply) applyNewDefaults(inputs, newDefaults!.list);
      newDefaults = null;
      persist();
      if (apply) {
        writeForm();
        recalc();
      }
      renderNotice();
      toast(apply ? 'Neue Standardwerte übernommen.' : 'Bisherige Werte behalten.');
      return;
    }
    if (action === 'adopt') {
      sharedView = false;
      persist();
      toast('Szenario als eigene Eingaben übernommen.');
    } else if (action === 'own') {
      leaveShared();
      const issues: InputIssue[] = [];
      try {
        inputs = mergeInputs(defaults, JSON.parse(initial.storedRaw ?? '{}'), issues, checkDate);
      } catch {
        inputs = mergeInputs(defaults, {}, [], checkDate);
      }
      loadIssues = issues.length ? { origin: 'den gespeicherten Eingaben', issues } : null;
      checkDefaults('storage', parseJson(initial.storedRaw));
      writeForm();
      recalc();
      toast('Eigene Eingaben geladen.');
    } else if (action === 'dismiss') {
      loadIssues = null;
    } else return;
    renderNotice();
  });

  // ---------- Origin of default values (popover) ----------
  const closePopovers = (except?: Element) => {
    for (const b of form.querySelectorAll<HTMLButtonElement>('.info-btn[aria-expanded="true"]')) {
      if (b === except) continue;
      b.setAttribute('aria-expanded', 'false');
      (document.getElementById(b.getAttribute('aria-controls')!) as HTMLElement).hidden = true;
    }
  };
  form.addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('.info-btn');
    if (!btn) return;
    e.preventDefault();
    closePopovers(btn);
    const pop = document.getElementById(btn.getAttribute('aria-controls')!) as HTMLElement;
    const open = btn.getAttribute('aria-expanded') !== 'true';
    if (open && !pop.firstElementChild && pop.dataset.src) pop.innerHTML = sourcePopHtml(pop.dataset.src, defaults);
    btn.setAttribute('aria-expanded', String(open));
    pop.hidden = !open;
  });
  document.addEventListener('click', (e) => {
    if (!(e.target as HTMLElement).closest?.('.info-btn, .src-pop')) closePopovers();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closePopovers();
  });

  // Apply the SPF (JAZ) estimate (F26): sets the field like a user input
  form.addEventListener('click', (e) => {
    if (!(e.target as HTMLElement).closest('[data-jaz-apply]')) return;
    inputs.heatPump.jaz = estimateJaz(inputs).mid;
    jazCheck = null;
    writeForm();
    persist();
    recalc();
  });

  form.addEventListener('input', (e) => {
    const el = e.target as HTMLInputElement;
    if (el.dataset.path) readField(el);
  });
  form.addEventListener('change', (e) => {
    const el = e.target as HTMLInputElement;
    if (el.dataset.path) readField(el);
  });
  // Chromium fires no input event when the last segment of a month is cleared (the value stays ""),
  // so the application month is checked again on leaving it and on Backspace/Delete (F1.5, F1.6)
  const isApplicationMonth = (t: EventTarget | null) => (t as HTMLElement | null)?.dataset?.path === 'heatPump.applicationMonth';
  form.addEventListener('focusout', (e) => {
    if (isApplicationMonth(e.target)) readField(e.target as HTMLInputElement);
  });
  form.addEventListener('keyup', (e) => {
    if ((e.key === 'Backspace' || e.key === 'Delete') && isApplicationMonth(e.target)) readField(e.target as HTMLInputElement);
  });

  // ---------- Toolbar menus (F38, ARIA pattern "Menu Button") ----------
  /** The three menus of the toolbar: button and panel per menu. */
  const toolMenus = [...root.querySelectorAll<HTMLButtonElement>('[data-menu-button]')].map((btn) => ({
    btn,
    panel: root.querySelector<HTMLElement>(`#${btn.getAttribute('aria-controls')}`)!,
  }));
  type ToolMenu = (typeof toolMenus)[number];
  const menuItemsOf = (m: ToolMenu) => [...m.panel.querySelectorAll<HTMLElement>('[role="menuitem"]')];
  const menuOpen = (m: ToolMenu) => !m.panel.hidden;
  const dialogOpen = () => document.querySelector('dialog[open]') !== null;
  /** Button of the menu whose item was activated; the focus returns there after the action (F38.5). */
  let menuOrigin: HTMLElement | null = null;
  /** Elements of the tab order; items with tabindex="-1" (menu items) are left out. */
  const FOCUSABLE =
    'a[href]:not([tabindex="-1"]), button:not([tabindex="-1"]), input:not([tabindex="-1"]), select:not([tabindex="-1"]), textarea:not([tabindex="-1"]), summary:not([tabindex="-1"]), [tabindex]:not([tabindex="-1"])';

  function closeMenu(m: ToolMenu): void {
    m.panel.hidden = true;
    m.btn.setAttribute('aria-expanded', 'false');
  }
  /** At most one menu is open (F38.4). */
  function closeAllMenus(except?: ToolMenu): void {
    for (const m of toolMenus) if (m !== except && menuOpen(m)) closeMenu(m);
  }
  function openMenu(m: ToolMenu): void {
    closeAllMenus(m);
    m.panel.hidden = false;
    m.btn.setAttribute('aria-expanded', 'true');
    menuItemsOf(m)[0]?.focus();
  }
  /** The next (or previous) focusable element after an element, used by Tab in an open menu (F38.4). */
  function focusNeighbour(el: HTMLElement, backwards: boolean): void {
    const all = [...document.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(
      // hidden parts (menu panels, closed dialogs) and aria-hidden ancestors are not part of the tab order
      (x) => !x.closest('[hidden], [aria-hidden="true"], dialog:not([open])') && !(x as HTMLButtonElement).disabled,
    );
    const i = all.indexOf(el);
    (all[backwards ? i - 1 : i + 1] ?? el).focus();
  }
  /** Focus back to the menu button after an action that has ended (F38.5). */
  function returnFocusToMenu(): void {
    const btn = menuOrigin;
    menuOrigin = null;
    btn?.focus();
  }
  for (const dlg of root.querySelectorAll('dialog')) {
    dlg.addEventListener('close', () => {
      if (menuOrigin && !dialogOpen()) returnFocusToMenu();
    });
  }
  for (const m of toolMenus) {
    m.btn.addEventListener('click', () => (menuOpen(m) ? closeMenu(m) : openMenu(m)));
    m.btn.addEventListener('keydown', (e) => {
      if (e.key !== 'ArrowDown') return;
      e.preventDefault();
      openMenu(m);
    });
    // Activating an item closes the menu and moves the focus to its button before the action runs (F38.5)
    m.panel.addEventListener(
      'click',
      (e) => {
        if (!(e.target as HTMLElement).closest('[role="menuitem"]')) return;
        closeMenu(m);
        menuOrigin = m.btn;
        m.btn.focus();
        // Without a dialog or file picker the focus stays on the button. The check runs after the timer: every action
        // of the menu opens its dialog synchronously (dialog.showModal, scenarios, variants, notices). An action that
        // opened its window later would lose the focus return – keep this in mind for new menu items.
        setTimeout(() => {
          if (!dialogOpen()) menuOrigin = null;
        }, 0);
      },
      true,
    );
    m.panel.addEventListener('keydown', (e) => {
      const items = menuItemsOf(m);
      const n = items.length;
      const i = items.indexOf(document.activeElement as HTMLElement);
      let target: HTMLElement | undefined;
      switch (e.key) {
        case 'ArrowDown':
          target = items[i < 0 ? 0 : (i + 1) % n];
          break;
        case 'ArrowUp':
          target = items[i <= 0 ? n - 1 : i - 1];
          break;
        case 'Home':
          target = items[0];
          break;
        case 'End':
          target = items[n - 1];
          break;
        case 'Escape':
          e.preventDefault();
          closeMenu(m);
          m.btn.focus();
          return;
        case 'Tab':
          e.preventDefault();
          closeMenu(m);
          focusNeighbour(m.btn, e.shiftKey);
          return;
        default:
          return;
      }
      e.preventDefault();
      target?.focus();
    });
  }
  // A click outside closes the open menu (F38.4); clicks on the menu buttons and items are handled above
  document.addEventListener('click', (e) => {
    if (!(e.target as HTMLElement).closest?.('.menu')) closeAllMenus();
  });

  // ---------- Toolbar ----------
  const toast = (msg: string) => {
    const t = $<HTMLElement>('#toast');
    t.textContent = msg;
    t.classList.add('show');
    setTimeout(() => t.classList.remove('show'), 2500);
  };

  // ---------- Confirmation before sharing/exporting (personal data, F9.7) and overwriting (F9.8) ----------
  const privacyDlg = $<HTMLDialogElement>('#privacy-confirm');
  const privacySkip = $<HTMLInputElement>('#privacy-skip');
  let privacyAction: (() => void) | null = null;
  let privacyAltAction: (() => void) | null = null;
  let privacySkippable = false;
  const noticeOff = () => {
    try {
      return storage?.getItem(PRIVACY_ACK_KEY) === '1';
    } catch {
      return false;
    }
  };
  /**
   * Runs `action` (or `alt`, the second button) after the user confirmed the notice. A switched-off skippable notice
   * runs `action` right away – unless the notice offers a choice (`brief`): then the dialog opens with the short text.
   */
  const confirmAction = (kind: ConfirmKind, action: () => void, name = '', alt?: () => void) => {
    const t = CONFIRM_NOTICE[kind];
    const off = SKIPPABLE.includes(kind) && noticeOff();
    if (off && t.brief === undefined) return action();
    privacySkippable = SKIPPABLE.includes(kind) && !off;
    $<HTMLElement>('.privacy-skip').hidden = !privacySkippable;
    // textContent: the variant name (file name or scenario name) is never interpreted as HTML; a function
    // as replacement keeps "$&"-like sequences in a name as they are
    $<HTMLElement>('#privacy-title').textContent = t.title.replace('{name}', () => name);
    $<HTMLElement>('#privacy-text').textContent = (off ? t.brief! : t.text).replace('{name}', () => name);
    $<HTMLButtonElement>('#privacy-ok').textContent = t.ok;
    const altBtn = $<HTMLButtonElement>('#privacy-alt');
    altBtn.hidden = !(t.alt && alt);
    altBtn.textContent = t.alt ?? '';
    privacySkip.checked = false;
    privacyAction = action;
    privacyAltAction = alt ?? null;
    showDialog(privacyDlg);
  };
  const closePrivacy = () => {
    privacyAction = null;
    privacyAltAction = null;
    if (privacyDlg.open) privacyDlg.close();
  };
  const confirmWith = (action: (() => void) | null) => {
    if (privacySkippable && privacySkip.checked) {
      try {
        storage?.setItem(PRIVACY_ACK_KEY, '1');
      } catch {
        /* storage not available */
      }
    }
    closePrivacy();
    // still inside the click: clipboard and download keep their user activation
    action?.();
  };
  $<HTMLButtonElement>('#privacy-ok').addEventListener('click', () => confirmWith(privacyAction));
  $<HTMLButtonElement>('#privacy-alt').addEventListener('click', () => confirmWith(privacyAltAction));
  $<HTMLButtonElement>('#privacy-cancel').addEventListener('click', closePrivacy);
  $<HTMLButtonElement>('#privacy-close').addEventListener('click', closePrivacy);
  privacyDlg.addEventListener('cancel', () => {
    privacyAction = null; // Esc
    privacyAltAction = null;
  });
  privacyDlg.addEventListener('click', (e) => {
    if (e.target === privacyDlg) closePrivacy();
  });

  const shareLink = async () => {
    const hash = encodeHash(defaults, inputs);
    history.replaceState(null, '', hash);
    // short domain (F9.2); the address bar keeps the current address
    const url = shareBaseUrl(location.href) + hash;
    try {
      await navigator.clipboard.writeText(url);
      toast('Link in die Zwischenablage kopiert.');
    } catch {
      toast('Link steht in der Adresszeile.');
    }
  };
  const download = (content: string, type: string, name: string) => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([content], { type }));
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };
  const exportFile = () => download(exportJson(inputs), 'application/json', exportFileName(inputs, env.today ?? new Date()));
  /** Markdown file for an AI agent (F35): everything incl. defaults, origins, derivation and monthly values. */
  const exportAgent = async () => {
    let lib: AgentExportLib;
    try {
      lib = await loadAgentExport();
    } catch {
      agentExportLoading = null;
      toast('Export konnte nicht geladen werden. Bitte die Seite neu laden.');
      return;
    }
    if (!last) return;
    const today = env.today ?? new Date();
    const md = lib.agentMarkdown({
      inputs,
      defaults,
      ...last,
      today,
      url: calculatorUrl(location.href),
      shareUrl: shareBaseUrl(location.href),
    });
    download(md, 'text/markdown;charset=utf-8', lib.agentFileName(inputs, today));
    toast('Export für KI-Assistenten gespeichert.');
  };
  $<HTMLButtonElement>('#btn-share').addEventListener('click', () => confirmAction('share', () => void shareLink()));
  $<HTMLButtonElement>('#btn-export').addEventListener('click', () => {
    void loadAgentExport().catch(() => undefined); // starts loading while the dialog is open
    confirmAction('export', exportFile, '', () => void exportAgent());
  });
  const fileInput = $<HTMLInputElement>('#file-import');
  // the file picker opens inside the confirming click (user activation)
  $<HTMLButtonElement>('#btn-import').addEventListener('click', () => confirmAction('import', () => fileInput.click()));
  // After the file picker (F38.5) the focus is on the menu button "Szenarien" again
  const focusScenariosMenu = () => root.querySelector<HTMLElement>('#menu-scenarios-button')?.focus();
  fileInput.addEventListener('cancel', focusScenariosMenu);
  fileInput.addEventListener('change', async () => {
    focusScenariosMenu();
    const file = fileInput.files?.[0];
    if (!file) return;
    try {
      const issues: InputIssue[] = [];
      const text = await file.text();
      const imported = importJson(defaults, text, issues, checkDate);
      leaveShared();
      loadIssues = issues.length ? { origin: 'der Datei', issues } : null;
      newDefaults = null;
      const outdated = outdatedDefaults(imported, defaults, savedDefaultsAsOf(parseJson(text)));
      if (outdated.length) newDefaults = { origin: 'file', asOf: savedDefaultsAsOf(parseJson(text)), list: outdated };
      controller.setInputs(imported);
      renderNotice();
      toast('Eingaben importiert.');
    } catch (err) {
      toast((err as Error).message);
    }
    fileInput.value = '';
  });
  $<HTMLButtonElement>('#btn-reset').addEventListener('click', () =>
    confirmAction('reset', () => {
      leaveShared();
      loadIssues = null;
      newDefaults = null;
      controller.setInputs(createDefaults(env.today ?? new Date()));
      renderNotice();
      toast('Auf Standardwerte zurückgesetzt.');
    }),
  );

  // ---------- Tabs ----------
  // Tabs per ARIA pattern: one tab stop, arrow keys/Home/End switch (WCAG 2.1.1, 4.1.2)
  const tabButtons = [...root.querySelectorAll<HTMLButtonElement>('[data-tab]')];
  const selectTab = (b: HTMLButtonElement, focus = false) => {
    activeChart = b.dataset.tab as ChartId;
    for (const x of tabButtons) {
      x.setAttribute('aria-selected', String(x === b));
      x.tabIndex = x === b ? 0 : -1;
    }
    root.querySelectorAll<HTMLElement>('[data-panel]').forEach((p) => (p.hidden = p.dataset.panel !== activeChart));
    if (focus) b.focus();
  };
  tabButtons.forEach((b, i) => {
    b.addEventListener('click', () => selectTab(b));
    b.addEventListener('keydown', (e) => {
      const n = tabButtons.length;
      const target =
        e.key === 'ArrowRight' ? tabButtons[(i + 1) % n]
        : e.key === 'ArrowLeft' ? tabButtons[(i - 1 + n) % n]
        : e.key === 'Home' ? tabButtons[0]
        : e.key === 'End' ? tabButtons[n - 1]
        : null;
      if (!target) return;
      e.preventDefault();
      selectTab(target, true);
    });
  });
  $<HTMLSelectElement>('#table-kind').addEventListener('change', (e) => {
    tableKind = (e.target as HTMLSelectElement).value as ScenarioKind;
    if (last) renderYearTable(last.run, last.events);
  });

  const redrawCharts = () => {
    charts?.reset();
    drawCharts();
  };
  // ---------- Light/dark ----------
  const media = typeof matchMedia === 'function' ? matchMedia('(prefers-color-scheme: dark)') : null;
  let theme: ThemeChoice = readTheme(storage);
  const applyTheme = (t: ThemeChoice) => {
    theme = t;
    document.documentElement.dataset.theme = t === 'auto' ? (media?.matches ? 'dark' : 'light') : t;
    root.querySelectorAll<HTMLButtonElement>('[data-theme-choice]').forEach((b) =>
      b.setAttribute('aria-pressed', String(b.dataset.themeChoice === t)),
    );
  };
  applyTheme(theme);
  media?.addEventListener?.('change', () => {
    if (theme !== 'auto') return;
    applyTheme('auto');
    redrawCharts();
  });
  root.querySelectorAll<HTMLButtonElement>('[data-theme-choice]').forEach((b) =>
    b.addEventListener('click', () => controller.setTheme(b.dataset.themeChoice as ThemeChoice)),
  );

  // ---------- Design ----------
  // Only the modern design (F14); the HTML pages set the attribute before the first paint as well.
  document.documentElement.dataset.design = 'modern';
  try {
    storage?.removeItem(LEGACY_DESIGN_KEY);
  } catch {
    /* Speicher nicht verfügbar */
  }

  // ---------- Calculation ----------
  let timer: ReturnType<typeof setTimeout> | undefined;
  function schedule(): void {
    const ms = env.debounceMs ?? 120;
    if (ms <= 0) return recalc();
    clearTimeout(timer);
    timer = setTimeout(recalc, ms);
  }

  function persist(): void {
    try {
      // defaultsAsOf: version of the defaults (F22.4); kept old while the notice on new defaults is unanswered
      if (!sharedView) storage?.setItem(STORAGE_KEY, JSON.stringify({ ...inputs, defaultsAsOf: newDefaults?.asOf ?? DEFAULTS_AS_OF }));
    } catch {
      /* Speicher nicht verfügbar */
    }
    if (/^#[sz]=/.test(location.hash)) history.replaceState(null, '', encodeHash(defaults, inputs));
    updateDerivationLink();
  }

  /** The footer link to the derivation page (F32) carries the current inputs (in the hash, never sent to the server). */
  function updateDerivationLink(): void {
    const a = root.querySelector<HTMLAnchorElement>('#link-derivation');
    if (a) a.href = derivationLink(DERIVATION_PAGE, defaults, inputs);
  }

  function recalc(): void {
    updateDerivationLink();
    let run: RunResult;
    let cmp: InstallComparison;
    let events: KeyEvents;
    let sens: Sensitivity;
    try {
      run = runAll(inputs);
      // Reuse the base run: avoids the duplicate reference/simulation in comparison and sensitivity (F7, F27)
      cmp = compareInstallTimes(inputs, run);
      events = keyEvents(inputs, run, env.today ?? new Date());
      sens = sensitivity(inputs, run);
    } catch (err) {
      $<HTMLElement>('#warnings').innerHTML = `<div class="alert error">${escapeHtml((err as Error).message)}</div>`;
      return;
    }
    last = { run, cmp, events, sens };
    renderKpis(run);
    renderWarnings(run);
    renderEvents(events);
    renderHouse();
    renderJazEstimate();
    renderPvEstimate();
    renderDetails(run);
    renderTariff();
    $<HTMLElement>('#burden').innerHTML = burdenHtml(run);
    renderInstallTable(cmp);
    renderYearTable(run, events);
    const prices = priceRows(inputs);
    const energy = energyYear(inputs);
    drawCharts();
    renderChartTables(run, prices, cmp, sens, energy);
  }

  function renderChartTables(run: RunResult, prices: ReturnType<typeof priceRows>, cmp: InstallComparison, sens: Sensitivity, energy: EnergyYear): void {
    const tables = chartTables(run, prices, cmp, sens, energy);
    renderEnergyNote(energy);
    // Summary of the sensitivity analysis (F27) above the chart
    const note = root.querySelector<HTMLElement>('[data-chart-note="sensitivity"]');
    const top = sens.items[0];
    if (note && top) {
      const lo = Math.min(top.low, top.high);
      const hi = Math.max(top.low, top.high);
      note.innerHTML =
        `Jede Annahme wird einzeln etwas niedriger und höher gerechnet, alle anderen bleiben gleich. ` +
        `Am stärksten wirkt <strong>${escapeHtml(top.label)}</strong>: Die Ersparnis liegt dann zwischen ${fmtEur(lo)} und ${fmtEur(hi)} (heute ${fmtEur(sens.base)}).` +
        (lo < 0 ? ' Schon diese eine Annahme kann die Wärmepumpe unwirtschaftlich machen.' : '');
    }
    for (const [id, t] of Object.entries(tables)) {
      const el = root.querySelector<HTMLElement>(`[data-chart-table="${id}"]`);
      if (!el) continue;
      el.innerHTML = `<table class="compact"><caption>${escapeHtml(t.caption)}</caption>
        <thead><tr>${t.head.map((h, i) => `<th scope="col"${i ? ' class="num"' : ''}>${escapeHtml(h)}</th>`).join('')}</tr></thead>
        <tbody>${t.rows.map((r) => `<tr>${r.map((c, i) => (i ? `<td class="num">${escapeHtml(c)}</td>` : `<th scope="row">${escapeHtml(c)}</th>`)).join('')}</tr>`).join('')}</tbody></table>`;
    }
  }

  /** Annual summary of the energy chart (F29): how much gas/oil and electricity per kWh of useful energy. */
  function renderEnergyNote(e: EnergyYear): void {
    const note = root.querySelector<HTMLElement>('[data-chart-note="energy"]');
    if (!note) return;
    const n0 = (x: number) => fmtNum(x, 0);
    const d2 = (x: number) => fmtNum(x, 2);
    const t = e.totals;
    const fuel = e.fuel === 'gas' ? 'Gas' : 'Heizöl';
    note.innerHTML =
      `Typisches Jahr: Bedarf <strong>${n0(t.need)} kWh</strong> für ${e.months.some((m) => m.need.cooking > 0) ? 'Heizen, Warmwasser und Kochen' : 'Heizen und Warmwasser'}. ` +
      `Die Altanlage braucht dafür <strong>${n0(t.old)} kWh ${fuel}</strong> (${d2(t.old / t.need)} kWh je kWh Bedarf), ` +
      `mit Wärmepumpe sind es <strong>${n0(t.hp)} kWh Strom</strong>${t.hpCookingGas > 0 ? ` und ${n0(t.hpCookingGas)} kWh Gas zum Kochen` : ''} ` +
      `(${d2((t.hp + t.hpCookingGas) / t.need)} kWh je kWh Bedarf). ` +
      `Die Jahresarbeitszahl ist ein Jahresmittel – tatsächlich arbeitet die Wärmepumpe an kalten Tagen etwas weniger effizient.`;
  }

  function renderKpis(run: RunResult): void {
    const best = run.best === 'tax' ? run.tax : run.kfw;
    const saving = run.ref.totalCost - best.totalCost;
    const be = run.best === 'tax' ? run.breakEvenTax : run.breakEvenKfw;
    const install = best.installMonth;
    const beText =
      be === null
        ? 'nicht im Zeitraum'
        : install !== null && be > install
          ? `${fmtMonth(be)} <small>(${fmtDuration(be - install)} nach Inbetriebnahme)</small>`
          : fmtMonth(be);
    // CO2 balance (F25): heating and cooking, heat pump with the electricity mix (Strommix)
    const co2Saved = run.ref.co2Tons - best.co2Tons;
    $<HTMLElement>('#kpis').innerHTML = `
      ${kpi('Ohne Wärmepumpe', fmtEur(run.ref.totalCost), 'ref', 'Gesamtkosten im Zeitraum')}
      ${kpi('WP + KfW-Zuschuss', fmtEur(run.kfw.totalCost), 'kfw', `Zuschuss ${fmtEur(run.kfw.kfw?.subsidy ?? 0)}`, run.best === 'kfw')}
      ${kpi('WP + Steuerbonus', run.tax.feasible ? fmtEur(run.tax.totalCost) : 'nicht möglich', 'tax', run.tax.feasible ? `Steuerbonus ${fmtEur(run.tax.tax?.total ?? 0)}` : (run.tax.tax?.notes[0] ?? ''), run.best === 'tax')}
      ${kpi(saving >= 0 ? 'Ersparnis mit WP' : 'Mehrkosten mit WP', fmtEur(Math.abs(saving)), saving >= 0 ? 'good' : 'bad', `bester Weg: ${run.best === 'tax' ? 'Steuerbonus' : 'KfW'}`)}
      ${kpi('Amortisation', beText, 'neutral', 'kumulierte Kosten dauerhaft unter Referenz')}
      ${kpi(co2Saved >= 0 ? 'CO₂-Einsparung' : 'CO₂-Mehrausstoß', `${fmtTons(Math.abs(co2Saved))} t`, co2Saved >= 0 ? 'good' : 'bad', `im Zeitraum: ohne WP ${fmtTons(run.ref.co2Tons)} t, mit WP ${fmtTons(best.co2Tons)} t`)}
    `;
    $<HTMLElement>('#horizon-note').textContent =
      `Betrachtung ${fmtMonth(run.ref.months[0].month)} – ${fmtMonth(run.ref.months[run.ref.months.length - 1].month)}, ` +
      `Inbetriebnahme WP ${fmtMonth(run.kfw.installMonth)}` +
      (inputs.general.opportunityRate ? `, aufgezinst mit ${fmtPct(inputs.general.opportunityRate, 2)} p. a.` : '');
  }

  function renderWarnings(run: RunResult): void {
    // Funding/tax notices, replacement boilers (Ersatzkessel) and remaining debts (Restschuld) are shown in more detail under "Wichtige Ereignisse"
    const covered = new Set([...(run.kfw.kfw?.notes ?? []), ...(run.tax.tax?.notes ?? [])]);
    const ws = [...new Set([...run.kfw.warnings, ...run.tax.warnings, ...run.ref.warnings])].filter(
      (w) => !covered.has(w) && !/Ersatzkessel|Restschuld/.test(w),
    );
    $<HTMLElement>('#warnings').innerHTML = ws.length
      ? `<ul class="alert">${ws.map((w) => `<li>${escapeHtml(w)}</li>`).join('')}</ul>`
      : '';
  }

  function renderEvents(ev: KeyEvents): void {
    const hints = ev.hints
      .map(
        (h) => `<div class="hint level-${h.level}">
          <div class="hint-title">${escapeHtml(h.title)}</div>
          ${h.detail ? `<div class="hint-detail">${escapeHtml(h.detail)}</div>` : ''}
        </div>`,
      )
      .join('');
    const items = ev.timeline
      .map(
        (e) => `<li class="ev level-${e.level}">
          <span class="ev-date">${fmtMonth(e.month)}</span>
          <span class="ev-body">
            <span class="ev-head">${scenarioChip(e)}<span class="ev-title">${escapeHtml(e.title)}</span></span>
            ${e.detail ? `<span class="ev-detail">${escapeHtml(e.detail)}</span>` : ''}
          </span>
          <span class="ev-amount ${e.amount !== undefined && e.amount < 0 ? 'pos' : ''}">${
            e.amount !== undefined ? (e.amount < 0 ? '+' : '−') + fmtEur(Math.abs(e.amount)) + (e.perYear ? '<small>/Jahr</small>' : '') : ''
          }</span>
        </li>`,
      )
      .join('');
    $<HTMLElement>('#events').innerHTML = `
      <h2>Wichtige Ereignisse &amp; Hinweise</h2>
      ${hints ? `<div class="hints">${hints}</div>` : ''}
      ${items ? `<ol class="timeline">${items}</ol>` : ''}`;
  }

  /** SPF (JAZ) estimate below the SPF field with explanation and "apply" button (F26). */
  function renderJazEstimate(): void {
    const box = root.querySelector<HTMLElement>('#jaz-estimate');
    if (!box) return;
    const e = estimateJaz(inputs);
    const d1 = (x: number) => fmtNum(x, 1);
    const jaz = inputs.heatPump.jaz;
    const fit =
      jaz > e.high + 1e-9
        ? `<p class="jaz-fit is-high">Achtung: Ihr Wert ${d1(jaz)} liegt über der Schätzung – nur übernehmen, wenn der Fachbetrieb ihn bestätigt.</p>`
        : jaz < e.low - 1e-9
          ? `<p class="jaz-fit">Ihr Wert ${d1(jaz)} liegt unter der Schätzung (vorsichtig gerechnet).</p>`
          : '';
    const changedBy = jazCheck ? fieldByPath.get(jazCheck.path)?.label : undefined;
    const changed = changedBy
      ? `<p class="jaz-fit is-high">Die Schätzung hat sich durch Ihre Änderung bei „${escapeHtml(changedBy)}“ geändert – bitte prüfen, ob Ihr Wert noch passt.</p>`
      : '';
    box.innerHTML = `
      <div class="jaz-head"><span>Schätzung für Ihr Haus: <strong>JAZ ${d1(e.low)}–${d1(e.high)}</strong> (Mitte ${d1(e.mid)}, Vorlauf ca. ${e.supplyTemp} °C)</span>
        <button type="button" data-jaz-apply${Math.abs(jaz - e.mid) < 1e-9 ? ' aria-pressed="true"' : ''}>${Math.abs(jaz - e.mid) < 1e-9 ? 'Übernommen' : `${d1(e.mid)} übernehmen`}</button></div>
      ${changed}${fit}
      <details class="jaz-why"><summary>Wie wird geschätzt?</summary>
        <ol>${e.steps.map((s) => `<li>${escapeHtml(s)}</li>`).join('')}</ol>
        <p>Grobe Orientierung. Die tatsächliche JAZ hängt von Auslegung, Einstellung (Heizkurve), Warmwasseranteil und Witterung ab. Selbsttest: An einem kalten Tag den Kessel auf 55 °C Vorlauf stellen – wird es in allen Räumen warm, reichen die Heizkörper für eine Wärmepumpe.</p>
      </details>`;
  }

  /** PV coverage of the heat pump over the year (F28), below the PV inputs. */
  function renderPvEstimate(): void {
    const box = root.querySelector<HTMLElement>('#pv-estimate');
    if (!box) return;
    box.hidden = !(inputs.heatPump.pvKwp > 0);
    if (box.hidden) return;
    const p = pvSummary(inputs);
    const n0 = (x: number) => fmtNum(x, 0);
    const pc = (x: number) => `${n0(x * 100)} %`;
    const MONTHS = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];
    box.innerHTML = `
      <div class="jaz-head"><span>PV deckt rechnerisch <strong>${pc(p.share)}</strong> des Wärmepumpenstroms
        (${n0(p.annualHpFromPv)} von ${n0(p.annualHp)} kWh im Jahr).</span></div>
      <p class="jaz-fit">Winter (Dez–Feb): <strong>${pc(p.winterShare)}</strong> · Sommer (Jun–Aug): ${pc(p.summerShare)}. Den Rest bezieht die Wärmepumpe aus dem Netz.</p>
      <details class="jaz-why"><summary>Monatswerte</summary>
        <div class="table-wrap"><table class="compact"><caption class="visually-hidden">PV-Ertrag und Wärmepumpenstrom je Monat (typisches Jahr)</caption>
          <thead><tr><th scope="col">Monat</th><th scope="col" class="num">PV-Ertrag</th><th scope="col" class="num">WP-Strom</th><th scope="col" class="num">davon PV</th></tr></thead>
          <tbody>${p.months.map((m) => `<tr><th scope="row">${MONTHS[m.month - 1]}</th><td class="num">${n0(m.pvKWh)}</td><td class="num">${n0(m.hpKWh)}</td><td class="num">${n0(m.hpFromPv)}</td></tr>`).join('')}</tbody>
        </table></div>
        <p>kWh im typischen Jahr. Der Haushaltsstrom nutzt den PV-Strom zuerst; von der Überschneidung aus Erzeugung und Verbrauch wird nur ein Teil gleichzeitig genutzt, ein Speicher verschiebt Überschuss in Abend und Nacht. Den genutzten PV-Strom rechnet der Rechner mit der entgangenen Einspeisevergütung.</p>
      </details>`;
  }

  /** Rating of the house (F18). */
  function renderHouse(): void {
    const h = rateHouse(inputs);
    const s = energySplit(inputs);
    const n0 = (x: number) => fmtNum(x, 0);
    const cmpText = {
      better: 'besser als für Baualter und Sanierungsstand zu erwarten',
      typical: 'im zu erwartenden Bereich',
      worse: 'höher als für Baualter und Sanierungsstand zu erwarten – Einsparpotenzial durch Dämmung oder Heizungsoptimierung',
    }[h.comparison];
    const fuelUnit = inputs.oldHeating.fuel === 'gas' ? 'Gas' : 'Heizöl';
    const parts = [
      `Raumwärme ${n0(s.spaceHeat / inputs.oldHeating.efficiency)} kWh`,
      s.dhwHeat > 0 ? `Warmwasser ${n0(s.dhwHeat / inputs.oldHeating.efficiency)} kWh` : '',
      s.cookingFuel > 0 ? `Kochen ${n0(s.cookingFuel)} kWh` : '',
    ].filter(Boolean);
    $<HTMLElement>('#house').innerHTML = `
      <h2>Einordnung des Hauses</h2>
      <div class="house-head">
        <div class="house-kpi"><span class="house-val">${n0(h.kwhPerM2)}</span> <span class="house-unit">kWh/(m²·a)</span>
          <div class="muted small">Endenergie ${h.includesDhw ? 'Heizung + Warmwasser' : 'nur Heizung'}, ohne Kochen</div></div>
        <ol class="eff-scale" aria-label="Effizienzklasse ${h.efficiencyClass} (Skala A+ bis H nach GEG)">
          ${EFFICIENCY_CLASSES.map((c, i) => `<li class="eff-${i}${c.cls === h.efficiencyClass ? ' is-current' : ''}"${c.cls === h.efficiencyClass ? ' aria-current="true"' : ''}>${c.cls}</li>`).join('')}
        </ol>
      </div>
      <dl class="house-dl">
        <dt>Effizienzklasse</dt><dd><strong>${h.efficiencyClass}</strong> <small>Skala des Energieausweises (GEG)</small></dd>
        <dt>Baujahr</dt><dd>${inputs.building.constructionYear} <small>${h.buildingAge} Jahre · ${escapeHtml(h.ageClass.label)}</small></dd>
        <dt>Sanierung</dt><dd>${escapeHtml(h.renovation.state)} <small>${escapeHtml(h.renovation.text)}</small></dd>
        <dt>Zu erwarten</dt><dd>${h.expected[0]}–${h.expected[1]} kWh/(m²·a) <small>unsaniert typisch ${h.ageClass.range[0]}–${h.ageClass.range[1]}</small></dd>
        <dt>Ihr Haus</dt><dd><span class="cmp-${h.comparison}">${escapeHtml(cmpText)}</span></dd>
        <dt>Verbrauch</dt><dd>${n0(s.fuelTotal)} kWh ${fuelUnit} auf ${n0(h.area)} m² <small>${parts.join(' · ')}</small></dd>
        <dt>Heizlast (grob)</dt><dd>ca. ${fmtNum(h.heatLoadKW, 1)} kW <small>Wärmebedarf ÷ 2.000 Volllaststunden – ersetzt keine Heizlastberechnung nach DIN EN 12831</small></dd>
      </dl>
      <div class="hint level-${h.wpSuitability.level === 'check' ? 'warning' : h.wpSuitability.level === 'ok' ? 'info' : 'important'}">
        <div class="hint-title">Eignung für die Wärmepumpe (Raumwärme ${n0(h.spaceHeatPerM2)} kWh/m²)</div>
        <div class="hint-detail">${escapeHtml(h.wpSuitability.text)}</div>
      </div>
      <p class="muted small">${h.notes.map(escapeHtml).join(' ')} Typische Werte nach Baualter sind grobe Schätzungen.</p>`;
  }

  function renderDetails(run: RunResult): void {
    const k = run.kfw.kfw;
    const t = run.tax.tax;
    const kfwHtml = k
      ? `<dl>
          <dt>Antrag (angenommen)</dt><dd>${fmtMonth(k.appMonth)}</dd>
          <dt>Grundförderung</dt><dd>${fmtPct(k.grundRate)}</dd>
          ${k.wsbRate > 0 ? `<dt>Wertschöpfungs-Bonus (EU)</dt><dd>${fmtPct(k.wsbRate)}</dd>` : ''}
          <dt>Klimageschwindigkeitsbonus</dt><dd>${fmtPct(k.kgbRate)}</dd>
          <dt>Einkommensbonus</dt><dd>${fmtPct(k.incomeRate)}</dd>
          <dt>Fördersatz (selbstgenutzte WE)</dt><dd>${fmtPct(k.ownerUnitRate)} <small>max. ${fmtPct(k.maxRate)}</small></dd>
          <dt>Förderfähige Kosten</dt><dd>${fmtEur(k.eligibleCosts)} <small>Höchstbetrag ${fmtEur(k.capTotal)}</small></dd>
          <dt>Zuschuss</dt><dd><strong>${fmtEur(k.subsidy)}</strong></dd>
        </dl>`
      : '<p class="muted">Keine Installation im Zeitraum.</p>';
    const taxHtml = t
      ? t.eligible
        ? `<dl>${t.yearly.map((y) => `<dt>Steuerjahr ${y.year}</dt><dd>${fmtEur(y.amount)}</dd>`).join('')}
            <dt>Summe</dt><dd><strong>${fmtEur(t.total)}</strong></dd></dl>
            <p class="muted small">Erstattung jeweils im Folgejahr. Nicht mit KfW-Zuschuss kombinierbar.</p>`
        : `<p class="muted">${t.notes.map(escapeHtml).join('<br>')}</p>`
      : '<p class="muted">Keine Installation im Zeitraum.</p>';
    const loans = [
      ...run.kfw.loans.map((l) => ({ ...l, path: 'KfW-Weg' })),
      ...run.tax.loans.map((l) => ({ ...l, path: 'Steuer-Weg' })),
    ];
    const loanHtml = loans.length
      ? `<div class="table-wrap"><table class="compact"><thead><tr><th>Weg</th><th>Kredit</th><th class="num">Betrag</th><th class="num">Zins</th><th class="num">Zinskosten*</th></tr></thead><tbody>
          ${loans.map((l) => `<tr><td>${l.path}</td><td>${escapeHtml(l.name.replace('KfW-Kredit ', 'KfW '))}</td><td class="num">${fmtEur(l.principal)}</td><td class="num">${fmtPct(l.rate, 2)}</td><td class="num">${fmtEur(l.totalInterest)}</td></tr>`).join('')}
          </tbody></table></div>${windfallHtml(run)}<p class="muted small">* im Betrachtungszeitraum. Zinssätze sind Annahmen.</p>`
      : '<p class="muted">Keine Kredite – vollständig aus Eigenkapital finanziert.</p>';
    $<HTMLElement>('#details').innerHTML = `
      <div class="card"><h3>KfW-Zuschuss (458)</h3>${kfwHtml}</div>
      <div class="card"><h3>Steuerbonus (§ 35c EStG)</h3>${taxHtml}</div>
      <div class="card"><h3>Finanzierung</h3>${loanHtml}</div>`;
  }

  function renderTariff(): void {
    const el = $<HTMLElement>('#tariff');
    const t = tariffComparison(inputs);
    if (!t || !t.firstFullYear) {
      el.innerHTML = '<h2>Stromkosten: mit oder ohne Wärmepumpentarif</h2><p class="muted">Keine Inbetriebnahme im Betrachtungszeitraum.</p>';
      return;
    }
    const y = t.firstFullYear;
    const hp = inputs.heatPump;
    const priceGap = hp.householdPriceCt - hp.elecPriceCt;
    const cheaperLabel = t.cheaper === 'with' ? 'Wärmepumpentarif' : 'Haushaltsstrom';
    const selectedNote =
      t.selected === t.cheaper
        ? `Die gewählte Variante (${t.selected === 'with' ? 'Wärmepumpentarif' : 'Haushaltsstrom'}) ist die günstigere.`
        : `Gewählt ist „${t.selected === 'with' ? 'Wärmepumpentarif' : 'Haushaltsstrom'}“ – „${cheaperLabel}“ wäre ${fmtEur(Math.abs(t.saving))} günstiger.`;
    el.innerHTML = `
      <h2>Stromkosten: mit oder ohne Wärmepumpentarif</h2>
      <div class="tariff-grid">
        <div class="tariff-col${t.cheaper === 'with' ? ' is-cheaper' : ''}">
          <div class="tariff-head">Mit Wärmepumpentarif${t.cheaper === 'with' ? ' <span class="badge">günstiger</span>' : ''}</div>
          <div class="tariff-val">${fmtEur(y.withTariff)}<small>/Jahr (${y.year})</small></div>
          <div class="tariff-sub">${fmtNum(hp.elecPriceCt, 1)} ct/kWh + ${fmtEur(hp.meterFee)} Zähler${hp.smartMeterFee ? ` + ${fmtEur(hp.smartMeterFee)} Messsystem` : ''} − ${fmtEur(hp.para14aReduction)} § 14a</div>
          ${t.setupCost > 0 ? `<div class="tariff-sub">einmalig ${fmtEur(t.setupCost)} Zählerschrank-Umbau${t.setupSubsidy > 0 ? ` − ${fmtEur(t.setupSubsidy)} Zuschuss` : ''}</div>` : ''}
          <div class="tariff-total">${fmtEur(t.totalWith)} im Zeitraum${t.setupCost > 0 ? ' inkl. Umbau' : ''}</div>
        </div>
        <div class="tariff-col${t.cheaper === 'without' ? ' is-cheaper' : ''}">
          <div class="tariff-head">Ohne (Haushaltsstrom)${t.cheaper === 'without' ? ' <span class="badge">günstiger</span>' : ''}</div>
          <div class="tariff-val">${fmtEur(y.withoutTariff)}<small>/Jahr (${y.year})</small></div>
          <div class="tariff-sub">${fmtNum(hp.householdPriceCt, 1)} ct/kWh, kein Zusatzzähler${hp.smartMeterFee ? `, + ${fmtEur(hp.smartMeterFee)} Messsystem` : ''}${hp.existing14aOnHousehold ? ', § 14a schon für andere Einrichtung genutzt' : ` − ${fmtEur(hp.para14aReduction)} § 14a`}</div>
          <div class="tariff-total">${fmtEur(t.totalWithout)} im Zeitraum</div>
        </div>
      </div>
      <p class="tariff-note"><strong>${t.saving >= 0 ? 'Ersparnis' : 'Mehrkosten'} mit Wärmepumpentarif: ${fmtEur(Math.abs(t.saving))}</strong> über ${t.years.length} Jahre
        (${fmtEur(Math.abs(y.withoutTariff - y.withTariff))} im Jahr ${y.year}). ${escapeHtml(selectedNote)}</p>
      <p class="muted small">WP-Strom aus dem Netz ${y.year}: ca. ${fmtNum(y.gridKWh)} kWh. ${
        t.breakEvenKWh === null
          ? 'Der WP-Tarif ist nicht günstiger als Haushaltsstrom – ein eigener Zähler lohnt sich nicht.'
          : t.breakEvenKWh === 0
            ? priceGap > 0
              ? 'Der eigene Zähler lohnt sich bei jedem Verbrauch: Die zusätzliche § 14a-Pauschale deckt den Zählergrundpreis.'
              : 'Der WP-Tarif ist nicht teurer als Haushaltsstrom – der eigene Zähler verursacht über den Verbrauch gerechnet keine Mehrkosten.'
            : `Der eigene Zähler lohnt sich ab ca. ${fmtNum(t.breakEvenKWh)} kWh WP-Strom pro Jahr (${hp.existing14aOnHousehold ? '(Zählergrundpreis − zusätzliche § 14a-Pauschale)' : 'Zählergrundpreis'} ÷ Preisvorteil, heutige Preise).`
      }${
        t.setupCost > 0
          ? t.setupPaybackYears === null
            ? ' Der Zählerschrank-Umbau amortisiert sich nicht.'
            : ` Der Zählerschrank-Umbau (netto ${fmtEur(t.setupCost - t.setupSubsidy)}) hat sich nach ca. ${fmtNum(t.setupPaybackYears, 1)} Jahren durch die günstigeren Stromkosten bezahlt gemacht.`
          : ' Einmalige Kosten für einen zweiten Zähler sind nicht angesetzt (Feld „Zählerschrank-Umbau“).'
      } ${
        hp.existing14aOnHousehold
          ? 'Die § 14a-Pauschale gibt es nur einmal je Zähler: Am Haushaltszähler wird sie schon für eine andere steuerbare Verbrauchseinrichtung (z. B. Wallbox) gewährt – nur mit eigenem WP-Zähler kommt eine zweite hinzu.'
          : 'Die § 14a-Pauschale (Modul 1) ist in beiden Varianten angesetzt. Hängt am Haushaltszähler schon z. B. eine Wallbox mit § 14a, bitte das entsprechende Feld ankreuzen.'
      }</p>
      <details class="tariff-years"><summary>Jahreswerte</summary>
        <div class="table-wrap"><table class="compact">
          <thead><tr><th>Jahr</th><th class="num">Netzbezug WP</th><th class="num">mit WP-Tarif</th><th class="num">Haushaltsstrom</th><th class="num">Differenz</th></tr></thead>
          <tbody>${t.years
            .map(
              (r) => `<tr><td>${r.year}</td><td class="num">${fmtNum(r.gridKWh)} kWh</td><td class="num">${fmtEur(r.withTariff)}</td><td class="num">${fmtEur(r.withoutTariff)}</td><td class="num ${r.withoutTariff - r.withTariff >= 0 ? 'pos' : 'neg'}">${fmtEur(r.withoutTariff - r.withTariff)}</td></tr>`,
            )
            .join('')}</tbody>
        </table></div>
      </details>`;
  }

  function renderInstallTable(cmp: InstallComparison): void {
    // F7.1 (AK5): a fixed application month can leave no point in time in the window
    if (cmp.rows.length === 0) {
      const limit = cmp.latestInstall === null ? '' : ` Mit dem festen Antragsmonat ist eine Inbetriebnahme nur bis ${fmtMonth(cmp.latestInstall)} möglich.`;
      $<HTMLElement>('#install-table').innerHTML = `<p id="cmp-empty" class="muted">Keine Zeitpunkte im Vergleich.${limit}</p>`;
      return;
    }
    $<HTMLElement>('#install-table').innerHTML = `
      <table>
        <thead><tr><th>Inbetriebnahme</th><th class="num">Zuschuss</th><th class="num">WP + KfW</th><th class="num">WP + Steuer</th><th>Bester Weg</th><th class="num">Ersparnis ggü. ohne WP</th><th class="num">Kosten des Wartens</th></tr></thead>
        <tbody>${cmp.rows
          .map(
            (r, i) => `<tr class="${i === cmp.bestIndex ? 'best' : ''}">
              <td>${fmtMonth(r.installMonth)}${i === cmp.bestIndex ? ' <span class="badge">günstigster</span>' : ''}</td>
              <td class="num">${fmtEur(r.kfwSubsidy)}</td>
              <td class="num">${fmtEur(r.kfwTotal)}</td>
              <td class="num">${r.taxFeasible ? fmtEur(r.taxTotal) : '<span class="muted">–</span>'}</td>
              <td>${r.best === 'tax' ? 'Steuerbonus' : 'KfW'}</td>
              <td class="num ${r.savingVsRef >= 0 ? 'pos' : 'neg'}">${fmtEur(r.savingVsRef)}</td>
              <td class="num ${r.extraVsFirst > 0 ? 'neg' : ''}">${i === 0 ? '–' : (r.extraVsFirst > 0 ? '+' : '') + fmtEur(r.extraVsFirst)}</td>
            </tr>`,
          )
          .join('')}</tbody>
      </table>
      <p class="muted small">Referenz ohne Wärmepumpe: ${fmtEur(cmp.refTotal)}. ${inputs.heatPump.applicationMonth ? `Antragsmonat ${escapeHtml(inputs.heatPump.applicationMonth)} (festgelegt, im Zeitpunktvergleich höchstens zum Einbaumonat).` : `Förderantrag automatisch ${AUTO_APPLICATION_LEAD_MONTHS} Monate vor Inbetriebnahme.`}</p>
      ${bestWhyHtml(cmp)}`;
  }

  /** Explanation of the cheapest point in time (F7.3). */
  function bestWhyHtml(cmp: InstallComparison): string {
    const ex = explainBest(cmp, inputs);
    if (!ex) return '';
    const parts = (Object.keys(COST_PART_LABELS) as CostPart[]).filter((p) => ex.comparisons.some((c) => Math.abs(c.parts[p]) >= 0.5));
    const cell = (x: number) => `<td class="num ${x >= 0.5 ? 'pos' : x <= -0.5 ? 'neg' : ''}">${x >= 0.5 ? '+' : ''}${fmtEur(x)}</td>`;
    const head = (c: (typeof ex.comparisons)[number]) => `ggü. ${fmtMonth(c.other)} (${c.direction === 'earlier' ? 'früher' : 'später'})`;
    const summary = ex.comparisons
      .map((c) => {
        const verdict = `${c.direction === 'earlier' ? 'Gegenüber dem früheren' : 'Gegenüber dem späteren'} Zeitpunkt ${fmtMonth(c.other)} ist ${fmtMonth(ex.month)} um ${fmtEur(c.diff)} günstiger`;
        const main = c.mainReason ? ` – größter Vorteil: ${escapeHtml(COST_PART_LABELS[c.mainReason])} (${fmtEur(c.parts[c.mainReason])})` : '';
        return `<li><strong>${verdict}${main}.</strong><ul>${c.facts.map((f) => `<li>${escapeHtml(f)}</li>`).join('')}</ul></li>`;
      })
      .join('');
    return `<div class="best-why">
        <h3>Warum ist ${fmtMonth(ex.month)} am günstigsten?</h3>
        <ul class="best-why-list">${summary}</ul>
        <div class="table-wrap"><table class="compact">
          <caption class="visually-hidden">Vorteil des günstigsten Zeitpunkts nach Kostenart</caption>
          <thead><tr><th>Kostenart</th>${ex.comparisons.map((c) => `<th class="num">${head(c)}</th>`).join('')}</tr></thead>
          <tbody>${parts
            .map((p) => `<tr><td>${escapeHtml(COST_PART_LABELS[p])}</td>${ex.comparisons.map((c) => cell(c.parts[p])).join('')}</tr>`)
            .join('')}
            <tr class="sum"><td>Gesamt</td>${ex.comparisons.map((c) => cell(c.diff)).join('')}</tr></tbody>
        </table></div>
        <p class="muted small">Positive Beträge (grün) = so viel spart der günstigste Zeitpunkt in dieser Kostenart, negative (rot) = dort kostet er mehr. Beträge einschließlich Opportunitätszins bis zum Ende des Betrachtungszeitraums.</p>
      </div>`;
  }

  function renderYearTable(run: RunResult, ev: KeyEvents): void {
    const s: ScenarioResult = run[tableKind];
    const evByYear = new Map<number, KeyEvent[]>();
    for (const e of ev.timeline) {
      if (e.month === null || (e.scenario !== 'all' && e.scenario !== tableKind)) continue;
      if (tableKind === 'ref' && e.scenario === 'all') continue;
      const y = Math.floor(e.month / 12);
      evByYear.set(y, [...(evByYear.get(y) ?? []), e]);
    }
    const cols: [keyof ScenarioResult['years'][number], string][] = [
      ['energy', 'Energie'],
      ['fixed', 'Grund-/Fixkosten'],
      ['maintenance', 'Wartung'],
      ['investment', 'Investition'],
      ['loanPayout', 'Kredit­auszahlung'],
      ['interest', 'Zinsen'],
      ['principal', 'Tilgung'],
      ['fees', 'Vorfällig­keits­entschädigung'],
      ['subsidy', 'Zuschuss'],
      ['taxBonus', 'Steuer­bonus'],
      ['residual', 'Restwert'],
      ['total', 'Summe'],
      ['cumulative', 'Kumuliert'],
    ];
    const used = cols.filter(([k]) => k === 'total' || k === 'cumulative' || s.years.some((y) => Math.abs(y[k] as number) > 0.5));
    $<HTMLElement>('#year-table').innerHTML = `
      <table>
        <thead><tr><th>Jahr</th>${used.map(([, l]) => `<th class="num">${l}</th>`).join('')}<th>Ereignisse</th></tr></thead>
        <tbody>${s.years
          .map(
            (y) =>
              `<tr><td>${y.year}</td>${used
                .map(([k]) => `<td class="num${k === 'total' || k === 'cumulative' ? ' strong' : ''}">${fmtEur(y[k] as number)}</td>`)
                .join('')}<td class="ev-cell">${(evByYear.get(y.year) ?? [])
                .map((e) => `<span class="ev-tag level-${e.level}" title="${escapeHtml(e.detail ?? '')}">${MONTH_SHORT[e.month! % 12]}: ${escapeHtml(e.title)}</span>`)
                .join('')}</td></tr>`,
          )
          .join('')}</tbody>
      </table>`;
  }

  // ---------- Introduction (F20) ----------
  const intro = $<HTMLDialogElement>('#intro');
  const introOpener = $<HTMLButtonElement>('#btn-intro');
  const showIntro = () => {
    if (intro.open) return;
    showDialog(intro);
  };
  const markIntroSeen = () => {
    try {
      storage?.setItem(INTRO_KEY, '1');
    } catch {
      /* Speicher nicht verfügbar */
    }
  };
  // Remember at every way of closing; the 'close' event alone is not delivered reliably (e.g. background tabs)
  intro.querySelector('form')!.addEventListener('submit', markIntroSeen);
  intro.addEventListener('cancel', markIntroSeen); // Esc
  intro.addEventListener('close', markIntroSeen);
  // close when clicking on the backdrop (outside the dialog content)
  intro.addEventListener('click', (e) => {
    if (e.target !== intro) return;
    markIntroSeen();
    intro.close();
  });
  introOpener.addEventListener('click', showIntro);

  // ---------- Origin of the calculator (F19.3): jump from the header and the introduction ----------
  // Scroll instead of changing the URL hash – the hash may carry a shared link with inputs ("#z=…")
  const showAbout = () => {
    const box = $<HTMLElement>('#ueber');
    box.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
    $<HTMLElement>('#about-title').focus({ preventScroll: true });
    box.classList.add('is-highlighted');
    setTimeout(() => box.classList.remove('is-highlighted'), 2000);
  };
  document.addEventListener('click', (e) => {
    const link = (e.target as HTMLElement).closest?.('[data-about-link]');
    if (!link || !root.contains(link)) return;
    e.preventDefault();
    if (intro.open) {
      markIntroSeen();
      intro.close();
    }
    showAbout();
  });

  // ---------- Recommend (F21) ----------
  const recommend = $<HTMLDialogElement>('#recommend');
  const recStatus = $<HTMLElement>('#rec-status');
  const recFallback = $<HTMLTextAreaElement>('#rec-fallback');
  const setRecStatus = (text: string, isError = false) => {
    recStatus.textContent = text;
    recStatus.classList.toggle('is-error', isError);
  };
  const copyText = async (text: string, ok: string) => {
    recFallback.hidden = true;
    try {
      await navigator.clipboard.writeText(text);
      setRecStatus(ok);
    } catch {
      // clipboard blocked (permissions, insecure context): show the text selected for manual copying
      recFallback.value = text;
      recFallback.hidden = false;
      recFallback.focus();
      recFallback.select();
      setRecStatus('Automatisches Kopieren ist hier nicht möglich – der Text ist markiert, bitte mit Strg+C bzw. ⌘+C kopieren.', true);
    }
  };
  $<HTMLButtonElement>('#btn-recommend').addEventListener('click', () => {
    const links = recommendLinks(location.href);
    $<HTMLAnchorElement>('#rec-whatsapp').href = links.whatsapp;
    $<HTMLAnchorElement>('#rec-threema').href = links.threema;
    $<HTMLAnchorElement>('#rec-email').href = links.email;
    setRecStatus('');
    recFallback.hidden = true;
    showDialog(recommend);
  });
  $<HTMLButtonElement>('#rec-other').addEventListener('click', async () => {
    const links = recommendLinks(location.href);
    if (typeof navigator.share === 'function') {
      try {
        await navigator.share({ title: RECOMMEND_SUBJECT, text: RECOMMEND_TEXT, url: links.url });
        setRecStatus('');
      } catch (err) {
        // AbortError: the user closed the share menu
        if ((err as Error).name !== 'AbortError') await copyText(links.message, 'Text kopiert – jetzt in die gewünschte App einfügen, z. B. Signal.');
      }
      return;
    }
    await copyText(links.message, 'Text kopiert – jetzt in die gewünschte App einfügen, z. B. Signal.');
  });
  $<HTMLButtonElement>('#rec-copy').addEventListener('click', () =>
    copyText(recommendLinks(location.href).url, 'Link zum Rechner kopiert.'),
  );
  recommend.addEventListener('click', (e) => {
    if (e.target === recommend) recommend.close();
  });

  // ---------- Support (F19.4) ----------
  const support = $<HTMLDialogElement>('#support');
  $<HTMLButtonElement>('#btn-support').addEventListener('click', () => {
    showDialog(support);
  });
  support.addEventListener('click', (e) => {
    if (e.target === support) support.close();
  });
  $<HTMLButtonElement>('#support-copy-iban').addEventListener('click', async () => {
    const status = $<HTMLElement>('#support-status');
    try {
      await navigator.clipboard.writeText(compactIban(DONATION_ACCOUNT.iban));
      status.textContent = 'IBAN kopiert.';
      status.classList.remove('is-error');
    } catch {
      // clipboard blocked: select the IBAN for manual copying
      const range = document.createRange();
      range.selectNodeContents($<HTMLElement>('#support-iban'));
      getSelection()?.removeAllRanges();
      getSelection()?.addRange(range);
      status.textContent = 'Automatisches Kopieren ist hier nicht möglich – die IBAN ist markiert, bitte mit Strg+C bzw. ⌘+C kopieren.';
      status.classList.add('is-error');
    }
  });

  const controller: AppController = {
    getInputs: () => inputs,
    setInputs(i) {
      inputs = mergeInputs(defaults, i, [], checkDate);
      jazCheck = null;
      writeForm();
      recalc();
      persist();
    },
    recalc,
    lastResult: () => last,
    getTheme: () => theme,
    setTheme(t) {
      if (t === theme) return;
      applyTheme(t);
      try {
        storage?.setItem(THEME_KEY, t);
      } catch {
        /* Speicher nicht verfügbar */
      }
      redrawCharts();
    },
    showIntro,
    buildReport,
    getVariants: () => getVariants(),
  };

  // ---------- Saved scenarios in the browser (F37) ----------
  type ScenarioStore = { state: 'ok'; entries: unknown[] } | { state: 'unreadable' } | { state: 'unavailable' };
  /** Reads the list anew from the storage (F37.1); nothing is cached between two actions. */
  function readScenarios(): ScenarioStore {
    if (!storage) return { state: 'unavailable' };
    let raw: string | null;
    try {
      raw = storage.getItem(SCENARIOS_KEY);
    } catch {
      return { state: 'unavailable' };
    }
    const parsed = parseScenarioFile(raw);
    return parsed.readable ? { state: 'ok', entries: parsed.entries } : { state: 'unreadable' };
  }
  /** Writes the list; false if the storage is full or refuses (F37.10). Only called after a successful read, so the storage is present. */
  function writeScenarios(entries: unknown[]): boolean {
    try {
      storage!.setItem(SCENARIOS_KEY, serializeScenarioFile(entries));
      return true;
    } catch {
      return false;
    }
  }

  const scDlg = $<HTMLDialogElement>('#scenarios');
  const scList = $<HTMLElement>('#sc-list');
  const scStatus = $<HTMLElement>('#sc-status');
  const scNotice = $<HTMLElement>('#sc-notice');
  const scSave = $<HTMLButtonElement>('#sc-save');
  const scClear = $<HTMLButtonElement>('#sc-clear');
  const setScStatus = (text: string, isError = false) => {
    scStatus.textContent = text;
    scStatus.classList.toggle('is-error', isError);
  };
  /** Draws the dialog from a fresh read: list, unreadable or unavailable notice, save and clear buttons. */
  function renderScenarios(): void {
    const s = readScenarios();
    scSave.disabled = s.state === 'unreadable'; // F37.11
    scClear.hidden = s.state !== 'unreadable';
    scNotice.textContent = s.state === 'unavailable' ? SCENARIO_TEXT.unavailable : s.state === 'unreadable' ? SCENARIO_TEXT.unreadable : '';
    scNotice.hidden = scNotice.textContent === '';
    if (s.state !== 'ok') {
      scList.innerHTML = '';
      return;
    }
    const views = scenarioViews(s.entries);
    scList.innerHTML = views.length ? scenarioListHtml(views) : `<p class="muted">${SCENARIO_TEXT.empty}</p>`;
  }
  /** Writes the current inputs under the name (F37.2); the list is read anew right before writing. */
  function saveCurrent(name: string): void {
    const s = readScenarios();
    if (s.state === 'unreadable') {
      renderScenarios();
      setScStatus(SCENARIO_TEXT.unreadable, true);
      return;
    }
    // Unreadable storage: nothing is written, so no saved entry can be replaced (F37.10)
    if (s.state === 'unavailable') {
      renderScenarios();
      setScStatus(SCENARIO_TEXT.saveFailed, true);
      return;
    }
    const entry = scenarioEntry(inputs, name, newDefaults?.asOf ?? DEFAULTS_AS_OF, new Date());
    const ok = writeScenarios(putScenario(s.entries, name, entry));
    renderScenarios();
    setScStatus(ok ? `„${name}“ gespeichert.` : SCENARIO_TEXT.saveFailed, !ok);
  }
  /**
   * The entry at this position if it is still the one that was shown (F37.1: another tab may have changed the list).
   * Otherwise the dialog is redrawn and null returned.
   */
  function currentScenario(index: number, name: string, needReadable: boolean, failText: string): { entries: unknown[]; view: ScenarioView } | null {
    const s = readScenarios();
    if (s.state === 'unavailable') {
      renderScenarios();
      setScStatus(failText, true);
      return null;
    }
    if (s.state === 'ok' && index < s.entries.length) {
      const view = viewScenario(s.entries[index], index);
      // Abrufen and Aktualisieren need readable inputs (F37.12); Löschen also works for unreadable entries
      if (view.name === name && (view.readable || !needReadable)) return { entries: s.entries, view };
    }
    renderScenarios();
    setScStatus(SCENARIO_TEXT.changed, true);
    return null;
  }
  function updateScenario(index: number, name: string): void {
    const cur = currentScenario(index, name, true, SCENARIO_TEXT.saveFailed);
    if (!cur) return;
    const entry = scenarioEntry(inputs, name, newDefaults?.asOf ?? DEFAULTS_AS_OF, new Date());
    const ok = writeScenarios(setScenarioAt(cur.entries, index, entry));
    renderScenarios();
    setScStatus(ok ? `„${name}“ aktualisiert.` : SCENARIO_TEXT.saveFailed, !ok);
  }
  function deleteScenario(index: number, name: string): void {
    const cur = currentScenario(index, name, false, SCENARIO_TEXT.deleteFailed);
    if (!cur) return;
    const ok = writeScenarios(removeScenarioAt(cur.entries, index));
    renderScenarios();
    setScStatus(ok ? `„${name || UNNAMED}“ gelöscht.` : SCENARIO_TEXT.deleteFailed, !ok);
  }
  /** Loads a saved scenario like an import (F37.6): checked as F9.5, link view ends, new defaults as F22.4. */
  function recallScenario(index: number, name: string): void {
    const cur = currentScenario(index, name, true, SCENARIO_TEXT.unavailable);
    if (!cur) return;
    const issues: InputIssue[] = [];
    // readable entries always pass importJson (same check: an object with version 1), see viewScenario
    const imported = importJson(defaults, JSON.stringify(cur.view.inputs), issues, checkDate);
    imported.scenario.name = name;
    leaveShared();
    loadIssues = issues.length ? { origin: 'dem gespeicherten Szenario', issues } : null;
    const asOf = savedDefaultsAsOf(cur.view.inputs);
    const outdated = outdatedDefaults(imported, defaults, asOf);
    newDefaults = outdated.length ? { origin: 'scenario', asOf, list: outdated } : null;
    controller.setInputs(imported);
    renderNotice();
    scDlg.close();
    toast(`„${name}“ abgerufen.`);
  }
  function clearScenarios(): void {
    let ok = false;
    try {
      storage!.removeItem(SCENARIOS_KEY); // only offered when the list was read (F37.11)
      ok = true;
    } catch {
      ok = false;
    }
    renderScenarios();
    setScStatus(ok ? SCENARIO_TEXT.cleared : SCENARIO_TEXT.clearFailed, !ok);
  }

  $<HTMLButtonElement>('#btn-scenarios').addEventListener('click', () => {
    setScStatus('');
    renderScenarios();
    showDialog(scDlg);
  });
  scSave.addEventListener('click', () => {
    const name = cleanScenarioName(inputs.scenario.name);
    if (name === '') {
      setScStatus(SCENARIO_TEXT.noName, true);
      return;
    }
    const s = readScenarios();
    // F37.4: the same name is asked for before it is overwritten
    if (s.state === 'ok' && findScenario(s.entries, name) >= 0) confirmAction('overwrite', () => saveCurrent(name), name);
    else saveCurrent(name);
  });
  scClear.addEventListener('click', () => confirmAction('clear', clearScenarios));
  scList.addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('button');
    if (!btn) return;
    const name = btn.closest<HTMLElement>('li')!.dataset.scName!;
    const label = name || UNNAMED;
    if (btn.dataset.scRecall !== undefined) {
      const i = Number(btn.dataset.scRecall);
      confirmAction('recall', () => recallScenario(i, name), name);
    } else if (btn.dataset.scUpdate !== undefined) {
      const i = Number(btn.dataset.scUpdate);
      confirmAction('overwrite', () => updateScenario(i, name), name);
    } else if (btn.dataset.scDelete !== undefined) {
      const i = Number(btn.dataset.scDelete);
      confirmAction('delete', () => deleteScenario(i, name), label);
    }
  });

  // ---------- Compare variants (F31) ----------
  const varDialog = $<HTMLDialogElement>('#variants');
  const varList = $<HTMLElement>('#var-list');
  const varResult = $<HTMLElement>('#var-result');
  const varStatus = $<HTMLElement>('#var-status');
  const varFiles = $<HTMLInputElement>('#var-file-input');
  let variants: Variant[] = [];
  let varChart: { destroy(): void } | null = null;
  const setVarStatus = (text: string, isError = false) => {
    varStatus.textContent = text;
    varStatus.classList.toggle('is-error', isError);
  };
  const LIVE_NAME = 'Aktuelle Eingaben';
  const addVariant = (inp: Inputs, fallback: string, live = false): boolean => {
    if (variants.length >= MAX_VARIANTS) {
      setVarStatus(VARIANTS_LIMIT_TEXT, true);
      return false;
    }
    variants.push({ name: variantName(inp, fallback, variants.map((v) => v.name)), inputs: structuredClone(inp), ...(live ? { live } : {}) });
    return true;
  };
  /** The live variant always shows what is in the calculator right now (values and name). */
  function syncLiveVariant(): void {
    const v = variants.find((x) => x.live);
    if (!v) return;
    v.inputs = structuredClone(inputs);
    v.name = variantName(inputs, LIVE_NAME, variants.filter((x) => x !== v).map((x) => x.name));
  }
  function renderVariants(): void {
    syncLiveVariant();
    varList.innerHTML = variants
      .map(
        (v, i) => `<li><span class="variants-name">${escapeHtml(v.name)}${v.live ? ' <small class="muted">folgt dem Rechner</small>' : ''}</span>
          ${
            v.live
              ? `<button type="button" data-var-freeze="${i}" title="Diesen Stand als feste Variante behalten, um ihn mit späteren Eingaben zu vergleichen">Stand festhalten</button>`
              : `<button type="button" data-var-open="${i}" title="Diese Variante in den Rechner übernehmen">Im Rechner öffnen</button>`
          }
          <button type="button" data-var-remove="${i}" aria-label="${escapeHtml(v.name)} entfernen">Entfernen</button></li>`,
      )
      .join('');
    varChart?.destroy();
    varChart = null;
    if (variants.length === 0) {
      varResult.innerHTML = '';
      return;
    }
    const rs = variants.map(variantResult);
    varResult.innerHTML = `
      ${variants.length < 2 ? '<p class="muted">Fügen Sie mindestens eine weitere Variante hinzu, um zu vergleichen.</p>' : ''}
      <h3>Kennzahlen</h3>${variantsTableHtml(rs)}
      <h3>Kumulierte Kosten</h3>
      <div class="chart-wrap"><canvas role="img" aria-label="Diagramm: kumulierte Kosten je Variante, mit und ohne Wärmepumpe. Die Werte stehen in der Tabelle darunter."></canvas></div>
      <details class="chart-data"><summary>Werte als Tabelle</summary><div class="table-wrap">${variantCurvesTableHtml(rs)}</div></details>
      ${variants.length > 1 ? `<h3>Unterschiede in den Eingaben</h3>${variantDiffsHtml(rs)}` : ''}`;
    const canvas = varResult.querySelector('canvas')!;
    const curves = variantCurves(rs);
    withChartLib((lib) => {
      if (!canvas.isConnected) return;
      varChart?.destroy();
      varChart = lib.variantsChart(canvas, curves);
    });
  }
  // Adding from the saved scenarios (F31.4): the list is only drawn while it is open
  const varSavedBtn = $<HTMLButtonElement>('#var-saved-btn');
  const varSaved = $<HTMLElement>('#var-saved');
  const varSavedNote = $<HTMLElement>('#var-saved-note');
  const varSavedList = $<HTMLElement>('#var-saved-list');
  const setVarSavedOpen = (open: boolean) => {
    varSaved.hidden = !open;
    varSavedBtn.setAttribute('aria-expanded', String(open));
    if (open) renderVarSaved();
  };
  function renderVarSaved(): void {
    const s = readScenarios();
    let note = '';
    let views: ScenarioView[] = [];
    if (s.state === 'unavailable') note = SCENARIO_TEXT.unavailable;
    else if (s.state === 'unreadable') note = SCENARIO_TEXT.unreadableVariants;
    else {
      views = scenarioViews(s.entries);
      if (!views.some((v) => v.readable)) note = SCENARIO_TEXT.empty;
    }
    varSavedNote.textContent = note;
    varSavedNote.hidden = note === '';
    varSavedList.innerHTML = savedPickHtml(views);
  }
  varSavedBtn.addEventListener('click', () => setVarSavedOpen(varSavedBtn.getAttribute('aria-expanded') !== 'true'));
  varSavedList.addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('button[data-var-saved]');
    if (!btn) return;
    const index = Number(btn.dataset.varSaved);
    const s = readScenarios();
    // The position and the name shown must still match (another tab may have deleted an entry before it)
    const view = s.state === 'ok' && index < s.entries.length ? viewScenario(s.entries[index], index) : null;
    if (!view?.readable || !view.inputs || view.name !== btn.dataset.varSavedName) {
      renderVarSaved();
      setVarStatus(SCENARIO_TEXT.changed, true);
      return;
    }
    const issues: InputIssue[] = [];
    // readable entries always pass importJson (same check: an object with version 1), see viewScenario
    const imported = importJson(defaults, JSON.stringify(view.inputs), issues, checkDate);
    imported.scenario.name = view.name;
    // The limit of three variants is reported by addVariant (VARIANTS_LIMIT_TEXT)
    if (addVariant(imported, view.name)) {
      const added = variants[variants.length - 1].name;
      setVarStatus(`„${added}“ hinzugefügt.${issues.length ? ` (${issues.length} Wert(e) korrigiert)` : ''}`);
      renderVariants();
    }
  });

  $<HTMLButtonElement>('#btn-variants').addEventListener('click', () => {
    setVarStatus('');
    setVarSavedOpen(false);
    renderVariants();
    showDialog(varDialog);
  });
  varDialog.addEventListener('close', () => {
    varChart?.destroy();
    varChart = null;
  });
  $<HTMLButtonElement>('#var-current').addEventListener('click', () => {
    if (variants.some((v) => v.live)) {
      setVarStatus('Die aktuellen Eingaben sind schon im Vergleich und folgen dem Rechner. Mit „Stand festhalten“ bleibt der jetzige Stand als eigene Variante stehen.');
    } else if (addVariant(inputs, LIVE_NAME, true)) {
      setVarStatus('Aktuelle Eingaben hinzugefügt. Die Variante folgt dem Rechner, bis Sie den Stand festhalten.');
    }
    renderVariants();
  });
  $<HTMLButtonElement>('#var-files').addEventListener('click', () => varFiles.click());
  varFiles.addEventListener('change', async () => {
    const messages: string[] = [];
    for (const file of [...(varFiles.files ?? [])]) {
      try {
        const issues: InputIssue[] = [];
        const imported = importJson(defaults, await file.text(), issues, checkDate);
        if (!addVariant(imported, file.name.replace(/\.json$/i, ''))) break;
        messages.push(`„${file.name}“ geladen${issues.length ? ` (${issues.length} Wert(e) korrigiert)` : ''}.`);
      } catch (err) {
        messages.push(`„${file.name}“: ${(err as Error).message}`);
      }
    }
    varFiles.value = '';
    if (messages.length) setVarStatus(messages.join(' '), messages.some((m) => !m.endsWith('.') || m.includes(': ')));
    renderVariants();
  });
  varList.addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('button');
    if (!btn) return;
    if (btn.dataset.varRemove !== undefined) {
      variants.splice(Number(btn.dataset.varRemove), 1);
      setVarStatus('');
      renderVariants();
    } else if (btn.dataset.varFreeze !== undefined) {
      const v = variants[Number(btn.dataset.varFreeze)];
      if (!v?.live) return;
      // A snapshot must not be called "Aktuelle Eingaben": without a scenario name it gets the time
      const time = new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
      delete v.live;
      v.name = variantName(v.inputs, `Stand ${time} Uhr`, variants.filter((x) => x !== v).map((x) => x.name));
      setVarStatus(`„${v.name}“ festgehalten. Ändern Sie nun die Eingaben im Rechner und fügen Sie die aktuellen Eingaben erneut hinzu.`);
      renderVariants();
    } else if (btn.dataset.varOpen !== undefined) {
      const v = variants[Number(btn.dataset.varOpen)];
      if (!v) return;
      confirmAction(
        'variant',
        () => {
          leaveShared();
          loadIssues = null;
          controller.setInputs(structuredClone(v.inputs));
          renderNotice();
          varDialog.close();
          toast(`„${v.name}“ in den Rechner übernommen.`);
        },
        v.name,
      );
    }
  });
  /** For tests: currently compared variants. */
  const getVariants = () => variants.map((v) => v.name);

  // ---------- Printable report (F30) ----------
  /** Theme before printing; the report is always printed light. */
  let themeBeforePrint: string | null = null;
  let titleBeforePrint = '';
  function buildReport(): HTMLElement | null {
    if (!last) return null;
    let report = document.getElementById('report');
    if (!report) {
      report = document.createElement('div');
      report.id = 'report';
      report.className = 'report';
      document.body.appendChild(report);
    }
    if (themeBeforePrint === null) {
      themeBeforePrint = document.documentElement.dataset.theme ?? null;
      titleBeforePrint = document.title;
    }
    document.documentElement.dataset.theme = 'light';
    // The browser suggests the document title as PDF file name
    const reportDate = (env.today ?? new Date()).toLocaleDateString('sv-SE');
    const reportName = inputs.scenario.name.trim();
    document.title = `Wärmepumpen-Bericht${reportName ? ` – ${reportName}` : ''} – ${reportDate}`;
    report.innerHTML = reportHtml({
      inputs,
      defaults,
      run: last.run,
      cmp: last.cmp,
      events: last.events,
      today: env.today ?? new Date(),
      url: calculatorUrl(location.href),
      shareUrl: shareBaseUrl(location.href),
      detailsHtml: $<HTMLElement>('#details').innerHTML,
    });
    // Charts: render off screen in light colours at print width, then keep a static copy of each bitmap.
    // A copy on a canvas is available immediately – an <img> with a data URL may not be decoded yet when
    // the browser lays out the print (Ctrl+P / "beforeprint"), and the chart would be missing.
    report.classList.add('is-rendering');
    const canvases: Partial<Record<ChartId, HTMLCanvasElement>> = {};
    for (const fig of report.querySelectorAll<HTMLElement>('[data-report-chart]')) {
      const wrap = document.createElement('div');
      wrap.className = 'report-chart-wrap';
      const canvas = document.createElement('canvas');
      wrap.appendChild(canvas);
      fig.appendChild(wrap);
      canvases[fig.dataset.reportChart as ChartId] = canvas;
    }
    // Chart.js is normally loaded long before; without it the placeholder text stays (e.g. printing right at the start)
    const rc = chartLib ? new chartLib.Charts(canvases, 2) : null;
    rc?.update(last.run, priceRows(inputs), last.cmp, last.events, last.sens, energyYear(inputs));
    for (const fig of report.querySelectorAll<HTMLElement>('[data-report-chart]')) {
      const source = fig.querySelector('canvas');
      const copy = document.createElement('canvas');
      const ctx = copy.getContext?.('2d');
      if (!rc || !source || !ctx || !source.width) continue;
      copy.width = source.width;
      copy.height = source.height;
      ctx.drawImage(source, 0, 0);
      copy.className = 'report-chart';
      copy.setAttribute('role', 'img');
      copy.setAttribute('aria-label', `Diagramm ${fig.querySelector('figcaption')?.textContent ?? ''}`);
      fig.querySelector('.muted')?.remove();
      fig.querySelector('.report-chart-wrap')?.replaceWith(copy);
    }
    rc?.reset();
    report.classList.remove('is-rendering');
    return report;
  }
  const restoreTheme = () => {
    if (themeBeforePrint !== null) {
      document.documentElement.dataset.theme = themeBeforePrint;
      document.title = titleBeforePrint;
    }
    themeBeforePrint = null;
  };
  // Ctrl+P / browser menu prints the report as well
  window.addEventListener('beforeprint', () => {
    if (themeBeforePrint === null) buildReport();
  });
  window.addEventListener('afterprint', restoreTheme);
  $<HTMLButtonElement>('#btn-report').addEventListener('click', async () => {
    await loadChartLib().catch(() => undefined);
    if (!buildReport()) return;
    window.print();
  });

  writeForm();
  renderNotice();
  recalc();
  if (isFirstVisit(storage, initial.storedRaw)) showIntro();
  return controller;
}

/** First visit: introduction not yet closed and no inputs of an earlier visit stored. */
function isFirstVisit(storage: Storage | null, storedRaw: string | null): boolean {
  try {
    return storage?.getItem(INTRO_KEY) !== '1' && storedRaw === null;
  } catch {
    return false;
  }
}

interface InitialLoad {
  inputs: Inputs;
  source: 'hash' | 'storage' | 'default';
  issues: InputIssue[];
  /** Own stored inputs (raw), if any. */
  storedRaw: string | null;
}

function loadInitial(defaults: Inputs, storage: Storage | null, checkDate: Date): InitialLoad {
  let storedRaw: string | null = null;
  try {
    storedRaw = storage?.getItem(STORAGE_KEY) ?? null;
  } catch {
    /* ignorieren */
  }
  const issues: InputIssue[] = [];
  const fromHash = typeof location !== 'undefined' ? decodeHash(defaults, location.hash, issues, checkDate) : null;
  if (fromHash) return { inputs: fromHash, source: 'hash', issues, storedRaw };
  issues.length = 0;
  if (storedRaw) {
    try {
      return { inputs: mergeInputs(defaults, JSON.parse(storedRaw), issues, checkDate), source: 'storage', issues, storedRaw };
    } catch {
      /* ignorieren */
    }
  }
  return { inputs: mergeInputs(defaults, {}, [], checkDate), source: 'default', issues: [], storedRaw };
}

/** JSON.parse without throwing (raw saved data for the defaults check, F22.4). */
function parseJson(raw: string | null): unknown {
  try {
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function readTheme(storage: Storage | null): ThemeChoice {
  try {
    const v = storage?.getItem(THEME_KEY);
    if (v === 'light' || v === 'dark' || v === 'auto') return v;
  } catch {
    /* ignorieren */
  }
  return 'auto';
}

function safeStorage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

const round = (x: number, d: number) => Math.round(x * 10 ** d) / 10 ** d;

const MONTH_SHORT = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];

const SCENARIO_LABEL = { all: 'beide WP-Wege', ref: 'ohne WP', kfw: 'KfW-Weg', tax: 'Steuer-Weg' } as const;

function scenarioChip(e: KeyEvent): string {
  return `<span class="chip chip-${e.scenario}">${SCENARIO_LABEL[e.scenario]}</span>`;
}

/** Tonnes with one decimal place, German format. */
function fmtTons(t: number): string {
  return t.toLocaleString('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

function kpi(label: string, value: string, tone: string, sub: string, best = false): string {
  return `<div class="kpi tone-${tone}${best ? ' is-best' : ''}">
    <div class="kpi-label">${escapeHtml(label)}${best ? ' <span class="badge">bester Weg</span>' : ''}</div>
    <div class="kpi-value">${value}</div>
    <div class="kpi-sub">${escapeHtml(sub)}</div>
  </div>`;
}

/** Formats a default value for display (for the origin popover). */
export function formatDefault(f: Field, defaults: Inputs): string {
  return formatValue(f, getPath(defaults, f.path), defaults);
}

/** Formats a value of field f for display (units may depend on the inputs). */
function formatValue(f: Field, v: unknown, inputs: Inputs): string {
  const unit = typeof f.unit === 'function' ? f.unit(inputs) : (f.unit ?? '');
  if (f.type === 'checkbox') return v ? 'Ja' : 'Nein';
  if (f.type === 'select') return f.options?.find(([k]) => k === v)?.[1] ?? String(v);
  if (f.type === 'month') return v ? fmtMonth(Number(tryParseMonth(String(v)))) : '(leer)';
  if (f.type === 'text') return String(v);
  const n = f.type === 'percent' ? Number(v) * 100 : Number(v);
  return `${n.toLocaleString('de-DE', { maximumFractionDigits: 3 })}${unit ? ' ' + unit : ''}`;
}

function sourceHtml(f: Field, id: string): { button: string; pop: string } {
  const src = DEFAULT_SOURCES[f.path];
  if (!src) return { button: '', pop: '' };
  const popId = `${id}-src`;
  return {
    button: `<button type="button" class="info-btn" aria-label="Woher kommt der Standardwert?" aria-expanded="false" aria-controls="${popId}">i</button>`,
    // Content is filled in on first opening (sourcePopHtml) – keeps the page small (N14)
    pop: `<div class="src-pop" id="${popId}" role="note" data-src="${f.path}" hidden></div>`,
  };
}

const FIELD_BY_PATH = new Map(SECTIONS.flatMap((s) => s.fields).map((f) => [f.path, f]));

/** Content of the origin popover of a field (F11). */
export function sourcePopHtml(path: string, defaults: Inputs): string {
  const f = FIELD_BY_PATH.get(path);
  const src = DEFAULT_SOURCES[path];
  if (!f || !src) return '';
  let host = '';
  try {
    host = src.url ? new URL(src.url).hostname.replace(/^www\./, '') : '';
  } catch {
    host = '';
  }
  return `<div class="src-head"><span class="src-kind kind-${src.kind}">${SOURCE_KIND_LABEL[src.kind]}</span>
        <span class="src-default">Standard: <strong>${escapeHtml(formatDefault(f, defaults))}</strong></span></div>
      <p>${escapeHtml(src.text)}</p>
      ${refsHtml(OFFICIAL_REFS[f.path])}
      ${src.url || src.asOf ? `<p class="src-meta">${src.url ? `<a href="${safeHref(src.url)}" target="_blank" rel="noopener">${escapeHtml(host)}</a>` : ''}${src.url && src.asOf ? ' · ' : ''}${src.asOf ? `Stand ${escapeHtml(src.asOf)}` : ''}</p>` : ''}`;
}

function refsHtml(refs: { label: string; url: string }[] | undefined): string {
  if (!refs?.length) return '';
  return `<div class="src-refs"><span>Offizielle Quellen</span><ul>${refs
    .map((r) => `<li><a href="${safeHref(r.url)}" target="_blank" rel="noopener">${escapeHtml(r.label)}</a></li>`)
    .join('')}</ul></div>`;
}

/** Special repayment (Sondertilgung) from the one-off payment (Einmalzahlung) per path (F12.6): date, amount, charge, interest saved. */
function windfallHtml(run: RunResult): string {
  const rows = (
    [
      ['KfW-Weg', run.kfw.windfall],
      ['Steuer-Weg', run.tax.windfall],
    ] as const
  ).filter(([, w]) => w);
  if (!rows.length) return '';
  const w0 = rows[0][1]!;
  const when =
    w0.availableMonth === w0.month ? fmtMonth(w0.month) : `${fmtMonth(w0.month)} <small>(verfügbar ab ${fmtMonth(w0.availableMonth)})</small>`;
  return `<h4 class="sub-head">Sondertilgung ${when}</h4>
    ${rows
      .map(([path, w]) =>
        w!.note
          ? `<p class="muted small"><strong>${path}:</strong> ${escapeHtml(w!.note)}</p>`
          : `<dl class="wf-dl"><dt class="wf-path">${path}</dt><dd></dd>
              <dt>Getilgt</dt><dd>${fmtEur(w!.used)}</dd>
              ${w!.fees > 0 ? `<dt>Vorfälligkeitsentschädigung</dt><dd>${fmtEur(w!.fees)}</dd>` : ''}
              <dt>Zinsersparnis*</dt><dd><strong>${fmtEur(w!.interestSaved)}</strong></dd>
              ${w!.unused > 0.5 ? `<dt>Nicht eingesetzt</dt><dd>${fmtEur(w!.unused)}</dd>` : ''}</dl>`,
      )
      .join('')}`;
}

/** Suffix of every input error: the old value stays (F9.5). */
export const KEEP_TEXT = ' Der bisherige Wert wird weiter verwendet.';

/** Text for a month that is only partly entered or cannot be read (F1.5, F1.6); the old value stays. */
export const PARTIAL_MONTH_TEXT = `Bitte den Monat vollständig eingeben oder das Feld ganz leeren.${KEEP_TEXT}`;

/** Error text for a month outside its range; the range is given as absolute months (F1.7, F1.8, F9.5). */
export function monthErrorText(range: [number, number]): string {
  return `Bitte einen Monat zwischen ${monthRangeLabel(range)} angeben (Jahr und Monat).${KEEP_TEXT}`;
}

/** True if a month value (YYYY-MM) lies in the range; an empty value is left to the field rules. */
export function inMonthRange(value: string, range: [number, number]): boolean {
  if (value === '') return true;
  const m = tryParseMonth(value);
  return m !== null && m >= range[0] && m <= range[1];
}

/** Error text for invalid inputs (F9.5, WCAG 3.3.1). */
export function fieldErrorText(f: Field): string {
  const keep = KEEP_TEXT;
  if (f.type === 'number' || f.type === 'percent') {
    if (!(f.path in NUMBER_LIMITS)) return `Bitte eine gültige Zahl eingeben.${keep}`;
    const k = f.type === 'percent' ? 100 : 1;
    const [min, max] = numberRange(f.path).map((x) => (x * k).toLocaleString('de-DE', { maximumFractionDigits: 2 }));
    const unit = typeof f.unit === 'string' && f.unit ? ` ${f.unit}` : '';
    return `Bitte einen Wert von ${min} bis ${max}${unit} eingeben.${keep}`;
  }
  return `Ungültige Eingabe.${keep}`;
}

function fieldHtml(f: Field): string {
  const id = `f-${f.path.replace(/\./g, '-')}`;
  const unit = typeof f.unit === 'string' ? f.unit : '';
  const help = f.help ? `<small class="help" id="${id}-help">${escapeHtml(f.help)}</small>` : '';
  // calculated note (F17.3), filled by refreshVisibility()
  const note = f.note ? `<small class="field-note" id="${id}-note" aria-live="polite"></small>` : '';
  const src = f.noSource ? { button: '', pop: '' } : sourceHtml(f, id);
  const ph = f.placeholder ? ` placeholder="${escapeHtml(f.placeholder)}"` : '';
  if (f.type === 'checkbox') {
    return `<div class="field check" data-field="${f.path}">
      <div class="label-row"><label for="${id}"><input type="checkbox" id="${id}" data-path="${f.path}"> ${escapeHtml(f.label)}</label>${src.button}</div>${src.pop}${help}</div>`;
  }
  let control: string;
  if (f.type === 'select') {
    control = `<select id="${id}" data-path="${f.path}">${(f.options ?? []).map(([v, l]) => `<option value="${v}">${escapeHtml(l)}</option>`).join('')}</select>`;
  } else if (f.type === 'month') {
    control = `<input type="month" id="${id}" data-path="${f.path}" placeholder="JJJJ-MM">`;
  } else if (f.type === 'textarea') {
    control = `<textarea id="${id}" data-path="${f.path}" rows="4" maxlength="${TEXT_LIMITS[f.path] ?? 2000}"${ph}></textarea>`;
  } else if (f.type === 'text') {
    control = `<input type="text" id="${id}" data-path="${f.path}" maxlength="${TEXT_LIMITS[f.path] ?? 2000}"${f.noSource ? '' : ' spellcheck="false"'}${ph}>`;
  } else {
    const attrs = [
      f.step !== undefined ? `step="${f.step}"` : 'step="any"',
      f.min !== undefined ? `min="${f.min}"` : '',
      f.max !== undefined ? `max="${f.max}"` : '',
    ].join(' ');
    control = `<input type="number" inputmode="decimal" id="${id}" data-path="${f.path}" ${attrs}>`;
  }
  // Link help text and error message to the field (screen readers)
  const describedBy = [f.help ? `${id}-help` : '', f.note ? `${id}-note` : '', `${id}-err`].filter(Boolean).join(' ');
  control = control.replace(`data-path="${f.path}"`, `data-path="${f.path}" aria-describedby="${describedBy}"`);
  return `<div class="field" data-field="${f.path}">
    <div class="label-row"><label for="${id}">${escapeHtml(f.label)}</label>${src.button}</div>${src.pop}
    <div class="control">${control}<span class="unit">${escapeHtml(unit)}</span></div>
    <small class="field-error" id="${id}-err" aria-live="polite" hidden></small>${note}${help}</div>`;
}

function sectionsToggleHtml(): string {
  return `<div class="sections-toggle" role="group" aria-label="Alle Eingabebereiche">
    <button type="button" data-sections="open" aria-controls="inputs">Alle aufklappen</button>
    <button type="button" data-sections="close" aria-controls="inputs">Alle zuklappen</button>
  </div>`;
}

function sectionHtml(s: (typeof SECTIONS)[number]): string {
  // SPF (JAZ) estimate (F26) directly below the SPF field
  const after = (f: Field) =>
    f.path === 'heatPump.jaz'
      ? '<div id="jaz-estimate" class="jaz-estimate" aria-live="polite"></div>'
      : f.path === 'heatPump.feedInCt'
        ? '<div id="pv-estimate" class="jaz-estimate pv-estimate" aria-live="polite" hidden></div>'
        : '';
  return `<details class="section${s.expert ? ' expert' : ''}" ${s.open ? 'open' : ''}>
    <summary>${escapeHtml(s.title)}</summary>
    ${s.note ? `<p class="note">${escapeHtml(s.note)}</p>` : ''}
    <div class="fields">${s.fields.map((f) => fieldHtml(f) + after(f)).join('')}</div>
  </details>`;
}

function layout(): string {
  return `
  <header class="top">
    <div class="brand">
      ${logoSvg()}
      <h1>Wärmepumpen-Investitionsrechner</h1>
      <p>Umstieg von Gas oder Öl: Energiepreise, KfW-Förderung, Kredit und Steuerbonus im Vergleich
        <a id="app-version" class="version-link" href="./changelog.html" title="Änderungen dieser und früherer Versionen (Changelog)">Version ${APP_VERSION}</a>
        <a class="version-link" href="#ueber" data-about-link title="Wie und warum dieser Rechner entstanden ist">Über diesen Rechner</a></p>
    </div>
    <div class="design-switch theme-switch" role="group" aria-label="Hell oder dunkel">
      <button type="button" data-theme-choice="light" aria-pressed="false" title="Helles Design">Hell</button>
      <button type="button" data-theme-choice="dark" aria-pressed="false" title="Dunkles Design">Dunkel</button>
      <button type="button" data-theme-choice="auto" aria-pressed="false" title="Wie Browser bzw. System">Auto</button>
    </div>
    <div class="toolbar app-toolbar">
      <a id="btn-help" class="tool-link" href="./hilfe.html" title="Benutzerhandbuch öffnen">Hilfe</a>
      <div class="menu menu-scenarios">
        <button id="menu-scenarios-button" type="button" class="menu-button" data-menu-button aria-haspopup="menu" aria-expanded="false" aria-controls="menu-scenarios">Szenarien<span aria-hidden="true"> ▾</span></button>
        <div id="menu-scenarios" class="menu-panel" role="menu" aria-labelledby="menu-scenarios-button" hidden>
          <button id="btn-scenarios" type="button" role="menuitem" tabindex="-1" aria-haspopup="dialog" title="Eingaben unter einer Bezeichnung im Browser speichern, abrufen, aktualisieren oder löschen">Gespeicherte Szenarien</button>
          <button id="btn-import" type="button" role="menuitem" tabindex="-1">Import</button>
          <div class="menu-separator" role="separator"></div>
          <button id="btn-reset" type="button" role="menuitem" tabindex="-1" class="ghost">Zurücksetzen</button>
        </div>
      </div>
      <div class="menu menu-share">
        <button id="menu-share-button" type="button" class="menu-button" data-menu-button aria-haspopup="menu" aria-expanded="false" aria-controls="menu-share">Teilen &amp; Export<span aria-hidden="true"> ▾</span></button>
        <div id="menu-share" class="menu-panel" role="menu" aria-labelledby="menu-share-button" hidden>
          <button id="btn-share" type="button" role="menuitem" tabindex="-1" title="Link mit Ihren aktuellen Eingaben kopieren – zum Sichern oder Weitergeben Ihrer Berechnung">Link mit Werten teilen</button>
          <button id="btn-export" type="button" role="menuitem" tabindex="-1" aria-haspopup="dialog" title="Eingaben als Datei (JSON) speichern oder als Markdown-Datei für einen KI-Assistenten">Export</button>
          <button id="btn-recommend" type="button" role="menuitem" tabindex="-1" aria-haspopup="dialog" title="Den Rechner per WhatsApp, Threema, E-Mail, Link oder einer anderen App (z. B. Signal) weiterempfehlen">Weiterempfehlen</button>
        </div>
      </div>
      <button id="btn-variants" type="button" aria-haspopup="dialog" aria-label="Varianten vergleichen" title="Zwei oder drei Varianten (Export-Dateien, gespeicherte Szenarien oder aktuelle Eingaben) nebeneinander vergleichen">Vergleichen</button>
      <button id="btn-report" type="button" aria-label="Bericht drucken" title="Kompakte Zusammenfassung mit Eingaben, Ergebnissen, Diagrammen, Förderung und Finanzierung – drucken oder als PDF speichern">Bericht</button>
      <div class="menu menu-more">
        <button id="menu-more-button" type="button" class="menu-button" data-menu-button aria-haspopup="menu" aria-expanded="false" aria-controls="menu-more">Mehr<span aria-hidden="true"> ▾</span></button>
        <div id="menu-more" class="menu-panel" role="menu" aria-labelledby="menu-more-button" hidden>
          <button id="btn-intro" type="button" role="menuitem" tabindex="-1" aria-haspopup="dialog" title="Kurze Einführung: Wozu dient der Rechner, wie bedient man ihn?">Einführung</button>
          <button id="btn-support" type="button" role="menuitem" tabindex="-1" aria-haspopup="dialog" title="Das Hobbyprojekt freiwillig unterstützen – per Buy Me a Coffee oder PayPal">Unterstützen</button>
        </div>
      </div>
    </div>
    <input id="file-import" type="file" accept="application/json,.json" hidden>
  </header>
  <main class="layout">
    <aside id="inputs" class="inputs" aria-label="Eingaben"></aside>
    <section class="results" aria-label="Ergebnisse">
      <div id="notice" class="notice" role="status" hidden></div>
      <h2 id="scenario-name" class="scenario-name" hidden></h2>
      <div id="kpis" class="kpis"></div>
      <p id="horizon-note" class="muted small"></p>
      <div id="warnings"></div>
      <div id="events" class="card events"></div>
      <div id="house" class="card house"></div>
      <div id="burden" class="card burden"></div>
      <div class="card">
        <h2 class="visually-hidden">Diagramme</h2>
        <div class="tabs" role="tablist" aria-label="Diagramme">
          ${CHART_TABS.map(([id, l], i) => `<button type="button" role="tab" id="tab-${id}" data-tab="${id}" aria-controls="panel-${id}" aria-selected="${i === 0}" tabindex="${i === 0 ? 0 : -1}">${l}</button>`).join('')}
        </div>
        ${CHART_TABS.map(
          ([id, l], i) => `<div role="tabpanel" id="panel-${id}" aria-labelledby="tab-${id}" data-panel="${id}" ${i === 0 ? '' : 'hidden'}>
            ${id === 'sensitivity' || id === 'energy' ? `<p class="chart-note muted small" data-chart-note="${id}"></p>` : ''}
            <div class="chart-wrap"><canvas data-chart="${id}" role="img" aria-label="Diagramm ${l}. Die Werte stehen in der Tabelle darunter."></canvas></div>
            <details class="chart-data"><summary>Werte als Tabelle</summary><div class="table-wrap" data-chart-table="${id}"></div></details>
          </div>`,
        ).join('')}
      </div>
      <div id="details" class="details"></div>
      <div id="tariff" class="card tariff"></div>
      <div class="card">
        <h2>Wann umrüsten?</h2>
        <div id="install-table" class="table-wrap"></div>
      </div>
      <div class="card">
        <div class="card-head">
          <h2>Jahresübersicht</h2>
          <select id="table-kind" aria-label="Szenario">
            <option value="kfw">WP + KfW-Zuschuss</option>
            <option value="tax">WP + Steuerbonus</option>
            <option value="ref">Ohne Wärmepumpe</option>
          </select>
        </div>
        <div id="year-table" class="table-wrap"></div>
        <p class="muted small">Positive Werte = Ausgaben, negative = Einnahmen. „Kumuliert" enthält den Opportunitätszins.</p>
      </div>
      <aside class="card next-steps" aria-labelledby="next-steps-title">
        <h2 id="next-steps-title">Nächste Schritte</h2>
        <p>Die Seite zeigt die Schritte von der Berechnung bis zur Abnahme und ersetzt keine Beratung.</p>
        <p><a href="./angebot.html">Weg zum Angebot und zur Förderung</a></p>
      </aside>
      <aside id="ueber" class="card about" aria-labelledby="about-title">
        <h2 id="about-title" tabindex="-1">Über diesen Rechner</h2>
        <p>Am Anfang stand eine ganz persönliche Frage: Lohnt sich der Umstieg auf eine Wärmepumpe auch finanziell? Die Antworten, die ich fand, waren oft sehr allgemein – oder beruhten auf Annahmen, die nicht zum eigenen Haus passten. Also habe ich angefangen, selbst nachzurechnen: Förderrichtlinien gelesen, Energie- und CO₂-Preise recherchiert, Steuerbonus und Kredite verglichen. Aus dieser Recherche ist Schritt für Schritt dieser Rechner entstanden.</p>
        <p>Er ist ein rein privates Hobbyprojekt – ohne Auftraggeber, ohne Werbung und ohne kommerzielles Interesse. Ich bin selbst kein Fachmann für Heizungstechnik oder Energieberatung, sondern jemand, der sich gründlich eingelesen hat. Deshalb sind alle Annahmen offengelegt: Der „i“-Knopf an jedem Feld zeigt, woher ein Standardwert stammt. Der Rechner soll helfen, die eigene Situation zu durchdenken und mit guten Fragen ins Gespräch mit Energieberatung und Fachbetrieb zu gehen – ersetzen kann er dieses Gespräch nicht.</p>
        <p class="muted small">Wenn Ihnen ein Fehler oder eine veraltete Annahme auffällt, freue ich mich über jeden Hinweis. – Christoph Kania</p>
      </aside>
      <aside class="card contribute" aria-labelledby="contribute-title">
        <h2 id="contribute-title">Mitmachen</h2>
        <p>Förderprogramme, Energiepreise und Steuerregeln ändern sich laufend – ein Rechner wie dieser ist nur so gut wie seine Annahmen. Er ist ein offenes Projekt, und mit deiner Hilfe wird er besser für alle, die vor der Entscheidung für eine Wärmepumpe stehen:</p>
        <ul>
          <li>Dir ist ein Fehler oder ein veralteter Wert aufgefallen? <a href="${safeHref(BUG_REPORT_URL)}" target="_blank" rel="noopener">Melde ihn</a> – am besten mit Quelle, z. B. eine geänderte KfW-Regel oder ein neuer Preis.</li>
          <li>Du hast eine Idee oder eine Frage, die der Rechner noch nicht beantwortet? <a href="${safeHref(FEATURE_REQUEST_URL)}" target="_blank" rel="noopener">Schlag sie vor</a>.</li>
          <li>Du möchtest selbst mitentwickeln – an Rechenlogik, Texten, Tests oder Barrierefreiheit? <a href="${safeHref(CONTRIBUTING_URL)}" target="_blank" rel="noopener">So funktioniert die Mitarbeit</a>.</li>
          <li>Der Rechner hat dir geholfen und du möchtest das Hobbyprojekt unterstützen? Über einen Kaffee freue ich mich: <a href="${safeHref(BUY_ME_A_COFFEE_URL)}" target="_blank" rel="noopener">Buy me a coffee</a> oder <a href="${safeHref(PAYPAL_URL)}" target="_blank" rel="noopener">PayPal</a>. Freiwillig – der Rechner bleibt kostenlos und werbefrei.</li>
        </ul>
        <p class="muted small">Quellcode, Fragen und Vorschläge: <a href="${safeHref(REPO_URL)}" target="_blank" rel="noopener">github.com/chkania/wpir</a> – schön, wenn du dabei bist!</p>
      </aside>
      <p class="disclaimer">Keine Finanz-, Steuer- oder Förderberatung. Alle Angaben ohne Gewähr; Förderbedingungen Stand ${FUNDING_SOURCE_DATE.split('-').reverse().join('.')} – bitte vor Antragstellung bei KfW, Energieberatung und Steuerberatung prüfen.</p>
      <p class="disclaimer license"><a href="./changelog.html">Version ${APP_VERSION}</a> · © 2026 Christoph Kania · Lizenz: <a href="./lizenz.html">PolyForm Noncommercial 1.0.0</a> – kostenfreie Nutzung für nicht-kommerzielle Zwecke; kommerzielle Nutzung nur nach Absprache · <a href="./lizenzen-drittanbieter.html">Lizenzen von Drittanbietern</a> · <a href="./impressum.html">Impressum</a> · <a href="./datenschutz.html">Datenschutz</a> · <a id="link-derivation" href="${DERIVATION_PAGE}" title="Detaillierte Berechnung hinter den Zahlen">Rechenweg</a> · <a href="./angebot.html">Weg zum Angebot</a> · <a href="${safeHref(REPO_URL)}" target="_blank" rel="noopener">Quellcode auf GitHub</a></p>
    </section>
  </main>
  <div id="toast" class="toast" role="status" aria-live="polite"></div>
  ${introHtml()}
  ${recommendHtml()}
  ${supportHtml()}
  <dialog id="privacy-confirm" class="intro privacy-confirm" aria-labelledby="privacy-title" aria-describedby="privacy-text">
    <form method="dialog" class="intro-body">
      <button type="button" id="privacy-close" class="dialog-close" data-dialog-first aria-label="Schließen">×</button>
      <h2 id="privacy-title"></h2>
      <p id="privacy-text"></p>
      <label class="privacy-skip"><input id="privacy-skip" type="checkbox"> Diesen Hinweis nicht mehr anzeigen</label>
      <div class="intro-actions"><button id="privacy-cancel" type="button">Abbrechen</button><span class="privacy-choices"><button id="privacy-alt" type="button" hidden></button><button id="privacy-ok" type="button" class="primary"></button></span></div>
    </form>
  </dialog>
  ${variantsHtml()}${scenariosHtml()}`;
}

/** Dialog for saved scenarios in the browser (F37); the list is drawn when it opens. */
function scenariosHtml(): string {
  return `
  <dialog id="scenarios" class="intro scenarios" aria-labelledby="scenarios-title" aria-describedby="scenarios-lead">
    <form method="dialog" class="intro-body">
      <button type="submit" value="close" class="dialog-close" data-dialog-first aria-label="Schließen">×</button>
      <h2 id="scenarios-title">Gespeicherte Szenarien</h2>
      <p id="scenarios-lead" class="intro-lead">Speichern Sie die aktuellen Eingaben unter der Bezeichnung aus dem Abschnitt „Szenario“ im Browser – so wechseln Sie zwischen Angeboten, ohne Dateien zu exportieren. Die Liste bleibt in diesem Browser auf diesem Gerät; sie wird nicht übertragen.</p>
      <div class="scenarios-actions">
        <button type="button" id="sc-save">Aktuelle Eingaben speichern</button>
        <button type="button" id="sc-clear" class="ghost" hidden>Gespeicherte Szenarien leeren</button>
      </div>
      <p id="sc-notice" class="sc-notice" hidden></p>
      <p id="sc-status" class="rec-status" role="status" aria-live="polite"></p>
      <div id="sc-list" class="scenarios-body"></div>
      <div class="intro-actions"><span></span><button type="submit" value="close" class="primary">Schließen</button></div>
    </form>
  </dialog>`;
}

/** Dialog for comparing variants (F31). */
function variantsHtml(): string {
  return `
  <dialog id="variants" class="intro variants" aria-labelledby="variants-title">
    <form method="dialog" class="intro-body">
      <button type="submit" value="close" class="dialog-close" data-dialog-first aria-label="Schließen">×</button>
      <h2 id="variants-title">Varianten vergleichen</h2>
      <p class="intro-lead">Laden Sie zwei oder drei Export-Dateien, etwa „Angebot A“ und „Angebot B“ oder „jetzt“ und „2028“, übernehmen Sie gespeicherte Szenarien oder die aktuellen Eingaben – diese Variante folgt dem Rechner, bis Sie den Stand festhalten. Die Varianten selbst werden nicht gespeichert; gespeicherte Szenarien („Gespeicherte Szenarien“ im Menü „Szenarien“) sind eine zusätzliche Quelle.</p>
      <div class="variants-actions">
        <button type="button" id="var-current">Aktuelle Eingaben hinzufügen</button>
        <button type="button" id="var-saved-btn" aria-expanded="false" aria-controls="var-saved">Aus gespeicherten Szenarien hinzufügen</button>
        <button type="button" id="var-files">Export-Dateien laden …</button>
        <input id="var-file-input" type="file" accept="application/json,.json" multiple hidden>
      </div>
      <div id="var-saved" class="variants-saved" hidden>
        <p id="var-saved-note" class="muted small" hidden></p>
        <ul id="var-saved-list" class="variants-list" aria-label="Gespeicherte Szenarien zum Hinzufügen"></ul>
      </div>
      <ul id="var-list" class="variants-list" aria-label="Geladene Varianten"></ul>
      <p id="var-status" class="rec-status" role="status" aria-live="polite"></p>
      <div id="var-result"></div>
      <div class="intro-actions"><span></span><button type="submit" value="close" class="primary">Schließen</button></div>
    </form>
  </dialog>`;
}

/** Dialog for recommending the calculator (F21); hrefs are set when it opens. */
function recommendHtml(): string {
  return `
  <dialog id="recommend" class="intro recommend" aria-labelledby="recommend-title" aria-describedby="recommend-lead">
    <form method="dialog" class="intro-body">
      <button type="submit" value="close" class="dialog-close" data-dialog-first aria-label="Schließen">×</button>
      <h2 id="recommend-title">Rechner weiterempfehlen</h2>
      <p id="recommend-lead">Kennen Sie jemanden, der über eine Wärmepumpe nachdenkt? Empfehlen Sie den Rechner weiter. Geteilt wird nur die Adresse des Rechners – nicht Ihre Eingaben.</p>
      <ul class="share-list">
        <li><a id="rec-whatsapp" class="share-btn">WhatsApp</a></li>
        <li><a id="rec-threema" class="share-btn" target="_blank" rel="noopener">Threema</a></li>
        <li><a id="rec-email" class="share-btn">E-Mail</a></li>
        <li><button id="rec-copy" class="share-btn" type="button">Link kopieren</button></li>
        <li><button id="rec-other" class="share-btn" type="button">Andere</button></li>
      </ul>
      <p id="rec-status" class="rec-status" role="status" aria-live="polite"></p>
      <textarea id="rec-fallback" class="rec-fallback" rows="3" readonly aria-label="Text zum Kopieren" hidden></textarea>
      <p class="muted small">„Andere“ öffnet das Teilen-Menü Ihres Geräts, z. B. für Signal oder Telegram. Wo es das nicht gibt, wird der Text kopiert – fügen Sie ihn in die gewünschte App ein. „E-Mail“ öffnet Ihr E-Mail-Programm mit vorbereitetem Betreff und Text. Ihre eigene Berechnung teilen Sie dagegen über „Link mit Werten teilen“.</p>
      <div class="intro-actions"><span></span><button type="submit" value="close" class="primary">Schließen</button></div>
    </form>
  </dialog>`;
}

/** Voluntary support of the hobby project (F19.4, F19.5): links to Buy Me a Coffee and PayPal, SEPA transfer with GiroCode. */
function supportHtml(): string {
  const qr = qrSvg(epcPayload(DONATION_ACCOUNT), `GiroCode: Überweisung an ${DONATION_ACCOUNT.name} mit der Banking-App scannen`);
  const transferQr = qr ? `<figure class="support-qr">${qr}<figcaption>GiroCode</figcaption></figure>` : '';
  return `
  <dialog id="support" class="intro recommend support" aria-labelledby="support-title" aria-describedby="support-lead">
    <form method="dialog" class="intro-body">
      <button type="submit" value="close" class="dialog-close" data-dialog-first aria-label="Schließen">×</button>
      <h2 id="support-title">Projekt unterstützen</h2>
      <p id="support-lead">Der Rechner ist ein privates Hobbyprojekt – kostenlos und ohne Werbung. Wenn er Ihnen geholfen hat, freue ich mich über einen Kaffee. Das ist natürlich freiwillig.</p>
      <ul class="share-list">
        <li><a class="share-btn" href="${safeHref(BUY_ME_A_COFFEE_URL)}" target="_blank" rel="noopener">Buy me a coffee</a></li>
        <li><a class="share-btn" href="${safeHref(PAYPAL_URL)}" target="_blank" rel="noopener">PayPal</a></li>
      </ul>
      <p class="muted small">Beide Links öffnen die Seite des Anbieters in einem neuen Tab; dort gelten dessen Datenschutzbestimmungen. Der Rechner überträgt dabei nichts.</p>
      <h3 id="support-transfer-title">Per Überweisung</h3>
      <div class="support-transfer" aria-labelledby="support-transfer-title">
        ${transferQr}
        <div class="support-details">
          <dl class="support-account">
            <dt>Empfänger</dt><dd>${escapeHtml(DONATION_ACCOUNT.name)}</dd>
            <dt>IBAN</dt><dd><span id="support-iban" class="support-iban">${escapeHtml(formatIban(DONATION_ACCOUNT.iban))}</span></dd>
            <dt>Verwendungszweck</dt><dd>${escapeHtml(DONATION_ACCOUNT.purpose)}</dd>
          </dl>
          <button id="support-copy-iban" class="share-btn" type="button">IBAN kopieren</button>
          <p id="support-status" class="rec-status" role="status" aria-live="polite"></p>
        </div>
      </div>
      <p class="muted small">Den GiroCode mit der Banking-App scannen: Empfänger, IBAN und Verwendungszweck sind dann ausgefüllt, den Betrag wählen Sie selbst. Der Code wird in Ihrem Browser erzeugt. Ebenso hilfreich: Fehler melden oder den Rechner weiterempfehlen.</p>
      <div class="intro-actions"><span></span><button type="submit" value="close" class="primary">Schließen</button></div>
    </form>
  </dialog>`;
}

/** Introduction for first-time visitors (F20): purpose, short usage, pointer to the manual. */
function introHtml(): string {
  return `
  <dialog id="intro" class="intro" aria-labelledby="intro-title" aria-describedby="intro-purpose">
    <form method="dialog" class="intro-body">
      <button type="submit" value="close" class="dialog-close" data-dialog-first aria-label="Schließen">×</button>
      <h2 id="intro-title">Willkommen beim Wärmepumpen-Investitionsrechner</h2>
      <p id="intro-purpose" class="intro-lead">Lohnt sich der Umstieg von Ihrer Gas- oder Ölheizung auf eine Wärmepumpe – und wann ist der beste Zeitpunkt? Der Rechner stellt die Gesamtkosten über viele Jahre gegenüber: <strong>bisherige Heizung weiterbetreiben</strong> oder <strong>auf eine Wärmepumpe umsteigen</strong> – mit KfW-Zuschuss oder Steuerbonus, Kredit, steigenden Energie- und CO₂-Preisen und den Kosten des Wartens.</p>
      <h3>So geht’s</h3>
      <ol class="intro-steps">
        <li><strong>Ihre Daten eintragen</strong> (links, auf dem Smartphone oben). Am wichtigsten sind Energieträger und Verbrauch Ihrer Heizung, die Kosten der Wärmepumpe und Ihr Haushaltseinkommen. Für alles andere sind realistische Standardwerte hinterlegt – das „i“ neben einem Feld zeigt, woher sie stammen.</li>
        <li><strong>Die Ergebnisse ansehen</strong> (rechts bzw. darunter). Sie aktualisieren sich sofort: Ersparnis und Amortisation, wichtige Termine und Hinweise, Diagramme und „Wann umrüsten?“.</li>
        <li><strong>Varianten sichern und vergleichen:</strong> Ihre Eingaben bleiben in diesem Browser gespeichert; über Export oder „Link mit Werten teilen“ heben Sie Varianten auf oder geben sie weiter.</li>
      </ol>
      <p class="intro-about">Ein privates Hobbyprojekt: Der Rechner ist aus meiner eigenen Frage entstanden, ob sich der Umstieg finanziell lohnt. <a href="#ueber" data-about-link>Wie und warum er entstanden ist</a></p>
      <p class="muted small">Gerechnet wird nur in Ihrem Browser. Die Ergebnisse sind eine Modellrechnung und ersetzen keine Energie-, Förder- oder Steuerberatung.</p>
      <div class="intro-actions">
        <a href="./hilfe.html">Ausführliche Anleitung in der Hilfe</a>
        <button type="submit" value="close" class="primary">Los geht’s</button>
      </div>
      <p class="muted small intro-again">Diese Einführung können Sie jederzeit über „Mehr“ › „Einführung“ wieder öffnen.</p>
    </form>
  </dialog>`;
}
