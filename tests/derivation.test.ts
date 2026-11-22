// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { parseMonth } from '../src/core/dates';
import { encodeHash } from '../src/core/serialize';
import { runAll } from '../src/core/simulation';
import type { Inputs } from '../src/core/types';
import { renderDocPage } from '../src/doc-page';
import { renderHelp } from '../src/help';
import { STORAGE_KEY } from '../src/ui/app';
import {
  CALCULATOR_STORAGE_KEY,
  bindDerivation,
  costTableHtml,
  derivationHtml,
  derivationLink,
  loadDerivationInputs,
  monthsCsv,
} from '../src/ui/derivation';
import { fmtEur } from '../src/ui/format';
import { defaults, pinned } from './helpers';

const memory = (data: Record<string, string> = {}) =>
  ({ getItem: (k: string) => data[k] ?? null }) as unknown as Storage;
const text = (html: string) => {
  const d = document.createElement('div');
  d.innerHTML = html;
  return d.textContent!.replace(/[ \t\r\n]+/g, ' ');
};
const page = (mut?: (i: Inputs) => void) => {
  const i = pinned();
  mut?.(i);
  return { i, ...derivationHtml(i, 'hash') };
};

describe('F32 Rechenweg – Eingaben', () => {
  it('aus dem Link, sonst aus dem Speicher des Rechners, sonst Standardwerte', () => {
    const d = defaults();
    const i = defaults();
    i.heatPump.jaz = 4.1;
    expect(CALCULATOR_STORAGE_KEY).toBe(STORAGE_KEY);
    const fromHash = loadDerivationInputs(d, encodeHash(d, i), memory());
    expect(fromHash.source).toBe('hash');
    expect(fromHash.inputs.heatPump.jaz).toBe(4.1);
    const stored = loadDerivationInputs(d, '', memory({ [STORAGE_KEY]: JSON.stringify(i) }));
    expect(stored.source).toBe('storage');
    expect(stored.inputs.heatPump.jaz).toBe(4.1);
    expect(loadDerivationInputs(d, '#z=kaputt!', memory({ [STORAGE_KEY]: '{kaputt' })).source).toBe('default');
    expect(loadDerivationInputs(d, '', null).inputs.heatPump.jaz).toBe(d.heatPump.jaz);
    expect(derivationLink('./rechenweg.html', d, i)).toBe(`./rechenweg.html${encodeHash(d, i)}`);
  });
});

