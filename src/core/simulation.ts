import { AUTO_APPLICATION_LEAD_MONTHS, DHW_PROFILE, SPACE_PROFILE } from './defaults';
import { formatMonthDe, monthOf, parseMonth, tryParseMonth, yearOf } from './dates';
import { incomeRangeValue } from './income-range';
import { kfwLoanVariant, kfwSubsidy } from './funding';
import { loanScheduleDetailed, type LoanResult, type LoanSpec, type PrepaymentRules } from './loan';
import { createPriceModel, energySplit, type EnergySplit, type PriceModel } from './prices';
import { createPvModel, pvSummary, type PvModel } from './pv';
import { taxBonus } from './tax';
import type {
  CostBreakdown,
  Inputs,
  InvestInfo,
  LoanInfo,
  MonthRow,
  ScenarioKind,
  ScenarioResult,
  WindfallInfo,
  YearRow,
} from './types';

export const SUBSIDY = 'Zuschuss';
export const TAX_REFUND = 'Steuererstattung';
const WINDFALL = 'Einmalzahlung';

/**
 * § 14a EnWG module 1 is granted per metering point (Marktlokation) (meter), not per device (F13.6).
 * If the heat pump is connected to the household meter (Haushaltszähler), where a controllable consumer (steuerbare Verbrauchseinrichtung) (e.g. wallbox)
 * already receives the flat-rate reduction (Pauschale), it brings no additional reduction.
 */
export function para14aFor(hp: Inputs['heatPump']): number {
  return hp.separateTariff || !hp.existing14aOnHousehold ? hp.para14aReduction : 0;
}

/** Special repayment (Sondertilgung) rules KfW 358/359 (fact sheet (Merkblatt) p. 5). */
function kfwRules(inp: Inputs): PrepaymentRules {
  const f = inp.financing;
  return {
    minAmount: f.kfwMinPrepay,
    freeWithinFix: true,
    fullOnlyAfterFix: true,
    feeRate: f.kfwFeeAfterFix,
    feeRateShortRemaining: f.kfwFeeAfterFix,
    capFeeAtInterest: false,
  };
}

/**
 * Special repayment (Sondertilgung) rules for consumer loans (§ 500 (2), § 502 BGB). The yearly free allowance
 * (kostenfreies Sondertilgungsrecht, F12.9) is the larger of the share of the loan amount and the fixed amount.
 */
function bankRules(inp: Inputs, principal: number): PrepaymentRules {
  const f = inp.financing;
  return {
    minAmount: 0,
    freeWithinFix: false,
    fullOnlyAfterFix: false,
    feeRate: f.bankPrepayFee,
    feeRateShortRemaining: f.bankPrepayFeeShort,
    capFeeAtInterest: true,
    freePerYear: Math.max(0, f.bankFreePrepayShare * principal, f.bankFreePrepayAmount),
  };
}

/** Order of loans for the one-off payment (Einmalzahlung): chosen loan first, otherwise highest interest rate first. */
function windfallOrder<T extends { name: string; spec: LoanSpec }>(loans: T[], target: string, month: number): T[] {
  const rateAt = (l: T) => (l.spec.fixMonths > 0 && month - l.spec.startMonth > l.spec.fixMonths ? l.spec.followUpRate : l.spec.rate);
  const isKfw = (l: T) => l.name.startsWith('KfW');
  return [...loans].sort((a, b) => {
    if (target === 'kfw' && isKfw(a) !== isKfw(b)) return isKfw(a) ? -1 : 1;
    if (target === 'bank' && isKfw(a) !== isKfw(b)) return isKfw(a) ? 1 : -1;
    return rateAt(b) - rateAt(a);
  });
}

const LABELS: Record<ScenarioKind, string> = {
  ref: 'Ohne Wärmepumpe (Referenz)',
  kfw: 'Wärmepumpe mit KfW-Zuschuss',
  tax: 'Wärmepumpe mit Steuerbonus',
};

