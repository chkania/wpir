import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { decodeHash, encodeHash, importJson, mergeInputs } from '../src/core/serialize';
import { heatingBounds, installBounds, monthBounds, validMonth } from '../src/core/validate';
import { parseMonth } from '../src/core/dates';
import { defaults as helperDefaults, TODAY } from './helpers';

const issuesOf = <T,>(fn: (issues: { path: string; reason: string }[]) => T) => {
  const issues: { path: string; reason: string }[] = [];
  const value = fn(issues);
  return { value, issues };
};
const link = (data: unknown) => '#s=' + Buffer.from(JSON.stringify(data)).toString('base64url');
const year2030 = new Date(2030, 5, 15);

describe('F1.7 Zeitraum der geplanten Inbetriebnahme (AK3, AK4)', () => {
  it('AK3 fester Antragsmonat 2027-03: Inbetriebnahme 2030-12 gültig, 2031-01 wird auf 2030-12 begrenzt', () => {
    const ok = issuesOf((i) => mergeInputs(helperDefaults(), { heatPump: { applicationMonth: '2027-03', installMonth: '2030-12' } }, i, TODAY));
    expect(ok.value.heatPump.installMonth).toBe('2030-12');
    expect(ok.issues.filter((x) => x.path === 'heatPump.installMonth')).toEqual([]);
    const late = issuesOf((i) => mergeInputs(helperDefaults(), { heatPump: { applicationMonth: '2027-03', installMonth: '2031-01' } }, i, TODAY));
    expect(late.value.heatPump.installMonth).toBe('2030-12');
    expect(late.issues).toEqual([expect.objectContaining({ path: 'heatPump.installMonth' })]);
  });

  it('AK3 Heizung bei Prüfjahr 2026: 1986 gültig, 1985 wird auf 1986-01 begrenzt, 2026-12 gültig, 2027-01 auf 2026-12', () => {
    const at = (m: string) => mergeInputs(helperDefaults(), { oldHeating: { installedMonth: m } }, [], TODAY).oldHeating.installedMonth;
    expect(at('1986-01')).toBe('1986-01');
    expect(at('1985-12')).toBe('1986-01');
    expect(at('2026-12')).toBe('2026-12');
    expect(at('2027-01')).toBe('2026-12');
  });

  it('AK3 Form-Grenzen gelten für validMonth: 2030-12 gültig, 2031-01 nicht (fester Antrag 2027-03)', () => {
    const [, hi] = installBounds(parseMonth('2027-03'));
    expect(hi).toBe(parseMonth('2030-12'));
    expect(parseMonth('2030-12') <= hi).toBe(true);
    expect(parseMonth('2031-01') <= hi).toBe(false);
  });

  it('AK4 Link: Inbetriebnahme 2031-01 wird auf 12/2030 begrenzt, Meldung nennt den neuen Monat', () => {
    const issues: { path: string; reason: string }[] = [];
    const inp = decodeHash(helperDefaults(), link({ heatPump: { applicationMonth: '2027-03', installMonth: '2031-01' } }), issues, TODAY)!;
    expect(inp.heatPump.installMonth).toBe('2030-12');
    expect(issues.find((x) => x.path === 'heatPump.installMonth')!.reason).toContain('12/2030');
  });

  it('AK4 Datei: Heizung 1950-01 wird auf 01/1986 begrenzt, Meldung nennt den neuen Monat', () => {
    const issues: { path: string; reason: string }[] = [];
    const inp = importJson(helperDefaults(), JSON.stringify({ version: 1, oldHeating: { installedMonth: '1950-01' } }), issues, TODAY);
    expect(inp.oldHeating.installedMonth).toBe('1986-01');
    expect(issues.find((x) => x.path === 'oldHeating.installedMonth')!.reason).toContain('01/1986');
  });

  it('AK4 Speicher: Inbetriebnahme 2031-06 mit festem Antrag 2027-03 wird begrenzt und gemeldet', () => {
    const issues: { path: string; reason: string }[] = [];
    const inp = mergeInputs(helperDefaults(), { heatPump: { applicationMonth: '2027-03', installMonth: '2031-06' } }, issues, TODAY);
    expect(inp.heatPump.installMonth).toBe('2030-12');
    expect(issues.some((x) => x.path === 'heatPump.installMonth')).toBe(true);
  });

  it('AK4 Link-Roundtrip mit begrenzter Inbetriebnahme ergibt dieselbe Eingabe', () => {
    const inp = mergeInputs(helperDefaults(), { heatPump: { applicationMonth: '2027-03', installMonth: '2031-06' } }, [], TODAY);
    expect(decodeHash(helperDefaults(), encodeHash(helperDefaults(), inp), [], TODAY)).toEqual(inp);
  });
});