describe('F32 Rechenweg – Inhalt stimmt mit dem Ergebnis überein', () => {
  it('alle Abschnitte im Inhaltsverzeichnis, Kennzahlen wie im Rechner', () => {
    const { html, toc, run } = page();
    expect(toc.map((t) => t.id)).toEqual(['ergebnis', 'energie', 'preise', 'investition', 'kfw-zuschuss', 'steuerbonus', 'finanzierung', 'kosten', 'amortisation', 'co2', 'restwert', 'hinweise']);
    for (const t of toc) expect(html).toContain(`<h2 id="${t.id}">`);
    const t = text(html);
    const best = run.best === 'tax' ? run.tax : run.kfw;
    expect(t).toContain(fmtEur(run.ref.totalCost));
    expect(t).toContain(fmtEur(run.ref.totalCost - best.totalCost));
    expect(t).toContain(fmtEur(run.kfw.kfw!.subsidy));
    expect(t).toContain(fmtEur(run.tax.tax!.total));
    expect(t).toContain('Link zu diesem Rechenweg kopieren');
    expect(t).toContain('Haushaltseinkommen');
  });

  it('Zwischenwerte des Rechenkerns: Investition, Auszahlungen, Jahressummen, CO₂', () => {
    const run = runAll(pinned());
    for (const s of [run.kfw, run.tax]) {
      const v = s.invest!;
      const row = s.months[v.month - s.months[0].month];
      expect(row.investment).toBeCloseTo(v.total + v.cooktop, 6);
      expect(v.total).toBeCloseTo(v.heatPump + v.extra + (pinned().heatPump.meterSetupEligible ? v.meterSetup : 0), 6);
    }
    const sub = run.kfw.months.find((m) => m.subsidy < 0)!;
    expect(sub.month).toBe(run.kfw.subsidyMonth);
    expect(run.tax.taxRefunds!.map((r) => r.amount)).toEqual(run.tax.tax!.yearly.map((y) => y.amount));
    for (const s of [run.ref, run.kfw, run.tax]) {
      expect(s.years.reduce((a, y) => a + y.total, 0)).toBeCloseTo(s.nominalCost, 6);
      expect(s.years.at(-1)!.cumulative).toBeCloseTo(s.totalCost, 6);
      expect(s.months.reduce((a, m) => a + m.co2Kg, 0) / 1000).toBeCloseTo(s.co2Tons, 9);
    }
  });

  it('F32.3 Kosten je Jahr mit aufklappbaren Monaten; leere Spalten ausgeblendet', () => {
    const run = runAll(pinned());
    const html = costTableHtml(run.ref);
    const d = document.createElement('div');
    d.innerHTML = html;
    expect(d.querySelectorAll('tr.year-row')).toHaveLength(run.ref.years.length);
    expect(d.querySelectorAll('tr.month-row[hidden]')).toHaveLength(run.ref.months.length);
    const head = [...d.querySelectorAll('thead th')].map((th) => th.textContent);
    expect(head).toContain('Energie');
    expect(head).not.toContain('Zinsen'); // no loan without a heat pump
    expect(head.at(-1)).toBe('Kumuliert');
    expect(d.querySelector('tr.year-row')!.lastElementChild!.textContent).toBe(fmtEur(run.ref.years[0].cumulative));
  });

  it('Sonderfälle: Öl, PV, Kochen auf Induktion, KfW-Kredit, Mehrfamilienhaus, ohne Restwert', () => {
    const t = text(
      page((i) => {
        i.oldHeating.fuel = 'oil';
        i.oldHeating.consumption = 2000;
        i.heatPump.pvKwp = 6;
        i.financing.useKfwLoan = true;
        i.financing.windfallAmount = 5000;
        i.financing.windfallMonth = '2029-03';
        i.building.units = 3;
        i.general.residualValue = false;
      }).html,
    );
    expect(t).toContain('2.000 l × 10,0 kWh/l');
    expect(t).toContain('davon aus der eigenen PV-Anlage');
    expect(t).toContain('KfW-Ergänzungskredit');
    expect(t).toContain('selbstgenutzte Einheit');
    expect(t).toContain('Restwert ist ausgeschaltet');
    expect(t).toContain('Sondertilgungen');
    const gas = text(
      page((i) => {
        i.oldHeating.cookingWithGas = true;
        i.oldHeating.cookingShare = 0.05;
        i.oldHeating.cookingAfter = 'electric';
      }).html,
    );
    expect(gas).toContain('Induktion, Haushaltsstrom');
    expect(gas).toContain('Neues Kochfeld');
  });

  it('Sonderfälle: vermietet (kein Steuerbonus), Wärmepumpe nach dem Zeitraum', () => {
    const rented = text(page((i) => (i.building.ownerOccupied = false)).html);
    expect(rented).toContain('Der Steuerbonus ist in diesem Fall nicht möglich');
    expect(rented).toContain('nur bei Selbstnutzung');
    const late = text(page((i) => (i.heatPump.installMonth = '2060-01')).html);
    expect(late).toContain('es gibt keine Investition');
    expect(late).toContain('Kein KfW-Zuschuss');
    expect(late).toContain('Kein Steuerbonus');
  });

  it('CSV: Monatswerte mit Semikolon und Dezimalkomma', () => {
    const run = runAll(pinned());
    const csv = monthsCsv(run.kfw);
    const lines = csv.trim().split('\r\n');
    expect(csv.startsWith('﻿Monat;Heizung;')).toBe(true);
    expect(lines).toHaveLength(run.kfw.months.length + 1);
    expect(lines[1]).toMatch(/^11\/2026;Altanlage;\d+,\d{2};/);
    expect(lines.at(-1)!.split(';').at(-1)).toBe(run.kfw.totalCost.toFixed(2).replace('.', ','));
  });
});

