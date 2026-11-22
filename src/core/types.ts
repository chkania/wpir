import type { ExtraResult } from './loan';

/** Fuel of the existing heating (Bestandsheizung). */
export type Fuel = 'gas' | 'oil';
/** Heat emitters (Heizflächen) of the house (F26). */
export type HeatEmitter = 'floor' | 'largeRadiators' | 'radiators';
/** Heat source (Wärmequelle) of the heat pump (F26). */
export type HeatSource = 'air' | 'ground';

/** Months are entered as ISO string "YYYY-MM" and handled internally as absolute month index (year*12 + month-1). */
export type MonthString = string;

export interface GeneralInputs {
  startMonth: MonthString;
  horizonYears: number;
  /** Opportunity interest rate (Opportunitätszins) p. a. as a fraction (0.02 = 2 %). */
  opportunityRate: number;
  /** General cost increase (maintenance) p. a. */
  costIncrease: number;
  /** Increase of investment costs (heat pump, boiler) p. a. until the purchase date. */
  investIncrease: number;
  residualValue: boolean;
  vat: number;
}

export interface BuildingInputs {
  ownerOccupied: boolean;
  units: number;
  /** Construction year of the building (F17). */
  constructionYear: number;
  /** Heated living area (m²). */
  heatedArea: number;
  /** Year of the last energy-related renovation (energetische Sanierung); 0 = none. */
  renovationYear: number;
  /** Scope of the last renovation. */
  renovationScope: 'partial' | 'full';
  /** Taxable annual household income (zu versteuerndes Einkommen) as income range code (Einkommensbereich, F5.4). */
  incomeRange: string;
  hasChild: boolean;
  /** Annual income tax liability (Einkommensteuerschuld) (€) as cap for § 35c; 0 = unlimited. */
  incomeTax: number;
}

export interface OldHeatingInputs {
  fuel: Fuel;
  /** Gas: kWh/year, oil: litres/year. */
  consumption: number;
  efficiency: number;
  /** Commissioning (Inbetriebnahme) of the existing heating, YYYY-MM – decides the climate speed bonus (Klimageschwindigkeitsbonus) to the month. */
  installedMonth: MonthString;
  /** Hot water (Warmwasser) is produced by the heating system (F17). */
  dhwViaHeating: boolean;
  /** Share of hot water (Warmwasser) in total consumption (0–1). */
  dhwShare: number;
  /** Gas cooker (Gasherd) on the same connection (gas only). */
  cookingWithGas: boolean;
  /** Share of cooking in total consumption (0–1). */
  cookingShare: number;
  /** Cooking after the switch: electricity (induction) or still gas (connection remains). */
  cookingAfter: 'electric' | 'gas';
  /** One-off cost of a new cooktop (Kochfeld) (induction) when switching to electricity (€, today's prices). */
  cookingSwitchCost: number;
  remainingLifeYears: number;
  /** Maintenance + chimney sweep (Schornsteinfeger) €/year. */
  maintenance: number;
  replacementCost: number;
  replacementEfficiency: number;
  replacementLifeYears: number;
}

export interface PriceInputs {
  /** Current gas price ct/kWh gross incl. CO2. */
  gasPriceCt: number;
  gasBaseFee: number;
  gasIncrease: number;
  /** Current heating oil price €/litre gross incl. CO2. */
  oilPriceEur: number;
  oilIncrease: number;
  oilKwhPerLiter: number;
  /** CO2 price path "year:€/t, year:€/t, …". */
  co2Path: string;
  gasCo2Factor: number;
  oilCo2Factor: number;
  /** CO2 emission factor of the German electricity mix (Strommix) "year:g/kWh, …" (F25). */
  gridCo2Path: string;
  bioEnabled: boolean;
  /** Bio step-up (Bio-Treppe) "year:share%, …". */
  bioSteps: string;
  bioPremiumCt: number;
  /** Share of biogas/bio oil (Biogas/Bioöl) bought today (0–1, e.g. biogas tariff); counts as climate-neutral (F25.4). */
  currentBioShare: number;
  /** Electricity needed for cooking per kWh of gas (induction instead of gas cooker (Gasherd)). */
  cookingElecFactor: number;
}

