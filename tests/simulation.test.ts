import { describe, expect, it } from 'vitest';
import { parseMonth } from '../src/core/dates';
import { createPriceModel } from '../src/core/prices';
import { breakEven, priceRows, runAll, simulate } from '../src/core/simulation';
import type { ScenarioResult } from '../src/core/types';
import { defaults, neutral } from './helpers';

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

describe('F1/F3 Referenzszenario', () => {
  it('konstante Preise: 20 Jahre × (Energie + Grundpreis + Wartung)', () => {
    const i = neutral((i) => (i.oldHeating.remainingLifeYears = 100));
    const r = simulate(i, 'ref');
    expect(r.months).toHaveLength(240);
    expect(r.nominalCost).toBeCloseTo(20 * (20000 * 0.115 + 180 + 300), 6);
    // F6.4: without opportunity interest (Opportunitätszins) = simple sum
    expect(r.totalCost).toBeCloseTo(r.nominalCost, 6);
  });

  it('F1.2 Monatsprofil: Wintermonat teurer als Sommermonat, volles Jahr = Jahresbedarf', () => {
    const i = neutral((i) => (i.oldHeating.remainingLifeYears = 100));
    const r = simulate(i, 'ref');
    const y2027 = r.years.find((y) => y.year === 2027)!;
    expect(y2027.energy).toBeCloseTo(2300, 6);
    const jan = r.months.find((m) => m.month === parseMonth('2027-01'))!;
    const jul = r.months.find((m) => m.month === parseMonth('2027-07'))!;
    expect(jan.energy).toBeGreaterThan(5 * jul.energy);
  });

  it('F3.2 Ersatzkessel nach Restlebensdauer mit neuem Nutzungsgrad', () => {
    const i = neutral((i) => (i.oldHeating.remainingLifeYears = 2));
    const r = simulate(i, 'ref');
    const repl = r.months[24];
    expect(repl.investment).toBe(17500);
    expect(repl.system).toBe('new');
    expect(r.months[23].system).toBe('old');
    // same heat demand (Wärmebedarf), better efficiency → lower fuel costs
    const y = (yr: number) => r.years.find((x) => x.year === yr)!.energy;
    expect(y(2030)).toBeCloseTo((18000 / 0.95) * 0.115, 6);
  });

  it('F2.7 Bio-Treppe nur für den neuen Kessel', () => {
    const i = neutral((i) => {
      i.oldHeating.remainingLifeYears = 2;
      i.prices.bioEnabled = true;
    });
    const r = simulate(i, 'ref');
    const e2030 = r.years.find((x) => x.year === 2030)!.energy;
    expect(e2030).toBeCloseTo((18000 / 0.95) * (0.115 + 0.15 * 0.04), 6);
    const i2 = neutral((i) => {
      i.oldHeating.remainingLifeYears = 100;
      i.prices.bioEnabled = true;
    });
    expect(simulate(i2, 'ref').years.find((x) => x.year === 2030)!.energy).toBeCloseTo(2300, 6);
  });

  it('F3.3 Restwert des Ersatzkessels', () => {
    const i = neutral((i) => {
      i.oldHeating.remainingLifeYears = 2;
      i.general.residualValue = true;
    });
    const r = simulate(i, 'ref');
    expect(r.months[239].residual).toBeCloseTo(-17500 * (24 / 240), 6);
  });

  it('Heizöl: kein Grundpreis', () => {
    const i = neutral((i) => {
      i.oldHeating.fuel = 'oil';
      i.oldHeating.consumption = 2000;
      i.oldHeating.remainingLifeYears = 100;
    });
    const r = simulate(i, 'ref');
    expect(sum(r.months.map((m) => m.fixed))).toBe(0);
  });
});

