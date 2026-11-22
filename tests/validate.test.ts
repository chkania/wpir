import { describe, expect, it } from 'vitest';
import { addCsp } from '../csp';
import { runAll } from '../src/core/simulation';
import { compareInstallTimes } from '../src/core/compare';
import { decodeHash, encodeHash, importJson, mergeInputs } from '../src/core/serialize';
import { checkValue, MONTH_FIELDS, NUMBER_LIMITS, SELECT_VALUES, TEXT_LIMITS, type InputIssue } from '../src/core/validate';
import { getPath } from '../src/ui/fields';
import { defaults } from './helpers';

const link = (data: unknown) => '#s=' + Buffer.from(JSON.stringify(data)).toString('base64url');

describe('F9.5 Eingabeprüfung beim Laden', () => {
  it('Standardwerte sind gültig, alle geprüften Pfade existieren', () => {
    const issues: InputIssue[] = [];
    expect(mergeInputs(defaults(), defaults(), issues)).toEqual(defaults());
    expect(issues).toEqual([]);
    for (const p of [...Object.keys(NUMBER_LIMITS), ...Object.keys(MONTH_FIELDS), ...Object.keys(SELECT_VALUES), ...Object.keys(TEXT_LIMITS)]) {
      expect(getPath(defaults(), p), p).not.toBeUndefined();
    }
  });

  it('Zahlen werden begrenzt (Schutz vor Einfrieren)', () => {
    const issues: InputIssue[] = [];
    const i = decodeHash(defaults(), link({ financing: { kfwTermYears: 1e6, kfwGraceYears: 1e6 }, general: { horizonYears: 2000 }, compare: { count: 1e5 }, heatPump: { jaz: 0 } }), issues)!;
    expect(i.financing.kfwTermYears).toBe(50);
    expect(i.general.horizonYears).toBe(50);
    expect(i.compare.count).toBe(40);
    expect(i.heatPump.jaz).toBe(0.5);
    expect(issues.map((x) => x.path)).toEqual(expect.arrayContaining(['financing.kfwTermYears', 'general.horizonYears', 'compare.count', 'heatPump.jaz']));
    const t = performance.now();
    const r = runAll(i);
    compareInstallTimes(i);
    expect(performance.now() - t).toBeLessThan(5000);
    expect(Number.isFinite(r.kfw.totalCost)).toBe(true);
  });

  it('Experten-Parameter für Förderung und Steuer werden auf sinnvolle Grenzen geklemmt', () => {
    const issues: InputIssue[] = [];
    const i = decodeHash(
      defaults(),
      link({
        funding: { grundRate: 5, kgbRate: -1, cap1: 1e12, loanMaxPerUnit: -5 },
        tax: { rateYear1: 3, maxCost: 1e12 },
      }),
      issues,
    )!;
    expect(i.funding.grundRate).toBe(1);
    expect(i.funding.kgbRate).toBe(0);
    expect(i.funding.cap1).toBe(1e7);
    expect(i.funding.loanMaxPerUnit).toBe(0);
    expect(i.tax.rateYear1).toBe(1);
    expect(i.tax.maxCost).toBe(1e7);
    expect(issues.map((x) => x.path)).toEqual(
      expect.arrayContaining([
        'funding.grundRate',
        'funding.kgbRate',
        'funding.cap1',
        'funding.loanMaxPerUnit',
        'tax.rateYear1',
        'tax.maxCost',
      ]),
    );
    expect(() => runAll(i)).not.toThrow();
  });

  it('ungültige Monate, Auswahlwerte und Typen → Standardwert; Texte gekürzt', () => {
    const d = defaults();
    const issues: InputIssue[] = [];
    const i = importJson(d, JSON.stringify({
      version: 1,
      tax: { deadline: '"><img src=x>' },
      general: { startMonth: '1900-01' },
      funding: { grundRateNewFrom: '' },
      oldHeating: { fuel: 'kohle', consumption: 'viel' },
      scenario: { name: 'x'.repeat(500) },
    }), issues);
    expect(i.tax.deadline).toBe(d.tax.deadline);
    expect(i.general.startMonth).toBe(d.general.startMonth);
    expect(i.funding.grundRateNewFrom).toBe(''); // empty allowed
    expect(i.oldHeating.fuel).toBe('gas');
    expect(i.oldHeating.consumption).toBe(d.oldHeating.consumption);
    expect(i.scenario.name).toHaveLength(200);
    expect(issues.map((x) => x.path).sort()).toEqual(
      ['general.startMonth', 'oldHeating.consumption', 'oldHeating.fuel', 'scenario.name', 'tax.deadline'].sort(),
    );
    expect(() => runAll(i)).not.toThrow();
  });

  it('checkValue: Grenzen und unveränderte gültige Werte', () => {
    expect(checkValue('heatPump.pvKwp', 9.5, 0)).toEqual({ value: 9.5 });
    expect(checkValue('heatPump.pvKwp', 500, 0).value).toBe(100);
    expect(checkValue('heatPump.investment', 1e12, 0).value).toBe(1e9);
    expect(checkValue('heatPump.installMonth', '2027-05', 'x')).toEqual({ value: '2027-05' });
    expect(checkValue('heatPump.installMonth', '', '2027-05').value).toBe('2027-05');
  });

  it('kein Prototype Pollution über __proto__/constructor', () => {
    importJson(defaults(), '{"version":1,"__proto__":{"polluted":1},"general":{"constructor":{"prototype":{"x":1}}}}');
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
    expect(({} as Record<string, unknown>).x).toBeUndefined();
  });

  it('Link-Roundtrip bleibt unverändert', () => {
    const i = defaults();
    i.heatPump.jaz = 4.1;
    i.scenario.notes = 'äöü <b>';
    const issues: InputIssue[] = [];
    expect(decodeHash(defaults(), encodeHash(defaults(), i), issues)).toEqual(i);
    expect(issues).toEqual([]);
  });
});

