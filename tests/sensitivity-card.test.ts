// @vitest-environment happy-dom
import { readFileSync } from 'node:fs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { STORAGE_KEY, mountApp } from '../src/ui/app';
import { mountSensitivityCard } from '../src/ui/sensitivity-card';
import { runAll } from '../src/core/simulation';
import { fmtEur } from '../src/ui/format';
import { keyFigureTexts } from '../src/ui/key-figures';
import { chartTables } from '../src/ui/charts';
import { compareInstallTimes } from '../src/core/compare';
import { energyYear } from '../src/core/energy';
import { priceRows } from '../src/core/simulation';
import { encodeHash, exportJson } from '../src/core/serialize';
import { reportHtml } from '../src/ui/report';
import { keyEvents } from '../src/core/events';
import { createDefaults } from '../src/core/defaults';
import { defaults, TODAY } from './helpers';

/*
 * Einflussgrößen-Karte (F27). In einer eigenen Datei, damit der Testlauf von ui.test.ts nicht den Speicher ausschöpft
 * (jede eingehängte App behält Speicher, sichtbar bei vielen Aufbauten).
 */

class MemoryStorage implements Storage {
  private m = new Map<string, string>();
  get length() { return this.m.size; }
  clear() { this.m.clear(); }
  getItem(k: string) { return this.m.get(k) ?? null; }
  key(i: number) { return [...this.m.keys()][i] ?? null; }
  removeItem(k: string) { this.m.delete(k); }
  setItem(k: string, v: string) { this.m.set(k, String(v)); }
}
const store = new MemoryStorage();

function mount() {
  document.body.innerHTML = '<div id="app"></div>';
  const root = document.getElementById('app')!;
  const app = mountApp(root, { storage: store, today: TODAY, debounceMs: 0 });
  return { root, app };
}

function setValue(root: HTMLElement, path: string, value: string) {
  const el = root.querySelector<HTMLInputElement | HTMLSelectElement>(`[data-path="${path}"]`)!;
  el.value = value;
  el.dispatchEvent(new Event('change', { bubbles: true }));
  return el;
}
const slider = (root: HTMLElement, id: string) => root.querySelector<HTMLInputElement>(`#sens-${id}`)!;
/** Moves a slider by steps (keyboard-like: value change plus input event). */
function slide(root: HTMLElement, id: string, delta: number) {
  const el = slider(root, id);
  el.value = String(Number(el.value) + delta);
  el.dispatchEvent(new Event('input', { bubbles: true }));
  return el;
}
const combo = (root: HTMLElement) => root.querySelector('.sens-combo')!.textContent;
/** Header key figures as the result table shows them: a negative saving or CO₂ value carries its label. */
const headerTexts = (root: HTMLElement) =>
  [...root.querySelectorAll<HTMLElement>('#kpis .kpi')].map((k) => {
    const label = k.querySelector('.kpi-label')!.textContent!;
    const value = k.querySelector('.kpi-value')!.textContent!;
    return /Mehr/.test(label) ? `${label} ${value}` : value;
  });
/** Values of one column of the result table ("Vorgabe" or "einstellung"). */
const column = (root: HTMLElement, which: 'vorgabe' | 'einstellung') =>
  [...root.querySelectorAll('.sens-table tbody tr')].map((tr) => tr.querySelectorAll('td')[which === 'vorgabe' ? 0 : 1].textContent);


