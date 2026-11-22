import { describe, expect, it } from 'vitest';
import { keyEvents } from '../src/core/events';
import { decodeHash, importJson, mergeInputs } from '../src/core/serialize';
import { runAll } from '../src/core/simulation';
import type { Inputs } from '../src/core/types';
import { heatingAgeNote } from '../src/ui/fields';
import { defaults, TODAY } from './helpers';

/** Default case: start 2026-11, installation 2027-05, application 4 months earlier = 2027-01. */
const withInstalled = (month: string, mut?: (i: Inputs) => void): Inputs => {
  const i = defaults();
  i.oldHeating.installedMonth = month;
  mut?.(i);
  return i;
};

describe('F34.1 Inbetriebnahme der Heizung: Mindestalter monatsgenau', () => {
  it('Standard: 22 Jahre vor dem Start der Betrachtung', () => {
    expect(defaults().oldHeating.installedMonth).toBe('2004-11');
  });

  it('Klimageschwindigkeitsbonus genau ab 20 Jahren im Antragsmonat', () => {
    expect(runAll(withInstalled('2007-01')).kfw.kfw!.kgbRate).toBe(0.16); // application 2027-01 = 240 months
    expect(runAll(withInstalled('2007-02')).kfw.kfw!.kgbRate).toBe(0); // 239 months
  });

  it('Hinweis nennt den Monat, in dem 20 Jahre erreicht sind', () => {
    const i = withInstalled('2007-05');
    const hint = keyEvents(i, runAll(i)).hints.find((h) => /Klimageschwindigkeitsbonus/.test(h.title))!;
    expect(hint.title).toBe('Klimageschwindigkeitsbonus erst bei Antrag ab 05/2027');
    expect(hint.detail).toMatch(/19,7 Jahre|19,67 Jahre|19,6 Jahre/);
  });

  it('Feldnotiz: Alter zum Start und Monat mit 20 Jahren (nur Gas)', () => {
    expect(heatingAgeNote(withInstalled('2007-05'))).toBe('Alter zum Start der Betrachtung (11/2026): 19 Jahre 6 Monate. 20 Jahre erreicht 05/2027.');
    expect(heatingAgeNote(withInstalled('2004-11'))).toBe('Alter zum Start der Betrachtung (11/2026): 22 Jahre. 20 Jahre erreicht seit 11/2024.');
    expect(heatingAgeNote(withInstalled('2025-10', (i) => (i.oldHeating.fuel = 'oil')))).toBe('Alter zum Start der Betrachtung (11/2026): 1 Jahr 1 Monat.');
    expect(heatingAgeNote(withInstalled(''))).toBe('');
  });

  it('AK9 Monat 1988 gültig, vor 40 Jahren zurück (1850) begrenzt', () => {
    const issues: { path: string; reason: string }[] = [];
    expect(mergeInputs(defaults(), { oldHeating: { installedMonth: '1988-03' } }, issues, TODAY).oldHeating.installedMonth).toBe('1988-03');
    expect(issues).toEqual([]);
    // AK9: before 40 years back from the check year (2026) → clamped to 01/1986, with a notice
    expect(mergeInputs(defaults(), { oldHeating: { installedMonth: '1850-01' } }, issues, TODAY).oldHeating.installedMonth).toBe('1986-01');
    expect(issues).toHaveLength(1);
  });
});

describe('F34.2 ältere Daten mit „Alter der Heizung“ werden umgerechnet', () => {
  it('Datei: Start der Betrachtung minus Alter, mit Hinweis', () => {
    const issues: { path: string; reason: string }[] = [];
    const raw = { version: 1, general: { startMonth: '2026-03' }, oldHeating: { ageYears: 19 } };
    const i = importJson(defaults(), JSON.stringify(raw), issues);
    expect(i.oldHeating.installedMonth).toBe('2007-03');
    expect(issues).toEqual([{ path: 'oldHeating.installedMonth', reason: expect.stringContaining('(19 Jahre) auf 03/2007 umgerechnet') }]);
  });

  it('ohne Start der Betrachtung zählt der heutige Start; vorhandener Monat hat Vorrang', () => {
    expect(mergeInputs(defaults(), { oldHeating: { ageYears: 16 } }).oldHeating.installedMonth).toBe('2010-11');
    const issues: { path: string; reason: string }[] = [];
    expect(mergeInputs(defaults(), { oldHeating: { ageYears: 16, installedMonth: '2009-04' } }, issues).oldHeating.installedMonth).toBe('2009-04');
    expect(issues).toEqual([]);
  });

  it('Link mit Alter (früheres Format)', () => {
    const json = JSON.stringify({ oldHeating: { ageYears: 25 } });
    const i = decodeHash(defaults(), '#s=' + Buffer.from(json).toString('base64url'));
    expect(i!.oldHeating.installedMonth).toBe('2001-11');
  });
});

describe('F1.8 Altersumrechnung über 40 Jahre (AK6)', () => {
  it('AK6 ageYears 45 (Start 2026-11, Prüfjahr 2026): Monat auf 01/1986 begrenzt, mit Meldung', () => {
    const issues: { path: string; reason: string }[] = [];
    const raw = { version: 1, general: { startMonth: '2026-11' }, oldHeating: { ageYears: 45 } };
    const i = importJson(defaults(), JSON.stringify(raw), issues, TODAY);
    expect(i.oldHeating.installedMonth).toBe('1986-01');
    expect(issues).toEqual([{ path: 'oldHeating.installedMonth', reason: expect.stringContaining('01/1986') }]);
    expect(issues[0].reason).toContain('begrenzt');
  });
});