describe('N6 Content-Security-Policy im Build', () => {
  it('fügt die Policy mit Hash der Inline-Skripte ein, externe Skripte ohne Hash', async () => {
    const html = '<html><head>\n<meta charset="UTF-8" />\n<script>console.log(1)</script>\n<script type="module" src="/a.js"></script></head></html>';
    const out = await addCsp(html);
    const meta = /<meta http-equiv="Content-Security-Policy" content="([^"]+)"/.exec(out)![1];
    expect(meta).toContain("script-src 'self' https://analytics.chkania.net 'sha256-CihokcEcBW4atb/CW/XWsvWwbTjqwQlE9nj9ii5ww5M='");
    expect(meta).toContain("object-src 'none'");
    expect(meta).toContain("base-uri 'none'");
    expect(meta).not.toContain('unsafe-inline');
    expect(out.indexOf('Content-Security-Policy')).toBeGreaterThan(out.indexOf('charset'));
    expect(out.indexOf('Content-Security-Policy')).toBeLessThan(out.indexOf('<script'));
  });
});

describe('F1.6 Antragsmonat nicht nach der Inbetriebnahme (AK4)', () => {
  it('AK4 Antragsmonat nach Inbetriebnahme wird auf die Inbetriebnahme begrenzt, mit Meldung (Link, Speicher, Datei)', () => {
    const issues: InputIssue[] = [];
    const inp = mergeInputs(defaults(), { heatPump: { installMonth: '2027-05', applicationMonth: '2027-06' } }, issues);
    expect(inp.heatPump.applicationMonth).toBe('2027-05');
    expect(issues).toHaveLength(1);
    expect(issues[0].path).toBe('heatPump.applicationMonth');
    expect(issues[0].reason).toContain('Inbetriebnahme');
  });

  it('AK4 Antragsmonat gleich der Inbetriebnahme bleibt unverändert und ohne Meldung', () => {
    const issues: InputIssue[] = [];
    const inp = mergeInputs(defaults(), { heatPump: { installMonth: '2027-05', applicationMonth: '2027-05' } }, issues);
    expect(inp.heatPump.applicationMonth).toBe('2027-05');
    expect(issues).toEqual([]);
  });

  it('AK4 Format 2027-13 wird als ungültiger Monat auf den Standard (leer) gesetzt', () => {
    const issues: InputIssue[] = [];
    const inp = mergeInputs(defaults(), { heatPump: { applicationMonth: '2027-13' } }, issues);
    expect(inp.heatPump.applicationMonth).toBe('');
    expect(issues).toHaveLength(1);
  });

  it('AK4 leerer Antragsmonat ist gültig (automatisch)', () => {
    expect(MONTH_FIELDS['heatPump.applicationMonth']).toBe(true);
    const issues: InputIssue[] = [];
    mergeInputs(defaults(), { heatPump: { applicationMonth: '' } }, issues);
    expect(issues).toEqual([]);
  });
});
