import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/** N7 accessibility: colour contrasts of the design tokens (WCAG 2.1 AA, 1.4.3). */
const css = (f: string) => readFileSync(new URL(`../src/${f}`, import.meta.url), 'utf8');
const tokens = (text: string, selector: string): Record<string, string> => {
  const start = text.indexOf(`${selector} {`);
  if (start < 0) throw new Error(`Block ${selector} fehlt`);
  const body = text.slice(start, text.indexOf('}', start));
  return Object.fromEntries([...body.matchAll(/--([\w-]+):\s*(#[0-9a-fA-F]{6})/g)].map((m) => [m[1], m[2]]));
};
const lum = (hex: string) => {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
};
const ratio = (a: string, b: string) => {
  const [x, y] = [lum(a), lum(b)];
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
};

const base = css('style.css');
const modern = css('style-modern.css');
// base tokens (style.css) overlaid by the modern design layer – the only design (F14)
const baseLight = tokens(base, ':root');
const baseDark = { ...baseLight, ...tokens(base, ":root[data-theme='dark']") };
const modernLight = { ...baseLight, ...tokens(modern, ":root[data-design='modern']") };
const modernDark = { ...baseDark, ...modernLight, ...tokens(modern, ":root[data-design='modern'][data-theme='dark']") };
const themes = { modernLight, modernDark };

describe('N7 Kontraste (WCAG 1.4.3, ≥ 4,5:1)', () => {
  for (const [name, t] of Object.entries(themes)) {
    it(name, () => {
      const surfaces = ['bg', 'surface', 'surface-2', 'accent-soft', 'warn-bg', 'imp-bg', 'info-bg'].filter((k) => t[k]);
      const fails: string[] = [];
      for (const fg of ['c-text', 'c-text-2', 'c-muted', 'good', 'bad']) {
        for (const bg of surfaces) {
          const r = ratio(t[fg], t[bg]);
          if (r < 4.5) fails.push(`${fg} auf ${bg}: ${r.toFixed(2)}`);
        }
      }
      const onAccent = ratio(t['on-accent'], t.accent);
      if (onAccent < 4.5) fails.push(`on-accent auf accent: ${onAccent.toFixed(2)}`);
      expect(fails).toEqual([]);
    });
  }
});

describe('A7 Kontrast von --accent als Textfarbe (F38.2, WCAG 1.4.3)', () => {
  // "Hilfe" in the toolbar and the links of the help use --accent as text colour
  for (const [name, t] of Object.entries(themes)) {
    it(`A7 ${name}: accent auf bg, surface und surface-2 ≥ 4,5 : 1`, () => {
      for (const bg of ['bg', 'surface', 'surface-2']) {
        expect(ratio(t.accent, t[bg]), `accent auf ${bg}`).toBeGreaterThanOrEqual(4.5);
      }
    });
  }
});

describe('N7 Fokus sichtbar (WCAG 2.4.7)', () => {
  it('kein outline: none ohne Ersatz', () => {
    for (const text of [base, modern, css('help.css')]) expect(text).not.toMatch(/outline:\s*(none|0)\b/);
  });
});

describe('F27.13 Regler: Farben nur über Tokens, Spur und Griff ≥ 3 : 1 (WCAG 1.4.11)', () => {
  const block = (text: string) => [...text.matchAll(/([^{}]*\.sens-[^{}]*)\{([^{}]*)\}/g)].map((m) => m[2]).join('\n');
  it('F27.13 keine festen Farben in den Regeln der Karte', () => {
    for (const text of [base, modern]) expect(block(text)).not.toMatch(/#[0-9a-fA-F]{3,8}\b|rgb\(|hsl\(/);
  });
  for (const [name, t] of Object.entries(themes)) {
    it(`F27.13 ${name}: Spur (c-muted) und Griff (accent) mindestens 3 : 1 auf der Fläche`, () => {
      expect(ratio(t['c-muted'], t.surface), 'Spur').toBeGreaterThanOrEqual(3);
      expect(ratio(t.accent, t.surface), 'Griff').toBeGreaterThanOrEqual(3);
    });
  }
});