describe('F4 Wärmepumpe (KfW-Weg)', () => {
  const wp = (mut?: Parameters<typeof neutral>[0]) =>
    neutral((i) => {
      i.oldHeating.remainingLifeYears = 100;
      i.heatPump.installMonth = '2026-11';
      i.financing.kfwEquity = 1e6;
      mut?.(i);
    });

  it('Sofortiger Umstieg, Eigenkapital: Strom + Fix + Wartung + Invest − Zuschuss', () => {
    const r = simulate(wp(), 'kfw');
    const annual = (18000 / 3.3) * 0.26 + (100 - 130) + 200;
    expect(r.kfw!.subsidy).toBe(12880);
    expect(r.nominalCost).toBeCloseTo(20 * annual + 32000 - 12880, 6);
    expect(r.loans).toHaveLength(0);
    expect(r.months[3].subsidy).toBe(-12880); // F5.1 payout (Auszahlung) after 3 months
  });

  it('F2.6/F28 PV-Strom der Wärmepumpe zur Einspeisevergütung bewertet', () => {
    const r = simulate(wp((i) => (i.heatPump.pvKwp = 8)), 'kfw');
    const y = r.months.filter((m) => Math.floor(m.month / 12) === 2027);
    const pv = y.reduce((a, m) => a + m.pvKWh, 0);
    expect(pv).toBeGreaterThan(0);
    expect(y.reduce((a, m) => a + m.energy, 0)).toBeCloseTo(((18000 / 3.3 - pv) * 0.26 + pv * 0.078), 6);
  });

  it('F2.5 ohne WP-Tarif: Haushaltsstrom, kein Zählergrundpreis', () => {
    const r = simulate(wp((i) => (i.heatPump.separateTariff = false)), 'kfw');
    const y = r.years.find((x) => x.year === 2027)!;
    expect(y.energy).toBeCloseTo((18000 / 3.3) * 0.34, 6);
    expect(y.fixed).toBeCloseTo(-130, 6);
  });

  it('F1.3 Installation mitten im Zeitraum: vorher Altanlage, danach WP', () => {
    const r = simulate(wp((i) => (i.heatPump.installMonth = '2028-03')), 'kfw');
    const idx = parseMonth('2028-03') - parseMonth('2026-11');
    expect(r.months[idx - 1].system).toBe('old');
    expect(r.months[idx].system).toBe('wp');
    expect(r.months[idx].investment).toBe(32000);
    expect(r.months[idx - 1].fixed).toBeCloseTo(15, 6); // Gas standing charge (Grundpreis) 180/12
  });

  it('AK2 F1.5 Antragsmonat leer: Inbetriebnahme 2027-05 minus 4 Monate = 2027-01, Klimageschwindigkeitsbonus 16 %', () => {
    const r = simulate(wp((i) => (i.heatPump.installMonth = '2027-05')), 'kfw');
    expect(r.kfw!.appMonth).toBe(parseMonth('2027-01'));
    expect(r.kfw!.kgbRate).toBe(0.16);
  });

  it('AK3 F1.4 fester Antragsmonat 2027-03 bei Inbetriebnahme 2027-05 ergibt 12 %', () => {
    const r = simulate(
      wp((i) => {
        i.heatPump.installMonth = '2027-05';
        i.heatPump.applicationMonth = '2027-03';
      }),
      'kfw',
    );
    expect(r.kfw!.appMonth).toBe(parseMonth('2027-03'));
    expect(r.kfw!.kgbRate).toBe(0.12);
  });

  it('AK4 F1.6 Antragsmonat gleich dem Inbetriebnahmemonat ist gültig (kein Hinweis)', () => {
    const r = simulate(
      wp((i) => {
        i.heatPump.installMonth = '2027-05';
        i.heatPump.applicationMonth = '2027-05';
      }),
      'kfw',
    );
    expect(r.kfw!.appMonth).toBe(parseMonth('2027-05'));
    expect(r.warnings.some((w) => w.includes('Antragsmonat'))).toBe(false);
  });

  it('AK6 F7.1 fester Antrag 2027-03 rutscht bei Einbau 2027-02 auf 2027-02, mit Hinweis', () => {
    const r = simulate(
      wp((i) => {
        i.heatPump.installMonth = '2027-02';
        i.heatPump.applicationMonth = '2027-03';
      }),
      'kfw',
    );
    expect(r.kfw!.appMonth).toBe(parseMonth('2027-02'));
    expect(r.warnings.some((w) => w.includes('Antragsmonat') && w.includes('02/2027'))).toBe(true);
  });

  it('F4.4 Altanlage fällt vor Installation aus → Ersatzkessel + Warnung', () => {
    const r = simulate(
      wp((i) => {
        i.oldHeating.remainingLifeYears = 1;
        i.heatPump.installMonth = '2028-11';
      }),
      'kfw',
    );
    expect(r.months[12].investment).toBe(17500);
    expect(r.warnings.join()).toMatch(/Ersatzkessel/);
    // new gas boiler is young → no climate speed bonus (Klimageschwindigkeitsbonus)
    expect(r.kfw!.kgbRate).toBe(0);
  });

  it('F4.2 Investitionskosten steigen bis zur Installation', () => {
    const r = simulate(
      wp((i) => {
        i.general.investIncrease = 0.05;
        i.heatPump.installMonth = '2028-11';
      }),
      'kfw',
    );
    expect(r.months[24].investment).toBeCloseTo(32000 * 1.05 ** 2, 6);
  });

  it('F3.3/F4.3 Restwert der WP', () => {
    const r = simulate(
      wp((i) => {
        i.general.residualValue = true;
        i.heatPump.installMonth = '2031-11';
      }),
      'kfw',
    );
    expect(r.months[239].residual).toBeCloseTo(-32000 * (60 / 240), 6);
  });

  it('F3.3 kein Restwert für einen Ersatzkessel, den die WP schon ersetzt hat', () => {
    const r = simulate(
      wp((i) => {
        i.general.residualValue = true;
        i.oldHeating.remainingLifeYears = 1;
        i.heatPump.installMonth = '2031-11';
      }),
      'kfw',
    );
    expect(r.boilerPurchases).toHaveLength(1);
    // heat pump only: 60 months of remaining life
    expect(r.months[239].residual).toBeCloseTo(-32000 * (60 / 240), 6);
  });

  it('F4.3 Ersatz-WP, wenn der Zeitraum länger ist als die Lebensdauer', () => {
    const r = simulate(
      wp((i) => {
        i.general.horizonYears = 30;
        i.general.residualValue = true;
      }),
      'kfw',
    );
    expect(r.hpReplacements).toEqual([{ month: parseMonth('2046-11'), cost: 32000 }]);
    expect(r.months[240].investment).toBe(32000);
    expect(r.warnings.join()).toMatch(/Ersatz-Wärmepumpe/);
    // residual value (Restwert) of the replacement heat pump (Ersatz-Wärmepumpe) only: 120 of 240 months
    expect(r.months[359].residual).toBeCloseTo(-32000 * 0.5, 6);
    expect(simulate(wp(), 'kfw').hpReplacements).toHaveLength(0);
  });

  it('F5.1/F5.2 Zuschuss bzw. Steuererstattung nach Zeitraumende als Forderung am Ende', () => {
    const late = (mut?: Parameters<typeof neutral>[0]) =>
      wp((i) => {
        i.heatPump.installMonth = '2046-09';
        mut?.(i);
      });
    const k = simulate(late(), 'kfw');
    expect(k.kfw!.subsidy).toBeGreaterThan(0);
    expect(k.months[239].subsidy).toBeCloseTo(-k.kfw!.subsidy, 6);
    expect(k.warnings.join()).toMatch(/Forderung/);
    // Tax bonus (Steuerbonus): deadline raised so that it is possible
    const t = simulate(late((i) => (i.tax.deadline = '2050-12')), 'tax');
    expect(t.tax!.total).toBeGreaterThan(0);
    expect(sum(t.months.map((m) => m.taxBonus))).toBeCloseTo(-t.tax!.total, 6);
    expect(t.months[239].taxBonus).toBeCloseTo(-t.tax!.total, 6);
  });
});

