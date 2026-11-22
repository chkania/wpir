import { deflateSync } from 'fflate';
import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseMonth } from '../src/core/dates';
import { runAll } from '../src/core/simulation';
import type { InputIssue } from '../src/core/validate';
import { cleanScenarioName, decodeHash, diffInputs, encodeHash, exportFileName, exportJson, fileSlug, importJson, mergeInputs } from '../src/core/serialize';
import { defaults } from './helpers';

describe('F9 Persistenz', () => {
  it('Link: nur Abweichungen, Roundtrip inkl. Umlaute', () => {
    const d = defaults();
    const i = defaults();
    i.oldHeating.fuel = 'oil';
    i.prices.co2Path = '2026:55, 2030:150 ÄÖÜ';
    i.heatPump.jaz = 3.8;
    expect(diffInputs(d, i)).toEqual({
      oldHeating: { fuel: 'oil' },
      prices: { co2Path: '2026:55, 2030:150 ÄÖÜ' },
      heatPump: { jaz: 3.8 },
    });
    const hash = encodeHash(d, i);
    expect(hash).toMatch(/^#z=[A-Za-z0-9_-]+$/);
    expect(decodeHash(d, hash)).toEqual(i);
  });

  it('F9.2 komprimierter Link („#z=“) ist deutlich kürzer; ältere Links („#s=“) bleiben lesbar', () => {
    const d = defaults();
    const i = defaults();
    i.scenario.name = 'Angebot A';
    i.oldHeating.consumption = 15000;
    i.heatPump.investment = 38000;
    i.heatPump.pvKwp = 8;
    i.financing.kfwEquity = 5000;
    i.prices.co2Path = '2026:55, 2027:65, 2028:90, 2030:130, 2035:180';
    const json = JSON.stringify(diffInputs(d, i));
    const old = '#s=' + Buffer.from(json).toString('base64url');
    expect(decodeHash(d, old)).toEqual(i);
    expect(encodeHash(d, i).length).toBeLessThan(old.length * 0.85);
  });

  it('F9.2 manipulierter komprimierter Link mit riesigem Inhalt wird abgelehnt', () => {
    const bomb = deflateSync(new Uint8Array(5 * 1024 * 1024).fill(32), { level: 9 });
    expect(decodeHash(defaults(), '#z=' + Buffer.from(bomb).toString('base64url'))).toBeNull();
  });

  it('ungültiger Hash → null', () => {
    const d = defaults();
    expect(decodeHash(d, '')).toBeNull();
    expect(decodeHash(d, '#s=%%%')).toBeNull();
    expect(decodeHash(d, '#s=bm9wZQ')).toBeNull(); // "nope"
    expect(decodeHash(d, '#z=bm9wZQ')).toBeNull(); // no valid DEFLATE
  });

  it('Merge: unbekannte Felder ignoriert, falsche Typen → Default, fehlende → Default', () => {
    const d = defaults();
    const m = mergeInputs(d, {
      foo: 1,
      heatPump: { jaz: 'viel', investment: 25000, unknown: true },
      building: { ownerOccupied: 'ja' },
      general: { horizonYears: Number.NaN },
    });
    expect(m.heatPump.jaz).toBe(d.heatPump.jaz);
    expect(m.heatPump.investment).toBe(25000);
    expect(m.building.ownerOccupied).toBe(true);
    expect(m.general.horizonYears).toBe(20);
    expect((m as unknown as Record<string, unknown>).foo).toBeUndefined();
  });

  it('JSON Export/Import Roundtrip und Fehler', () => {
    const d = defaults();
    const i = defaults();
    i.building.units = 3;
    expect(importJson(d, exportJson(i))).toEqual(i);
    expect(() => importJson(d, '{kaputt')).toThrow(/JSON/);
    expect(() => importJson(d, '{"version":2}')).toThrow(/version/);
  });
});

describe('F28 früherer fester PV-Anteil', () => {
  it('wird ignoriert, mit Hinweis auf die Leistung der PV-Anlage', () => {
    const issues: { path: string; reason: string }[] = [];
    const i = mergeInputs(defaults(), { heatPump: { pvShare: 0.25 } }, issues);
    expect(i.heatPump.pvKwp).toBe(0);
    expect(issues).toEqual([{ path: 'heatPump.pvKwp', reason: expect.stringContaining('feste PV-Anteil (25 %)') }]);
    const none: unknown[] = [];
    mergeInputs(defaults(), { heatPump: { pvShare: 0 } }, none as never);
    expect(none).toEqual([]);
  });
});

describe('F16 Szenario-Beschreibung', () => {
  const now = new Date(2026, 10, 12);

  it('Export-Dateiname mit Bezeichnung, Umlaute umgeschrieben', () => {
    const i = defaults();
    expect(exportFileName(i, now)).toBe('waermepumpe-rechner-2026-11.json');
    i.scenario.name = '  Angebot Müller / Herbst 2027 – 12 kW!  ';
    expect(exportFileName(i, now)).toBe('waermepumpe-rechner-Angebot-Mueller-Herbst-2027-12-kW-2026-11.json');
    expect(fileSlug('Größe Öl Straße')).toBe('Groesse-Oel-Strasse');
    expect(fileSlug('Café')).toBe('Cafe');
    expect(fileSlug('???')).toBe('');
    expect(fileSlug('x'.repeat(100))).toHaveLength(60);
  });

  it('Bezeichnung und Bemerkungen im Export und Link, ältere Dateien ohne Felder importierbar', () => {
    const d = defaults();
    const i = defaults();
    i.scenario.name = 'Variante B';
    i.scenario.notes = 'Zeile 1\nZeile 2 – äöü';
    expect(importJson(d, exportJson(i)).scenario).toEqual(i.scenario);
    expect(decodeHash(d, encodeHash(d, i))!.scenario).toEqual(i.scenario);
    const old = JSON.parse(exportJson(defaults()));
    delete old.scenario;
    expect(importJson(d, JSON.stringify(old)).scenario).toEqual({ name: '', notes: '', documents: [] });
  });
});

describe('F37 Gespeicherte Szenarien – Bezeichnung', () => {
  it('A14 Name mit 201 Zeichen und Leerzeichen am Rand wird bereinigt und auf 200 Zeichen gekürzt; Nicht-Text ergibt leer', () => {
    expect(cleanScenarioName(` ${'a'.repeat(201)} `)).toBe('a'.repeat(200));
    expect(cleanScenarioName('   ')).toBe('');
    expect(cleanScenarioName('  Angebot A  ')).toBe('Angebot A');
    expect(cleanScenarioName(42)).toBe('');
    expect(cleanScenarioName(undefined)).toBe('');
  });

  it('F37.2 exportJson übernimmt den Stand der Standardwerte, wenn er angegeben wird', () => {
    expect(JSON.parse(exportJson(defaults(), '2026-11-17')).defaultsAsOf).toBe('2026-11-17');
    expect(JSON.parse(exportJson(defaults())).defaultsAsOf).toBe('2026-11-18');
  });
});

const oldLink = (data: unknown) => '#s=' + Buffer.from(JSON.stringify(data)).toString('base64url');

describe('F1.5/F9.5 Antragsmonat: Migration und Prüfung (AK7, AK8, AK9)', () => {
  it('AK7 Link mit leadMonths 4 oder ohne Feld: leerer Antragsmonat, ohne Meldung', () => {
    const d = defaults();
    const issues4: InputIssue[] = [];
    expect(decodeHash(d, oldLink({ heatPump: { leadMonths: 4 } }), issues4)!.heatPump.applicationMonth).toBe('');
    expect(issues4).toEqual([]);
    const issuesNone: InputIssue[] = [];
    expect(decodeHash(d, oldLink({ heatPump: { jaz: 3.5 } }), issuesNone)!.heatPump.applicationMonth).toBe('');
    expect(issuesNone).toEqual([]);
  });

  it('AK7 Link mit leadMonths 2 und Inbetriebnahme 2027-05: fester Antrag 2027-03, mit Meldung, Rechnung wie bisher', () => {
    const d = defaults();
    const issues: InputIssue[] = [];
    const inp = decodeHash(d, oldLink({ heatPump: { installMonth: '2027-05', leadMonths: 2 } }), issues)!;
    expect(inp.heatPump.applicationMonth).toBe('2027-03');
    expect(issues.map((x) => x.path)).toEqual(['heatPump.applicationMonth']);
    expect(issues[0].reason).toContain('03/2027');
    expect(runAll(inp).kfw!.kfw!.appMonth).toBe(parseMonth('2027-03'));
  });

  it('AK7 leadMonths außerhalb der Grenzen wird geklemmt, wie bisher (0 … 120)', () => {
    const d = defaults();
    const issues: InputIssue[] = [];
    const inp = mergeInputs(d, { heatPump: { installMonth: '2027-05', leadMonths: 500 } }, issues);
    expect(inp.heatPump.applicationMonth).toBe('2017-05');
    expect(issues).toHaveLength(1);
  });

  it('AK7 leadMonths 0: fester Antrag im Einbaumonat, gemeldet', () => {
    const issues: InputIssue[] = [];
    const inp = mergeInputs(defaults(), { heatPump: { installMonth: '2027-05', leadMonths: 0 } }, issues);
    expect(inp.heatPump.applicationMonth).toBe('2027-05');
    expect(issues).toHaveLength(1);
  });

  it('AK7 Vorlauf ohne Inbetriebnahme im Datensatz: Umrechnung mit dem Standard-Einbaumonat (2027-05 – 2 = 2027-03)', () => {
    const issues: InputIssue[] = [];
    const inp = mergeInputs(defaults(), { heatPump: { leadMonths: 2 } }, issues);
    expect(inp.heatPump.applicationMonth).toBe('2027-03');
    expect(issues).toHaveLength(1);
  });

  it('AK7 Vorlauf, der keine Zahl ist: Standardwert (leer) mit Meldung', () => {
    const issues: InputIssue[] = [];
    const inp = mergeInputs(defaults(), { heatPump: { leadMonths: 'vier' } }, issues);
    expect(inp.heatPump.applicationMonth).toBe('');
    expect(issues.map((x) => x.path)).toEqual(['heatPump.applicationMonth']);
  });

  it('AK7 vorhandener applicationMonth hat Vorrang vor leadMonths', () => {
    const issues: InputIssue[] = [];
    const inp = mergeInputs(defaults(), { heatPump: { installMonth: '2027-05', leadMonths: 2, applicationMonth: '2027-02' } }, issues);
    expect(inp.heatPump.applicationMonth).toBe('2027-02');
    expect(issues).toEqual([]);
  });

  it('AK8 alte Beispieldateien (leadMonths statt applicationMonth) laden ohne Fehler; Version bleibt 1', () => {
    const dir = new URL('../beispiele/', import.meta.url);
    const files = readdirSync(dir).filter((f) => f.endsWith('.json'));
    expect(files.length).toBeGreaterThanOrEqual(5);
    for (const f of files) {
      const data = JSON.parse(readFileSync(new URL(f, dir), 'utf8'));
      delete data.heatPump.applicationMonth;
      data.heatPump.leadMonths = 4;
      const issues: InputIssue[] = [];
      const inp = importJson(defaults(), JSON.stringify(data), issues);
      expect(inp.version).toBe(1);
      expect(inp.heatPump.applicationMonth).toBe('');
      expect(issues.filter((x) => x.path.startsWith('heatPump.applicationMonth'))).toEqual([]);
    }
  });

  it('AK8 Beispieldateien im aktuellen Format laden ohne Meldung zum Antragsmonat', () => {
    const dir = new URL('../beispiele/', import.meta.url);
    for (const f of readdirSync(dir).filter((x) => x.endsWith('.json'))) {
      const issues: InputIssue[] = [];
      importJson(defaults(), readFileSync(new URL(f, dir), 'utf8'), issues);
      expect(issues.filter((x) => x.path.startsWith('heatPump.applicationMonth'))).toEqual([]);
    }
  });

  it('AK8 Import: alter Vorlauf 4 bleibt Standard, Datei mit Version 1 wird nicht abgelehnt', () => {
    const data = { version: 1, heatPump: { leadMonths: 4 } };
    expect(importJson(defaults(), JSON.stringify(data)).heatPump.applicationMonth).toBe('');
  });

  it('AK9 Export enthält applicationMonth, nicht leadMonths; Export, Import und Link ergeben dieselben Eingaben', () => {
    const i = defaults();
    i.heatPump.installMonth = '2027-05';
    i.heatPump.applicationMonth = '2027-03';
    const json = exportJson(i);
    expect(json).toContain('"applicationMonth": "2027-03"');
    expect(json).not.toContain('leadMonths');
    expect(importJson(defaults(), json)).toEqual(i);
    expect(decodeHash(defaults(), encodeHash(defaults(), i))).toEqual(i);
    const auto = defaults();
    expect(importJson(defaults(), exportJson(auto))).toEqual(auto);
  });
});
