import type { Inputs } from '../core/types';

export type FieldType = 'number' | 'percent' | 'checkbox' | 'select' | 'month' | 'text' | 'textarea';

export interface Field {
  /** Path in the Inputs object, e.g. "heatPump.jaz". */
  path: string;
  label: string;
  type: FieldType;
  unit?: string | ((i: Inputs) => string);
  step?: number;
  min?: number;
  max?: number;
  options?: [string, string][];
  help?: string;
  placeholder?: string;
  /** No default value with an origin (e.g. free text) – no "i" popover. */
  noSource?: boolean;
  /** Does not change the calculation (save only, no recalculation). */
  noRecalc?: boolean;
  show?: (i: Inputs) => boolean;
  /** Calculated note below the field, updated with every change (e.g. absolute value of a share). */
  note?: (i: Inputs) => string;
  /** Reaction to a change (e.g. unit conversion). */
  onChange?: (i: Inputs, prev: unknown) => void;
}

export interface Section {
  id: string;
  title: string;
  expert?: boolean;
  open?: boolean;
  note?: string;
  fields: Field[];
}

const kwhDe = (x: number) => `${(Math.round(x / 10) * 10).toLocaleString('de-DE')} kWh`;
/**
 * Final energy for hot water and cooking (kWh) – same split as energySplit() in core/prices.ts (tested against it).
 * Calculated here because this file runs with plain Node (scripts/assumptions-checklist.ts) and may only import types.
 */
export function shareFuel(i: Inputs): { dhw: number; cooking: number } {
  const o = i.oldHeating;
  const total = o.fuel === 'gas' ? o.consumption : o.consumption * i.prices.oilKwhPerLiter;
  const cook = o.fuel === 'gas' && o.cookingWithGas ? Math.max(0, o.cookingShare) : 0;
  const dhw = o.dhwViaHeating ? Math.max(0, o.dhwShare) : 0;
  return { dhw: total * Math.min(dhw, 1 - cook), cooking: total * cook };
}
/** Absolute amount of fuel per year, in the unit of the consumption (F17.5): kWh gas or litres of oil (+ kWh). */
const fuelAmount = (i: Inputs, kWh: number) =>
  i.oldHeating.fuel === 'oil'
    ? `${(Math.round(kWh / i.prices.oilKwhPerLiter / 10) * 10).toLocaleString('de-DE')} l Heizöl (${kwhDe(kWh)})`
    : `${kwhDe(kWh)} Gas`;
/** Absolute month (year*12 + month-1) of YYYY-MM, null if invalid – inline, see shareFuel why core/dates is not imported. */
const absMonth = (s: string): number | null => {
  const m = /^(\d{4})-(\d{2})$/.exec(s);
  return m ? Number(m[1]) * 12 + Number(m[2]) - 1 : null;
};
const deMonth = (abs: number) => `${String((abs % 12) + 1).padStart(2, '0')}/${Math.floor(abs / 12)}`;
/** Age of the heating at the start of the evaluation and, for gas, the month it reaches the minimum age for the climate speed bonus (Klimageschwindigkeitsbonus) (F34). */
export function heatingAgeNote(i: Inputs): string {
  const installed = absMonth(i.oldHeating.installedMonth);
  const start = absMonth(i.general.startMonth);
  if (installed === null || start === null) return '';
  const months = Math.max(0, start - installed);
  const y = Math.floor(months / 12);
  const m = months % 12;
  const age = `${y} ${y === 1 ? 'Jahr' : 'Jahre'}${m ? ` ${m} ${m === 1 ? 'Monat' : 'Monate'}` : ''}`;
  const text = `Alter zum Start der Betrachtung (${deMonth(start)}): ${age}.`;
  if (i.oldHeating.fuel !== 'gas') return text;
  const reach = installed + Math.ceil(i.funding.kgbMinGasAge * 12);
  return `${text} ${i.funding.kgbMinGasAge} Jahre ${reach <= start ? 'erreicht seit' : 'erreicht'} ${deMonth(reach)}.`;
}
/**
 * Note under the application month (F1.5): the automatic month when the field is empty. Lead time 4 months
 * as in AUTO_APPLICATION_LEAD_MONTHS (core/defaults.ts); inline here because this file may only import types.
 */
export function applicationMonthNote(i: Inputs): string {
  if (i.heatPump.applicationMonth !== '') return '';
  const install = absMonth(i.heatPump.installMonth);
  if (install === null) return '';
  const auto = install - 4;
  return `automatisch: ${Math.floor(auto / 12)}-${String((auto % 12) + 1).padStart(2, '0')}`;
}
/** Window note of the planned commissioning (F1.7) for a fixed application month; empty for the automatic month. Inline like absMonth. */
export function installWindowNote(i: Inputs): string {
  const app = absMonth(i.heatPump.applicationMonth);
  if (app === null) return '';
  const lastYear = Math.floor(app / 12) + 3;
  return `Zulässig bis 12/${lastYear}: höchstens drei Jahre nach dem Antragsjahr ${Math.floor(app / 12)}.`;
}
const hasPv = (i: Inputs) => i.heatPump.pvKwp > 0;
const isGas = (i: Inputs) => i.oldHeating.fuel === 'gas';
const isOil = (i: Inputs) => i.oldHeating.fuel === 'oil';