describe('F6 Finanzierung im Szenario', () => {
  const fin = (mut?: Parameters<typeof neutral>[0]) =>
    neutral((i) => {
      i.oldHeating.remainingLifeYears = 100;
      i.heatPump.installMonth = '2026-11';
      i.financing.kfwEquity = 0;
      i.financing.taxEquity = 0;
      mut?.(i);
    });

  it('Kreditauszahlung, Tilgung = Kreditsumme (inkl. Restschuld-Ablösung)', () => {
    const r = simulate(fin((i) => (i.financing.kfwTermYears = 30)), 'kfw');
    expect(r.months[0].loanPayout).toBe(-32000);
    expect(sum(r.months.map((m) => m.principal))).toBeCloseTo(32000, 6);
    expect(r.warnings.join()).toMatch(/Restschuld/);
    expect(r.loans[0].name).toBe('KfW-Kredit 358');
  });

  it('Zuschuss als Sondertilgung reduziert Zinsen', () => {
    const a = simulate(fin(), 'kfw');
    const b = simulate(fin((i) => (i.financing.subsidyAsSpecialRepayment = false)), 'kfw');
    expect(a.loans[0].totalInterest).toBeLessThan(b.loans[0].totalInterest);
  });

  it('F6.2 ohne KfW-Kredit: Bedarf über den Bankkredit, Zuschuss bleibt', () => {
    const a = simulate(fin(), 'kfw');
    const b = simulate(fin((i) => (i.financing.useKfwLoan = false)), 'kfw');
    expect(b.loans.map((l) => l.name)).toEqual(['Bankkredit']);
    expect(b.loans[0].principal).toBeCloseTo(sum(a.loans.map((l) => l.principal)), 6);
    expect(b.kfw!.subsidy).toBe(a.kfw!.subsidy);
    expect(sum(b.months.map((m) => m.subsidy))).toBeCloseTo(-b.kfw!.subsidy, 6);
    expect(b.warnings.join()).toMatch(/Ohne KfW-Kredit/);
    // with enough equity no loan at all
    const c = simulate(fin((i) => {
      i.financing.useKfwLoan = false;
      i.financing.kfwEquity = 1e6;
    }), 'kfw');
    expect(c.loans).toHaveLength(0);
    expect(c.warnings.join()).not.toMatch(/Ohne KfW-Kredit/);
  });

  it('KfW 359 bei Einkommen > 90.000 €', () => {
    const r = simulate(fin((i) => (i.building.incomeRange = '90001+')), 'kfw');
    expect(r.loans[0].name).toBe('KfW-Kredit 359');
    expect(r.loans[0].rate).toBe(0.033);
  });

  it('nicht förderfähige Nebenkosten laufen über Bankkredit', () => {
    const r = simulate(fin((i) => (i.heatPump.extraCost = 2000)), 'kfw');
    expect(r.loans.map((l) => [l.name, Math.round(l.principal)])).toEqual([
      ['KfW-Kredit 358', 32000],
      ['Bankkredit', 2000],
    ]);
  });

  it('Steuer-Weg: Bankkredit und Steuererstattungen im Folgejahr', () => {
    const r = simulate(fin(), 'tax');
    expect(r.loans[0].name).toBe('Bankkredit');
    expect(r.tax!.total).toBe(6400);
    const refunds = r.months.filter((m) => m.taxBonus < 0).map((m) => m.month);
    expect(refunds).toEqual([parseMonth('2027-06'), parseMonth('2028-06'), parseMonth('2029-06')]);
  });

  it('F6.4 Opportunitätszins zinst Zahlungen auf', () => {
    const i = fin();
    i.general.opportunityRate = 0.03;
    const r = simulate(i, 'ref');
    expect(r.totalCost).toBeGreaterThan(r.nominalCost);
  });
});

