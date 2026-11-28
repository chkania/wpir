import { describe, expect, it } from 'vitest';
import { keyFigures, movedSummary, sliderInputs, sliders, type Slider, type SliderId } from '../src/core/sensitivity';
import { runAll } from '../src/core/simulation';
import type { Inputs } from '../src/core/types';
import { defaults, neutral } from './helpers';

const find = (list: Slider[], id: SliderId): Slider => list.find((s) => s.id === id)!;
const basis = (i: Inputs) => runAll(i);
/** Slider with the form value (index of the base). */
const at = (s: Slider) => s.values[s.base];
const first = (s: Slider) => s.values[0];
const last = (s: Slider) => s.values[s.values.length - 1];
/** Positions at a given value (must exist on the grid). */
const indexOf = (s: Slider, v: number) => s.values.findIndex((x) => Math.abs(x - v) < 1e-9);

/** Standard test inputs: an 'Eigenkapital' case without loan is set up in the individual tests. */
const equityOnly = (i: Inputs) => {
  i.financing.kfwEquity = 200000;
  i.financing.taxEquity = 200000;
  return i;
};

describe('F27.3 Regler: Auswahl und Reihenfolge', () => {
  it('F27.3 mit Kredit im Basisfall: sieben Regler in fester Reihenfolge', () => {
    const i = defaults();
    expect(sliders(i, basis(i)).map((s) => s.id)).toEqual([
      'fuelIncrease',
      'elecIncrease',
      'jaz',
      'investment',
      'co2Price',
      'loanRate',
      'opportunityRate',
    ]);
  });

  it('F27.3 Eigenkapital ohne Kredit: sechs Regler, ohne Kreditzinsen', () => {
    const i = equityOnly(defaults());
    const run = basis(i);
    expect(run.kfw.loans.length + run.tax.loans.length).toBe(0);
    expect(sliders(i, run).map((s) => s.id)).not.toContain('loanRate');
    expect(sliders(i, run)).toHaveLength(6);
  });

  it('F27.3 leerer CO₂-Pfad: kein CO₂-Regler', () => {
    const i = defaults();
    i.prices.co2Path = '';
    expect(sliders(i, basis(i)).map((s) => s.id)).not.toContain('co2Price');
  });

  it('F27.3 Heizöl: Regler heißt Steigerung Ölpreis (ohne CO₂)', () => {
    const i = defaults();
    i.oldHeating.fuel = 'oil';
    const s = find(sliders(i, basis(i)), 'fuelIncrease');
    expect(s.label).toBe('Steigerung Ölpreis (ohne CO₂)');
    expect(s.short).toBe('Steigerung Ölpreis');
  });

  it('F27.3 „Gas-/Ölpreis heute“ und „Strompreis heute“ sind keine Regler', () => {
    const i = defaults();
    const labels = sliders(i, basis(i)).map((s) => s.label);
    expect(labels.join(' ')).not.toMatch(/heute/);
  });
});