const COST_KEYS: (keyof CostBreakdown)[] = [
  'energy',
  'fixed',
  'maintenance',
  'investment',
  'loanPayout',
  'interest',
  'principal',
  'fees',
  'subsidy',
  'taxBonus',
  'residual',
  'total',
];

function emptyBreakdown(): CostBreakdown {
  return {
    energy: 0,
    fixed: 0,
    maintenance: 0,
    investment: 0,
    loanPayout: 0,
    interest: 0,
    principal: 0,
    fees: 0,
    subsidy: 0,
    taxBonus: 0,
    residual: 0,
    total: 0,
  };
}

interface Asset {
  cost: number;
  install: number;
  lifeMonths: number;
}

/**
 * Inputs derived once from the user inputs that do not depend on the scenario or the installation month.
 * Shared by all scenarios of one calculation so the price model, PV model and energy split are not
 * rebuilt for every simulation – the sensitivity analysis and the installation-time comparison run dozens.
 */
export interface SimContext {
  start: number;
  priceModel: PriceModel;
  pvModel: PvModel;
  split: EnergySplit;
}

export function createSimContext(inp: Inputs): SimContext {
  return {
    start: parseMonth(inp.general.startMonth),
    priceModel: createPriceModel(inp),
    pvModel: createPvModel(inp),
    split: energySplit(inp),
  };
}

/**
 * Application month (Antragsmonat, absolute) of the KfW 458 application (F1.4, F1.5, F7.1). An empty entry is
 * automatic: AUTO_APPLICATION_LEAD_MONTHS before the commissioning month, so it moves with it. A fixed month
 * cannot lie after the commissioning month (F1.6): it is then moved to that month and `movedFrom` holds the entered one.
 */
export function applicationMonthOf(inp: Inputs, install: number): { month: number; movedFrom: number | null } {
  const fixed = tryParseMonth(inp.heatPump.applicationMonth);
  if (fixed === null) return { month: install - AUTO_APPLICATION_LEAD_MONTHS, movedFrom: null };
  if (fixed > install) return { month: install, movedFrom: fixed };
  return { month: fixed, movedFrom: null };
}

/**
 * Simulates a scenario month by month.
 * @param installOverride absolute installation month (overrides inputs.heatPump.installMonth)
 * @param ctx precomputed inputs shared by several simulations; defaults to a fresh context
 */
