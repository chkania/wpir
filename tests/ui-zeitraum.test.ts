// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest';
import { INTRO_KEY, mountApp } from '../src/ui/app';
import { TODAY } from './helpers';

/**
 * Commissioning windows (F1.7, F1.8) in the form and on load. Kept apart from ui.test.ts: the app mounts many
 * times in one worker, and the larger file exhausted the heap of the test worker.
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

describe('F1.7/F1.8 Zeitraum im Formular (AK1, AK2, AK3, AK9)', () => {
  beforeEach(() => {
    store.clear();
    store.setItem(INTRO_KEY, '1');
  });
  const errOf = (root: HTMLElement, path: string) => {
    const err = root.querySelector<HTMLElement>(`#f-${path.replace(/\./g, '-')}-err`)!;
    return err.hidden ? '' : err.textContent;
  };

  it('AK1 Inbetriebnahme nach 12/2030 bei festem Antrag 03/2027: Fehlertext als Text, Feld rot, alter Wert bleibt', () => {
    const { root, app } = mount();
    setValue(root, 'heatPump.applicationMonth', '2027-03');
    setValue(root, 'heatPump.installMonth', '2031-01');
    expect(errOf(root, 'heatPump.installMonth')).toContain('Bitte einen Monat zwischen 03/2027 und 12/2030 angeben');
    expect(root.querySelector('[data-path="heatPump.installMonth"]')!.classList.contains('invalid')).toBe(true);
    expect(app.getInputs().heatPump.installMonth).toBe('2027-05');
  });

  it('AK1 Inbetriebnahme vor dem festen Antrag wird ebenfalls abgewiesen', () => {
    const { root, app } = mount();
    setValue(root, 'heatPump.applicationMonth', '2027-03');
    setValue(root, 'heatPump.installMonth', '2027-02');
    expect(errOf(root, 'heatPump.installMonth')).toContain('zwischen 03/2027 und 12/2030');
    expect(app.getInputs().heatPump.installMonth).toBe('2027-05');
  });

  it('AK2 Antragsmonat, der die Inbetriebnahme außerhalb des Zeitraums bringt: Fehler am Antragsfeld, Wert nicht übernommen', () => {
    const { root, app } = mount();
    setValue(root, 'heatPump.installMonth', '2031-06');
    expect(errOf(root, 'heatPump.installMonth')).toBe('');
    setValue(root, 'heatPump.applicationMonth', '2027-03');
    expect(errOf(root, 'heatPump.applicationMonth')).toContain('Mit diesem Antragsmonat liegt die Inbetriebnahme außerhalb des Zeitraums (bis 12/2030).');
    expect(app.getInputs().heatPump.applicationMonth).toBe('');
  });

  it('AK3 Form: 2030-12 gültig, 2031-01 ungültig bei festem Antrag 2027-03', () => {
    const { root, app } = mount();
    setValue(root, 'heatPump.applicationMonth', '2027-03');
    setValue(root, 'heatPump.installMonth', '2030-12');
    expect(errOf(root, 'heatPump.installMonth')).toBe('');
    expect(app.getInputs().heatPump.installMonth).toBe('2030-12');
    setValue(root, 'heatPump.installMonth', '2031-01');
    expect(errOf(root, 'heatPump.installMonth')).not.toBe('');
  });

  it('AK3 Heizung im Formular (Prüfmonat 2026-11): 2026-11 gültig, 2026-12 abgewiesen mit Zeitraum 01/1986 und 11/2026', () => {
    const { root: r0, app: a0 } = mount();
    setValue(r0, 'oldHeating.installedMonth', '2026-12');
    expect(errOf(r0, 'oldHeating.installedMonth')).toContain('Bitte einen Monat zwischen 01/1986 und 11/2026 angeben');
    expect(a0.getInputs().oldHeating.installedMonth).toBe('2004-11');
    setValue(r0, 'oldHeating.installedMonth', '2026-11');
    expect(errOf(r0, 'oldHeating.installedMonth')).toBe('');
  });

  it('AK3 Heizung im Formular (Prüfjahr 2026): 1986-01 gültig, 1985-12 abgewiesen mit Zeitraum 01/1986 und 11/2026', () => {
    const { root, app } = mount();
    setValue(root, 'oldHeating.installedMonth', '1985-12');
    expect(errOf(root, 'oldHeating.installedMonth')).toContain('Bitte einen Monat zwischen 01/1986 und 11/2026 angeben');
    expect(app.getInputs().oldHeating.installedMonth).toBe('2004-11');
    setValue(root, 'oldHeating.installedMonth', '1986-01');
    expect(errOf(root, 'oldHeating.installedMonth')).toBe('');
  });

  it('AK1 Hinweis am Feld Geplante Inbetriebnahme nennt den Zeitraum bis 12/2030 bei festem Antrag 03/2027', () => {
    const { root } = mount();
    setValue(root, 'heatPump.applicationMonth', '2027-03');
    expect(root.querySelector('[data-field="heatPump.installMonth"] .field-note')!.textContent).toBe('Zulässig bis 12/2030: höchstens drei Jahre nach dem Antragsjahr 2027.');
    setValue(root, 'heatPump.applicationMonth', '');
    expect(root.querySelector('[data-field="heatPump.installMonth"] .field-note')!.textContent).toBe('');
  });

  it('AK9 Antragsmonat-Meldung nennt weiterhin den Bereich 2000 und 2150', () => {
    const { root } = mount();
    setValue(root, 'heatPump.applicationMonth', '1999-01');
    expect(errOf(root, 'heatPump.applicationMonth')).toContain('zwischen 2000 und 2150');
  });

  it('AK9 Heizung 1995-08 bleibt gültig, 1800-01 bei Inbetriebnahme abgewiesen', () => {
    const { root, app } = mount();
    setValue(root, 'oldHeating.installedMonth', '1995-08');
    expect(app.getInputs().oldHeating.installedMonth).toBe('1995-08');
    setValue(root, 'heatPump.installMonth', '1800-01');
    expect(root.querySelector('[data-path="heatPump.installMonth"]')!.classList.contains('invalid')).toBe(true);
  });
});

describe('F7.1 Hinweis, wenn der Zeitpunktvergleich leer bleibt (AK5)', () => {
  beforeEach(() => {
    store.clear();
    store.setItem(INTRO_KEY, '1');
  });
  it('AK5 Antragsmonat 06/2022 und Inbetriebnahme 06/2022: kein Zeitpunkt übrig, Hinweistext mit Grenze', () => {
    const { root } = mount();
    setValue(root, 'heatPump.installMonth', '2022-06');
    setValue(root, 'heatPump.applicationMonth', '2022-06');
    expect(root.querySelector<HTMLElement>('#f-heatPump-applicationMonth-err')!.hidden).toBe(true);
    expect(root.querySelector('#cmp-empty')!.textContent).toContain('Keine Zeitpunkte im Vergleich');
    expect(root.querySelector('#cmp-empty')!.textContent).toContain('12/2025');
  });
});