describe('F27.5 Spannen', () => {
  it('F27.5 Steigerung Strompreis 2 %: Regler reicht von 0 % bis 22 %', () => {
    const i = defaults();
    i.heatPump.elecIncrease = 0.02;
    const s = find(sliders(i, basis(i)), 'elecIncrease');
    expect(first(s)).toBeCloseTo(0, 9);
    expect(last(s)).toBeCloseTo(0.22, 9);
    expect(s.hint).toContain('Ihre Eingabe: 2,0 % p. a.');
    expect(s.hint).toContain('Prozentpunkte');
    expect(s.hint).toContain('durchschnittliche jährliche Steigerung im Betrachtungszeitraum');
  });

  it('F27.5 Steigerung Gas 3 % (Standard): Untergrenze 0 %, Obergrenze 23 %', () => {
    const i = defaults();
    const s = find(sliders(i, basis(i)), 'fuelIncrease');
    expect(first(s)).toBeCloseTo(0, 9);
    expect(last(s)).toBeCloseTo(0.23, 9);
    expect(at(s)).toBeCloseTo(0.03, 12);
  });

  it('F27.5 Steigerung negativ aus Link (−1 %): untere Grenze −1 %', () => {
    const i = defaults();
    i.prices.gasIncrease = -0.01;
    const s = find(sliders(i, basis(i)), 'fuelIncrease');
    expect(first(s)).toBeCloseTo(-0.01, 9);
    expect(last(s)).toBeCloseTo(0.19, 9);
  });

  it('F27.5 Obergrenze höchstens 100 % (NUMBER_LIMITS)', () => {
    const i = defaults();
    i.heatPump.elecIncrease = 0.95;
    const s = find(sliders(i, basis(i)), 'elecIncrease');
    expect(last(s)).toBeCloseTo(1, 9);
  });

  it('F27.5 Investition: B × 0,8 bis B × 1,2; B = 0 deaktiviert', () => {
    const i = defaults();
    const s = find(sliders(i, basis(i)), 'investment');
    expect(first(s)).toBeCloseTo(32000 * 0.8, 6);
    expect(last(s)).toBeCloseTo(32000 * 1.2, 6);
    const zero = defaults();
    zero.heatPump.investment = 0;
    const z = find(sliders(zero, basis(zero)), 'investment');
    expect(z.values).toEqual([0]);
    expect(z.hint).toContain('Keine Spanne');
  });

  it('F27.5 JAZ 3,5: Spanne 1,5 bis 5,5', () => {
    const i = defaults();
    i.heatPump.jaz = 3.5;
    const s = find(sliders(i, basis(i)), 'jaz');
    expect(first(s)).toBeCloseTo(1.5, 9);
    expect(last(s)).toBeCloseTo(5.5, 9);
  });

  it('F27.5 JAZ 2,5: untere Grenze 1,0, Regler reicht bis 4,5', () => {
    const i = defaults();
    i.heatPump.jaz = 2.5;
    const s = find(sliders(i, basis(i)), 'jaz');
    expect(first(s)).toBeCloseTo(1, 9);
    expect(last(s)).toBeCloseTo(4.5, 9);
  });

  it('F27.5 JAZ unter 1 (nur aus Link): B ist die untere Grenze', () => {
    const i = defaults();
    i.heatPump.jaz = 0.8;
    const s = find(sliders(i, basis(i)), 'jaz');
    expect(first(s)).toBeCloseTo(0.8, 9);
  });

  it('F27.5 CO₂-Preis Standardpfad: Regler reicht von 154 bis 286 €/t (2045)', () => {
    const i = defaults();
    const s = find(sliders(i, basis(i)), 'co2Price');
    expect(s.format(first(s))).toBe('154 €/t (2045)');
    expect(s.format(last(s))).toBe('286 €/t (2045)');
    expect(s.format(1)).toBe('220 €/t (2045)');
  });

  it('F27.5 CO₂ bei 130 %: jeder Stützpunkt × 1,3 (2030: 143 €/t)', () => {
    const i = defaults();
    const s = find(sliders(i, basis(i)), 'co2Price');
    const moved = sliderInputs(i, sliders(i, basis(i)), { co2Price: s.values.indexOf(1.3) });
    expect(moved.prices.co2Path).toBe('2026:71.5, 2027:84.5, 2028:104, 2030:143, 2035:208, 2040:260, 2045:286');
    expect(i.prices.co2Path).toBe(defaults().prices.co2Path);
  });

  it('F27.5 CO₂ Stützpunkt 2030 geht von 110 auf 77 bis 143 €/t', () => {
    const i = defaults();
    const s = find(sliders(i, basis(i)), 'co2Price');
    expect(Math.round(110 * first(s))).toBe(77);
    expect(Math.round(110 * last(s))).toBe(143);
  });

  it('F27.5 Kreditzinsen: Änderung −5 bis +5 Prozentpunkte; kein Zins unter 0 %', () => {
    const i = defaults();
    const s = find(sliders(i, basis(i)), 'loanRate');
    expect(first(s)).toBeCloseTo(-0.05, 9);
    expect(last(s)).toBeCloseTo(0.05, 9);
    expect(at(s)).toBe(0);
    const atBase = sliderInputs(i, sliders(i, basis(i)), { loanRate: s.base });
    expect(atBase.financing.kfwRate358).toBeCloseTo(0.022, 12);
    // −5 Prozentpunkte: 2,2 % → 0 %, 4,6 % → 0 %, 6,5 % → 1,5 %, 4,0 % → 0 %
    const low = sliderInputs(i, sliders(i, basis(i)), { loanRate: 0 });
    expect(low.financing.kfwRate358).toBe(0);
    expect(low.financing.kfwRate359).toBe(0);
    expect(low.financing.bankRate).toBeCloseTo(0.015, 9);
    expect(low.financing.followUpRate).toBe(0);
  });

  it('F27.5 Kreditzinsen: ein Zins unter 0 % (Link) bleibt bei seinem Eingabewert', () => {
    const i = defaults();
    i.financing.kfwRate358 = -0.01;
    const s = find(sliders(i, basis(i)), 'loanRate');
    const low = sliderInputs(i, sliders(i, basis(i)), { loanRate: indexOf(s, -0.05) });
    expect(low.financing.kfwRate358).toBeCloseTo(-0.01, 12);
  });

  it('F27.5 Opportunitätszins 2 %: Regler reicht von 0 % bis 7 %', () => {
    const i = defaults();
    const s = find(sliders(i, basis(i)), 'opportunityRate');
    expect(first(s)).toBeCloseTo(0, 9);
    expect(last(s)).toBeCloseTo(0.07, 9);
  });
});