export function simulate(inp: Inputs, kind: ScenarioKind, installOverride?: number, ctx?: SimContext): ScenarioResult {
  const warnings: string[] = [];
  const c = ctx ?? createSimContext(inp);
  const start = c.start;
  const H = Math.max(1, Math.round(inp.general.horizonYears * 12));
  const end = start + H;
  const pm = c.priceModel;
  const pv = c.pvModel;
  // Space heating (Raumwärme), hot water (Warmwasser) and cooking handled separately (F17)
  const split = c.split;
  const cookStaysGas = split.cookingFuel > 0 && inp.oldHeating.cookingAfter === 'gas';
  const o = inp.oldHeating;
  const hp = inp.heatPump;
  const fin = inp.financing;
  const fuel = o.fuel;
  const growth = (rate: number, monthsFromStart: number) => Math.pow(1 + rate, monthsFromStart / 12);
  let feasible = true;

  let install: number | null = null;
  if (kind !== 'ref') {
    install = installOverride ?? parseMonth(hp.installMonth);
    if (install < start) {
      warnings.push('Installationszeitpunkt liegt vor dem Startmonat – auf Startmonat gesetzt.');
      install = start;
    }
    if (install >= end) {
      warnings.push('Installationszeitpunkt liegt außerhalb des Betrachtungszeitraums.');
      install = null;
      feasible = false;
    }
  }

  // Replacement boiler (Ersatzkessel) (reference or heat pump scenario, if the old system fails before installation)
  const oldEnd = start + Math.max(0, Math.round(o.remainingLifeYears * 12));
  const fossilEnd = install ?? end;
  const replLife = Math.max(1, Math.round(o.replacementLifeYears * 12));
  const replacements: number[] = [];
  for (let b = oldEnd; b < fossilEnd; b += replLife) replacements.push(b);
  if (kind !== 'ref' && replacements.length > 0) {
    warnings.push(
      `Die Altanlage erreicht ihr Lebensende (${formatMonthDe(oldEnd)}) vor der Installation der Wärmepumpe – ein Ersatzkessel ist eingerechnet.`,
    );
  }

  const rows: MonthRow[] = [];
  for (let m = 0; m < H; m++) {
    rows.push({ month: start + m, heatKWh: 0, cookingCost: 0, system: 'old', co2Kg: 0, pvKWh: 0, ...emptyBreakdown() });
  }
  const assets: Asset[] = [];

  const boilerPurchases: { month: number; cost: number }[] = [];
  const hpReplacements: { month: number; cost: number }[] = [];
  for (const b of replacements) {
    const cost = o.replacementCost * growth(inp.general.investIncrease, b - start);
    rows[b - start].investment += cost;
    boilerPurchases.push({ month: b, cost });
    // Residual value (Restwert) only if the boiler runs until the end; in the heat pump scenario it is replaced at installation
    if (install === null) assets.push({ cost, install: b, lifeMonths: replLife });
  }

  // Running costs
  for (const r of rows) {
    const abs = r.month;
    const year = yearOf(abs);
    const m = abs - start;
    const mo = monthOf(abs) - 1;
    const heatM = split.spaceHeat * SPACE_PROFILE[mo] + split.dhwHeat * DHW_PROFILE[mo];
    const cookM = split.cookingFuel / 12;
    r.heatKWh = heatM;
    const maintGrowth = growth(inp.general.costIncrease, m);
    if (install !== null && abs >= install) {
      r.system = 'wp';
      const elec = heatM / hp.jaz;
      const gridCt = pm.elecCt(abs);
      // Own PV (F28): monthly model – in winter little PV is left for the heat pump; valued at the lost feed-in tariff
      const fromPv = pv.forHeatPump(mo, elec);
      r.pvKWh = fromPv;
      r.energy = ((elec - fromPv) * gridCt + fromPv * hp.feedInCt) / 100;
      // CO2 (F25): grid electricity with the electricity mix (Strommix), own PV electricity counts as emission-free
      r.co2Kg = (elec - fromPv) * pm.gridCo2Kg(year);
      // Smart metering system (iMSys) required for the KfW subsidy: fixed price cap, needed with and without own meter
      r.fixed = ((hp.separateTariff ? hp.meterFee * pm.elecGrowth(abs) : 0) + hp.smartMeterFee - para14aFor(hp)) / 12;
      r.maintenance = (hp.maintenance * maintGrowth) / 12;
      if (cookM > 0) {
        // Cooking: stays on gas (connection incl. standing charge (Grundpreis) remains) or induction on the household meter (Haushaltszähler)
        if (cookStaysGas) {
          const gas = (cookM * pm.fuelCt('gas', abs)) / 100;
          const base = pm.gasBaseFee(abs) / 12;
          r.energy += gas;
          r.fixed += base;
          r.cookingCost = gas + base;
          r.co2Kg += cookM * (1 - pm.currentBioShare) * pm.fuelCo2Kg('gas');
        } else {
          const el = (cookM * inp.prices.cookingElecFactor * pm.householdCt(abs)) / 100;
          r.energy += el;
          r.cookingCost = el;
          r.co2Kg += cookM * inp.prices.cookingElecFactor * pm.gridCo2Kg(year);
        }
      }
    } else {
      const isNew = abs >= oldEnd;
      r.system = isNew ? 'new' : 'old';
      const eff = isNew ? o.replacementEfficiency : o.efficiency;
      const fuelKWh = heatM / eff;
      const ct = pm.fuelCt(fuel, abs) + (isNew ? pm.bioSurchargeCt(year) : 0);
      // Cooking does not run through the boiler and has no bio obligation (Bio-Pflicht)
      const cook = (cookM * pm.fuelCt(fuel, abs)) / 100;
      r.energy = (fuelKWh * ct) / 100 + cook;
      r.cookingCost = cook;
      // CO2 (F25): bio share (Bio-Anteil) counts as climate-neutral (as in the BEHG) – today's tariff share,
      // for a replacement boiler at least the legally required share (Bio-Treppe)
      const bioHeat = isNew ? Math.max(pm.currentBioShare, pm.bioShare(year)) : pm.currentBioShare;
      r.co2Kg = (fuelKWh * (1 - bioHeat) + cookM * (1 - pm.currentBioShare)) * pm.fuelCo2Kg(fuel);
      r.fixed = fuel === 'gas' ? pm.gasBaseFee(abs) / 12 : 0;
      r.maintenance = (o.maintenance * maintGrowth) / 12;
    }
  }

  const loans: LoanInfo[] = [];
  let windfall: WindfallInfo | undefined;
  let kfwRes: ScenarioResult['kfw'];
  let taxRes: ScenarioResult['tax'];
  let invest: InvestInfo | undefined;
  let subsidyMonthOut: number | undefined;
  let taxRefunds: ScenarioResult['taxRefunds'];

  if (install !== null) {
    const iIdx = install - start;
    const wpGross = hp.investment * growth(inp.general.investIncrease, iIdx);
    // Second meter (meter cabinet conversion (Zählerschrank-Umbau)) only with a separate heat pump tariff (Wärmepumpentarif) (F13.5)
    const meterSetup = hp.separateTariff ? Math.max(0, hp.meterSetupCost) * growth(inp.general.investIncrease, iIdx) : 0;
    const extra = hp.extraCost * growth(inp.general.investIncrease, iIdx) + (hp.meterSetupEligible ? 0 : meterSetup);
    const eligibleGross = wpGross * hp.eligibleShare + (hp.meterSetupEligible ? meterSetup : 0);
    const total = wpGross + extra + (hp.meterSetupEligible ? meterSetup : 0);
    rows[iIdx].investment += total;
    // New cooktop (Kochfeld) when switching to electricity (F17.3): one-off, not eligible for funding, paid from own funds
    const cooktop = split.cookingFuel > 0 && !cookStaysGas ? Math.max(0, inp.oldHeating.cookingSwitchCost) * growth(inp.general.investIncrease, iIdx) : 0;
    rows[iIdx].investment += cooktop;
    invest = {
      month: install,
      growth: growth(inp.general.investIncrease, iIdx),
      heatPump: wpGross,
      extra,
      meterSetup,
      eligible: eligibleGross,
      total,
      cooktop,
      equity: Math.min(Math.max(0, kind === 'kfw' ? fin.kfwEquity : fin.taxEquity), total),
    };
    const hpLife = Math.max(1, Math.round(hp.lifeYears * 12));
    assets.push({ cost: wpGross, install, lifeMonths: hpLife });
    // Replacement heat pump (Ersatz-Wärmepumpe) if the period is longer than its lifetime (without funding, like the replacement boiler (Ersatzkessel))
    for (let b = install + hpLife; b < end; b += hpLife) {
      const cost = hp.investment * growth(inp.general.investIncrease, b - start);
      rows[b - start].investment += cost;
      hpReplacements.push({ month: b, cost });
      assets.push({ cost, install: b, lifeMonths: hpLife });
    }
    if (hpReplacements.length > 0) {
      warnings.push(
        `Die Wärmepumpe erreicht ihr Lebensende (${formatMonthDe(hpReplacements[0].month)}) im Betrachtungszeitraum – eine Ersatz-Wärmepumpe ohne Förderung ist eingerechnet.`,
      );
    }

    const addLoan = (name: string, spec: LoanSpec, res: LoanResult) => {
      rows[spec.startMonth - start].loanPayout -= spec.principal;
      let interest = 0;
      let fees = 0;
      let balanceAtEnd = spec.principal;
      let payoffMonth: number | null = null;
      for (const p of res.payments) {
        if (p.month >= end) break;
        const row = rows[p.month - start];
        row.interest += p.interest;
        row.principal += p.principal;
        row.fees += p.fee;
        interest += p.interest;
        fees += p.fee;
        balanceAtEnd = p.balance;
        if (p.balance <= 0.005) payoffMonth = p.month;
      }
      if (balanceAtEnd > 0.005) {
        rows[H - 1].principal += balanceAtEnd;
        warnings.push(
          `${name}: Restschuld von ${Math.round(balanceAtEnd).toLocaleString('de-DE')} € am Ende des Betrachtungszeitraums als Ablösung eingerechnet.`,
        );
      }
      for (const x of res.extras) {
        if ((x.label === SUBSIDY || x.label === TAX_REFUND) && x.status === 'rejected') {
          warnings.push(`${name}: ${x.label} nicht als Sondertilgung möglich – ${x.reason}`);
        }
      }
      const lastPayment = res.payments.length ? res.payments[res.payments.length - 1].month : spec.startMonth;
      const fixEnd = spec.fixMonths > 0 ? spec.startMonth + spec.fixMonths : null;
      loans.push({
        name,
        principal: spec.principal,
        rate: spec.rate,
        totalInterest: interest,
        startMonth: spec.startMonth,
        repaymentStartMonth: spec.graceMonths > 0 ? spec.startMonth + spec.graceMonths + 1 : null,
        fixEndMonth: fixEnd !== null && fixEnd < lastPayment ? fixEnd : null,
        followUpRate: spec.followUpRate,
        payoffMonth,
        balanceAtEnd: balanceAtEnd > 0.005 ? balanceAtEnd : 0,
        extras: res.extras,
        totalFees: fees,
      });
    };

    /** Calculates the loans and distributes the one-off payment (Einmalzahlung) (e.g. life insurance) as special repayment (Sondertilgung). */
    const runLoans = (planned: { name: string; spec: LoanSpec }[]) => {
      const active = planned.filter((l) => l.spec.principal > 0);
      const results = new Map(active.map((l) => [l, loanScheduleDetailed(l.spec)] as const));
      const avail = tryParseMonth(fin.windfallMonth);
      if (fin.windfallAmount > 0 && avail !== null) {
        // Repayment date (F12.6): empty = immediately when available; earlier than available is not possible
        let wfMonth = tryParseMonth(fin.windfallRepayMonth) ?? avail;
        if (wfMonth < avail) {
          warnings.push(
            `Sondertilgung ${formatMonthDe(wfMonth)} liegt vor der Verfügbarkeit der Einmalzahlung – gerechnet wird mit ${formatMonthDe(avail)}.`,
          );
          wfMonth = avail;
        }
        windfall = {
          month: wfMonth,
          availableMonth: avail,
          amount: fin.windfallAmount,
          used: 0,
          unused: fin.windfallAmount,
          attempts: [],
          interestSaved: 0,
          fees: 0,
        };
        const interestInHorizon = () =>
          active.reduce((sum, l) => sum + results.get(l)!.payments.filter((p) => p.month < end).reduce((a, p) => a + p.interest, 0), 0);
        const interestBefore = interestInHorizon();
        if (wfMonth < start || wfMonth >= end) {
          windfall.note = 'Die Sondertilgung liegt außerhalb des Betrachtungszeitraums.';
        } else if (active.length === 0) {
          windfall.note = 'Es gibt keinen Kredit, der getilgt werden könnte.';
        } else {
          let remaining = fin.windfallAmount;
          for (const l of windfallOrder(active, fin.windfallTarget, wfMonth)) {
            if (remaining <= 0.005) break;
            const spec: LoanSpec = {
              ...l.spec,
              extraRepayments: [...(l.spec.extraRepayments ?? []), { month: wfMonth, amount: remaining, label: WINDFALL }],
            };
            const res = loanScheduleDetailed(spec);
            const r = res.extras.find((x) => x.label === WINDFALL)!;
            windfall.attempts.push({ loan: l.name, applied: r.applied, fee: r.fee, status: r.status, reason: r.reason, paidOff: r.paidOff });
            if (r.applied > 0) {
              l.spec = spec;
              results.set(l, res);
              remaining -= r.applied;
              windfall.fees += r.fee;
            }
          }
          windfall.used = fin.windfallAmount - remaining;
          windfall.unused = remaining;
          windfall.interestSaved = interestBefore - interestInHorizon();
        }
      }
      for (const l of active) addLoan(l.name, l.spec, results.get(l)!);
    };

    if (kind === 'kfw') {
      const app = applicationMonthOf(inp, install);
      const appMonth = app.month;
      if (app.movedFrom !== null) {
        warnings.push(
          `Der Antragsmonat ${formatMonthDe(app.movedFrom)} liegt nach dem Einbaumonat ${formatMonthDe(install)} – gerechnet wird mit einem Antrag im Einbaumonat.`,
        );
      }
      const lastRepl = replacements.filter((b) => b <= appMonth).pop();
      const oldAge =
        (appMonth - (lastRepl ?? parseMonth(o.installedMonth))) / 12;
      kfwRes = kfwSubsidy(
        {
          eligibleCost: eligibleGross,
          appMonth,
          fuel,
          oldHeatingAge: oldAge,
          ownerOccupied: inp.building.ownerOccupied,
          units: inp.building.units,
          householdIncome: incomeRangeValue(inp.building.incomeRange),
          hasChild: inp.building.hasChild,
          euOrigin: inp.heatPump.euOrigin,
        },
        inp.funding,
      );
      warnings.push(...kfwRes.notes);
      const subsidyMonth = install + Math.max(0, Math.round(fin.subsidyDelayMonths));
      subsidyMonthOut = subsidyMonth;
      if (subsidyMonth < end) {
        rows[subsidyMonth - start].subsidy -= kfwRes.subsidy;
      } else if (kfwRes.subsidy > 0) {
        // The claim exists – included like the remaining debt (Restschuld) of the loans at the end of the period
        rows[H - 1].subsidy -= kfwRes.subsidy;
        warnings.push(
          `KfW-Zuschuss wird erst ${formatMonthDe(subsidyMonth)} ausgezahlt – als Forderung am Ende des Betrachtungszeitraums eingerechnet.`,
        );
      }

      const equity = Math.min(Math.max(0, fin.kfwEquity), total);
      const need = total - equity;
      const variant = kfwLoanVariant(
        inp.building.ownerOccupied,
        inp.building.units,
        incomeRangeValue(inp.building.incomeRange),
        inp.funding,
      );
      const kfwMax = inp.funding.loanMaxPerUnit * Math.max(1, inp.building.units);
      const kfwLoan = fin.useKfwLoan ? Math.max(0, Math.min(need, kfwMax, eligibleGross)) : 0;
      const bankLoan = need - kfwLoan;
      if (!fin.useKfwLoan) {
        if (need > 0.005) {
          warnings.push(
            `Ohne KfW-Kredit: Finanzierungsbedarf von ${Math.round(bankLoan).toLocaleString('de-DE')} € wird über den Bankkredit gerechnet.`,
          );
        }
      } else if (need > kfwLoan + 0.005) {
        warnings.push(
          `Finanzierungsbedarf über KfW-Kredit hinaus (${Math.round(bankLoan).toLocaleString('de-DE')} €) wird über den Bankkredit gerechnet.`,
        );
      }
      // The subsidy (Zuschuss) repays the KfW loan; without one the bank loan of this path (F12.8)
      const subsidyExtra =
        fin.subsidyAsSpecialRepayment && subsidyMonth < end ? [{ month: subsidyMonth, amount: kfwRes.subsidy, label: SUBSIDY }] : [];
      const toKfw = kfwLoan > 0;
      runLoans([
        {
          name: `KfW-Kredit ${variant}`,
          spec: {
            principal: kfwLoan,
            startMonth: install,
            rate: variant === '358' ? fin.kfwRate358 : fin.kfwRate359,
            termMonths: Math.round(fin.kfwTermYears * 12),
            graceMonths: Math.round(fin.kfwGraceYears * 12),
            fixMonths: Math.round(fin.kfwFixYears * 12),
            followUpRate: fin.followUpRate,
            rules: kfwRules(inp),
            extraRepayments: toKfw ? subsidyExtra : [],
          },
        },
        {
          name: 'Bankkredit',
          spec: { ...bankSpec(bankLoan, install, inp), extraRepayments: toKfw || kfwRes.subsidy <= 0 ? [] : subsidyExtra },
        },
      ]);
    } else {
      const ageAtCompletion = install / 12 - inp.building.constructionYear;
      taxRes = taxBonus(
        {
          cost: eligibleGross,
          completionMonth: install,
          ownerOccupied: inp.building.ownerOccupied,
          buildingAgeAtCompletion: ageAtCompletion,
          incomeTax: inp.building.incomeTax,
        },
        inp.tax,
      );
      warnings.push(...taxRes.notes);
      if (!taxRes.eligible) feasible = false;
      const refundMonth = Math.min(12, Math.max(1, Math.round(fin.taxRefundMonth)));
      taxRefunds = taxRes.yearly.map((y) => ({ year: y.year, month: (y.year + 1) * 12 + (refundMonth - 1), amount: y.amount }));
      for (const y of taxRes.yearly) {
        const month = (y.year + 1) * 12 + (refundMonth - 1);
        if (month >= start && month < end) rows[month - start].taxBonus -= y.amount;
        else if (month >= end && y.amount > 0) rows[H - 1].taxBonus -= y.amount;
      }
      const late = taxRes.yearly.filter((y) => y.amount > 0 && (y.year + 1) * 12 + (refundMonth - 1) >= end);
      if (late.length > 0) {
        warnings.push(
          `Steuererstattung für ${late.map((y) => y.year).join(', ')} erfolgt nach dem Betrachtungszeitraum – als Forderung am Ende eingerechnet.`,
        );
      }
      const equity = Math.min(Math.max(0, fin.taxEquity), total);
      // Tax refunds (Steuererstattungen) as special repayments (Sondertilgung) of the bank loan (F12.8)
      const refundExtras = fin.taxRefundAsSpecialRepayment
        ? taxRefunds.filter((r) => r.amount > 0 && r.month >= start && r.month < end).map((r) => ({ month: r.month, amount: r.amount, label: TAX_REFUND }))
        : [];
      runLoans([{ name: 'Bankkredit', spec: { ...bankSpec(total - equity, install, inp), extraRepayments: refundExtras } }]);
    }
  }

  // Residual values (Restwert)
  if (inp.general.residualValue) {
    for (const a of assets) {
      const remaining = a.install + a.lifeMonths - end;
      if (remaining > 0) rows[H - 1].residual -= (a.cost * Math.min(remaining, a.lifeMonths)) / a.lifeMonths;
    }
  }

  // Totals and compounding
  const q = Math.pow(1 + inp.general.opportunityRate, 1 / 12) - 1;
  const cumulative: number[] = [];
  let cum = 0;
  let nominal = 0;
  for (const r of rows) {
    r.total =
      r.energy +
      r.fixed +
      r.maintenance +
      r.investment +
      r.loanPayout +
      r.interest +
      r.principal +
      r.fees +
      r.subsidy +
      r.taxBonus +
      r.residual;
    nominal += r.total;
    cum = cum * (1 + q) + r.total;
    cumulative.push(cum);
  }

  const years = aggregateYears(rows, cumulative);

  return {
    kind,
    label: LABELS[kind],
    feasible,
    installMonth: install,
    months: rows,
    years,
    cumulative,
    totalCost: cum,
    co2Tons: rows.reduce((sum, r) => sum + r.co2Kg, 0) / 1000,
    nominalCost: nominal,
    warnings,
    kfw: kfwRes,
    tax: taxRes,
    loans,
    boilerPurchases,
    hpReplacements,
    windfall,
    invest,
    subsidyMonth: subsidyMonthOut,
    taxRefunds,
  };
}

