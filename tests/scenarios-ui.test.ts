// @vitest-environment happy-dom
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_CHANGES } from '../src/core/default-history';
import { SCENARIOS_KEY, serializeScenarioFile } from '../src/core/scenario-store';
import { encodeHash, exportJson } from '../src/core/serialize';
import { mountApp, STORAGE_KEY, THEME_KEY } from '../src/ui/app';
import { SCENARIO_TEXT } from '../src/ui/scenarios';
import { VARIANTS_LIMIT_TEXT } from '../src/ui/variants';
import { defaults, TODAY } from './helpers';

class MemoryStorage implements Storage {
  protected m = new Map<string, string>();
  get length() {
    return this.m.size;
  }
  clear() {
    this.m.clear();
  }
  getItem(k: string) {
    return this.m.get(k) ?? null;
  }
  key(i: number) {
    return [...this.m.keys()][i] ?? null;
  }
  removeItem(k: string) {
    this.m.delete(k);
  }
  setItem(k: string, v: string) {
    this.m.set(k, String(v));
  }
}
/** Storage that is full (setItem throws), e.g. private mode or quota exceeded. */
class FullStorage extends MemoryStorage {
  setItem(): void {
    throw new Error('QuotaExceededError');
  }
}
/** Storage that cannot remove keys. */
class NoRemoveStorage extends MemoryStorage {
  removeItem(): void {
    throw new Error('SecurityError');
  }
}

let store: MemoryStorage;
const OLD = '2026-11-01T08:00:00.000Z';

beforeEach(() => {
  store = new MemoryStorage();
  history.replaceState(null, '', '/');
  document.body.innerHTML = '';
});

function mountWith(storage: Storage | null) {
  document.body.innerHTML = '<div id="app"></div>';
  const root = document.getElementById('app')!;
  const app = mountApp(root, { storage, today: TODAY, debounceMs: 0 });
  return { root, app };
}
const mount = () => mountWith(store);

const btn = (root: HTMLElement, sel: string) => root.querySelector<HTMLButtonElement>(sel)!;
const scDlg = (root: HTMLElement) => root.querySelector<HTMLDialogElement>('#scenarios')!;
const privacy = (root: HTMLElement) => root.querySelector<HTMLDialogElement>('#privacy-confirm')!;
const privacyTitle = (root: HTMLElement) => root.querySelector('#privacy-title')!.textContent;
const privacyText = (root: HTMLElement) => root.querySelector('#privacy-text')!.textContent;
const status = (root: HTMLElement) => root.querySelector('#sc-status')!.textContent;
const confirmOk = (root: HTMLElement) => btn(root, '#privacy-ok').click();
const confirmCancel = (root: HTMLElement) => btn(root, '#privacy-cancel').click();
const openScenarios = (root: HTMLElement) => btn(root, '#btn-scenarios').click();
const list = () => JSON.parse(store.getItem(SCENARIOS_KEY)!).entries as Record<string, any>[];
const names = () => list().map((e) => e.name);
const listText = (root: HTMLElement) => root.querySelector('#sc-list')!.textContent!;

function setValue(root: HTMLElement, path: string, value: string) {
  const el = root.querySelector<HTMLInputElement | HTMLSelectElement>(`[data-path="${path}"]`)!;
  el.value = value;
  el.dispatchEvent(new Event('change', { bubbles: true }));
}
const setName = (root: HTMLElement, name: string) => setValue(root, 'scenario.name', name);
/** Opens the dialog and presses "Aktuelle Eingaben speichern". */
function saveNow(root: HTMLElement) {
  openScenarios(root);
  btn(root, '#sc-save').click();
}

/** A stored entry in the export format with the given name and changes. */
function entryFor(name: string, mut?: (i: ReturnType<typeof defaults>) => void, savedAt = OLD) {
  const i = defaults();
  i.scenario.name = name;
  mut?.(i);
  return { name, savedAt, inputs: JSON.parse(exportJson(i)) };
}
const seed = (entries: unknown[]) => store.setItem(SCENARIOS_KEY, serializeScenarioFile(entries));