describe('F27.6 Schrittweiten und Raster', () => {
  it('F27.6 Steigerung B = 2,05 %: Regler reicht von 0,05 % bis 22,05 %, Voreinstellung erreichbar', () => {
    const i = defaults();
    i.prices.gasIncrease = 0.0205;
    const s = find(sliders(i, basis(i)), 'fuelIncrease');
    expect(first(s)).toBeCloseTo(0.0005, 12);
    expect(last(s)).toBeCloseTo(0.2205, 12);
    expect(s.values[s.base]).toBe(0.0205);
    expect(s.format(first(s))).toBe('0,05 % p. a.');
    expect(s.hint).toContain('Ihre Eingabe: 2,05 % p. a.');
  });

  it('F27.6 Schrittweite Steigerung und Zins 0,1 Prozentpunkte', () => {
    const i = defaults();
    const s = find(sliders(i, basis(i)), 'elecIncrease');
    expect(s.values[s.base + 1] - s.values[s.base]).toBeCloseTo(0.001, 12);
    const r = find(sliders(i, basis(i)), 'loanRate');
    expect(r.values[r.base + 1] - r.values[r.base]).toBeCloseTo(0.001, 12);
  });

  it('F27.6 Investition 27.345 €: Positionen 21.945 € bis 32.745 € in 100-€-Schritten', () => {
    const i = defaults();
    i.heatPump.investment = 27345;
    const s = find(sliders(i, basis(i)), 'investment');
    expect(s.values[0]).toBe(21945);
    expect(s.values[s.values.length - 1]).toBe(32745);
    expect(s.values[s.base]).toBe(27345);
    expect(s.values[1] - s.values[0]).toBe(100);
  });

  it('F27.6 JAZ-Schritt 0,1 und CO₂-Schritt 5 Prozentpunkte (70 % bis 130 %, 13 Positionen)', () => {
    const i = defaults();
    const j = find(sliders(i, basis(i)), 'jaz');
    expect(j.values[j.base + 1] - j.values[j.base]).toBeCloseTo(0.1, 9);
    const c = find(sliders(i, basis(i)), 'co2Price');
    expect(c.values).toHaveLength(13);
    expect(c.values[0]).toBeCloseTo(0.7, 9);
    expect(c.values[c.values.length - 1]).toBeCloseTo(1.3, 9);
    expect(c.values[c.base]).toBe(1);
  });

  it('F27.6 Voreinstellung liegt immer auf dem Raster (auch ohne Mitte)', () => {
    const i = defaults();
    i.general.opportunityRate = 0.01;
    for (const s of sliders(i, basis(i))) expect(s.values[s.base], s.id).toBeDefined();
  });
});