function bankSpec(principal: number, install: number, inp: Inputs): LoanSpec {
  const f = inp.financing;
  return {
    principal: Math.max(0, principal),
    startMonth: install,
    rate: f.bankRate,
    termMonths: Math.round(f.bankTermYears * 12),
    graceMonths: Math.round(f.bankGraceYears * 12),
    fixMonths: 0,
    followUpRate: f.bankRate,
    rules: bankRules(inp, Math.max(0, principal)),
  };
}

export function aggregateYears(rows: MonthRow[], cumulative: number[]): YearRow[] {
  const map = new Map<number, YearRow>();
  rows.forEach((r, i) => {
    const y = yearOf(r.month);
    let yr = map.get(y);
    if (!yr) {
      yr = { year: y, cumulative: 0, ...emptyBreakdown() };
      map.set(y, yr);
    }
    for (const k of COST_KEYS) yr[k] += r[k];
    yr.cumulative = cumulative[i];
  });
  return [...map.values()];
}

/**
 * Break-even point (Amortisation): first month from which the cumulative costs of the heat pump scenario
 * stay ≤ the reference until the end. null = no break-even within the period.
 */
export function breakEven(ref: ScenarioResult, wp: ScenarioResult): number | null {
  const n = Math.min(ref.cumulative.length, wp.cumulative.length);
  let lastWorse = -1;
  for (let i = 0; i < n; i++) if (wp.cumulative[i] > ref.cumulative[i] + 1e-6) lastWorse = i;
  if (lastWorse === n - 1) return null;
  return ref.months[lastWorse + 1].month;
}