describe('F27.8 Kennzahlen-Texte (Kopfbereich und Ergebnisblock)', () => {
  const base = { ref: 1000, kfw: 900, tax: 950, saving: 100, breakEven: 130, installMonth: 100, co2Saved: 2.5 };
  const text = (k: Parameters<typeof keyFigureTexts>[0]) => Object.fromEntries(keyFigureTexts(k).map((x) => [x.id, x]));

  it('F27.8 Steuerbonus nicht möglich; Amortisation nach Inbetriebnahme mit Dauer; Ersparnis positiv', () => {
    const t = text(base);
    expect(t.tax.value).toBe(fmtEur(950));
    expect(t.saving.label).toBe('Ersparnis mit WP');
    expect(t.saving.negative).toBe(false);
    expect(t.amortisation.value).toContain('nach Inbetriebnahme');
    expect(t.amortisation.value).toContain('2 J. 6 Mon.');
    expect(text({ ...base, tax: null }).tax.value).toBe('nicht möglich');
  });

  it('F27.8 nicht im Zeitraum; Mehrkosten und CO₂-Mehrausstoß mit Betrag in der Zelle', () => {
    const t = text({ ...base, breakEven: null, saving: -50, co2Saved: -2.5, installMonth: null });
    expect(t.amortisation.value).toBe('nicht im Zeitraum');
    expect(t.saving.label).toBe('Mehrkosten mit WP');
    expect(t.saving.cell).toBe(`Mehrkosten mit WP ${fmtEur(50)}`);
    expect(t.co2.label).toBe('CO₂-Mehrausstoß');
    expect(t.co2.value).toBe('2,5 t');
    expect(t.co2.cell).toBe('CO₂-Mehrausstoß 2,5 t');
  });

  it('F27.8 Amortisation ohne Inbetriebnahme-Abstand zeigt nur den Monat', () => {
    const t = text({ ...base, breakEven: 100, installMonth: 100 });
    expect(t.amortisation.value).not.toContain('nach Inbetriebnahme');
  });
});