describe('F37 Gespeicherte Szenarien im Browser', () => {
  it('A9 (F37.1) Schaltfläche ist der erste Punkt im Menü „Szenarien“; öffnet den Dialog; die Liste wird bei jedem Öffnen neu gelesen; Schließen hat den Fokus', () => {
    const { root } = mount();
    const b = btn(root, '#btn-scenarios');
    expect(b.textContent).toBe('Gespeicherte Szenarien');
    // F38.1: first item of the "Szenarien" menu panel
    expect(b.parentElement!.getAttribute('role')).toBe('menu');
    expect(b.parentElement!.id).toBe('menu-scenarios');
    expect(b.parentElement!.firstElementChild).toBe(b);
    expect(b.getAttribute('aria-haspopup')).toBe('dialog');
    b.click();
    expect(scDlg(root).open).toBe(true);
    expect(listText(root)).toContain('Noch keine Szenarien gespeichert.');
    expect(document.activeElement).toBe(btn(root, '#scenarios .dialog-close'));
    scDlg(root).close();
    // another tab saves while the dialog is closed: the next opening shows it
    seed([entryFor('Angebot C')]);
    openScenarios(root);
    expect(listText(root)).toContain('Angebot C');
  });

  it('F37.2 Speichern legt Inputs unter dem Namen ab (version 1, Zeitpunkt, Bezeichnung = Name); der Einzelspeicher bleibt unberührt', () => {
    const { root } = mount();
    setValue(root, 'heatPump.jaz', '3.2');
    setName(root, '  Angebot A  ');
    const v1 = store.getItem(STORAGE_KEY);
    saveNow(root);
    const raw = JSON.parse(store.getItem(SCENARIOS_KEY)!);
    expect(raw.version).toBe(1);
    expect(raw.entries).toHaveLength(1);
    expect(raw.entries[0].name).toBe('Angebot A');
    expect(raw.entries[0].savedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(raw.entries[0].inputs).toMatchObject({ version: 1, scenario: { name: 'Angebot A' }, heatPump: { jaz: 3.2 } });
    expect(store.getItem(STORAGE_KEY)).toBe(v1);
    expect(status(root)).toBe('„Angebot A“ gespeichert.');
  });

  it('A1 Speichern, neu laden, abrufen: JAZ 3,2 zurück, Dialog schließt, Meldung, Einzelspeicher enthält JAZ 3,2', () => {
    const first = mount();
    setValue(first.root, 'heatPump.jaz', '3.2');
    setName(first.root, 'Angebot A');
    saveNow(first.root);
    // "Seite neu laden": the calculator starts again on the same storage
    const { root, app } = mount();
    setValue(root, 'heatPump.jaz', '4');
    openScenarios(root);
    expect(listText(root)).toContain('Angebot A');
    expect(listText(root)).toMatch(/Stand \d{2}\.\d{2}\.\d{4} \d{2}:\d{2}/);
    btn(root, '[data-sc-recall="0"]').click();
    expect(privacyTitle(root)).toBe('Gespeichertes Szenario abrufen?');
    confirmOk(root);
    expect(app.getInputs().heatPump.jaz).toBe(3.2);
    expect(scDlg(root).open).toBe(false);
    expect(root.querySelector('#toast')!.textContent).toBe('„Angebot A“ abgerufen.');
    expect(JSON.parse(store.getItem(STORAGE_KEY)!).heatPump.jaz).toBe(3.2);
  });

  it('A2 Leere oder nur aus Leerzeichen bestehende Bezeichnung: Hinweis, nichts gespeichert', () => {
    const { root } = mount();
    for (const n of ['', '   ']) {
      setName(root, n);
      saveNow(root);
      expect(status(root)).toBe(SCENARIO_TEXT.noName);
      expect(status(root)).toBe('Bitte zuerst eine Bezeichnung des Szenarios eintragen (Abschnitt Szenario).');
    }
    expect(store.getItem(SCENARIOS_KEY)).toBeNull();
  });

  it('A3 Gleicher Name fragt nach; Abbrechen lässt den alten Stand, Überschreiben ersetzt; „angebot a“ ist ein zweiter Eintrag', () => {
    seed([entryFor('Angebot A', undefined, OLD)]);
    const { root } = mount();
    setValue(root, 'heatPump.jaz', '3.3');
    setName(root, ' Angebot A ');
    saveNow(root);
    expect(privacyTitle(root)).toBe('Gespeicherten Stand „Angebot A“ mit den aktuellen Eingaben überschreiben?');
    confirmCancel(root);
    expect(list()).toHaveLength(1);
    expect(list()[0].savedAt).toBe(OLD);
    saveNow(root);
    confirmOk(root);
    expect(names()).toEqual(['Angebot A']);
    expect(list()[0].savedAt).not.toBe(OLD);
    expect(list()[0].inputs.heatPump.jaz).toBe(3.3);
    expect(list()[0].inputs.scenario.name).toBe('Angebot A');
    // exact comparison: no question, a second entry
    setName(root, 'angebot a');
    saveNow(root);
    expect(privacy(root).open).toBe(false);
    expect(names()).toEqual(['Angebot A', 'angebot a']);
  });

  it('A4 Aktualisieren, dann Esc: unverändert, Dialog offen; danach Aktualisieren mit anderer Bezeichnung behält den Namen „Angebot A“', () => {
    seed([entryFor('Angebot A', undefined, OLD)]);
    const { root } = mount();
    openScenarios(root);
    btn(root, '[data-sc-update="0"]').click();
    expect(privacyTitle(root)).toBe('Gespeicherten Stand „Angebot A“ mit den aktuellen Eingaben überschreiben?');
    // Esc: the browser closes only the confirmation (cancel, then the dialog is closed)
    privacy(root).dispatchEvent(new Event('cancel', { cancelable: true }));
    privacy(root).close();
    confirmOk(root); // a closed confirmation does nothing
    expect(list()[0].savedAt).toBe(OLD);
    expect(scDlg(root).open).toBe(true);
    // another name in the calculator; updating "Angebot A" keeps its name
    setName(root, 'Angebot B');
    btn(root, '[data-sc-update="0"]').click();
    confirmOk(root);
    expect(names()).toEqual(['Angebot A']);
    expect(list()[0].savedAt).not.toBe(OLD);
    expect(list()[0].inputs.scenario.name).toBe('Angebot A');
    expect(status(root)).toBe('„Angebot A“ aktualisiert.');
  });

  it('A5 Löschen, dann Abbrechen: bleibt; Löschen: verschwindet, leere Liste mit Hinweis', () => {
    seed([entryFor('Angebot A'), entryFor('Angebot B')]);
    const { root } = mount();
    openScenarios(root);
    btn(root, '[data-sc-delete="0"]').click();
    expect(privacyTitle(root)).toBe('„Angebot A“ endgültig löschen?');
    confirmCancel(root);
    expect(names()).toEqual(['Angebot A', 'Angebot B']);
    btn(root, '[data-sc-delete="0"]').click();
    confirmOk(root);
    expect(names()).toEqual(['Angebot B']);
    expect(status(root)).toBe('„Angebot A“ gelöscht.');
    btn(root, '[data-sc-delete="0"]').click();
    confirmOk(root);
    expect(listText(root)).toContain('Noch keine Szenarien gespeichert.');
  });

  it('A6 Abrufen fragt immer; Abbrechen lässt Eingaben und Einzelspeicher unverändert', () => {
    seed([entryFor('Angebot A', (i) => (i.heatPump.jaz = 3.2))]);
    const { root, app } = mount();
    setValue(root, 'heatPump.jaz', '4');
    const v1 = store.getItem(STORAGE_KEY);
    openScenarios(root);
    btn(root, '[data-sc-recall="0"]').click();
    expect(privacy(root).open).toBe(true);
    expect(privacyTitle(root)).toBe('Gespeichertes Szenario abrufen?');
    expect(privacyText(root)).toContain('Die Eingaben im Rechner werden durch „Angebot A“ ersetzt.');
    confirmCancel(root);
    expect(app.getInputs().heatPump.jaz).toBe(4);
    expect(store.getItem(STORAGE_KEY)).toBe(v1);
  });

  it('A7 Abrufen bei geteiltem Link beendet die Link-Ansicht; Speichern dort legt den Eintrag an und lässt den Hinweis stehen', () => {
    const linked = defaults();
    linked.heatPump.jaz = 3.9;
    history.replaceState(null, '', encodeHash(defaults(), linked));
    store.setItem(STORAGE_KEY, JSON.stringify(defaults()));
    seed([entryFor('Angebot A', (i) => (i.heatPump.jaz = 3.2))]);
    const { root, app } = mount();
    expect(root.querySelector('.notice-shared')).not.toBeNull();
    openScenarios(root);
    btn(root, '[data-sc-recall="0"]').click();
    confirmOk(root);
    expect(root.querySelector('.notice-shared')).toBeNull();
    expect(location.hash).not.toContain('#z=');
    expect(app.getInputs().heatPump.jaz).toBe(3.2);

    // saving while the link is open: entry created, the notice stays
    history.replaceState(null, '', encodeHash(defaults(), linked));
    const second = mount();
    expect(second.root.querySelector('.notice-shared')).not.toBeNull();
    setName(second.root, 'Link-Stand');
    saveNow(second.root);
    expect(names()).toContain('Link-Stand');
    expect(second.root.querySelector('.notice-shared')).not.toBeNull();
  });

  it('A8 Manipulierter Eintrag (JAZ 99) wird auf 10 begrenzt; Meldung mit der Herkunft „dem gespeicherten Szenario“', () => {
    seed([entryFor('Angebot A', (i) => (i.heatPump.jaz = 99))]);
    const { root, app } = mount();
    openScenarios(root);
    btn(root, '[data-sc-recall="0"]').click();
    confirmOk(root);
    expect(app.getInputs().heatPump.jaz).toBe(10);
    expect(root.querySelector('#notice')!.textContent).toContain('dem gespeicherten Szenario');
  });

  it('A9 Unlesbare Liste: Hinweis, Speichern deaktiviert, „leeren“ sichtbar; ohne Eingriff bleibt der Speicher gleich', () => {
    store.setItem(SCENARIOS_KEY, '{kaputt');
    let { root } = mount();
    openScenarios(root);
    expect(root.querySelector('#sc-notice')!.textContent).toBe(SCENARIO_TEXT.unreadable);
    expect(btn(root, '#sc-save').disabled).toBe(true);
    expect(btn(root, '#sc-clear').hidden).toBe(false);
    expect(btn(root, '#sc-save').nextElementSibling).toBe(btn(root, '#sc-clear'));
    expect(store.getItem(SCENARIOS_KEY)).toBe('{kaputt');

    store.setItem(SCENARIOS_KEY, JSON.stringify({ version: 2, entries: [] }));
    ({ root } = mount());
    openScenarios(root);
    expect(root.querySelector('#sc-notice')!.textContent).toBe(SCENARIO_TEXT.unreadable);
    expect(btn(root, '#sc-save').disabled).toBe(true);

    // a readable list: no clear button
    store.setItem(SCENARIOS_KEY, JSON.stringify({ version: 1, entries: [] }));
    ({ root } = mount());
    openScenarios(root);
    expect(btn(root, '#sc-clear').hidden).toBe(true);
    expect(root.querySelector<HTMLElement>('#sc-notice')!.hidden).toBe(true);
    expect(btn(root, '#sc-save').disabled).toBe(false);
  });

  it('A10 Einzelne unlesbare Einträge: Zusatz „nicht lesbar“, Abrufen und Aktualisieren aus, Löschen aktiv; übrige bleiben nutzbar', () => {
    seed([entryFor('Angebot A'), { name: 'X', savedAt: OLD, inputs: 'x' }, { name: 'Y', savedAt: OLD, inputs: { version: 2 } }]);
    const { root } = mount();
    openScenarios(root);
    const items = [...root.querySelectorAll<HTMLElement>('.scenario-item')];
    expect(items.map((li) => li.querySelector('.scenario-name')!.textContent)).toEqual(['Angebot A', 'X', 'Y']);
    expect(items.map((li) => li.textContent!.includes('nicht lesbar'))).toEqual([false, true, true]);
    for (const li of items.slice(1)) {
      expect(li.querySelector<HTMLButtonElement>('[data-sc-recall]')!.disabled).toBe(true);
      expect(li.querySelector<HTMLButtonElement>('[data-sc-update]')!.disabled).toBe(true);
      expect(li.querySelector<HTMLButtonElement>('[data-sc-delete]')!.disabled).toBe(false);
    }
    btn(root, '[data-sc-delete="1"]').click();
    expect(privacyTitle(root)).toBe('„X“ endgültig löschen?');
    confirmOk(root);
    expect(names()).toEqual(['Angebot A', 'Y']);
    expect(btn(root, '[data-sc-recall="0"]').disabled).toBe(false);
  });

  it('F37.12 Abrufen eines inzwischen unlesbar gewordenen Eintrags (anderer Tab) wird abgelehnt, ohne Ausnahme und ohne Änderung', () => {
    seed([entryFor('Angebot A', (i) => (i.heatPump.jaz = 3.2))]);
    const { root, app } = mount();
    setValue(root, 'heatPump.jaz', '4');
    openScenarios(root);
    // another tab damages the entry while the dialog still shows it as readable
    seed([{ name: 'Angebot A', savedAt: OLD, inputs: 'x' }]);
    btn(root, '[data-sc-recall="0"]').click();
    confirmOk(root);
    expect(app.getInputs().heatPump.jaz).toBe(4);
    expect(status(root)).toBe('Die gespeicherten Szenarien haben sich inzwischen geändert. Bitte die Auswahl erneut treffen.');
    // deleting such an entry still works
    btn(root, '[data-sc-delete="0"]').click();
    confirmOk(root);
    expect(names()).toEqual([]);
  });

  it('F37.12 Eintrag ohne Namen steht als „Unbenannter Eintrag“; ungültiges savedAt als „Stand unbekannt“', () => {
    seed([{ savedAt: 'kaputt', inputs: JSON.parse(exportJson(defaults())) }]);
    const { root } = mount();
    openScenarios(root);
    const li = root.querySelector('.scenario-item')!;
    expect(li.querySelector('.scenario-name')!.textContent).toBe('Unbenannter Eintrag');
    expect(li.textContent).toContain('nicht lesbar');
    expect(li.textContent).toContain('Stand unbekannt');
    // deleting the unnamed entry: the question and the status use the placeholder name
    btn(root, '[data-sc-delete="0"]').click();
    expect(privacyTitle(root)).toBe('„Unbenannter Eintrag“ endgültig löschen?');
    confirmOk(root);
    expect(status(root)).toBe('„Unbenannter Eintrag“ gelöscht.');
    expect(listText(root)).toContain('Noch keine Szenarien gespeichert.');
  });

  it('A11 Speicher voll: Text, keine unbehandelte Ausnahme, Rechner rechnet weiter; Löschen ohne Schreibrecht meldet den Fehler', () => {
    const full = new FullStorage();
    const { root, app } = mountWith(full);
    setName(root, 'Angebot A');
    saveNow(root);
    expect(status(root)).toBe(SCENARIO_TEXT.saveFailed);
    expect(full.getItem(SCENARIOS_KEY)).toBeNull();
    expect(app.lastResult()).not.toBeNull();

    // list stored before the storage became full: writing fails, reading works
    const readOnly = new FullStorage();
    MemoryStorage.prototype.setItem.call(readOnly, SCENARIOS_KEY, serializeScenarioFile([entryFor('Angebot A')]));
    const { root: r2 } = mountWith(readOnly);
    openScenarios(r2);
    btn(r2, '[data-sc-delete="0"]').click();
    confirmOk(r2);
    expect(status(r2)).toBe('Der Browser-Speicher ist nicht verfügbar. Das Szenario wurde nicht gelöscht.');
    expect(JSON.parse(readOnly.getItem(SCENARIOS_KEY)!).entries).toHaveLength(1);
  });

  it('A11 Speicher nicht verfügbar (null): Hinweis schon beim Öffnen; Speichern meldet den Text', () => {
    const { root, app } = mountWith(null);
    openScenarios(root);
    expect(root.querySelector('#sc-notice')!.textContent).toBe(SCENARIO_TEXT.unavailable);
    setName(root, 'Angebot A');
    btn(root, '#sc-save').click();
    expect(status(root)).toBe(SCENARIO_TEXT.saveFailed);
    expect(app.lastResult()).not.toBeNull();
  });

  it('A12 Vergleich: gespeicherte Szenarien und Datei ergeben drei Varianten, vierte wird abgelehnt; Änderung des Eintrags wirkt nicht', async () => {
    seed([entryFor('Angebot A', (i) => (i.heatPump.jaz = 3.2)), entryFor('Angebot B', (i) => (i.heatPump.jaz = 3.4))]);
    const { root, app } = mount();
    btn(root, '#btn-variants').click();
    btn(root, '#var-saved-btn').click();
    expect(root.querySelector<HTMLElement>('#var-saved')!.hidden).toBe(false);
    expect(root.querySelectorAll('[data-var-saved]')).toHaveLength(2);
    btn(root, '[data-var-saved="0"]').click();
    btn(root, '[data-var-saved="1"]').click();
    expect(app.getVariants()).toEqual(['Angebot A', 'Angebot B']);
    // a file whose name is taken by a saved scenario is numbered like any other duplicate
    const d = defaults();
    d.scenario.name = 'Angebot A';
    const input = root.querySelector<HTMLInputElement>('#var-file-input')!;
    Object.defineProperty(input, 'files', {
      value: [new File([JSON.stringify({ ...d, version: 1 })], 'Angebot A.json', { type: 'application/json' })],
      configurable: true,
    });
    input.dispatchEvent(new Event('change'));
    await new Promise((r) => setTimeout(r, 20));
    expect(app.getVariants()).toEqual(['Angebot A', 'Angebot B', 'Angebot A (2)']);
    // the fourth one is refused
    btn(root, '[data-var-saved="0"]').click();
    expect(app.getVariants()).toHaveLength(3);
    expect(root.querySelector('#var-status')!.textContent).toBe(VARIANTS_LIMIT_TEXT);
    // the saved entry changes: the variant stays as it was compared
    seed([entryFor('Angebot A', (i) => (i.heatPump.jaz = 4.5)), entryFor('Angebot B', (i) => (i.heatPump.jaz = 3.4))]);
    btn(root, '[data-var-remove="2"]').click();
    const jazCells = [...root.querySelectorAll('#var-result .variants-table tbody tr')]
      .find((r) => r.textContent!.includes('Jahresarbeitszahl'))!
      .querySelectorAll('td');
    expect([...jazCells].map((c) => c.textContent)).toEqual(['3,2', '3,4']);
  });

  it('F31.4 Hinzufügen nach Löschen im anderen Tab: der angezeigte Name muss stimmen, sonst „geändert“ und nichts wird hinzugefügt', () => {
    seed([entryFor('Angebot A'), entryFor('Angebot B')]);
    const { root, app } = mount();
    btn(root, '#btn-variants').click();
    btn(root, '#var-saved-btn').click();
    // the list shows "Angebot A" at position 0; another tab deletes it, so "Angebot B" moves to position 0
    seed([entryFor('Angebot B')]);
    btn(root, '[data-var-saved="0"]').click();
    expect(app.getVariants()).toEqual([]);
    expect(root.querySelector('#var-status')!.textContent).toBe(SCENARIO_TEXT.changed);
  });

  it('F37.10 Speicher nicht lesbar: Speichern schreibt nichts und meldet den Fehler; Aktualisieren und Löschen melden ihren Text', () => {
    class BrokenRead extends MemoryStorage {
      broken = false;
      written: string[] = [];
      getItem(k: string) {
        if (this.broken) throw new Error('SecurityError');
        return super.getItem(k);
      }
      setItem(k: string, v: string) {
        this.written.push(k);
        super.setItem(k, v);
      }
    }
    const b = new BrokenRead();
    const keptNames = () => (JSON.parse(b.getItem(SCENARIOS_KEY)!).entries as { name: string }[]).map((e) => e.name);
    MemoryStorage.prototype.setItem.call(b, SCENARIOS_KEY, serializeScenarioFile([entryFor('Angebot A')]));
    const { root } = mountWith(b);
    openScenarios(root);
    b.broken = true;
    // saving while the list cannot be read: nothing is written, the entry is not replaced
    setName(root, 'Angebot A');
    btn(root, '#sc-save').click();
    expect(status(root)).toBe(SCENARIO_TEXT.saveFailed);
    expect(b.written.filter((k) => k === SCENARIOS_KEY)).toEqual([]);
    b.broken = false;
    expect(keptNames()).toEqual(['Angebot A']);

    // stale buttons: the list is drawn while the storage works, then it fails before the click
    b.broken = false;
    openScenarios(root);
    b.broken = true;
    btn(root, '[data-sc-update="0"]').click();
    confirmOk(root);
    expect(status(root)).toBe(SCENARIO_TEXT.saveFailed);
    b.broken = false;
    openScenarios(root);
    b.broken = true;
    btn(root, '[data-sc-delete="0"]').click();
    confirmOk(root);
    expect(status(root)).toBe(SCENARIO_TEXT.deleteFailed);
    b.broken = false;
    expect(b.written.filter((k) => k === SCENARIOS_KEY)).toEqual([]);
    expect(keptNames()).toEqual(['Angebot A']);
  });

  it('A14 Name im Formular ist auf 200 Zeichen begrenzt (maxlength)', () => {
    const { root } = mount();
    expect(root.querySelector('[data-path="scenario.name"]')!.getAttribute('maxlength')).toBe('200');
  });

  it('F31.4 Speicher nicht verfügbar: der Vergleich zeigt den Hinweis beim Öffnen der Auswahl', () => {
    const { root } = mountWith(null);
    btn(root, '#btn-variants').click();
    btn(root, '#var-saved-btn').click();
    expect(root.querySelector('#var-saved-note')!.textContent).toBe(SCENARIO_TEXT.unavailable);
  });

  it('F31.4 Hinzufügen eines Eintrags mit korrigierten Werten meldet die Zahl der Korrekturen', () => {
    seed([entryFor('Angebot A', (i) => (i.heatPump.jaz = 99))]);
    const { root, app } = mount();
    btn(root, '#btn-variants').click();
    btn(root, '#var-saved-btn').click();
    btn(root, '[data-var-saved="0"]').click();
    expect(app.getVariants()).toEqual(['Angebot A']);
    expect(root.querySelector('#var-status')!.textContent).toBe('„Angebot A“ hinzugefügt. (1 Wert(e) korrigiert)');
  });

  it('F37.10 Aktualisieren bei vollem Speicher: Fehlertext, Eintrag bleibt unverändert', () => {
    const full = new FullStorage();
    MemoryStorage.prototype.setItem.call(full, SCENARIOS_KEY, serializeScenarioFile([entryFor('Angebot A')]));
    const before = full.getItem(SCENARIOS_KEY);
    const { root } = mountWith(full);
    openScenarios(root);
    btn(root, '[data-sc-update="0"]').click();
    confirmOk(root);
    expect(status(root)).toBe(SCENARIO_TEXT.saveFailed);
    expect(full.getItem(SCENARIOS_KEY)).toBe(before);
  });

  it('F37.11 Liste wird zwischen Öffnen und Speichern unlesbar: Fehlertext, Inhalt bleibt Byte für Byte gleich', () => {
    seed([entryFor('Angebot A')]);
    const { root } = mount();
    openScenarios(root);
    store.setItem(SCENARIOS_KEY, '{kaputt');
    setName(root, 'Angebot B');
    btn(root, '#sc-save').click();
    expect(status(root)).toBe(SCENARIO_TEXT.unreadable);
    expect(root.querySelector('#sc-status')!.classList.contains('is-error')).toBe(true);
    expect(store.getItem(SCENARIOS_KEY)).toBe('{kaputt');
  });

  it('F37.5 Klick auf die Liste selbst (nicht auf eine Schaltfläche) tut nichts', () => {
    seed([entryFor('Angebot A')]);
    const { root } = mount();
    openScenarios(root);
    (root.querySelector('.scenarios-list') as HTMLElement).click();
    expect(privacy(root).open).toBe(false);
    expect(names()).toEqual(['Angebot A']);
  });

  it('F31.4 Klick auf die Auswahlliste selbst tut nichts', () => {
    seed([entryFor('Angebot A')]);
    const { root, app } = mount();
    btn(root, '#btn-variants').click();
    btn(root, '#var-saved-btn').click();
    (root.querySelector('#var-saved-list') as HTMLElement).click();
    expect(app.getVariants()).toEqual([]);
  });

  it('F31.4 Hinzufügen nach Leeren im anderen Tab: Index außerhalb der Liste wird als „geändert“ gemeldet', () => {
    seed([entryFor('Angebot A')]);
    const { root, app } = mount();
    btn(root, '#btn-variants').click();
    btn(root, '#var-saved-btn').click();
    seed([]);
    btn(root, '[data-var-saved="0"]').click();
    expect(app.getVariants()).toEqual([]);
    expect(root.querySelector('#var-status')!.textContent).toBe(SCENARIO_TEXT.changed);
  });

  it('A13 Ohne gespeicherte Szenarien: „Noch keine Szenarien gespeichert.“; nicht lesbar: Hinweis aus F31.4', () => {
    const { root } = mount();
    btn(root, '#btn-variants').click();
    btn(root, '#var-saved-btn').click();
    expect(root.querySelector('#var-saved-note')!.textContent).toBe('Noch keine Szenarien gespeichert.');
    expect(root.querySelectorAll('[data-var-saved]')).toHaveLength(0);
    expect(root.querySelector('#var-result')!.textContent).toBe('');
    expect(root.querySelector('#variants .intro-lead')!.textContent).toContain('gespeicherte Szenarien');

    store.setItem(SCENARIOS_KEY, '{kaputt');
    const again = mount();
    btn(again.root, '#btn-variants').click();
    btn(again.root, '#var-saved-btn').click();
    expect(again.root.querySelector('#var-saved-note')!.textContent).toBe(
      'Die gespeicherten Szenarien sind nicht lesbar. Sie lassen sich unter „Gespeicherte Szenarien“ leeren.',
    );
  });

  it('A15 Tab-Reihenfolge bei lesbarer Liste: ×, Speichern, je Eintrag Abrufen/Aktualisieren/Löschen, Schließen; Fokus sichtbar (kein outline: none)', () => {
    seed([entryFor('Angebot A')]);
    const { root } = mount();
    openScenarios(root);
    const focusable = () =>
      [...scDlg(root).querySelectorAll('button')]
        .filter((b) => !b.disabled && !b.closest('[hidden]'))
        .map((b) => b.getAttribute('aria-label') ?? b.textContent!.trim());
    expect(focusable()).toEqual(['Schließen', 'Aktuelle Eingaben speichern', 'Angebot A abrufen', 'Angebot A aktualisieren', 'Angebot A löschen', 'Schließen']);
    scDlg(root).close();

    store.setItem(SCENARIOS_KEY, '{kaputt');
    const again = mount();
    openScenarios(again.root);
    expect(
      [...scDlg(again.root).querySelectorAll('button')]
        .filter((b) => !b.disabled && !b.closest('[hidden]'))
        .map((b) => b.getAttribute('aria-label') ?? b.textContent!.trim()),
    ).toEqual(['Schließen', 'Gespeicherte Szenarien leeren', 'Schließen']);
    const css = readFileSync(resolve('src/style.css'), 'utf8');
    expect(css).not.toMatch(/outline:\s*(none|0)\b/);
  });

  it('A15 Lange Namen brechen im Dialog um (400 px ohne horizontalen Überlauf, geprüft über die Regeln)', () => {
    const css = readFileSync(resolve('src/style.css'), 'utf8');
    expect(css).toMatch(/\.scenario-info \{[^}]*min-width: 0/);
    expect(css).toMatch(/\.scenario-info \{[^}]*overflow-wrap: anywhere/);
    expect(css).toMatch(/\.scenario-item \{[^}]*flex-wrap: wrap/);
  });

  it('A17 Zwei Tabs: die Liste wird vor jedem Schreiben neu gelesen; beide Einträge bleiben', () => {
    document.body.innerHTML = '<div id="a"></div><div id="b"></div>';
    const rootA = document.getElementById('a')!;
    const rootB = document.getElementById('b')!;
    mountApp(rootA, { storage: store, today: TODAY, debounceMs: 0 });
    mountApp(rootB, { storage: store, today: TODAY, debounceMs: 0 });
    openScenarios(rootA); // dialog open in tab 1
    setName(rootB, 'B');
    saveNow(rootB); // tab 2 saves "B"
    setName(rootA, 'A');
    saveNow(rootA); // tab 1 saves "A" and must not overwrite "B"
    expect(names()).toEqual(['B', 'A']);
    expect(listText(rootA)).toContain('B');
    expect(listText(rootA)).toContain('A');
  });

  it('A18 Zurücksetzen lässt die gespeicherten Szenarien unverändert', () => {
    seed([entryFor('Angebot A')]);
    const before = store.getItem(SCENARIOS_KEY);
    const { root } = mount();
    btn(root, '#btn-reset').click();
    confirmOk(root);
    expect(store.getItem(SCENARIOS_KEY)).toBe(before);
  });

  it('A19 Ein Name mit HTML erscheint als Text in Liste, Rückfragen und Vergleich; nichts wird ausgeführt', () => {
    const evil = '<img src=x onerror=alert(1)>';
    const { root } = mount();
    setName(root, evil);
    saveNow(root);
    expect(root.querySelector('#sc-list img')).toBeNull();
    expect(root.querySelector('.scenario-name')!.textContent).toBe(evil);
    btn(root, '[data-sc-delete="0"]').click();
    expect(privacyTitle(root)).toBe(`„${evil}“ endgültig löschen?`);
    expect(root.querySelector('#privacy-title img')).toBeNull();
    confirmCancel(root);
    btn(root, '#btn-variants').click();
    btn(root, '#var-saved-btn').click();
    expect(root.querySelector('#var-saved-list img')).toBeNull();
    expect(root.querySelector('#var-saved-list')!.textContent).toContain(evil);
  });

  it('A20 Unlesbare Liste leeren: Abbrechen/Esc lässt alles; Leeren entfernt nur die Liste; danach speichern wieder möglich', () => {
    store.setItem(SCENARIOS_KEY, '{kaputt');
    store.setItem(THEME_KEY, 'dark');
    const { root } = mount();
    store.setItem(STORAGE_KEY, JSON.stringify(defaults()));
    const v1 = store.getItem(STORAGE_KEY);
    openScenarios(root);
    btn(root, '#sc-clear').click();
    expect(privacyTitle(root)).toBe('Alle gespeicherten Szenarien endgültig löschen?');
    confirmCancel(root);
    expect(store.getItem(SCENARIOS_KEY)).toBe('{kaputt');
    btn(root, '#sc-clear').click();
    confirmOk(root);
    expect(store.getItem(SCENARIOS_KEY)).toBeNull();
    expect(store.getItem(STORAGE_KEY)).toBe(v1);
    expect(store.getItem(THEME_KEY)).toBe('dark');
    expect(listText(root)).toContain('Noch keine Szenarien gespeichert.');
    expect(status(root)).toBe('Gespeicherte Szenarien geleert.');
    expect(btn(root, '#sc-save').disabled).toBe(false);
    setName(root, 'Neu');
    btn(root, '#sc-save').click();
    expect(JSON.parse(store.getItem(SCENARIOS_KEY)!)).toMatchObject({ version: 1, entries: [{ name: 'Neu' }] });
  });

  it('A20 Leeren scheitert: Meldung, Speicher unverändert', () => {
    const ns = new NoRemoveStorage();
    ns.setItem(SCENARIOS_KEY, '{kaputt');
    const { root } = mountWith(ns);
    openScenarios(root);
    btn(root, '#sc-clear').click();
    confirmOk(root);
    expect(status(root)).toBe('Der Browser-Speicher ist nicht verfügbar. Die gespeicherten Szenarien wurden nicht gelöscht.');
    expect(ns.getItem(SCENARIOS_KEY)).toBe('{kaputt');
  });

  it('A16 Das Default-Szenario liefert dieselben Ergebnisse, auch nach Speichern und Abrufen', () => {
    const { root, app } = mount();
    const before = JSON.stringify(app.lastResult()!.run);
    saveNow(root);
    setName(root, 'Standard');
    saveNow(root);
    btn(root, '[data-sc-recall="0"]').click();
    confirmOk(root);
    expect(JSON.stringify(app.lastResult()!.run)).toBe(before);
  });

  it('F37.13 Viele Einträge werden alle angezeigt', () => {
    seed(Array.from({ length: 30 }, (_, n) => entryFor(`Szenario ${n}`)));
    const { root } = mount();
    openScenarios(root);
    expect(root.querySelectorAll('.scenario-item')).toHaveLength(30);
  });

  it('F22.4 Abgerufenes Szenario mit früherem Standardwert meldet „Seit das Szenario gespeichert wurde“ und speichert den alten Stand weiter', () => {
    const previous = DEFAULT_CHANGES[0].previous['oldHeating.maintenance'] as number;
    expect(defaults().oldHeating.maintenance).not.toBe(previous);
    const e = entryFor('Alt', (i) => (i.oldHeating.maintenance = previous));
    (e.inputs as Record<string, unknown>).defaultsAsOf = '2026-11-17';
    seed([e]);
    const { root, app } = mount();
    openScenarios(root);
    btn(root, '[data-sc-recall="0"]').click();
    confirmOk(root);
    expect(root.querySelector('.notice-defaults')!.textContent).toContain('Seit das Szenario gespeichert wurde');
    expect(app.getInputs().oldHeating.maintenance).toBe(previous);
    expect(JSON.parse(store.getItem(STORAGE_KEY)!).defaultsAsOf).toBe('2026-11-17');
  });
});

describe('F1.5/F9.5 Antragsmonat in gespeicherten Szenarien und Varianten (AK8)', () => {
  /** Stored entry with the former lead time (leadMonths 2, commissioning 2027-05) instead of applicationMonth. */
  const oldLeadEntry = (name: string) => {
    const e = entryFor(name, (i) => (i.heatPump.installMonth = '2027-05')) as { name: string; savedAt: string; inputs: Record<string, any> };
    delete e.inputs.heatPump.applicationMonth;
    e.inputs.heatPump.leadMonths = 2;
    return e;
  };

  it('AK8 F37.6 Abrufen eines Szenarios mit leadMonths 2: fester Antragsmonat 03/2027 und Meldung', () => {
    seed([oldLeadEntry('Altes Angebot')]);
    const { root, app } = mount();
    openScenarios(root);
    btn(root, '[data-sc-recall="0"]').click();
    confirmOk(root);
    expect(app.getInputs().heatPump.applicationMonth).toBe('2027-03');
    expect(root.querySelector<HTMLInputElement>('[data-path="heatPump.applicationMonth"]')!.value).toBe('2027-03');
    expect(root.querySelector('#notice')!.textContent).toContain('03/2027');
    expect(root.querySelector('#notice')!.textContent).toContain('dem gespeicherten Szenario');
  });

  it('AK8 F31.4 Variante aus einem Szenario mit leadMonths 2: festgelegter Antragsmonat, eine Korrektur gemeldet', () => {
    seed([oldLeadEntry('Altes Angebot')]);
    const { root } = mount();
    btn(root, '#btn-variants').click();
    btn(root, '#var-saved-btn').click();
    btn(root, '[data-var-saved="0"]').click();
    expect(root.querySelector('#var-status')!.textContent).toBe('„Altes Angebot“ hinzugefügt. (1 Wert(e) korrigiert)');
    // Second variant (current inputs, automatic month) so that the comparison shows the differing month
    btn(root, '#var-current').click();
    expect(root.querySelector('#var-result')!.textContent).toContain('03/2027');
  });
});