export interface HeatPumpInputs {
  investment: number;
  eligibleShare: number;
  extraCost: number;
  jaz: number;
  /** Heat source (Wärmequelle): outside air or ground (Erdwärme) – basis of the SPF (JAZ) estimate (F26). */
  source: HeatSource;
  /** Heat emitters (Heizflächen) – basis of the SPF (JAZ) estimate (F26). */
  emitter: HeatEmitter;
  maintenance: number;
  lifeYears: number;
  installMonth: MonthString;
  /** Application month (Antragsmonat) of the KfW 458 application, JJJJ-MM; empty = automatic (F1.5). */
  applicationMonth: string;
  /** Heat pump of EU origin (value-added bonus (Wertschöpfungs-Bonus)). */
  euOrigin: boolean;
  separateTariff: boolean;
  elecPriceCt: number;
  householdPriceCt: number;
  elecIncrease: number;
  meterFee: number;
  /** Running cost of the smart metering system (intelligentes Messsystem, iMSys) incl. control unit (Steuerungseinrichtung), €/year, fixed (price cap (Preisobergrenze) § 30 MsbG). */
  smartMeterFee: number;
  /** One-off cost of the second meter (meter cabinet conversion (Zählerschrank-Umbau)), only with a separate heat pump tariff (Wärmepumpentarif). */
  meterSetupCost: number;
  /** Meter cabinet conversion (Zählerschrank-Umbau) recognised as eligible (to be confirmed by the installer). */
  meterSetupEligible: boolean;
  para14aReduction: number;
  /** A controllable consumer (steuerbare Verbrauchseinrichtung) with § 14a (e.g. wallbox) is already connected to the household meter (Haushaltszähler). */
  existing14aOnHousehold: boolean;
  /** Peak power (Leistung) of the own PV system in kWp; 0 = no PV (F28). */
  pvKwp: number;
  /** Specific annual yield (spezifischer Ertrag) of the PV system, kWh per kWp and year (F28). */
  pvYield: number;
  /** Usable capacity of the battery storage (Batteriespeicher), kWh; 0 = none (F28). */
  batteryKwh: number;
  /** Household electricity (Haushaltsstrom) without heat pump, kWh/year – it uses the PV first (F28). */
  householdKwh: number;
  feedInCt: number;
  /** Grid electricity from a green tariff (Ökostromtarif): counted with 0 g CO2/kWh in the CO2 balance (F25.4). */
  greenElectricity: boolean;
}

export interface FinancingInputs {
  kfwEquity: number;
  taxEquity: number;
  kfwRate358: number;
  kfwRate359: number;
  kfwTermYears: number;
  kfwGraceYears: number;
  kfwFixYears: number;
  followUpRate: number;
  /** Apply for KfW supplementary loan (Ergänzungskredit) 358/359; false = external financing via the bank loan only. */
  useKfwLoan: boolean;
  /** Subsidy (Zuschuss) repays the KfW loan, without one the bank loan of the KfW path. */
  subsidyAsSpecialRepayment: boolean;
  /** Tax refunds (Steuererstattungen) repay the bank loan of the tax path. */
  taxRefundAsSpecialRepayment: boolean;
  bankRate: number;
  bankTermYears: number;
  bankGraceYears: number;
  subsidyDelayMonths: number;
  taxRefundMonth: number;
  /** Future one-off payment (Einmalzahlung) (e.g. life insurance) for special repayments (Sondertilgung); 0 = none. */
  windfallAmount: number;
  windfallMonth: MonthString;
  /** Month of the special repayment (Sondertilgung) (YYYY-MM); empty = immediately when available. */
  windfallRepayMonth: string;
  /** Which loan first: 'auto' = highest interest rate first. */
  windfallTarget: 'auto' | 'kfw' | 'bank';
  /** KfW: minimum special repayment (Sondertilgung) within the first fixed-rate period (Zinsbindung). */
  kfwMinPrepay: number;
  /** KfW: early repayment charge (Vorfälligkeitsentschädigung) after the fixed-rate period (Zinsbindung) (fraction, assumption). */
  kfwFeeAfterFix: number;
  /** Bank: early repayment charge (Vorfälligkeitsentschädigung) (§ 502 BGB max. 1 %). */
  bankPrepayFee: number;
  /** Bank: early repayment charge (Vorfälligkeitsentschädigung) for a remaining term ≤ 1 year (§ 502 BGB max. 0.5 %). */
  bankPrepayFeeShort: number;
  /** Bank: free special repayment allowance (kostenfreies Sondertilgungsrecht) per calendar year as share of the loan amount. */
  bankFreePrepayShare: number;
  /** Bank: free special repayment allowance per calendar year as fixed amount (€); the larger of both applies. */
  bankFreePrepayAmount: number;
}

