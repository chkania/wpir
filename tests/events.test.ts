import { describe, expect, it } from 'vitest';
import { formatMonth, parseMonth } from '../src/core/dates';
import { keyEvents, type KeyEvent } from '../src/core/events';
import { estimateJaz } from '../src/core/jaz';
import { runAll } from '../src/core/simulation';
import type { Inputs } from '../src/core/types';
import { defaults } from './helpers';

/** Scenario from the user's question (gas heating 16 years, remaining life 5 years, income 120 k€). */
function userCase(mut?: (i: Inputs) => void): Inputs {
  const i = defaults();
  i.building.constructionYear = 1950;
  i.building.incomeRange = '90001+';
  i.oldHeating.consumption = 11000;
  i.oldHeating.installedMonth = '2010-11'; // 16 years before the start
  i.financing.kfwEquity = 4000;
  mut?.(i);
  return i;
}

const ev = (i: Inputs) => keyEvents(i, runAll(i));
const find = (list: KeyEvent[], re: RegExp) => list.find((e) => re.test(e.title));

describe('F25.4 Bio-Treppe ohne Aufpreis', () => {
  it('heutiger Bio-Anteil deckt die Pflicht: kein Betrag, Erklärung', () => {
    const steps = (share: number) =>
      ev(
        userCase((i) => {
          i.oldHeating.remainingLifeYears = 2;
          i.prices.bioEnabled = true;
          i.prices.currentBioShare = share;
        }),
      ).timeline.filter((e) => e.title.startsWith('Bio-Treppe'));
    const covered = steps(0.4);
    expect(covered.length).toBeGreaterThan(0);
    const low = covered.find((e) => /: (10|15|30) %/.test(e.title))!;
    expect(low.amount).toBeUndefined();
    expect(low.detail).toContain('kein Aufpreis');
    expect(steps(0).every((e) => e.amount === undefined || e.amount > 0)).toBe(true);
  });
});

describe('F26 Hinweis bei JAZ über der Schätzung', () => {
  it('nur wenn die JAZ über der Spanne liegt', () => {
    expect(find(ev(userCase()).hints, /liegt über der Schätzung/)).toBeUndefined();
    const h = find(ev(userCase((i) => (i.heatPump.jaz = 4))).hints, /liegt über der Schätzung/)!;
    const i = userCase();
    const e = estimateJaz(i);
    const d1 = (x: number) => x.toLocaleString('de-DE', { minimumFractionDigits: 1 });
    expect(h.title).toBe(`JAZ 4,0 liegt über der Schätzung für Ihr Haus (${d1(e.low)}–${d1(e.high)})`);
    expect(h.level).toBe('warning');
    expect(h.detail).toContain(`Vorlauf von ca. ${e.supplyTemp} °C`);
  });
});

describe('F25.4 Hinweis Bio-Anteil im heutigen Tarif', () => {
  it('nur mit Bio-Anteil; nennt Brennstoff und Preisfeld', () => {
    expect(find(ev(userCase()).hints, /im heutigen Tarif/)).toBeUndefined();
    const gas = find(ev(userCase((i) => (i.prices.currentBioShare = 0.4))).hints, /im heutigen Tarif/)!;
    expect(gas.title).toBe('40 % Biogas im heutigen Tarif: Gaspreis dieses Tarifs eintragen');
    expect(gas.level).toBe('warning');
    expect(gas.detail).toMatch(/Ersparnis der Wärmepumpe fällt zu niedrig aus/);
    const oil = find(ev(userCase((i) => {
      i.oldHeating.fuel = 'oil';
      i.prices.currentBioShare = 0.1;
    })).hints, /im heutigen Tarif/)!;
    expect(oil.title).toBe('10 % Bioöl im heutigen Tarif: Heizölpreis dieses Tarifs eintragen');
  });
});