export const SECTIONS: Section[] = [
  {
    id: 'scenario',
    title: 'Szenario',
    open: true,
    fields: [
      {
        path: 'scenario.name',
        label: 'Bezeichnung des Szenarios',
        type: 'text',
        placeholder: 'z. B. Angebot Firma A, Herbst 2027',
        help: 'Zur Unterscheidung mehrerer Szenarien; wird in den Dateinamen beim Export übernommen.',
        noSource: true,
        noRecalc: true,
      },
      {
        path: 'scenario.notes',
        label: 'Bemerkungen',
        type: 'textarea',
        placeholder: 'Beschreibung, Annahmen, Angebote, offene Fragen …',
        noSource: true,
        noRecalc: true,
      },
    ],
  },
  {
    id: 'old',
    title: 'Bestandsheizung',
    open: true,
    fields: [
      {
        path: 'oldHeating.fuel',
        label: 'Energieträger',
        type: 'select',
        options: [
          ['gas', 'Erdgas'],
          ['oil', 'Heizöl'],
        ],
        onChange: (i, prev) => {
          if (prev === 'gas' && i.oldHeating.fuel === 'oil') i.oldHeating.consumption = Math.round(i.oldHeating.consumption / 10);
          if (prev === 'oil' && i.oldHeating.fuel === 'gas') i.oldHeating.consumption = Math.round(i.oldHeating.consumption * 10);
        },
      },
      {
        path: 'oldHeating.consumption',
        label: 'Verbrauch pro Jahr',
        type: 'number',
        unit: (i) => (isGas(i) ? 'kWh' : 'Liter'),
        step: 100,
        min: 0,
        help: 'Gesamter Verbrauch laut Abrechnung (inkl. Warmwasser und ggf. Kochen), am besten der Durchschnitt mehrerer Jahre.',
      },
      { path: 'oldHeating.dhwViaHeating', label: 'Warmwasser über die Heizung', type: 'checkbox', help: 'Nicht ankreuzen bei Durchlauferhitzer oder elektrischem Speicher.' },
      { path: 'oldHeating.dhwShare', label: 'Anteil Warmwasser am Verbrauch', type: 'percent', unit: '%', step: 1, min: 0, max: 60, show: (i) => i.oldHeating.dhwViaHeating, help: 'Typisch 10–20 % im Einfamilienhaus, in gut gedämmten Häusern mehr.', note: (i) => `Aus Ihrem Verbrauch: ≈ ${fuelAmount(i, shareFuel(i).dhw)} im Jahr für Warmwasser.` },
      { path: 'oldHeating.cookingWithGas', label: 'Kochen mit Gas', type: 'checkbox', show: isGas, help: 'Gasherd am selben Anschluss.' },
      { path: 'oldHeating.cookingShare', label: 'Anteil Kochen am Verbrauch', type: 'percent', unit: '%', step: 0.5, min: 0, max: 30, show: (i) => isGas(i) && i.oldHeating.cookingWithGas, help: 'Typisch 1–3 % (ein Gasherd braucht etwa 300–600 kWh im Jahr).', note: (i) => `Aus Ihrem Verbrauch: ≈ ${fuelAmount(i, shareFuel(i).cooking)} im Jahr fürs Kochen.` },
      {
        path: 'oldHeating.cookingAfter',
        label: 'Kochen nach dem Umstieg',
        type: 'select',
        options: [
          ['electric', 'Mit Strom (Induktion) – Gasanschluss entfällt'],
          ['gas', 'Weiter mit Gas – Gasanschluss bleibt'],
        ],
        show: (i) => isGas(i) && i.oldHeating.cookingWithGas,
        help: 'Bleibt der Gasherd, fallen weiter Gas-Grundpreis und Gaskosten fürs Kochen an.',
      },
      {
        path: 'oldHeating.cookingSwitchCost',
        label: 'Investition neues Kochfeld (Induktion)',
        type: 'number',
        unit: '€',
        step: 100,
        min: 0,
        show: (i) => isGas(i) && i.oldHeating.cookingWithGas,
        help: 'Kochfeld inkl. Einbau und ggf. neuer Töpfe; fällt nur beim Umstieg auf Strom an (nicht förderfähig, aus Eigenmitteln).',
      },
      { path: 'oldHeating.efficiency', label: 'Nutzungsgrad Altanlage', type: 'percent', unit: '%', step: 1, min: 1, help: 'Typisch 80–95 %.' },
      {
        path: 'oldHeating.installedMonth',
        label: 'Inbetriebnahme der Heizung',
        type: 'month',
        help: 'Monat und Jahr, z. B. vom Typenschild oder aus dem Protokoll des Schornsteinfegers. Zulässig sind 40 Jahre zurück bis zum aktuellen Monat. Gasheizungen erhalten den Klimageschwindigkeitsbonus, wenn die Inbetriebnahme bei Antrag mindestens 20 Jahre zurückliegt.',
        note: heatingAgeNote,
      },
      { path: 'oldHeating.remainingLifeYears', label: 'Restlebensdauer', type: 'number', unit: 'Jahre', step: 0.5, min: 0, help: 'Danach wird im Szenario ohne Wärmepumpe ein neuer Kessel gekauft.' },
      { path: 'oldHeating.maintenance', label: 'Wartung + Schornsteinfeger', type: 'number', unit: '€/Jahr', step: 10, min: 0 },
      { path: 'oldHeating.replacementCost', label: 'Kosten Ersatzkessel', type: 'number', unit: '€', step: 500, min: 0 },
      { path: 'oldHeating.replacementEfficiency', label: 'Nutzungsgrad Ersatzkessel', type: 'percent', unit: '%', step: 1, min: 1 },
      { path: 'oldHeating.replacementLifeYears', label: 'Lebensdauer Ersatzkessel', type: 'number', unit: 'Jahre', step: 1, min: 1 },
    ],
  },
  {
    id: 'prices',
    title: 'Energiepreise',
    open: true,
    fields: [
      { path: 'prices.gasPriceCt', label: 'Gaspreis heute (inkl. CO₂)', type: 'number', unit: 'ct/kWh', step: 0.1, min: 0, show: isGas },
      { path: 'prices.gasBaseFee', label: 'Gas-Grundpreis', type: 'number', unit: '€/Jahr', step: 10, min: 0, show: isGas, help: 'Entfällt nach dem Umstieg (Gasanschluss wird stillgelegt).' },
      { path: 'prices.gasIncrease', label: 'Steigerung Gaspreis (ohne CO₂)', type: 'percent', unit: '% p. a.', step: 0.5, show: isGas },
      { path: 'prices.oilPriceEur', label: 'Heizölpreis heute (inkl. CO₂)', type: 'number', unit: '€/Liter', step: 0.01, min: 0, show: isOil },
      { path: 'prices.oilIncrease', label: 'Steigerung Ölpreis (ohne CO₂)', type: 'percent', unit: '% p. a.', step: 0.5, show: isOil },
      { path: 'prices.currentBioShare', label: 'Bio-Anteil im heutigen Tarif', type: 'percent', unit: '%', step: 5, min: 0, max: 100, help: 'Anteil Biogas bzw. Bioöl, den Sie heute schon beziehen (z. B. Tarif mit 10 % Biogas); gilt in der CO₂-Bilanz als klimaneutral. Wichtig: Oben muss der Preis genau dieses Tarifs stehen. Der Rechner nimmt an, dass der Bio-Aufpreis darin enthalten ist, und rechnet ihn bei einem neuen Kessel nicht noch einmal – mit dem Preis von reinem Erdgas fällt die Ersparnis der Wärmepumpe zu niedrig aus.' },
      { path: 'prices.co2Path', label: 'CO₂-Preispfad', type: 'text', unit: 'Jahr:€/t', help: 'Stützstellen, linear interpoliert. 2026/27: BEHG-Korridor 55–65 €/t, ab 2028 EU-ETS2 (Annahme).' },
      { path: 'prices.bioEnabled', label: 'Bio-Treppe für neuen fossilen Kessel', type: 'checkbox', help: 'Gebäudemodernisierungsgesetz: ab 2029 steigender Bio-Anteil für neu eingebaute Gas-/Ölheizungen.' },
      { path: 'prices.bioSteps', label: 'Bio-Anteil', type: 'text', unit: 'Jahr:%', show: (i) => i.prices.bioEnabled },
      { path: 'prices.bioPremiumCt', label: 'Mehrpreis Biogas/-öl', type: 'number', unit: 'ct/kWh', step: 0.5, show: (i) => i.prices.bioEnabled },
      { path: 'prices.gridCo2Path', label: 'CO₂-Faktor Strommix', type: 'text', unit: 'Jahr:g/kWh', help: 'Für die CO₂-Bilanz. Stützstellen, linear interpoliert. 2025: 344 g/kWh (Umweltbundesamt), danach Annahme: sinkt mit dem Ausbau der Erneuerbaren.' },
    ],
  },
  {
    id: 'hp',
    title: 'Wärmepumpe',
    open: true,
    fields: [
      {
        path: 'heatPump.installMonth',
        label: 'Geplante Inbetriebnahme',
        type: 'month',
        help: 'Bis dahin läuft die Altanlage zu steigenden Preisen weiter. Mit einem festen Antragsmonat höchstens drei Jahre nach dem Antragsjahr.',
        note: installWindowNote,
      },
      { path: 'heatPump.investment', label: 'Investition gesamt (brutto)', type: 'number', unit: '€', step: 500, min: 0, help: 'Gerät, Installation, Umfeldmaßnahmen (z. B. Heizkörper, Elektrik).' },
      { path: 'heatPump.eligibleShare', label: 'davon förderfähig', type: 'percent', unit: '%', step: 5, min: 0, max: 100 },
      { path: 'heatPump.extraCost', label: 'Nicht förderfähige Nebenkosten', type: 'number', unit: '€', step: 100, min: 0, help: 'z. B. Stilllegung des Gasanschlusses. Rückbau und Entsorgung der Altanlage inkl. Öl-/Gastank sind förderfähig.' },
      {
        path: 'heatPump.source',
        label: 'Wärmequelle',
        type: 'select',
        options: [
          ['air', 'Luft (Luft/Wasser-Wärmepumpe)'],
          ['ground', 'Erdwärme (Sole/Wasser)'],
        ],
      },
      {
        path: 'heatPump.emitter',
        label: 'Heizflächen im Haus',
        type: 'select',
        options: [
          ['radiators', 'Normale Heizkörper'],
          ['largeRadiators', 'Große Heizkörper (Niedertemperatur)'],
          ['floor', 'Fußbodenheizung'],
        ],
        help: 'Für die Schätzung der Jahresarbeitszahl. Gemischt: die überwiegende Art wählen; einzelne zu kleine Heizkörper bestimmen oft die nötige Vorlauftemperatur.',
      },
      { path: 'heatPump.jaz', label: 'Jahresarbeitszahl (JAZ)', type: 'number', step: 0.1, min: 1, help: 'Wie viel Wärme die Wärmepumpe je kWh Strom liefert. Unten steht eine Schätzung für Ihr Haus; einen Wert aus dem Angebot oder der Auslegung des Fachbetriebs bevorzugen.' },
      { path: 'heatPump.maintenance', label: 'Wartung', type: 'number', unit: '€/Jahr', step: 10, min: 0 },
      { path: 'heatPump.lifeYears', label: 'Lebensdauer', type: 'number', unit: 'Jahre', step: 1, min: 1 },
      { path: 'heatPump.euOrigin', label: 'Wärmepumpe mit Ursprung in der EU', type: 'checkbox', help: 'Ab dem 1. Quartal 2027: 15 % Grundförderung + 15 % Wertschöpfungs-Bonus nur für Wärmepumpen aus der EU, sonst nur 15 %.' },
      {
        path: 'heatPump.applicationMonth',
        label: 'Antragsmonat',
        type: 'month',
        help: 'Monat der Antragstellung der KfW-Förderung; Boni und Höchstbeträge richten sich nach dem Antragsdatum. Leer = automatisch 4 Monate vor der Inbetriebnahme. Der Antrag muss vor Vorhabenbeginn gestellt werden und darf nicht nach der Inbetriebnahme liegen.',
        note: applicationMonthNote,
      },
    ],
  },
  {
    id: 'elec',
    title: 'Strom',
    fields: [
      { path: 'heatPump.separateTariff', label: 'Separater Wärmepumpentarif', type: 'checkbox', help: 'Gilt für die Berechnung. Beide Varianten werden zusätzlich im Tarifvergleich gegenübergestellt.' },
      { path: 'heatPump.elecPriceCt', label: 'WP-Strompreis (eigener Zähler)', type: 'number', unit: 'ct/kWh', step: 0.5, min: 0 },
      { path: 'heatPump.meterFee', label: 'Grundpreis WP-Zähler', type: 'number', unit: '€/Jahr', step: 10, min: 0 },
      { path: 'heatPump.smartMeterFee', label: 'Laufende Kosten intelligentes Messsystem', type: 'number', unit: '€/Jahr', step: 10, min: 0, help: 'Messsystem (iMSys) mit Steuerungseinrichtung: Für die KfW-Förderung muss es bestellt werden. Fällt mit und ohne eigenen WP-Zähler an. 0 eintragen, wenn schon eines mit Steuerungseinrichtung vorhanden ist und bezahlt wird.' },
      { path: 'heatPump.meterSetupCost', label: 'Einmalig: zweiter Zähler / Zählerschrank-Umbau', type: 'number', unit: '€', step: 100, min: 0, help: 'Nur die Mehrkosten für den zweiten Zählerplatz. Fällt nur mit separatem WP-Tarif an.' },
      { path: 'heatPump.meterSetupEligible', label: 'Umbau als förderfähig angesetzt', type: 'checkbox', show: (i) => i.heatPump.meterSetupCost > 0, help: 'Nur ankreuzen, wenn der Fachbetrieb bzw. Energieeffizienz-Experte das bestätigt.' },
      { path: 'heatPump.householdPriceCt', label: 'Haushaltsstrompreis (ohne WP-Tarif)', type: 'number', unit: 'ct/kWh', step: 0.5, min: 0 },
      { path: 'heatPump.elecIncrease', label: 'Steigerung Strompreis', type: 'percent', unit: '% p. a.', step: 0.5 },
      { path: 'heatPump.para14aReduction', label: 'Netzentgeltreduzierung § 14a EnWG', type: 'number', unit: '€/Jahr', step: 10, help: 'Modul 1: pauschale Reduzierung je Zähler, abhängig vom Netzbetreiber.' },
      { path: 'heatPump.existing14aOnHousehold', label: 'Haushaltszähler hat schon § 14a (z. B. Wallbox)', type: 'checkbox', help: 'Die Pauschale gibt es nur einmal je Zähler. Ohne eigenen WP-Zähler bringt die Wärmepumpe dann keine zusätzliche Reduzierung.' },
      { path: 'heatPump.greenElectricity', label: 'Ökostromtarif', type: 'checkbox', help: 'Für die CO₂-Bilanz: Netzstrom für Wärmepumpe (und ggf. Induktionsherd) zählt mit 0 g CO₂/kWh statt mit dem Strommix.' },
      { path: 'heatPump.pvKwp', label: 'PV-Anlage: Leistung', type: 'number', unit: 'kWp', step: 0.5, min: 0, help: '0 = keine PV-Anlage. Wie viel PV-Strom die Wärmepumpe nutzen kann, wird Monat für Monat berechnet – im Winter ist es wenig.' },
      { path: 'heatPump.pvYield', label: 'PV: Jahresertrag je kWp', type: 'number', unit: 'kWh/kWp', step: 25, min: 0, show: hasPv, help: 'Süddach typisch 900–1.100, Ost/West 750–900. Steht im Anlagenmonitor oder in der Abrechnung des Netzbetreibers.' },
      { path: 'heatPump.batteryKwh', label: 'Batteriespeicher (nutzbar)', type: 'number', unit: 'kWh', step: 0.5, min: 0, show: hasPv, help: '0 = kein Speicher. Verschiebt Überschuss vom Tag in Abend und Nacht – vor allem im Sommerhalbjahr.' },
      { path: 'heatPump.householdKwh', label: 'Haushaltsstrom ohne Wärmepumpe', type: 'number', unit: 'kWh/Jahr', step: 100, min: 0, show: hasPv, help: 'Der Haushalt nutzt den PV-Strom schon heute; die Wärmepumpe bekommt nur, was übrig bleibt.' },
      { path: 'heatPump.feedInCt', label: 'Einspeisevergütung (entgangen)', type: 'number', unit: 'ct/kWh', step: 0.1, min: 0, show: hasPv },
    ],
  },
  {
    id: 'household',
    title: 'Haushalt & Gebäude',
    fields: [
      { path: 'building.ownerOccupied', label: 'Selbstgenutzt (Hauptwohnsitz)', type: 'checkbox', help: 'Voraussetzung für Boni und Steuerbonus.' },
      { path: 'building.units', label: 'Wohneinheiten', type: 'number', step: 1, min: 1 },
      { path: 'building.constructionYear', label: 'Baujahr des Gebäudes', type: 'number', step: 1, min: 1500, max: 2100, help: 'Steuerbonus: Gebäude mindestens 10 Jahre alt. Dient auch der Einordnung des Hauses.' },
      { path: 'building.heatedArea', label: 'Beheizte Wohnfläche', type: 'number', unit: 'm²', step: 5, min: 10, help: 'Für den Verbrauchskennwert in kWh je m² und Jahr.' },
      { path: 'building.renovationYear', label: 'Letzte energetische Sanierung', type: 'number', step: 1, min: 0, max: 2100, help: 'Jahr, 0 = keine (z. B. Dämmung, neue Fenster, Dach).' },
      {
        path: 'building.renovationScope',
        label: 'Umfang der Sanierung',
        type: 'select',
        options: [
          ['partial', 'Einzelne Maßnahmen (z. B. Fenster oder Dach)'],
          ['full', 'Umfassend (Hülle gedämmt, neue Fenster)'],
        ],
        show: (i) => i.building.renovationYear > 0,
      },
      {
        path: 'building.incomeRange',
        label: 'Zu versteuerndes Haushaltseinkommen',
        type: 'select',
        // Deliberately duplicated from INCOME_RANGES in core/income-range.ts: scripts/assumptions-checklist.ts runs
        // with plain Node type stripping, which cannot resolve the extensionless import. tests/income-range-ui.test.ts
        // asserts that these codes and labels equal INCOME_RANGES.
        options: [
          ['0-30000', 'bis 30.000 €'],
          ['30001-40000', 'über 30.000 bis 40.000 €'],
          ['40001-50000', 'über 40.000 bis 50.000 €'],
          ['50001-60000', 'über 50.000 bis 60.000 €'],
          ['60001-90000', 'über 60.000 bis 90.000 €'],
          ['90001+', 'über 90.000 €'],
        ],
        help: 'Durchschnitt des 2. und 3. Jahres vor Antragstellung laut Steuerbescheid. Grenzen einschließlich. Maßgeblich für Einkommensbonus und KfW 358.',
      },
      { path: 'building.hasChild', label: 'Kindergeldberechtigtes Kind unter 18', type: 'checkbox' },
      { path: 'building.incomeTax', label: 'Einkommensteuerschuld', type: 'number', unit: '€/Jahr', step: 500, min: 0, help: 'Begrenzt den Steuerbonus (0 = keine Begrenzung).' },
    ],
  },
  {
    id: 'finance',
    title: 'Finanzierung',
    note: 'Zinssätze sind Annahmen – die aktuellen KfW-Konditionen bitte auf kfw.de bzw. bei der Hausbank prüfen.',
    fields: [
      { path: 'financing.useKfwLoan', label: 'KfW-Kredit nutzen (358/359)', type: 'checkbox' },
      {
        path: 'financing.kfwEquity',
        label: 'Eigenkapital (Weg mit KfW-Zuschuss)',
        type: 'number',
        unit: '€',
        step: 1000,
        min: 0,
        help: 'Eigenes Geld für die Wärmepumpe im Szenario „WP + KfW-Zuschuss“ – gilt auch ohne KfW-Kredit. Den Rest finanziert der KfW-Kredit (wenn gewählt, höchstens die förderfähigen Kosten) und darüber hinaus der Bankkredit.',
      },
      { path: 'financing.kfwRate358', label: 'Zins KfW 358 (zinsverbilligt)', type: 'percent', unit: '%', step: 0.05 },
      { path: 'financing.kfwRate359', label: 'Zins KfW 359', type: 'percent', unit: '%', step: 0.05 },
      { path: 'financing.kfwTermYears', label: 'Laufzeit KfW-Kredit', type: 'number', unit: 'Jahre', step: 1, min: 4, max: 35 },
      { path: 'financing.kfwGraceYears', label: 'Tilgungsfreie Anlaufjahre', type: 'number', unit: 'Jahre', step: 1, min: 0, max: 5 },
      { path: 'financing.kfwFixYears', label: 'Zinsbindung', type: 'number', unit: 'Jahre', step: 1, min: 1, max: 10 },
      { path: 'financing.followUpRate', label: 'Anschlusszins', type: 'percent', unit: '%', step: 0.1 },
      {
        path: 'financing.subsidyAsSpecialRepayment',
        label: 'Zuschuss als Sondertilgung verwenden',
        type: 'checkbox',
        help: 'Der KfW-Zuschuss tilgt bei Auszahlung den KfW-Kredit (ab 5.000 €), ohne KfW-Kredit den Bankkredit. Die Rate bleibt gleich, der Kredit ist früher abbezahlt.',
      },
      { path: 'financing.subsidyDelayMonths', label: 'Auszahlung Zuschuss nach Inbetriebnahme', type: 'number', unit: 'Monate', step: 1, min: 0 },
      {
        path: 'financing.taxEquity',
        label: 'Eigenkapital (Weg mit Steuerbonus)',
        type: 'number',
        unit: '€',
        step: 1000,
        min: 0,
        help: 'Eigenes Geld für die Wärmepumpe im Szenario „WP + Steuerbonus“. Den Rest finanziert der Bankkredit. Für einen fairen Vergleich meist derselbe Betrag wie beim Weg mit KfW-Zuschuss.',
      },
      { path: 'financing.bankRate', label: 'Zins Bankkredit', type: 'percent', unit: '%', step: 0.1 },
      { path: 'financing.bankTermYears', label: 'Laufzeit Bankkredit', type: 'number', unit: 'Jahre', step: 1, min: 1 },
      { path: 'financing.bankGraceYears', label: 'Tilgungsfreie Jahre (Bank)', type: 'number', unit: 'Jahre', step: 1, min: 0 },
      { path: 'financing.taxRefundMonth', label: 'Steuererstattung im Folgejahr, Monat', type: 'number', step: 1, min: 1, max: 12 },
      {
        path: 'financing.taxRefundAsSpecialRepayment',
        label: 'Steuererstattungen als Sondertilgung verwenden',
        type: 'checkbox',
        help: 'Jede Steuererstattung (§ 35c) tilgt im Erstattungsmonat den Bankkredit des Steuer-Wegs, abzüglich Vorfälligkeitsentschädigung. Die Rate bleibt gleich, der Kredit ist früher abbezahlt.',
      },
    ],
  },
  {
    id: 'windfall',
    title: 'Sondertilgung aus Einmalzahlung',
    note: 'Z. B. fällige Lebensversicherung. Der Betrag wird nach den Kreditbedingungen als Sondertilgung eingesetzt; was nicht eingesetzt werden kann, bleibt außen vor.',
    fields: [
      { path: 'financing.windfallAmount', label: 'Verfügbarer Betrag', type: 'number', unit: '€', step: 1000, min: 0, help: '0 = keine Einmalzahlung.' },
      { path: 'financing.windfallMonth', label: 'Verfügbar ab', type: 'month', show: (i) => i.financing.windfallAmount > 0 },
      {
        path: 'financing.windfallRepayMonth',
        label: 'Sondertilgung am',
        type: 'month',
        show: (i) => i.financing.windfallAmount > 0,
        help: 'Leer = sofort, wenn das Geld verfügbar ist. KfW: Teil-Sondertilgungen nur bis zum Ende der ersten Zinsbindung kostenfrei.',
      },
      {
        path: 'financing.windfallTarget',
        label: 'Zuerst tilgen',
        type: 'select',
        options: [
          ['auto', 'Automatisch: höchster Zins zuerst'],
          ['kfw', 'KfW-Kredit'],
          ['bank', 'Bankkredit'],
        ],
        show: (i) => i.financing.windfallAmount > 0,
        help: 'Ist die Sondertilgung beim gewählten Kredit nicht möglich, wird der andere Kredit versucht.',
      },
    ],
  },
  {
    id: 'general',
    title: 'Betrachtung',
    fields: [
      { path: 'general.startMonth', label: 'Start der Betrachtung', type: 'month' },
      { path: 'general.horizonYears', label: 'Betrachtungszeitraum', type: 'number', unit: 'Jahre', step: 1, min: 1, max: 40 },
      { path: 'general.opportunityRate', label: 'Opportunitätszins', type: 'percent', unit: '% p. a.', step: 0.25, help: 'Alternative Verzinsung (z. B. Tagesgeld). Alle Zahlungen werden damit bis zum Ende aufgezinst.' },
      { path: 'general.costIncrease', label: 'Steigerung Wartungskosten', type: 'percent', unit: '% p. a.', step: 0.5 },
      { path: 'general.investIncrease', label: 'Steigerung Anschaffungspreise', type: 'percent', unit: '% p. a.', step: 0.5, help: 'Wirkt, wenn später gekauft wird.' },
      { path: 'general.residualValue', label: 'Restwert am Ende berücksichtigen', type: 'checkbox' },
      { path: 'compare.stepMonths', label: 'Zeitpunktvergleich: Abstand', type: 'number', unit: 'Monate', step: 1, min: 1 },
      { path: 'compare.count', label: 'Zeitpunktvergleich: Anzahl', type: 'number', step: 1, min: 1, max: 30 },
    ],
  },
  {
    id: 'expert-kfw',
    title: 'Experten: KfW-Heizungsförderung 458',
    expert: true,
    note: 'Defaults: Stand KfW-Website 11.11.2026.',
    fields: [
      { path: 'funding.grundRate', label: 'Grundförderung', type: 'percent', unit: '%', step: 1 },
      { path: 'funding.grundRateNewFrom', label: 'Neue WP-Förderung gilt ab (Antrag)', type: 'month', help: 'Start von reduzierter Grundförderung und Wertschöpfungs-Bonus; leer = keine Änderung.' },
      { path: 'funding.grundRateNew', label: 'Grundförderung Wärmepumpe ab Stichtag', type: 'percent', unit: '%', step: 1 },
      { path: 'funding.wsbRate', label: 'Wertschöpfungs-Bonus (EU-Ursprung)', type: 'percent', unit: '%', step: 1 },
      { path: 'funding.kgbRate', label: 'Klimageschwindigkeitsbonus', type: 'percent', unit: '%', step: 1 },
      { path: 'funding.kgbStep', label: 'KGB-Absenkung je Halbjahr', type: 'percent', unit: '%-Pkt.', step: 1 },
      { path: 'funding.kgbDegressionStart', label: 'KGB erste Absenkung', type: 'month' },
      { path: 'funding.kgbEnd', label: 'KGB entfällt ab', type: 'month' },
      { path: 'funding.kgbMinGasAge', label: 'KGB: Mindestalter Gasheizung', type: 'number', unit: 'Jahre', step: 1 },
      { path: 'funding.incomeLimit1', label: 'Einkommensbonus Stufe 1 bis', type: 'number', unit: '€', step: 1000 },
      { path: 'funding.incomeRate1', label: 'Einkommensbonus Stufe 1', type: 'percent', unit: '%', step: 1 },
      { path: 'funding.incomeLimit2', label: 'Einkommensbonus Stufe 2 bis', type: 'number', unit: '€', step: 1000 },
      { path: 'funding.incomeRate2', label: 'Einkommensbonus Stufe 2', type: 'percent', unit: '%', step: 1 },
      { path: 'funding.incomeLimit3', label: 'Einkommensbonus Stufe 3 bis', type: 'number', unit: '€', step: 1000 },
      { path: 'funding.incomeRate3', label: 'Einkommensbonus Stufe 3', type: 'percent', unit: '%', step: 1 },
      { path: 'funding.incomeChildShift', label: 'Grenzerhöhung mit Kind', type: 'number', unit: '€', step: 1000 },
      { path: 'funding.maxRate', label: 'Höchstfördersatz', type: 'percent', unit: '%', step: 1 },
      { path: 'funding.maxRateLowIncome', label: 'Höchstfördersatz (Einkommensstufe 1)', type: 'percent', unit: '%', step: 1 },
      { path: 'funding.cap1', label: 'Förderfähige Kosten 1. WE', type: 'number', unit: '€', step: 500 },
      { path: 'funding.capStep', label: 'Absenkung je Halbjahr', type: 'number', unit: '€', step: 50 },
      { path: 'funding.capDegressionStart', label: 'Erste Absenkung', type: 'month' },
      { path: 'funding.capFloor', label: 'Untergrenze nach Absenkung', type: 'number', unit: '€', step: 500 },
      { path: 'funding.cap2to6', label: 'Förderfähige Kosten 2.–6. WE', type: 'number', unit: '€', step: 500 },
      { path: 'funding.cap7plus', label: 'Förderfähige Kosten ab 7. WE', type: 'number', unit: '€', step: 500 },
      { path: 'funding.loanMaxPerUnit', label: 'KfW-Kredit max. je WE', type: 'number', unit: '€', step: 1000 },
      { path: 'funding.loan358IncomeLimit', label: 'KfW 358: Einkommensgrenze', type: 'number', unit: '€', step: 1000 },
    ],
  },
  {
    id: 'expert-prepay',
    title: 'Experten: Sondertilgungsregeln',
    expert: true,
    fields: [
      { path: 'financing.kfwMinPrepay', label: 'KfW: Mindestbetrag Sondertilgung', type: 'number', unit: '€', step: 500, min: 0 },
      { path: 'financing.kfwFeeAfterFix', label: 'KfW: Vorfälligkeitsentschädigung nach Zinsbindung', type: 'percent', unit: '%', step: 0.1, min: 0 },
      { path: 'financing.bankPrepayFee', label: 'Bank: Vorfälligkeitsentschädigung', type: 'percent', unit: '%', step: 0.1, min: 0 },
      { path: 'financing.bankPrepayFeeShort', label: 'Bank: Entschädigung bei Restlaufzeit ≤ 1 Jahr', type: 'percent', unit: '%', step: 0.1, min: 0 },
      {
        path: 'financing.bankFreePrepayShare',
        label: 'Bank: kostenfreie Sondertilgung pro Jahr (Anteil am Kreditbetrag)',
        type: 'percent',
        unit: '%',
        step: 1,
        min: 0,
        max: 100,
        help: 'Kostenfreies Sondertilgungsrecht laut Kreditvertrag, z. B. 10 % des Kreditbetrags je Kalenderjahr. Bis zu dieser Summe kosten Sondertilgungen (Zuschuss, Steuererstattungen, Einmalzahlung) nichts; nur der Teil darüber kostet die Vorfälligkeitsentschädigung.',      },
      {
        path: 'financing.bankFreePrepayAmount',
        label: 'Bank: kostenfreie Sondertilgung pro Jahr (fester Betrag)',
        type: 'number',
        unit: '€',
        step: 500,
        min: 0,
        help: 'Alternativ ein fester Betrag je Kalenderjahr, z. B. 5.000 €. Sind beide Felder ausgefüllt, gilt der größere Wert. 0 = kein festes Kontingent.',
      },
    ],
  },
  {
    id: 'expert-tax',
    title: 'Experten: Steuerbonus § 35c & Konstanten',
    expert: true,
    fields: [
      { path: 'tax.rateYear1', label: 'Steuerbonus Jahr 1', type: 'percent', unit: '%', step: 1 },
      { path: 'tax.rateYear2', label: 'Steuerbonus Jahr 2', type: 'percent', unit: '%', step: 1 },
      { path: 'tax.rateYear3', label: 'Steuerbonus Jahr 3', type: 'percent', unit: '%', step: 1 },
      { path: 'tax.maxBonus', label: 'Max. Steuerermäßigung', type: 'number', unit: '€', step: 1000 },
      { path: 'tax.maxCost', label: 'Max. begünstigte Kosten', type: 'number', unit: '€', step: 1000 },
      { path: 'tax.deadline', label: 'Abschluss spätestens', type: 'month' },
      { path: 'tax.minBuildingAge', label: 'Mindestalter Gebäude', type: 'number', unit: 'Jahre', step: 1 },
      { path: 'prices.gasCo2Factor', label: 'CO₂-Faktor Erdgas', type: 'number', unit: 'kg/kWh', step: 0.001 },
      { path: 'prices.oilCo2Factor', label: 'CO₂-Faktor Heizöl', type: 'number', unit: 'kg/kWh', step: 0.001 },
      { path: 'prices.oilKwhPerLiter', label: 'Heizwert Heizöl', type: 'number', unit: 'kWh/Liter', step: 0.1 },
      { path: 'prices.cookingElecFactor', label: 'Strom je kWh Gas beim Kochen (Induktion)', type: 'number', unit: 'kWh/kWh', step: 0.05 },
      { path: 'general.vat', label: 'Mehrwertsteuer', type: 'percent', unit: '%', step: 1 },
    ],
  },
];

export function getPath(obj: unknown, path: string): unknown {
  return path.split('.').reduce<unknown>((o, k) => (o as Record<string, unknown>)?.[k], obj);
}

export function setPath(obj: unknown, path: string, value: unknown): void {
  const keys = path.split('.');
  const last = keys.pop()!;
  const target = keys.reduce<unknown>((o, k) => (o as Record<string, unknown>)[k], obj) as Record<string, unknown>;
  target[last] = value;
}