export interface FundingParams {
  grundRate: number;
  /** Base funding (Grundförderung) for heat pumps from grundRateNewFrom (guideline (Richtlinie) no. 8.4.1 c: 15 %). */
  grundRateNew: number;
  /** From this application month (Antragsmonat) grundRateNew and the value-added bonus (Wertschöpfungs-Bonus) apply; empty = never. */
  grundRateNewFrom: MonthString;
  /** Value-added bonus (Wertschöpfungs-Bonus) for heat pumps of EU origin (guideline (Richtlinie) no. 8.4.6). */
  wsbRate: number;
  kgbRate: number;
  kgbStep: number;
  kgbDegressionStart: MonthString;
  kgbEnd: MonthString;
  kgbMinGasAge: number;
  incomeLimit1: number;
  incomeRate1: number;
  incomeLimit2: number;
  incomeRate2: number;
  incomeLimit3: number;
  incomeRate3: number;
  incomeChildShift: number;
  maxRate: number;
  maxRateLowIncome: number;
  cap1: number;
  capStep: number;
  /** Floor after the end of the degression (from 08/2030: 22,000 €). */
  capFloor: number;
  capDegressionStart: MonthString;
  cap2to6: number;
  cap7plus: number;
  loanMaxPerUnit: number;
  loan358IncomeLimit: number;
}

export interface TaxParams {
  rateYear1: number;
  rateYear2: number;
  rateYear3: number;
  maxBonus: number;
  maxCost: number;
  /** Last permitted completion month. */
  deadline: MonthString;
  minBuildingAge: number;
}

export interface CompareInputs {
  stepMonths: number;
  count: number;
}

/** Link to a document for the installer or energy adviser (F16.4); the address is only shown and opened, never loaded. */
export interface DocumentLink {
  /** Short description, e.g. "Angebot Heizungsbauer". */
  title: string;
  /** http:// or https:// address. */
  url: string;
}

/** Description of the scenario (F16) – does not affect the calculation. */
export interface ScenarioInfo {
  /** Name, e.g. "Variante Herbst 2027"; used in the export file name. */
  name: string;
  /** Free text: description, assumptions, quotes … */
  notes: string;
  /** Links to documents (F16.4), at most MAX_DOCUMENTS. */
  documents: DocumentLink[];
}

export interface Inputs {
  version: 1;
  scenario: ScenarioInfo;
  general: GeneralInputs;
  building: BuildingInputs;
  oldHeating: OldHeatingInputs;
  prices: PriceInputs;
  heatPump: HeatPumpInputs;
  financing: FinancingInputs;
  funding: FundingParams;
  tax: TaxParams;
  compare: CompareInputs;
}

export type ScenarioKind = 'ref' | 'kfw' | 'tax';

/** Cost categories; positive values = expenses, negative = income. */
export interface CostBreakdown {
  energy: number;
  fixed: number;
  maintenance: number;
  investment: number;
  loanPayout: number;
  interest: number;
  principal: number;
  /** Early repayment charges (Vorfälligkeitsentschädigung). */
  fees: number;
  subsidy: number;
  taxBonus: number;
  residual: number;
  total: number;
}

export interface MonthRow extends CostBreakdown {
  month: number;
  /** Useful heat (Nutzwärme) of the heating system (space heating (Raumwärme) + hot water (Warmwasser) if applicable). */
  heatKWh: number;
  /** Of which costs for cooking (in energy/fixed), e.g. for the tariff comparison. */
  cookingCost: number;
  /** 'old' | 'new' (replacement boiler (Ersatzkessel)) | 'wp' */
  system: 'old' | 'new' | 'wp';
  /** CO2 emissions of heating and cooking in kg (F25). */
  co2Kg: number;
  /** Heat pump electricity covered by the own PV system (kWh) (F28). */
  pvKWh: number;
}

export interface YearRow extends CostBreakdown {
  year: number;
  /** Cumulative costs (incl. opportunity interest (Opportunitätszins)) at year end. */
  cumulative: number;
}