describe('F27.4 / F27.12 Kombination und Eingabenkopie', () => {
  it('F27.4 Verschieben ändert die Eingaben nicht (Kopie)', () => {
    const i = defaults();
    const before = structuredClone(i);
    const list = sliders(i, basis(i));
    sliderInputs(i, list, { elecIncrease: 0, jaz: 0 });
    expect(i).toEqual(before);
  });

  it('F27.12 Kombination: zwei Regler wirken gleichzeitig auf eine Kopie', () => {
    const i = defaults();
    const list = sliders(i, basis(i));
    const jaz = find(list, 'jaz');
    const ele = find(list, 'elecIncrease');
    const moved = sliderInputs(i, list, { elecIncrease: indexOf(ele, 0.05), jaz: indexOf(jaz, 3) });
    expect(moved.heatPump.elecIncrease).toBeCloseTo(0.05, 12);
    expect(moved.heatPump.jaz).toBeCloseTo(3, 9);
    expect(i.heatPump.jaz).toBe(3.3);
  });

  it('F27.12 Heizöl-Steigerung, Investition und Opportunitätszins werden auf die Kopie angewendet', () => {
    const i = defaults();
    i.oldHeating.fuel = 'oil';
    const list = sliders(i, basis(i));
    const oil = find(list, 'fuelIncrease');
    const inv = find(list, 'investment');
    const opp = find(list, 'opportunityRate');
    const moved = sliderInputs(i, list, {
      fuelIncrease: indexOf(oil, 0.05),
      investment: indexOf(inv, 30000),
      opportunityRate: indexOf(opp, 0.03),
    });
    expect(moved.prices.oilIncrease).toBeCloseTo(0.05, 12);
    expect(moved.prices.gasIncrease).toBe(i.prices.gasIncrease);
    expect(moved.heatPump.investment).toBe(30000);
    expect(moved.general.opportunityRate).toBeCloseTo(0.03, 12);
    expect(i.general.opportunityRate).toBe(0.02);
  });

  it('F27.4 Regler auf Voreinstellung verändert nichts', () => {
    const i = defaults();
    const list = sliders(i, basis(i));
    expect(sliderInputs(i, list, {})).toEqual(i);
  });

  it('F27.8 Beschriftung: „keine Änderung“, sonst verschobene Regler in fester Reihenfolge', () => {
    const i = defaults();
    const list = sliders(i, basis(i));
    expect(movedSummary(list, {})).toBe('keine Änderung');
    const jaz = find(list, 'jaz');
    const ele = find(list, 'elecIncrease');
    const pos = { jaz: indexOf(jaz, 3), elecIncrease: indexOf(ele, 0.05) };
    expect(movedSummary(list, pos)).toBe('Steigerung Strompreis 5,0 % p. a., JAZ 3,0');
    expect(movedSummary(list, { jaz: jaz.base })).toBe('keine Änderung');
  });

  it('F27.8 Keine Änderung, wenn ein Regler wieder auf der Voreinstellung steht', () => {
    const i = defaults();
    const list = sliders(i, basis(i));
    const ele = find(list, 'elecIncrease');
    expect(movedSummary(list, { elecIncrease: ele.base })).toBe('keine Änderung');
  });
});