describe('F5.3/F8 Gesamtergebnis', () => {
  it('Steuerbonus nach Frist nicht möglich → KfW ist bester Weg', () => {
    const i = defaults();
    i.heatPump.installMonth = '2030-03';
    const r = runAll(i);
    expect(r.tax.feasible).toBe(false);
    expect(r.breakEvenTax).toBeNull();
    expect(r.best).toBe('kfw');
  });

  it('Installation außerhalb des Zeitraums ist nicht machbar', () => {
    const i = defaults();
    i.heatPump.installMonth = '2050-01';
    const r = simulate(i, 'kfw');
    expect(r.feasible).toBe(false);
    expect(r.installMonth).toBeNull();
  });

  it('F8.1 Amortisation: erster Monat, ab dem WP dauerhaft günstiger ist', () => {
    const mk = (cum: number[]): ScenarioResult =>
      ({ cumulative: cum, months: cum.map((_, i) => ({ month: 100 + i })) }) as unknown as ScenarioResult;
    expect(breakEven(mk([1, 2, 3, 4]), mk([1, 5, 3, 3.5]))).toBe(102);
    expect(breakEven(mk([1, 2, 3, 4]), mk([1, 2, 3, 5]))).toBeNull();
    expect(breakEven(mk([1, 2]), mk([0, 0]))).toBe(100);
  });

  it('Preisübersicht: Wärmekosten je kWh', () => {
    const rows = priceRows(neutral());
    expect(rows[0].heatCtFossil).toBeCloseTo(11.5 / 0.9, 6);
    expect(rows[0].heatCtWp).toBeCloseTo(26 / 3.3, 6);
    expect(rows).toHaveLength(21);
  });
});

