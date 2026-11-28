import { describe, expect, it } from 'vitest';
import { compareInstallTimes } from '../src/core/compare';
import { keyEvents } from '../src/core/events';
import { runAll } from '../src/core/simulation';
import type { Inputs } from '../src/core/types';
import { SECTIONS } from '../src/ui/fields';
import { decodeHash } from '../src/core/serialize';
import { fieldText, REPORT_CHARTS, reportHtml, reportLink } from '../src/ui/report';
import { defaults, TODAY } from './helpers';

/** F30 printable report. */
const report = (mut?: (i: Inputs) => void, extra: { shareUrl?: string } = {}) => {
  const i = defaults();
  mut?.(i);
  const run = runAll(i);
  return reportHtml({
    inputs: i,
    defaults: defaults(),
    run,
    cmp: compareInstallTimes(i),
    events: keyEvents(i, run),
    today: TODAY,
    url: 'https://example.invalid/',
    detailsHtml: '<div class="card"><h3>KfW-Zuschuss (458)</h3></div>',
    ...extra,
  });
};
const field = (path: string) => SECTIONS.flatMap((s) => s.fields).find((f) => f.path === path)!;

describe('F30 Bericht', () => {
  it('F30.2 Bericht enthält nur die Diagramme „Kumulierte Kosten“ und „Energie je Monat“, ohne Einflussgrößen', () => {
    expect(REPORT_CHARTS.map(([id]) => id)).toEqual(['cumulative', 'energy']);
    const html = report();
    expect(html.match(/data-report-chart="/g)).toHaveLength(2);
    expect(html).not.toContain('data-report-chart="sensitivity"');
    expect(html).not.toContain('Einflussgrößen');
  });

  it('enthält alle Abschnitte, Diagramm-Platzhalter, Haftungshinweis und Adresse ohne Eingaben', () => {
    const html = report();
    for (const h of ['Ergebnis', 'Haus und Wärmepumpe', 'Diagramme', 'Förderung und Finanzierung', 'Wichtige Ereignisse und Hinweise', 'Eingaben']) {
      expect(html, h).toContain(`<h2>${h}</h2>`);
    }
    for (const [id] of REPORT_CHARTS) expect(html).toContain(`data-report-chart="${id}"`);
    expect(html).toContain('Stand 11.11.2026');
    // logo (F23) in the header, decorative
    expect(html).toMatch(/<header class="report-head">\s*<svg class="report-logo"[^>]*aria-hidden="true"/);
    expect(html).toContain('Ersparnis mit WP');
    expect(html).toContain('CO₂-Einsparung');
    expect(html).toContain('KfW-Zuschuss (458)');
    expect(html).toContain('ohne Gewähr');
    expect(html).toContain('https://example.invalid/');
    expect(html).not.toContain('<h2>Bemerkungen</h2>');
  });

  it('Bezeichnung und Bemerkungen werden maskiert', () => {
    const html = report((i) => {
      i.scenario.name = 'Angebot <A>';
      i.scenario.notes = 'Firma "X" & Söhne';
    });
    expect(html).toContain('<strong>Angebot &lt;A&gt;</strong>');
    expect(html).toContain('Firma &quot;X&quot; &amp; Söhne');
    expect(html).not.toContain('<A>');
  });

  it('Eingaben: sichtbare Felder; Experten-Abschnitte nur mit Abweichungen', () => {
    expect(report()).not.toContain('<h3>Experten');
    const changed = report((i) => (i.general.vat = 0.07));
    expect(changed).toMatch(/<h3>Experten: Steuerbonus § 35c &amp; Konstanten<\/h3><dl><dt>Mehrwertsteuer<\/dt><dd>7 %<\/dd><\/dl>/);
    // hidden fields (no PV) do not appear
    expect(report()).not.toContain('Batteriespeicher');
    expect(report((i) => (i.heatPump.pvKwp = 8))).toContain('Batteriespeicher');
  });

  it('F30.3 QR-Code öffnet den Rechner mit den Eingaben (ohne Bemerkungen)', () => {
    const html = report((i) => {
      i.scenario.name = 'Angebot A';
      i.scenario.notes = 'x'.repeat(5000);
    });
    expect(html).toMatch(/<figure class="report-qr"><svg class="qr" viewBox="0 0 \d+ \d+" role="img"/);
    const i = defaults();
    i.scenario.name = 'Angebot A';
    i.scenario.notes = 'lange Notiz';
    i.heatPump.investment = 41000;
    const link = reportLink({ inputs: i, defaults: defaults(), url: 'https://example.invalid/' });
    expect(link).toMatch(/^https:\/\/example\.invalid\/#z=/);
    const back = decodeHash(defaults(), link.slice(link.indexOf('#')))!;
    expect(back.heatPump.investment).toBe(41000);
    expect(back.scenario.name).toBe('Angebot A');
    expect(back.scenario.notes).toBe('');
  });

  it('F30.3 QR-Code nutzt die kurze Domain, die Fußzeile die Adresse des Rechners', () => {
    const d = { inputs: defaults(), defaults: defaults(), url: 'https://waermepumpen-investitionsrechner.de/', shareUrl: 'https://wpir.de/' };
    expect(reportLink(d)).toMatch(/^https:\/\/wpir\.de\/#z=/);
    const html = report((i) => (i.heatPump.investment = 41000), { shareUrl: 'https://wpir.de/' });
    expect(html).toContain('Erstellt mit dem Wärmepumpen-Investitionsrechner: https://example.invalid/');
  });

  it('F30.4 Text unter dem QR-Code ist mit demselben Link hinterlegt', () => {
    const html = report((i) => (i.heatPump.investment = 41000), { shareUrl: 'https://wpir.de/' });
    const href = /<figcaption><a class="report-open" href="([^"]+)">Berechnung mit diesen Eingaben öffnen<\/a><\/figcaption>/.exec(html)![1];
    expect(href).toMatch(/^https:\/\/wpir\.de\/#z=/);
    expect(decodeHash(defaults(), href.slice(href.indexOf('#')))!.heatPump.investment).toBe(41000);
  });

  it('F30.3 zu langer Link: Hinweis statt QR-Code', () => {
    let seed = 1;
    const noise = () => Array.from({ length: 1990 }, () => String.fromCharCode(33 + ((seed = (seed * 16807) % 2147483647) % 90))).join('');
    const html = report((i) => {
      i.prices.co2Path = noise();
      i.prices.bioSteps = noise();
      i.prices.gridCo2Path = noise();
    });
    expect(html).not.toContain('class="qr"');
    expect(html).toContain('Zu viele Eingaben für einen QR-Code');
    // F30.4 the link stays usable in the PDF
    expect(html).toMatch(/<a class="report-open" href="https:\/\/example\.invalid\/#z=/);
  });

  it('Feldwerte: Zahl mit Einheit, Prozent, ja/nein, Auswahl, Monat', () => {
    const i = defaults();
    expect(fieldText(field('heatPump.investment'), i)).toBe('32.000 €');
    expect(fieldText(field('heatPump.eligibleShare'), i)).toBe('100 %');
    expect(fieldText(field('heatPump.euOrigin'), i)).toMatch(/^(ja|nein)$/);
    expect(fieldText(field('oldHeating.fuel'), i)).toBe('Erdgas');
    expect(fieldText(field('heatPump.installMonth'), i)).toMatch(/^\d{2}\/\d{4}$/);
    // years without thousands separator
    i.building.constructionYear = 1950;
    expect(fieldText(field('building.constructionYear'), i)).toBe('1950');
    i.building.heatedArea = 1200;
    expect(fieldText(field('building.heatedArea'), i)).toBe('1.200 m²');
  });
});
