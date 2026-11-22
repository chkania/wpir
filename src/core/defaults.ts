import { formatMonth, monthFromDate, parseMonth } from './dates';
import type { Inputs } from './types';

/**
 * Central default assumptions. Sources and dates: see docs/anforderungen/quellen.md and annahmen.md.
 *
 * KfW 458 funding – as stated on the KfW website, retrieved 2026-11-11:
 *  - Base funding (Grundförderung) 30 %; from Q1/2027 for heat pumps 15 % + 15 % value-added bonus (Wertschöpfungs-Bonus) for EU origin (guideline (Richtlinie) no. 8.4.1 c, 8.4.6)
 *  - Climate speed bonus (Klimageschwindigkeitsbonus) 16 %, from 2027-02-01 reduced by 4 percentage points every six months, dropped for applications from 2028-08-01
 *  - Income bonus (Einkommensbonus) 40/30/10 % up to 30/40/50 k€ taxable income (zu versteuerndes Einkommen) (+10 k€ with child), valid since 2026-07-21
 *  - Maximum rate (Höchstsatz) 70 % (80 % for the lowest income bracket)
 *  - Eligible costs (förderfähige Kosten) 28,000 € (1st dwelling unit (Wohneinheit)), from 2027-02-01 reduced by 750 € every six months down to 22,000 € from 08/2030; 2nd–6th unit 15,000 €, from 7th unit 8,000 €
 * KfW 358/359: up to 120,000 € per dwelling unit; 358 up to 90,000 € household income. Interest rates from a secondary source (hausvoraus.de, 2026-11-10).
 * Market and price values: researched on 2026-11-11, checked again on 2026-11-18 (F22.3 report), sources per field in sources.ts.
 * § 35c EStG: 20 % (7/7/6), max. 40,000 €, costs max. 200,000 €, completion by end of 2029 (§ 52 (35a) EStG).
 */
export const FUNDING_SOURCE_DATE = '2026-11-18';
/** Automatic application month (F1.5): this many months before the commissioning month, if no month is entered. */
export const AUTO_APPLICATION_LEAD_MONTHS = 4;

/** Jan … Dec – share of the annual heat demand (Wärmebedarf) (space heating (Raumwärme) + 15 % hot water (Warmwasser)), sum = 1. */
export const HEAT_PROFILE: readonly number[] = [
  0.165, 0.145, 0.125, 0.08, 0.045, 0.025, 0.02, 0.02, 0.035, 0.075, 0.12, 0.145,
];
/** Monthly profile for hot water (Warmwasser) (almost uniform, slightly higher in winter due to colder inlet water), sum = 1. */
export const DHW_PROFILE: readonly number[] = [
  0.093, 0.087, 0.091, 0.085, 0.083, 0.077, 0.075, 0.075, 0.077, 0.083, 0.085, 0.089,
];
/** Monthly profile for space heating (Raumwärme), derived so that 85 % space heating + 15 % hot water (Warmwasser) = HEAT_PROFILE (F17), sum = 1. */
export const SPACE_PROFILE: readonly number[] = [
  0.1777, 0.1552, 0.131, 0.0791, 0.0383, 0.0158, 0.0103, 0.0103, 0.0276, 0.0736, 0.1262, 0.1549,
];