export interface KfwResult {
  eligible: boolean;
  appMonth: number;
  grundRate: number;
  wsbRate: number;
  kgbRate: number;
  incomeRate: number;
  /** Effective subsidy rate (Fördersatz) of the owner-occupied (selbstgenutzt) unit (after the maximum rate (Höchstsatz)). */
  ownerUnitRate: number;
  maxRate: number;
  capTotal: number;
  eligibleCosts: number;
  subsidy: number;
  notes: string[];
}

export interface TaxResult {
  eligible: boolean;
  completionYear: number;
  total: number;
  yearly: { year: number; amount: number }[];
  notes: string[];
}

export interface LoanInfo {
  name: string;
  principal: number;
  rate: number;
  totalInterest: number;
  startMonth: number;
  /** First repayment instalment (Rate) (after the repayment-free period (tilgungsfreie Anlaufzeit)); null without an initial period. */
  repaymentStartMonth: number | null;
  /** End of the fixed-rate period (Zinsbindung) if before the end of repayment; followUpRate applies afterwards. */
  fixEndMonth: number | null;
  followUpRate: number;
  /** Month of the last instalment (Rate), if within the analysis period (Betrachtungszeitraum). */
  payoffMonth: number | null;
  /** Remaining debt (Restschuld) at the end of the period (included as payoff). */
  balanceAtEnd: number;
  /** Results of the special repayments (Sondertilgung) (subsidy (Zuschuss), one-off payment (Einmalzahlung)). */
  extras: ExtraResult[];
  totalFees: number;
}

export interface WindfallAttempt {
  loan: string;
  applied: number;
  fee: number;
  status: 'applied' | 'partial' | 'rejected';
  reason?: string;
  paidOff: boolean;
}

export interface WindfallInfo {
  /** Month of the special repayment (Sondertilgung). */
  month: number;
  /** Month from which the money is available. */
  availableMonth: number;
  /** Loan interest saved within the analysis period (Betrachtungszeitraum) by the special repayment (Sondertilgung). */
  interestSaved: number;
  /** Early repayment charges (Vorfälligkeitsentschädigung) of the special repayment (Sondertilgung). */
  fees: number;
  amount: number;
  used: number;
  unused: number;
  attempts: WindfallAttempt[];
  /** Note why nothing was applied (e.g. outside the period, no loan). */
  note?: string;
}

/** Investment of the heat pump scenarios at installation (gross €, with the investment price increase), for the derivation page (F32). */
export interface InvestInfo {
  month: number;
  /** Factor of the investment price increase from the start month to the installation month. */
  growth: number;
  /** Heat pump price (offer) at installation. */
  heatPump: number;
  /** Not eligible extra costs (incl. second meter if not eligible). */
  extra: number;
  /** Second meter (Zählerschrank-Umbau), only with a separate heat pump tariff (Wärmepumpentarif). */
  meterSetup: number;
  /** Eligible costs (förderfähige Kosten) before the cap (Höchstbetrag). */
  eligible: number;
  /** Total investment (financed with equity and loans). */
  total: number;
  /** New cooktop (Kochfeld) when cooking switches to electricity; paid from own funds. */
  cooktop: number;
  /** Equity (Eigenkapital) used. */
  equity: number;
}

export interface ScenarioResult {
  kind: ScenarioKind;
  label: string;
  feasible: boolean;
  installMonth: number | null;
  months: MonthRow[];
  years: YearRow[];
  /** Cumulative costs at each month end (incl. opportunity interest (Opportunitätszins)). */
  cumulative: number[];
  totalCost: number;
  /** CO2 emissions of heating and cooking over the period in tonnes (F25). */
  co2Tons: number;
  /** Total without interest. */
  nominalCost: number;
  warnings: string[];
  kfw?: KfwResult;
  tax?: TaxResult;
  loans: LoanInfo[];
  /** Purchases of replacement boilers (Ersatzkessel) (month, gross cost). */
  boilerPurchases: { month: number; cost: number }[];
  /** Replacement heat pumps (Ersatz-Wärmepumpe) after the end of their lifetime (month, gross cost). */
  hpReplacements: { month: number; cost: number }[];
  windfall?: WindfallInfo;
  /** Investment at installation (heat pump scenarios only). */
  invest?: InvestInfo;
  /** Payout month of the KfW subsidy (Zuschuss); may lie after the period (then included at the end). */
  subsidyMonth?: number;
  /** Refunds of the tax bonus (Steuerbonus) per tax year with the refund month; may lie after the period. */
  taxRefunds?: { year: number; month: number; amount: number }[];
}