export interface PriceRow {
  year: number;
  co2Price: number;
  fuelCt: number;
  elecCt: number;
  /** Cost per kWh of useful heat (Nutzwärme) (ct): fossil = fuel / efficiency, heat pump = electricity / SPF (JAZ). */
  heatCtFossil: number;
  heatCtWp: number;
}

export function priceRows(inp: Inputs): PriceRow[] {
  const pm = createPriceModel(inp);
  const out: PriceRow[] = [];
  // Annual average PV share of the heat pump electricity (F28)
  const pvShare = pvSummary(inp).share;
  const n = Math.ceil(inp.general.horizonYears) + 1;
  for (let i = 0; i < n; i++) {
    const year = pm.startYear + i;
    // Price at the start of the year (in the start year: start month)
    const month = Math.max(pm.startMonth, year * 12);
    const fuelCt = pm.fuelCt(inp.oldHeating.fuel, month);
    const elecCt = pm.elecCt(month);
    const hp = inp.heatPump;
    out.push({
      year,
      co2Price: pm.co2Price(year),
      fuelCt,
      elecCt,
      heatCtFossil: fuelCt / inp.oldHeating.efficiency,
      heatCtWp: ((1 - pvShare) * elecCt + pvShare * hp.feedInCt) / hp.jaz,
    });
  }
  return out;
}

export interface RunResult {
  ref: ScenarioResult;
  kfw: ScenarioResult;
  tax: ScenarioResult;
  breakEvenKfw: number | null;
  breakEvenTax: number | null;
  best: 'kfw' | 'tax';
}

export function runAll(inp: Inputs, ctx: SimContext = createSimContext(inp)): RunResult {
  const ref = simulate(inp, 'ref', undefined, ctx);
  const kfw = simulate(inp, 'kfw', undefined, ctx);
  const tax = simulate(inp, 'tax', undefined, ctx);
  const best = tax.feasible && tax.totalCost < kfw.totalCost ? 'tax' : 'kfw';
  return {
    ref,
    kfw,
    tax,
    breakEvenKfw: kfw.feasible ? breakEven(ref, kfw) : null,
    breakEvenTax: tax.feasible ? breakEven(ref, tax) : null,
    best,
  };
}