describe('F25 CO₂-Bilanz', () => {
  const base = (mut?: Parameters<typeof neutral>[0]) =>
    neutral((i) => {
      i.oldHeating.remainingLifeYears = 100;
      i.heatPump.installMonth = '2026-11';
      i.financing.kfwEquity = 1e6;
      i.prices.gridCo2Path = '2026:300';
      mut?.(i);
    });

  it('Referenz: Brennstoff × Emissionsfaktor über den Zeitraum', () => {
    const r = simulate(base(), 'ref');
    expect(r.co2Tons).toBeCloseTo((20 * 20000 * 0.201) / 1000, 6);
    expect(sum(r.months.map((m) => m.co2Kg)) / 1000).toBeCloseTo(r.co2Tons, 9);
  });

  it('Wärmepumpe: Netzstrom × Strommix, PV-Eigenanteil CO₂-frei', () => {
    const elec = 18000 / 3.3;
    expect(simulate(base(), 'kfw').co2Tons).toBeCloseTo((20 * elec * 0.3) / 1000, 6);
    const pv = simulate(base((i) => (i.heatPump.pvKwp = 8)), 'kfw');
    const pvKWh = pv.months.reduce((a, m) => a + m.pvKWh, 0);
    expect(pv.co2Tons).toBeCloseTo(((20 * elec - pvKWh) * 0.3) / 1000, 6);
    const run = runAll(base());
    expect(run.ref.co2Tons - run.kfw.co2Tons).toBeGreaterThan(40);
  });

  it('Bio-Anteil eines neuen Kessels gilt als klimaneutral, Altanlage nicht', () => {
    const bio = (life: number) =>
      simulate(
        base((i) => {
          i.oldHeating.remainingLifeYears = life;
          i.prices.bioEnabled = true;
          i.prices.bioSteps = '2026:50';
        }),
        'ref',
      ).co2Tons;
    const newBoilerKwh = 18000 / defaults().oldHeating.replacementEfficiency;
    expect(bio(0)).toBeCloseTo((20 * newBoilerKwh * 0.5 * 0.201) / 1000, 6);
    expect(bio(100)).toBeCloseTo((20 * 20000 * 0.201) / 1000, 6);
  });

  it('F25.4 Ökostromtarif: Netzstrom CO₂-frei, Kosten unverändert', () => {
    const plain = simulate(base(), 'kfw');
    const green = simulate(base((i) => (i.heatPump.greenElectricity = true)), 'kfw');
    expect(green.co2Tons).toBe(0);
    expect(green.totalCost).toBeCloseTo(plain.totalCost, 9);
  });

  it('F25.4 heutiger Bio-Anteil: Altanlage, Kochen mit Gas, neuer Kessel mindestens Bio-Treppe', () => {
    const fossil = (20 * 20000 * 0.201) / 1000;
    expect(simulate(base((i) => (i.prices.currentBioShare = 0.25)), 'ref').co2Tons).toBeCloseTo(fossil * 0.75, 6);
    const kwhNew = 18000 / defaults().oldHeating.replacementEfficiency;
    const newBoiler = (current: number) =>
      simulate(
        base((i) => {
          i.oldHeating.remainingLifeYears = 0;
          i.prices.bioEnabled = true;
          i.prices.bioSteps = '2026:30';
          i.prices.currentBioShare = current;
        }),
        'ref',
      );
    // required 30 %, today 10 % → 30 % neutral, premium for the missing 20 %
    const low = newBoiler(0.1);
    expect(low.co2Tons).toBeCloseTo((20 * kwhNew * 0.7 * 0.201) / 1000, 6);
    // today 50 % → 50 % neutral, no extra premium
    const high = newBoiler(0.5);
    expect(high.co2Tons).toBeCloseTo((20 * kwhNew * 0.5 * 0.201) / 1000, 6);
    const none = newBoiler(0);
    const bioCost = (r: ScenarioResult) => r.nominalCost - newBoiler(0.3).nominalCost;
    expect(bioCost(none)).toBeCloseTo((20 * kwhNew * 0.3 * 4) / 100, 6);
    expect(bioCost(low)).toBeCloseTo((20 * kwhNew * 0.2 * 4) / 100, 6);
    expect(bioCost(high)).toBeCloseTo(0, 6);
  });

  it('Strommix-Pfad: linear interpoliert, konstant außerhalb, negative Werte → 0', () => {
    const pm = (path: string) => createPriceModel(neutral((i) => (i.prices.gridCo2Path = path)));
    const p = pm('2025:344, 2030:250');
    expect(p.gridCo2Kg(2020)).toBeCloseTo(0.344, 9);
    expect(p.gridCo2Kg(2030)).toBeCloseTo(0.25, 9);
    expect(p.gridCo2Kg(2040)).toBeCloseTo(0.25, 9);
    expect(pm('2026:-5').gridCo2Kg(2027)).toBe(0);
    expect(pm('').gridCo2Kg(2027)).toBe(0);
  });
});
