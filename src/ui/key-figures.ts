import { type KeyFigures } from '../core/sensitivity';
import { fmtDuration, fmtEur, fmtMonth } from './format';

/**
 * Texts of the six key figures (F27.8): the header (`renderKpis`) and the result block of the sliders use the same
 * texts, so that both show identical values for the same result.
 */
export interface KeyFigureText {
  id: 'ref' | 'kfw' | 'tax' | 'saving' | 'amortisation' | 'co2';
  /** Label, e.g. "Ersparnis mit WP" or "Mehrkosten mit WP" (negative). */
  label: string;
  /** Value as HTML (only our own formatted text, no user input). */
  value: string;
  /** Text of a table cell, e.g. "Mehrkosten mit WP 1.234 €" for a negative saving. */
  cell: string;
  /** Negative saving or extra CO₂ emission. */
  negative: boolean;
}

/** Row labels of the six key figures with their positive wording (also the rows of the result table, F27.8). */
export const ROW_LABEL: Record<KeyFigureText['id'], string> = {
  ref: 'Ohne Wärmepumpe',
  kfw: 'WP + KfW-Zuschuss',
  tax: 'WP + Steuerbonus',
  saving: 'Ersparnis mit WP',
  amortisation: 'Amortisation',
  co2: 'CO₂-Einsparung',
};

/** Tonnes with one decimal place, German format. */
export function fmtTons(t: number): string {
  return t.toLocaleString('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

/** The six key figures in the order of the header and the slider card. */
export function keyFigureTexts(f: KeyFigures): KeyFigureText[] {
  const negative = f.saving < 0;
  const co2Negative = f.co2Saved < 0;
  const saving = fmtEur(Math.abs(f.saving));
  const tons = `${fmtTons(Math.abs(f.co2Saved))} t`;
  // Amortisation: month, plus the duration after commissioning if it is later than that (F8)
  const install = f.installMonth;
  const be = f.breakEven;
  const amortisation =
    be === null
      ? 'nicht im Zeitraum'
      : install !== null && be > install
        ? `${fmtMonth(be)} <small>(${fmtDuration(be - install)} nach Inbetriebnahme)</small>`
        : fmtMonth(be);
  const tax = f.tax === null ? 'nicht möglich' : fmtEur(f.tax);
  return [
    { id: 'ref', label: ROW_LABEL.ref, value: fmtEur(f.ref), cell: fmtEur(f.ref), negative: false },
    { id: 'kfw', label: ROW_LABEL.kfw, value: fmtEur(f.kfw), cell: fmtEur(f.kfw), negative: false },
    { id: 'tax', label: ROW_LABEL.tax, value: tax, cell: tax, negative: false },
    {
      id: 'saving',
      label: negative ? 'Mehrkosten mit WP' : ROW_LABEL.saving,
      value: saving,
      cell: negative ? `Mehrkosten mit WP ${saving}` : saving,
      negative,
    },
    { id: 'amortisation', label: ROW_LABEL.amortisation, value: amortisation, cell: amortisation, negative: false },
    {
      id: 'co2',
      label: co2Negative ? 'CO₂-Mehrausstoß' : ROW_LABEL.co2,
      value: tons,
      cell: co2Negative ? `CO₂-Mehrausstoß ${tons}` : tons,
      negative: co2Negative,
    },
  ];
}