describe('F27 Einflussgrößen (Karte)', () => {
  beforeEach(() => {
    store.clear();
    history.replaceState(null, '', '/');
  });

  it('F27.2 Diagrammleiste hat fünf Reiter; kein Tornado-Diagramm, keine Einflussgrößen-Tabelle, kein Satz', () => {
    const { root, app } = mount();
    expect(root.querySelectorAll('[role="tab"]')).toHaveLength(5);
    expect(root.textContent).not.toContain('Am stärksten wirkt');
    const i = defaults();
    const run = app.lastResult()!.run;
    expect(Object.keys(chartTables(run, priceRows(i), compareInstallTimes(i), energyYear(i)))).not.toContain('sensitivity');
    expect(root.querySelector('canvas[data-chart="sensitivity"]')).toBeNull();
    expect(root.querySelector('[data-chart-note="sensitivity"]')).toBeNull();
    expect(root.querySelector('[data-chart-table="sensitivity"]')).toBeNull();
    expect(root.querySelector('#panel-sensitivity')).toBeNull();
  });

  it('F27.3 Karte „Einflussgrößen“ steht nach dem Diagrammbereich und vor „Details“, mit sieben Reglern in fester Reihenfolge', () => {
    const { root } = mount();
    const card = root.querySelector('#sensitivity')!;
    expect(card.tagName).toBe('SECTION');
    expect(card.querySelector('h2')!.textContent).toBe('Einflussgrößen');
    expect(card.nextElementSibling!.id).toBe('details');
    expect(card.previousElementSibling!.querySelector('[role="tablist"]')).not.toBeNull();
    const labels = [...card.querySelectorAll<HTMLLabelElement>('.sens-slider label')].map((l) => l.textContent);
    expect(labels).toEqual([
      'Steigerung Gaspreis (ohne CO₂)',
      'Steigerung Strompreis',
      'Jahresarbeitszahl (JAZ)',
      'Investition gesamt (brutto)',
      'CO₂-Preis',
      'Kreditzinsen',
      'Opportunitätszins',
    ]);
    expect(labels.join(' ')).not.toMatch(/heute/);
  });

  it('F27.3 ohne Kredit (Eigenkapital) sechs Regler; ohne CO₂-Pfad kein CO₂-Regler', () => {
    const { root, app } = mount();
    const i = app.getInputs();
    i.financing.kfwEquity = 200000;
    i.financing.taxEquity = 200000;
    app.setInputs(i);
    app.recalc();
    expect(root.querySelectorAll('[data-sens-slider]')).toHaveLength(6);
    expect(root.querySelector('#sens-loanRate')).toBeNull();
    i.prices.co2Path = '';
    app.setInputs(i);
    app.recalc();
    expect(root.querySelector('#sens-co2Price')).toBeNull();
  });

  it('F27.7 jeder Regler hat einen Hinweis mit Eingabe und Spanne; Steigerungen mit Erläuterung', () => {
    const { root } = mount();
    const hint = (id: string) => root.querySelector(`#sens-${id}-hint`)!.textContent!;
    expect(hint('elecIncrease')).toContain('Ihre Eingabe: 2,0 % p. a.');
    expect(hint('elecIncrease')).toContain('Spanne: 0,0 % bis 22,0 % (Prozentpunkte)');
    expect(hint('elecIncrease')).toContain('durchschnittliche jährliche Steigerung im Betrachtungszeitraum');
    expect(hint('jaz')).toContain('Ihre Eingabe: 3,3');
    expect(hint('investment')).toContain('(relativ).');
    expect(hint('co2Price')).toContain('Ihre Eingabe: 220 €/t (2045)');
    expect(hint('loanRate')).toContain('Ihre Eingabe: KfW 358 2,2 %');
    expect(hint('opportunityRate')).toContain('Spanne: 0,0 % bis 7,0 % (Prozentpunkte)');
  });

  it('F27.4 F27.9 F27.10 Regler verändern weder Formular, Kopfbereich, Speicher, Link noch Export-Eingaben', () => {
    const { root, app } = mount();
    const hashBefore = encodeHash(createDefaults(TODAY), app.getInputs());
    const jsonBefore = exportJson(app.getInputs());
    const before = {
      kpis: root.querySelector('#kpis')!.innerHTML,
      field: root.querySelector<HTMLInputElement>('[data-path="heatPump.elecIncrease"]')!.value,
      inputs: structuredClone(app.getInputs()),
      stored: store.getItem(STORAGE_KEY),
      hash: location.hash,
    };
    slide(root, 'elecIncrease', 30);
    slide(root, 'jaz', 5);
    expect(root.querySelector('#kpis')!.innerHTML).toBe(before.kpis);
    expect(root.querySelector<HTMLInputElement>('[data-path="heatPump.elecIncrease"]')!.value).toBe(before.field);
    expect(app.getInputs()).toEqual(before.inputs);
    expect(store.getItem(STORAGE_KEY)).toBe(before.stored);
    expect(location.hash).toBe(before.hash);
    // Link (#z=) and JSON export carry the form inputs only (F27.10)
    expect(encodeHash(createDefaults(TODAY), app.getInputs())).toBe(hashBefore);
    expect(exportJson(app.getInputs())).toBe(jsonBefore);
    // Printable report: no slider positions (F27.10)
    const run = app.lastResult()!.run;
    const html = reportHtml({ inputs: app.getInputs(), defaults: createDefaults(TODAY), run, cmp: compareInstallTimes(app.getInputs()), events: keyEvents(app.getInputs(), run), today: TODAY, url: 'https://example.invalid/', detailsHtml: '' });
    expect(html).not.toContain('Steigerung Strompreis 5,0');
    expect(combo(root)).not.toBe('keine Änderung');
  });

  it('F27.4 F27.10 Matomo erhält keine Reglerereignisse (Karte ruft die Analyse nicht auf)', () => {
    const src = readFileSync('src/ui/sensitivity-card.ts', 'utf8');
    expect(src).not.toMatch(/analytics|_paq|trackEvent/);
    expect(src).not.toMatch(/localStorage|setItem|replaceState|location\.hash/);
  });

  it('F27.8 Hinweis unter der Ergebnistabelle zur Amortisation (fester Text, keine Berechnung)', () => {
    const { root } = mount();
    const note = root.querySelector('.sens-note')!.textContent!;
    expect(note).toContain('Die Amortisation liegt oft beim Kesseltausch im Referenzfall');
    slide(root, 'elecIncrease', 30);
    expect(root.querySelector('.sens-note')!.textContent).toBe(note);
  });

  it('F27.8 Startzustand: Beschriftung „keine Änderung“, Spalten „Vorgabe“ und „bei Einstellung“ gleich wie der Kopfbereich', () => {
    const { root } = mount();
    expect(combo(root)).toBe('keine Änderung');
    // no live region: each step would be announced (F27.8)
    expect(root.querySelector('#sensitivity')!.innerHTML).not.toContain('aria-live');
    const kpis = headerTexts(root);
    expect(column(root, 'vorgabe')).toEqual(kpis);
    expect(column(root, 'einstellung')).toEqual(kpis);
    expect(column(root, 'vorgabe')).toHaveLength(6);
  });

  it('F27.8 F27.12 Einstellung Steigerung Strom 22 % ergibt dieselben Kennzahlen wie die Formulareingabe 22 %', () => {
    const { root } = mount();
    slide(root, 'elecIncrease', 200);
    expect(combo(root)).toBe('Steigerung Strompreis 22,0 % p. a.');
    const set = column(root, 'einstellung');
    setValue(root, 'heatPump.elecIncrease', '22');
    expect(set).toEqual(headerTexts(root));
    expect(combo(root)).toBe('keine Änderung');
  });

  it('F27.8 zwei Regler bewegt: Beschriftung nennt beide; Ergebnis entspricht der Formulareingabe mit beiden Änderungen', () => {
    const { root } = mount();
    slide(root, 'elecIncrease', 30);
    expect(combo(root)).toBe('Steigerung Strompreis 5,0 % p. a.');
    // JAZ 3,0 (form value 3,3): three steps down
    slide(root, 'jaz', -3);
    expect(combo(root)).toBe('Steigerung Strompreis 5,0 % p. a., JAZ 3,0');
    const set = column(root, 'einstellung');
    setValue(root, 'heatPump.elecIncrease', '5');
    setValue(root, 'heatPump.jaz', '3');
    expect(set).toEqual(headerTexts(root));
  });

  it('F27.8 Ein Regler auf die Voreinstellung zurückgeschoben verschwindet aus der Beschriftung; die übrigen Änderungen bleiben', () => {
    const { root } = mount();
    slide(root, 'elecIncrease', 30);
    slide(root, 'jaz', -3);
    slide(root, 'jaz', 3);
    expect(combo(root)).toBe('Steigerung Strompreis 5,0 % p. a.');
  });

  it('F27.11 Zurücksetzen stellt alle Regler auf die Voreinstellung; „keine Änderung“, beide Spalten gleich', () => {
    const { root } = mount();
    slide(root, 'elecIncrease', 30);
    slide(root, 'jaz', -3);
    root.querySelector<HTMLButtonElement>('[data-sens-reset]')!.click();
    expect(combo(root)).toBe('keine Änderung');
    expect(column(root, 'einstellung')).toEqual(column(root, 'vorgabe'));
    expect(slider(root, 'elecIncrease').getAttribute('aria-valuetext')).toBe('2,0 % p. a.');
    expect(root.querySelector('[data-sens-value="jaz"]')!.textContent).toBe('3,3');
  });

  it('F27.11 Eingabeänderung im Formular: alle Regler auf dem neuen Eingabewert, Beschriftung „keine Änderung“', () => {
    const { root } = mount();
    slide(root, 'elecIncrease', 30);
    setValue(root, 'general.opportunityRate', '3');
    expect(combo(root)).toBe('keine Änderung');
    expect(slider(root, 'elecIncrease').getAttribute('aria-valuetext')).toBe('2,0 % p. a.');
    expect(root.querySelector('[data-sens-value="opportunityRate"]')!.textContent).toBe('3,0 % p. a.');
  });

  it('F27.13 Bedienung: Range-Eingaben mit Beschriftung, Schrittweite 1, Einheit in aria-valuetext', () => {
    const { root } = mount();
    const el = slider(root, 'elecIncrease');
    expect(el.type).toBe('range');
    expect(el.min).toBe('0');
    expect(el.step).toBe('1');
    expect(el.getAttribute('aria-describedby')).toBe('sens-elecIncrease-hint');
    slide(root, 'elecIncrease', 30);
    expect(el.getAttribute('aria-valuetext')).toBe('5,0 % p. a.');
    slider(root, 'loanRate').value = String(slider(root, 'loanRate').value);
    slide(root, 'loanRate', 10);
    expect(slider(root, 'loanRate').getAttribute('aria-valuetext')).toBe('+1,0 Prozentpunkte');
    slide(root, 'co2Price', -6);
    expect(slider(root, 'co2Price').getAttribute('aria-valuetext')).toBe('154 €/t (2045)');
    expect(root.querySelector('[data-sens-value="co2Price"]')!.textContent).toBe('154 €/t (2045)');
  });

  it('F27.5 Investition 0 €: Regler deaktiviert, Text „keine Spanne“', () => {
    const { root } = mount();
    setValue(root, 'heatPump.investment', '0');
    expect(slider(root, 'investment').disabled).toBe(true);
    expect(root.querySelector('#sens-investment-hint')!.textContent).toContain('Keine Spanne');
  });

  it('F27.14 KI-Export-Grundlage: Einflussgrößen-Berechnung bleibt im letzten Lauf erhalten', () => {
    const { root, app } = mount();
    expect(app.lastResult()!.sens.items.length).toBeGreaterThan(0);
    expect(root.querySelector('#sensitivity')).not.toBeNull();
  });

  it('F27.12 je Reglerwert genau ein Aufruf des Rechners, auch wenn schon andere Regler verschoben sind', () => {
    const root = document.createElement('div');
    document.body.appendChild(root);
    const runner = vi.fn(runAll);
    const card = mountSensitivityCard(root, runner);
    const i = defaults();
    card.render(i, runAll(i));
    slide(root, 'jaz', 2);
    expect(runner).toHaveBeenCalledTimes(1);
    slide(root, 'elecIncrease', 30);
    expect(runner).toHaveBeenCalledTimes(2);
    // the second call carries both moved sliders
    const sent = runner.mock.calls[1][0];
    expect(sent.heatPump.elecIncrease).toBeCloseTo(0.05, 9);
    expect(sent.heatPump.jaz).toBeCloseTo(3.5, 9);
    expect(i.heatPump.elecIncrease).toBe(0.02);
    slide(root, 'elecIncrease', 0);
    expect(runner).toHaveBeenCalledTimes(3);
    root.querySelector<HTMLButtonElement>('[data-sens-reset]')!.click();
    expect(runner).toHaveBeenCalledTimes(3);
    root.remove();
  });

  it('F27.12 Rechenfehler erscheint als Text in der Spalte; Eingaben bleiben unverändert', () => {
    const root = document.createElement('div');
    document.body.appendChild(root);
    const i = defaults();
    const run = runAll(i);
    const card = mountSensitivityCard(root, () => {
      throw new Error('Testfehler');
    });
    card.render(i, run);
    const before = structuredClone(i);
    slide(root, 'jaz', 2);
    expect(root.querySelector('.field-error')!.textContent).toContain('Testfehler');
    expect(column(root, 'einstellung').every((c) => c === '–')).toBe(true);
    expect(column(root, 'vorgabe').every((c) => c !== '–')).toBe(true);
    expect(i).toEqual(before);
    root.remove();
  });
});