describe('F27.8 Einstellung gleich Formulareingabe', () => {
  it('Steigerung Strom 2 %: Einstellung 22 % ergibt dieselben Kennzahlen wie Formulareingabe 22 %', () => {
    const i = defaults();
    i.heatPump.elecIncrease = 0.02;
    const list = sliders(i, basis(i));
    const s = find(list, 'elecIncrease');
    const set = keyFigures(runAll(sliderInputs(i, list, { elecIncrease: indexOf(s, 0.22) })));
    const typed = defaults();
    typed.heatPump.elecIncrease = 0.22;
    expect(set).toEqual(keyFigures(runAll(typed)));
  });

  it('Steigerung Gas 3 % (Standard): Einstellung 5 % ergibt dieselben Kennzahlen wie Formulareingabe 5 %', () => {
    const i = defaults();
    const list = sliders(i, basis(i));
    const s = find(list, 'fuelIncrease');
    const set = keyFigures(runAll(sliderInputs(i, list, { fuelIncrease: indexOf(s, 0.05) })));
    const typed = defaults();
    typed.prices.gasIncrease = 0.05;
    expect(set).toEqual(keyFigures(runAll(typed)));
  });

  it('JAZ 3,5: Einstellung 5,5 ergibt dieselben Kennzahlen wie Formulareingabe 5,5', () => {
    const i = defaults();
    i.heatPump.jaz = 3.5;
    const list = sliders(i, basis(i));
    const s = find(list, 'jaz');
    const set = keyFigures(runAll(sliderInputs(i, list, { jaz: indexOf(s, 5.5) })));
    const typed = defaults();
    typed.heatPump.jaz = 5.5;
    expect(set).toEqual(keyFigures(runAll(typed)));
  });

  it('CO₂ 130 %: Kennzahlen entsprechen dem so eingegebenen Pfad', () => {
    const i = defaults();
    const list = sliders(i, basis(i));
    const s = find(list, 'co2Price');
    const set = keyFigures(runAll(sliderInputs(i, list, { co2Price: s.values.indexOf(1.3) })));
    const typed = defaults();
    typed.prices.co2Path = '2026:71.5, 2027:84.5, 2028:104, 2030:143, 2035:208, 2040:260, 2045:286';
    expect(set).toEqual(keyFigures(runAll(typed)));
  });

  it('Investition: Einstellung 0 bleibt bei der Formulareingabe (keine Änderung)', () => {
    const i = defaults();
    const list = sliders(i, basis(i));
    expect(keyFigures(runAll(sliderInputs(i, list, {})))).toEqual(keyFigures(basis(i)));
  });

  it('F27.8 keyFigures: Spalten, Vorzeichen und „nicht möglich“ aus einem Lauf', () => {
    const run = basis(defaults());
    const k = keyFigures(run);
    const best = run.best === 'tax' ? run.tax : run.kfw;
    expect(k.saving).toBeCloseTo(run.ref.totalCost - best.totalCost, 6);
    expect(k.installMonth).toBe(best.installMonth);
    expect(k.tax).toBe(run.tax.feasible ? run.tax.totalCost : null);
  });
});

describe('F27.5 Kredit-Regler in der Kombination', () => {
  it('F27.5 Kreditzinsen +1 Prozentpunkt erhöht alle vier Zinsen um dieselbe Differenz', () => {
    const i = defaults();
    const list = sliders(i, basis(i));
    const s = find(list, 'loanRate');
    const moved = sliderInputs(i, list, { loanRate: indexOf(s, 0.01) });
    expect(moved.financing.kfwRate358).toBeCloseTo(0.032, 9);
    expect(moved.financing.kfwRate359).toBeCloseTo(0.056, 9);
    expect(moved.financing.bankRate).toBeCloseTo(0.075, 9);
    expect(moved.financing.followUpRate).toBeCloseTo(0.05, 9);
  });

  it('F27.5 Opportunitätszins-Regler erreicht die Eingabe 2 % genau', () => {
    const i = neutral();
    i.general.opportunityRate = 0.02;
    const s = find(sliders(i, basis(i)), 'opportunityRate');
    expect(s.values[s.base]).toBe(0.02);
  });
});