describe('F10 Wichtige Ereignisse', () => {
  it('F10.1 Kauf des Ersatzkessels im Referenzszenario mit Betrag', () => {
    const { timeline } = ev(userCase());
    const e = find(timeline, /neuen Kessels/)!;
    expect(formatMonth(e.month!)).toBe('2031-11');
    expect(e.scenario).toBe('ref');
    expect(e.level).toBe('important');
    expect(e.amount).toBeCloseTo(17500 * 1.02 ** 5, 2);
  });

  it('F10.1 Bio-Treppe nur ab Kesselkauf, Stufe 2030 gilt ab Kauf', () => {
    const { timeline } = ev(userCase());
    const bio = timeline.filter((e) => /Bio-Treppe/.test(e.title));
    expect(bio.map((e) => [formatMonth(e.month!), e.title.match(/\d+ %/)![0]])).toEqual([
      ['2031-11', '15 %'],
      ['2035-01', '30 %'],
      ['2040-01', '60 %'],
    ]);
    expect(bio[0].perYear).toBe(true);
    expect(bio[0].amount).toBeCloseTo(((11000 * 0.9) / 0.95) * 0.15 * (userCase().prices.bioPremiumCt / 100), 6);
  });

  it('F10.2 letzte Steuererstattung ist hervorgehoben', () => {
    const { timeline } = ev(userCase());
    const refunds = timeline.filter((e) => /Steuererstattung/.test(e.title));
    expect(refunds.map((e) => formatMonth(e.month!))).toEqual(['2028-06', '2029-06', '2030-06']);
    const last = refunds[2];
    expect(last.title).toMatch(/Letzte/);
    expect(last.level).toBe('important');
    expect(last.detail).toMatch(/Kreditraten laufen weiter/);
    expect(last.amount).toBeLessThan(0);
  });

  it('AK13 F1.5 Standard: Ereignis „Förderantrag KfW 458 stellen“ vier Monate vor Inbetriebnahme (Antragsmonat leer)', () => {
    const { timeline } = ev(userCase((i) => (i.heatPump.applicationMonth = '')));
    expect(find(timeline, /Förderantrag/)!.month).toBe(find(timeline, /Inbetriebnahme/)!.month! - 4);
  });

  it('F10.3 Zuschuss, Inbetriebnahme, Antrag und Kreditereignisse', () => {
    const { timeline } = ev(userCase());
    expect(find(timeline, /Förderantrag/)!.month).toBe(find(timeline, /Inbetriebnahme/)!.month! - 4);
    expect(find(timeline, /Auszahlung KfW-Zuschuss/)!.amount).toBe(-8400);
    expect(find(timeline, /Zinsbindung endet/)).toBeDefined();
    expect(find(timeline, /Bankkredit vollständig getilgt/)).toBeDefined();
    // sorted chronologically
    const months = timeline.map((e) => e.month!);
    expect([...months].sort((a, b) => a - b)).toEqual(months);
  });

  it('F10.3 Inbetriebnahme nennt die Investition des Monats; ein Ersatzkessel bleibt ein eigenes Ereignis', () => {
    // Old system fails after one year, the heat pump only comes later → boiler purchase strictly before commissioning
    const i = userCase((x) => {
      x.oldHeating.remainingLifeYears = 1;
      x.heatPump.installMonth = '2029-01';
    });
    const run = runAll(i);
    const start = parseMonth(i.general.startMonth);
    const install = run.kfw.installMonth!;
    const boiler = run.kfw.boilerPurchases[0];
    expect(boiler.month).toBeLessThan(install);
    expect(run.kfw.boilerPurchases.some((b) => b.month === install)).toBe(false);
    const commissioning = find(keyEvents(i, run).timeline, /^Inbetriebnahme der Wärmepumpe$/)!;
    expect(commissioning.amount).toBeCloseTo(run.kfw.months[install - start].investment, 6);
    expect(find(keyEvents(i, run).timeline, /Altanlage fällt/)!.amount).toBeCloseTo(boiler.cost, 6);
  });

  it('F10.4 Klimageschwindigkeitsbonus nicht erreichbar (Heizung wird erst nach Auslaufen 20 J. alt)', () => {
    const { hints } = ev(userCase());
    const h = find(hints, /Klimageschwindigkeitsbonus/)!;
    expect(h.title).toMatch(/nicht erreichbar/);
    expect(h.level).toBe('warning');
    expect(h.detail).toMatch(/11\/2030/);
    expect(h.detail).toMatch(/08\/2028/);
  });

  it('F10.4 Klimageschwindigkeitsbonus erst später erreichbar', () => {
    const { hints } = ev(userCase((i) => (i.oldHeating.installedMonth = '2007-11')));
    const h = find(hints, /Klimageschwindigkeitsbonus/)!;
    expect(h.title).toBe('Klimageschwindigkeitsbonus erst bei Antrag ab 11/2027');
    expect(h.level).toBe('info');
    expect(h.detail).toMatch(/8 %/);
  });

  it('F10.4 Klimageschwindigkeitsbonus nicht erreichbar wegen Restlebensdauer', () => {
    const { hints } = ev(userCase((i) => {
      i.oldHeating.installedMonth = '2007-11';
      i.oldHeating.remainingLifeYears = 0.5;
    }));
    const h = find(hints, /Klimageschwindigkeitsbonus/)!;
    expect(h.title).toMatch(/nicht erreichbar/);
  });

  it('F10.4 Klimageschwindigkeitsbonus gesichert mit Hinweis auf nächste Absenkung', () => {
    const { hints } = ev(defaults());
    const h = find(hints, /Klimageschwindigkeitsbonus/)!;
    expect(h.level).toBe('important');
    expect(h.detail).toMatch(/16 %/);
    expect(h.detail).toMatch(/ab 02\/2027 nur noch 12 %/);
  });

  it('F10.4 weitere Hinweise: Einkommensbonus, Kreditvariante, Steuerfrist', () => {
    const { hints } = ev(userCase());
    expect(find(hints, /Kein Einkommensbonus/)).toBeDefined();
    expect(find(hints, /359 statt/)).toBeDefined();
    expect(find(hints, /Steuerbonus nur bei Abschluss bis 12\/2029/)).toBeDefined();
    const late = ev(userCase((i) => (i.heatPump.installMonth = '2030-06'))).hints;
    expect(find(late, /Steuerbonus nicht möglich/)!.level).toBe('warning');
  });

  it('F10.1 WP-Szenario: Ausfall der Altanlage vor Installation als Warnung', () => {
    const { timeline } = ev(userCase((i) => {
      i.oldHeating.remainingLifeYears = 0.25;
      i.heatPump.installMonth = '2027-11';
    }));
    const w = timeline.filter((e) => /fällt vor der Wärmepumpe aus/.test(e.title));
    expect(w.map((e) => e.scenario)).toEqual(['kfw', 'tax']);
    expect(w[0].level).toBe('warning');
  });

  it('F10.1 Ersatz der Wärmepumpe bei langem Betrachtungszeitraum', () => {
    const e = ev(userCase((i) => (i.general.horizonYears = 30)));
    const r = find(e.timeline, /Ersatz der Wärmepumpe/);
    expect(r).toBeDefined();
    expect(r!.amount).toBeGreaterThan(30000);
    expect(find(ev(userCase()).timeline, /Ersatz der Wärmepumpe/)).toBeUndefined();
  });

  it('F10.4 Hinweis Wertschöpfungs-Bonus bzw. reduzierte Grundförderung ab 2027', () => {
    const eu = ev(userCase((i) => (i.heatPump.installMonth = '2027-11'))).hints;
    expect(find(eu, /Wertschöpfungs-Bonus 15 %/)!.level).toBe('info');
    const nonEu = ev(userCase((i) => {
      i.heatPump.installMonth = '2027-11';
      i.heatPump.euOrigin = false;
    })).hints;
    expect(find(nonEu, /Nur 15 % Grundförderung/)!.level).toBe('warning');
    // Application 12/2026 (before the cut-off date (Stichtag)): no notice
    expect(find(ev(userCase((i) => (i.heatPump.installMonth = '2027-04'))).hints, /Grundförderung/)).toBeUndefined();
  });
});

