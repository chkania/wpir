import { keyFigures, movedSummary, sliderInputs, sliders, type Slider, type SliderId } from '../core/sensitivity';
import { runAll, type RunResult } from '../core/simulation';
import type { Inputs } from '../core/types';
import { escapeHtml } from './format';
import { keyFigureTexts, ROW_LABEL, type KeyFigureText } from './key-figures';

/**
 * Card "Einflussgrößen" (F27.3–F27.13): sliders for the main assumptions and a result block that shows the key
 * figures for the combination of all moved sliders. Positions live only in this card; the form inputs are never changed.
 */
export interface SensitivityCard {
  /** Rebuilds the card for new inputs and their result; all sliders go back to the form values (F27.11). */
  render(inputs: Inputs, run: RunResult): void;
}

/** Fixed note under the result table: the amortisation month is the one of the header (F8), see F27.8. */
const AMORTISATION_NOTE =
  'Die Amortisation liegt oft beim Kesseltausch im Referenzfall. Sie bewegt sich mit den Reglern nur, wenn sich die Mehrkosten der Wärmepumpe bis dahin ändern.';

/**
 * Mounts the card into `root`. `runner` computes the result for one combination (default `runAll`); it is called once
 * per changed slider position (F27.12).
 */
export function mountSensitivityCard(root: HTMLElement, runner: (inputs: Inputs) => RunResult = runAll): SensitivityCard {
  return {
    render(form: Inputs, run: RunResult): void {
      // Own copy: the card never changes the inputs of the form (F27.4)
      const inputs = structuredClone(form);
      const list = sliders(inputs, run);
      const positions: Partial<Record<SliderId, number>> = Object.fromEntries(list.map((s) => [s.id, s.base]));
      const valueText = (s: Slider, index: number) => s.format(s.values[index]);
      const today = keyFigureTexts(keyFigures(run));

      /** Result block: the moved sliders as label, then the table "Vorgabe" and "bei Einstellung" (F27.8). */
      const updateResult = (): void => {
        const moved = list.some((s) => (positions[s.id] ?? s.base) !== s.base);
        let set: KeyFigureText[] | null = today;
        let error = '';
        // Only a changed combination is calculated; without moved sliders the result equals the header (F27.12)
        if (moved) {
          try {
            set = keyFigureTexts(keyFigures(runner(sliderInputs(inputs, list, positions))));
          } catch (err) {
            set = null;
            error = (err as Error).message;
          }
        }
        const rows = today
          .map((t, k) => `<tr><th scope="row">${escapeHtml(ROW_LABEL[t.id])}</th><td class="num">${t.cell}</td><td class="num">${set ? set[k].cell : '–'}</td></tr>`)
          .join('');
        root.querySelector<HTMLElement>('[data-sens-result]')!.innerHTML = `<p class="sens-combo">${escapeHtml(movedSummary(list, positions))}</p>
          <div class="table-wrap"><table class="compact sens-table">
            <caption class="visually-hidden">Kennzahlen Vorgabe und bei der eingestellten Kombination</caption>
            <thead><tr><th scope="col">Kennzahl</th><th scope="col" class="num">Vorgabe</th><th scope="col" class="num">bei Einstellung</th></tr></thead>
            <tbody>${rows}</tbody>
          </table></div>
          ${error ? `<p class="field-error">Bei dieser Einstellung nicht berechenbar: ${escapeHtml(error)}</p>` : ''}
          <p class="sens-note muted small">${escapeHtml(AMORTISATION_NOTE)}</p>`;
      };

      /** Moves one slider to a position; the input element and its text follow (also used by the reset). */
      const setPosition = (s: Slider, index: number): void => {
        positions[s.id] = index;
        const el = root.querySelector<HTMLInputElement>(`#sens-${s.id}`)!;
        el.value = String(index);
        el.setAttribute('aria-valuetext', valueText(s, index));
        root.querySelector<HTMLElement>(`[data-sens-value="${s.id}"]`)!.textContent = valueText(s, index);
      };

      root.innerHTML = `<p class="muted small">Verschieben Sie einen oder mehrere Regler. Das Ergebnis zeigt die Kennzahlen mit diesen Annahmen. Ihre Eingaben im Formular bleiben unverändert; die Regler werden nicht gespeichert.</p>
        <div class="sens-sliders">${list.map((s) => sliderHtml(s, valueText(s, s.base))).join('')}</div>
        <div class="sens-result" data-sens-result></div>
        <button type="button" class="sens-reset" data-sens-reset>Auf heutige Werte zurücksetzen</button>`;
      for (const s of list) {
        root.querySelector<HTMLInputElement>(`#sens-${s.id}`)!.addEventListener('input', (ev) => {
          setPosition(s, Number((ev.target as HTMLInputElement).value));
          updateResult();
        });
      }
      root.querySelector<HTMLButtonElement>('[data-sens-reset]')!.addEventListener('click', () => {
        for (const s of list) setPosition(s, s.base);
        updateResult();
      });
      updateResult();
    },
  };
}

/** One slider: label, value as text, input with its range (F27.13), hint (F27.7). */
function sliderHtml(s: Slider, text: string): string {
  return `<div class="sens-slider">
    <div class="sens-head"><label for="sens-${s.id}">${escapeHtml(s.label)}</label><span class="sens-value" data-sens-value="${s.id}">${escapeHtml(text)}</span></div>
    <input type="range" id="sens-${s.id}" data-sens-slider="${s.id}" min="0" max="${s.values.length - 1}" step="1" value="${s.base}" aria-valuetext="${escapeHtml(text)}" aria-describedby="sens-${s.id}-hint"${s.values.length === 1 ? ' disabled' : ''}>
    <p class="sens-hint muted small" id="sens-${s.id}-hint">${escapeHtml(s.hint)}</p>
  </div>`;
}