describe('F1.8 Prüfzeitpunkt als Parameter (AK7)', () => {
  it('AK7 Prüfjahr 2026: 1986 gültig, 1985 ungültig, 2026-12 gültig, 2027-01 ungültig', () => {
    expect(validMonth('oldHeating.installedMonth', '1986-01', TODAY)).toBe(true);
    expect(validMonth('oldHeating.installedMonth', '1985-12', TODAY)).toBe(false);
    expect(validMonth('oldHeating.installedMonth', '2026-12', TODAY)).toBe(true);
    expect(validMonth('oldHeating.installedMonth', '2027-01', TODAY)).toBe(false);
  });

  it('AK7 Prüfjahr 2030 (anderer Prüfzeitpunkt): 1990 gültig, 1989 ungültig, 2030-12 gültig, 2031-01 ungültig', () => {
    expect(heatingBounds(year2030)).toEqual([parseMonth('1990-01'), parseMonth('2030-12')]);
    expect(validMonth('oldHeating.installedMonth', '1990-01', year2030)).toBe(true);
    expect(validMonth('oldHeating.installedMonth', '1989-12', year2030)).toBe(false);
    expect(validMonth('oldHeating.installedMonth', '2030-12', year2030)).toBe(true);
    expect(validMonth('oldHeating.installedMonth', '2031-01', year2030)).toBe(false);
  });

  it('AK7 derselbe Wert gilt je Prüfzeitpunkt unterschiedlich (1989-06: 2026 gültig, 2030 ungültig)', () => {
    expect(validMonth('oldHeating.installedMonth', '1989-06', TODAY)).toBe(true);
    expect(validMonth('oldHeating.installedMonth', '1989-06', year2030)).toBe(false);
    expect(validMonth('oldHeating.installedMonth', '1990-06', year2030)).toBe(true);
    expect(validMonth('oldHeating.installedMonth', '1986-06', TODAY)).toBe(true);
  });

  it('AK7 ohne Prüfzeitpunkt-Argument gilt das heutige Jahr (Standard)', () => {
    const year = new Date().getFullYear();
    const inp = mergeInputs(helperDefaults(), { oldHeating: { installedMonth: '1900-01' } }, []);
    expect(inp.oldHeating.installedMonth).toBe(`${year - 40}-01`);
  });
});

describe('AK8 Standardwerte, Beispiele und Antragsmonat-Bereich bleiben', () => {
  it('AK8 Standardwerte 2004-11 (Heizung) und 2027-05 (Inbetriebnahme) unverändert', () => {
    expect(helperDefaults().oldHeating.installedMonth).toBe('2004-11');
    expect(helperDefaults().heatPump.installMonth).toBe('2027-05');
    expect(validMonth('oldHeating.installedMonth', '2004-11', TODAY)).toBe(true);
  });

  it('AK8 Antragsmonat-Bereich 2000–2150 unverändert', () => {
    expect(monthBounds('heatPump.applicationMonth', TODAY)).toEqual([parseMonth('2000-01'), parseMonth('2150-12')]);
    expect(validMonth('heatPump.applicationMonth', '2000-01', TODAY)).toBe(true);
    expect(validMonth('heatPump.applicationMonth', '1999-12', TODAY)).toBe(false);
    expect(validMonth('heatPump.applicationMonth', '2150-12', TODAY)).toBe(true);
    expect(validMonth('heatPump.applicationMonth', '2151-01', TODAY)).toBe(false);
  });

  it('AK8 Beispiele 01–05 laden ohne Zeitraum-Meldung und mit unveränderten Einbaumonaten', () => {
    const dir = new URL('../beispiele/', import.meta.url);
    for (const f of readdirSync(dir).filter((x) => x.endsWith('.json'))) {
      const issues: { path: string; reason: string }[] = [];
      const inp = importJson(helperDefaults(), readFileSync(new URL(f, dir), 'utf8'), issues, TODAY);
      // The notice of the former age (F34.2) is not a window notice; only window notices count here
      const windowNotices = issues.filter((x) => (x.path === 'oldHeating.installedMonth' || x.path === 'heatPump.installMonth') && !x.reason.includes('umgerechnet'));
      expect(windowNotices).toEqual([]);
      expect(inp.heatPump.installMonth).toMatch(/^20\d\d-\d\d$/);
    }
  });
});