export function createDefaults(today: Date = new Date()): Inputs {
  const start = monthFromDate(today);
  return {
    version: 1,
    scenario: { name: '', notes: '', documents: [] },
    general: {
      startMonth: start,
      horizonYears: 20,
      opportunityRate: 0.02,
      costIncrease: 0.02,
      investIncrease: 0.02,
      residualValue: true,
      vat: 0.19,
    },
    building: {
      ownerOccupied: true,
      units: 1,
      constructionYear: Math.floor(parseMonth(start) / 12) - 40,
      heatedArea: 140,
      renovationYear: 0,
      renovationScope: 'partial',
      incomeRange: '50001-60000',
      hasChild: false,
      incomeTax: 0,
    },
    oldHeating: {
      fuel: 'gas',
      consumption: 20000,
      efficiency: 0.9,
      installedMonth: formatMonth(parseMonth(start) - 22 * 12),
      dhwViaHeating: true,
      dhwShare: 0.15,
      cookingWithGas: false,
      cookingShare: 0.03,
      cookingAfter: 'electric',
      cookingSwitchCost: 800,
      remainingLifeYears: 5,
      maintenance: 300,
      replacementCost: 17500,
      replacementEfficiency: 0.95,
      replacementLifeYears: 20,
    },
    prices: {
      gasPriceCt: 12.2,
      gasBaseFee: 150,
      gasIncrease: 0.03,
      oilPriceEur: 1.64,
      oilIncrease: 0.03,
      oilKwhPerLiter: 10,
      co2Path: '2026:55, 2027:65, 2028:80, 2030:110, 2035:160, 2040:200, 2045:220',
      gasCo2Factor: 0.201,
      oilCo2Factor: 0.266,
      gridCo2Path: '2025:344, 2030:250, 2035:150, 2040:80, 2045:30',
      bioEnabled: true,
      bioSteps: '2029:10, 2030:15, 2035:30, 2040:60',
      bioPremiumCt: 3,
      currentBioShare: 0,
      cookingElecFactor: 0.55,
    },
    heatPump: {
      investment: 32000,
      eligibleShare: 1,
      extraCost: 0,
      jaz: 3.3,
      source: 'air',
      emitter: 'radiators',
      maintenance: 150,
      lifeYears: 20,
      installMonth: formatMonth(parseMonth(start) + 6),
      applicationMonth: '',
      euOrigin: true,
      separateTariff: true,
      elecPriceCt: 24,
      householdPriceCt: 37,
      elecIncrease: 0.02,
      meterFee: 100,
      smartMeterFee: 100,
      meterSetupCost: 0,
      meterSetupEligible: false,
      para14aReduction: 130,
      existing14aOnHousehold: false,
      pvKwp: 0,
      pvYield: 950,
      batteryKwh: 0,
      householdKwh: 3500,
      feedInCt: 7.7,
      greenElectricity: false,
    },
    financing: {
      kfwEquity: 10000,
      taxEquity: 10000,
      kfwRate358: 0.022,
      kfwRate359: 0.046,
      kfwTermYears: 20,
      kfwGraceYears: 1,
      kfwFixYears: 10,
      followUpRate: 0.04,
      useKfwLoan: true,
      subsidyAsSpecialRepayment: true,
      taxRefundAsSpecialRepayment: true,
      bankRate: 0.065,
      bankTermYears: 15,
      bankGraceYears: 0,
      subsidyDelayMonths: 3,
      taxRefundMonth: 6,
      windfallAmount: 0,
      windfallMonth: formatMonth(parseMonth(start) + 60),
      windfallRepayMonth: '',
      windfallTarget: 'auto',
      kfwMinPrepay: 5000,
      kfwFeeAfterFix: 0.01,
      bankPrepayFee: 0.01,
      bankPrepayFeeShort: 0.005,
      bankFreePrepayShare: 0,
      bankFreePrepayAmount: 0,
    },
    funding: {
      grundRate: 0.3,
      grundRateNew: 0.15,
      grundRateNewFrom: '2027-01',
      wsbRate: 0.15,
      kgbRate: 0.16,
      kgbStep: 0.04,
      kgbDegressionStart: '2027-02',
      kgbEnd: '2028-08',
      kgbMinGasAge: 20,
      incomeLimit1: 30000,
      incomeRate1: 0.4,
      incomeLimit2: 40000,
      incomeRate2: 0.3,
      incomeLimit3: 50000,
      incomeRate3: 0.1,
      incomeChildShift: 10000,
      maxRate: 0.7,
      maxRateLowIncome: 0.8,
      cap1: 28000,
      capStep: 750,
      capFloor: 22000,
      capDegressionStart: '2027-02',
      cap2to6: 15000,
      cap7plus: 8000,
      loanMaxPerUnit: 120000,
      loan358IncomeLimit: 90000,
    },
    tax: {
      rateYear1: 0.07,
      rateYear2: 0.07,
      rateYear3: 0.06,
      maxBonus: 40000,
      maxCost: 200000,
      deadline: '2029-12',
      minBuildingAge: 10,
    },
    compare: {
      stepMonths: 6,
      count: 9,
    },
  };
}