describe('F10.6 Start der Betrachtung in der Zukunft', () => {
  const today = new Date(2026, 10, 15);
  const hint = (start: string, mut?: (i: Inputs) => void) => {
    const i = userCase((x) => {
      x.general.startMonth = start;
      x.heatPump.installMonth = start;
      mut?.(x);
    });
    return find(keyEvents(i, runAll(i), today).hints, /Start der Betrachtung liegt in der Zukunft/);
  };

  it('warnt, wenn der Start nach dem aktuellen Monat liegt, und nennt die betroffenen Werte', () => {
    const h = hint('2030-05')!;
    expect(h.level).toBe('warning');
    expect(h.scenario).toBe('all');
    expect(h.title).toContain('05/2030');
    expect(h.detail).toMatch(/Gaspreis, Strompreise, Investition/);
    expect(h.detail).toMatch(/CO₂-Anteil/);
    expect(h.detail).toMatch(/„Geplante Inbetriebnahme“ verschieben/);
    expect(hint('2030-05', (i) => (i.oldHeating.fuel = 'oil'))!.detail).toMatch(/Heizölpreis/);
  });

  it('kein Hinweis für den aktuellen Monat, die Vergangenheit oder ohne Datum', () => {
    expect(hint('2026-11')).toBeUndefined();
    expect(hint('2025-01')).toBeUndefined();
    const i = userCase((x) => (x.general.startMonth = '2030-05'));
    expect(find(keyEvents(i, runAll(i)).hints, /Start der Betrachtung/)).toBeUndefined();
  });
});