describe('F32 Rechenweg – Seite und Bedienung', () => {
  afterEach(() => vi.restoreAllMocks());

  it('Seitenrahmen aus vorbereitetem HTML; Monate auf- und zuklappen; CSV; Link kopieren', async () => {
    const i = pinned();
    const content = derivationHtml(i, 'storage');
    const { html } = renderDocPage({ rendered: content, subtitle: 's' });
    document.body.innerHTML = `<div id="doc">${html}</div>`;
    const root = document.getElementById('doc')!;
    expect(root.querySelector('h1')!.textContent).toBe('Rechenweg');
    expect(root.querySelectorAll('.help-toc li')).toHaveLength(12);
    expect(root.textContent).toContain('in diesem Browser gespeichert');
    const writeText = vi.fn(() => Promise.resolve());
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    const created = vi.fn(() => 'blob:x');
    URL.createObjectURL = created;
    URL.revokeObjectURL = vi.fn();
    const clicked = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    bindDerivation(root, { inputs: i, defaults: defaults(), run: content.run, pageUrl: 'https://example.invalid/rechenweg.html', today: new Date(2026, 10, 11) });

    const toggle = root.querySelector<HTMLButtonElement>('[data-year-toggle="kfw-2027"]')!;
    toggle.click();
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    expect(root.querySelectorAll('[data-year-of="kfw-2027"]:not([hidden])')).toHaveLength(12);
    toggle.click();
    expect(root.querySelectorAll('[data-year-of="kfw-2027"]:not([hidden])')).toHaveLength(0);

    root.querySelector<HTMLButtonElement>('[data-csv="tax"]')!.click();
    expect(created).toHaveBeenCalledTimes(1);
    expect(clicked).toHaveBeenCalledTimes(1);

    root.querySelector<HTMLButtonElement>('#dw-copy')!.click();
    await Promise.resolve();
    expect(writeText).toHaveBeenCalledWith(`https://example.invalid/rechenweg.html${encodeHash(defaults(), i)}`);
    expect(root.querySelector('#dw-copy-status')!.textContent).toBe('Link kopiert.');
  });

  it('Kopieren gesperrt: Link wird zum Abschreiben angezeigt', async () => {
    const i = pinned();
    const content = derivationHtml(i, 'default');
    document.body.innerHTML = `<div id="doc">${content.html}</div>`;
    const root = document.getElementById('doc')!;
    expect(root.textContent).toContain('mit den Standardwerten');
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: () => Promise.reject(new Error('x')) }, configurable: true });
    bindDerivation(root, { inputs: i, defaults: defaults(), run: content.run, pageUrl: 'https://example.invalid/rechenweg.html' });
    root.querySelector<HTMLButtonElement>('#dw-copy')!.click();
    await new Promise((r) => setTimeout(r, 0));
    expect(root.querySelector('#dw-copy-status')!.textContent).toContain('Kopieren nicht möglich – Link: https://example.invalid/rechenweg.html#z=');
  });

  it('Hilfe: Link zum Rechenweg öffnet im selben Tab', () => {
    const { html } = renderHelp('Siehe [Rechenweg](./rechenweg.html) und [Hilfe](./hilfe.html).');
    expect(html).toContain('<a href="./rechenweg.html">Rechenweg</a>');
    expect(html).toContain('<a href="./hilfe.html">Hilfe</a>');
  });
});

describe('F32.2 Rechenweg Antragsmonat (AK10)', () => {
  const rowsText = (html: string) => text(html);
  it('AK10 automatisch: „Inbetriebnahme 05/2027 minus 4 Monate = 01/2027“', () => {
    const i = pinned();
    i.heatPump.installMonth = '2027-05';
    i.heatPump.applicationMonth = '';
    const { html } = derivationHtml(i, 'default');
    expect(rowsText(html)).toContain('automatisch: Inbetriebnahme 05/2027 minus 4 Monate = 01/2027');
  });

  it('AK14 Rechenweg und Ergebnis nennen denselben Antragsmonat aus demselben Lauf (keine zweite Rechnung)', () => {
    const i = pinned();
    i.heatPump.installMonth = '2027-05';
    i.heatPump.applicationMonth = '2027-03';
    const { html, run } = derivationHtml(i, 'default');
    expect(run.kfw.kfw!.appMonth).toBe(parseMonth('2027-03'));
    expect(text(html)).toContain('festgelegt: 03/2027');
  });

  it('AK10 festgelegt: „festgelegt: 03/2027“', () => {
    const i = pinned();
    i.heatPump.installMonth = '2027-05';
    i.heatPump.applicationMonth = '2027-03';
    const { html } = derivationHtml(i, 'default');
    expect(rowsText(html)).toContain('festgelegt: 03/2027');
    expect(rowsText(html)).not.toContain('automatisch: Inbetriebnahme');
  });
});
