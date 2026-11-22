// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { compareInstallTimes } from '../src/core/compare';
import { keyEvents } from '../src/core/events';
import { sensitivity } from '../src/core/sensitivity';
import { importJson } from '../src/core/serialize';
import { runAll } from '../src/core/simulation';
import { DEFAULT_SOURCES } from '../src/core/sources';
import type { Inputs } from '../src/core/types';
import { monthlyBurden } from '../src/core/burden';
import { agentFileName, agentMarkdown, htmlToMarkdown, mdTable } from '../src/ui/agent-export';
import { SECTIONS } from '../src/ui/fields';
import { fmtEur } from '../src/ui/format';
import { defaults, TODAY } from './helpers';

/** F35 export for an AI agent. */
const exportMd = (mut?: (i: Inputs) => void) => {
  const i = defaults();
  mut?.(i);
  const run = runAll(i);
  return {
    inputs: i,
    run,
    md: agentMarkdown({
      inputs: i,
      defaults: defaults(),
      run,
      cmp: compareInstallTimes(i, run),
      events: keyEvents(i, run, TODAY),
      sens: sensitivity(i, run),
      today: TODAY,
      url: 'https://example.invalid/',
      shareUrl: 'https://short.invalid/',
    }),
  };
};

/** Fenced JSON block after the heading "Eingaben als JSON". */
const jsonBlock = (md: string) => /## Eingaben als JSON[\s\S]*?```json\n([\s\S]*?)\n```/.exec(md)![1];

describe('F35 Export für KI-Assistenten (Markdown)', () => {
  it('enthält Hinweise für den Agenten und alle Abschnitte in fester Reihenfolge', () => {
    const { md } = exportMd();
    const order = [
      '# Wärmepumpen-Investitionsrechner – Export für die Auswertung mit einem KI-Assistenten',
      '## Hinweise für den KI-Assistenten',
      '## Ergebnis',
      '## Haus und Wärmepumpe',
      '## Monatliche Belastung',
      '## Wichtige Ereignisse und Hinweise des Rechners',
      '## Zeitpunkt der Umrüstung',
      '## Einflussgrößen (Sensitivität)',
      '## Rechenweg',
      '### KfW-Zuschuss',
      '### Finanzierung',
      '## Eingaben',
      '## Eingaben als JSON',
      '## Anhang: Monatswerte',
    ];
    let pos = -1;
    for (const h of order) {
      const at = md.indexOf(`${h}\n`, pos + 1);
      expect(at, h).toBeGreaterThan(pos);
      pos = at;
    }
    expect(md).toContain('Positiv = Ausgabe, negativ = Einnahme');
    expect(md).toContain('Stand 18.11.2026');
    expect(md).not.toMatch(/<[a-z][^>]*>/); // no HTML left over from the derivation page
  });

  it('Kennzahlen stimmen mit der Rechnung überein', () => {
    const { md, run } = exportMd();
    // table cells use plain spaces instead of the non-breaking space of the € format
    const eur = (x: number) => fmtEur(x).replace(/ /g, ' ');
    expect(md.replace(/ /g, ' ')).toContain(`| Gesamtkosten (mit Opportunitätszins) | ${eur(run.ref.totalCost)} | ${eur(run.kfw.totalCost)} | ${eur(run.tax.totalCost)} |`);
    const best = run.best === 'tax' ? run.tax : run.kfw;
    expect(md.replace(/ /g, ' ')).toContain(`Ersparnis mit Wärmepumpe gegenüber „ohne Wärmepumpe“: ${eur(run.ref.totalCost - best.totalCost)}`);
  });

  it('listet jedes Formularfeld mit Pfad, Wert und Herkunft des Standardwerts', () => {
    const { md } = exportMd((i) => (i.heatPump.jaz = 3.7));
    for (const f of SECTIONS.flatMap((s) => s.fields)) expect(md, f.path).toContain(`(\`${f.path}\``);
    for (const [path, src] of Object.entries(DEFAULT_SOURCES)) {
      if (SECTIONS.some((s) => s.fields.some((f) => f.path === path))) expect(md, path).toContain(src.text.replace(/\s+/g, ' ').trim());
    }
    expect(md).toMatch(/\*\*Jahresarbeitszahl[^*]*\*\* \(`heatPump\.jaz` = `3\.7`\): 3,7 – eigener Wert\n {2}- Standardwert: 3,3 \(`3\.3`\)/);
    expect(md).toContain('1 Feld weicht vom Standard ab.');
  });

  it('JSON lässt sich wieder importieren und ergibt dieselben Eingaben', () => {
    const { md, inputs } = exportMd((i) => {
      i.scenario.name = 'Angebot A';
      i.scenario.notes = 'Mit ``` im Text';
    });
    expect(importJson(defaults(), jsonBlock(md))).toEqual(inputs);
    // notes with backticks do not close the code block
    expect(md).toContain('````text\nMit ``` im Text\n````');
  });

  it('Rechenweg ohne Bedienelemente; Monatswerte im Anhang', () => {
    const { md, run } = exportMd();
    expect(md).not.toContain('Jahreszahl anklicken');
    expect(md).not.toContain('Link zu diesem Rechenweg kopieren');
    expect(md).not.toContain('als CSV herunterladen');
    expect(md).toContain('Die Monatswerte stehen im Anhang dieses Dokuments.');
    // one CSV row per month and scenario (+ header)
    const csv = [...md.matchAll(/```csv\n([\s\S]*?)\n```/g)].map((m) => m[1].split('\n').length);
    expect(csv).toEqual([run.ref.months.length + 1, run.kfw.months.length + 1, run.tax.months.length + 1]);
  });

  it('F36 Monatliche Belastung: heute mit Aufteilung, eine Zeile je 12-Monats-Zeitraum, einmalige Beträge', () => {
    const { md, run } = exportMd();
    const b = monthlyBurden(run);
    const flat = md.replace(/\u00a0/g, ' ');
    const section = flat.slice(flat.indexOf('## Monatliche Belastung'), flat.indexOf('## Wichtige Ereignisse'));
    expect(section).toContain(`${fmtEur(b.today).replace(/\u00a0/g, ' ')} im Monat – Energie`);
    expect(section.match(/^\| \d\d\/\d{4} – \d\d\/\d{4} /gm)).toHaveLength(b.years.length + b.oneOffs.length);
    expect(section).toContain('| Durchschnitt im Zeitraum |');
    expect(section).toContain('### Einmalige Beträge (nicht in den Monatswerten)');
    expect(md).toContain('verkürzt die Laufzeit; die Rate wird nicht gesenkt');
  });

  it('Dateiname wie beim Export, Endung -ki.md', () => {
    const i = defaults();
    i.scenario.name = 'Angebot Firma A';
    expect(agentFileName(i, TODAY)).toBe('waermepumpe-rechner-Angebot-Firma-A-2026-11-ki.md');
  });

  it('HTML → Markdown: Tabellen, Listen, Links, ausgeblendete Zeilen', () => {
    const md = htmlToMarkdown(
      `<h2>Titel <a class="anchor" aria-hidden="true" href="#x">#</a></h2><p>Text mit <strong>fett</strong> und <a href="https://a.invalid/">Link</a>.</p>
       <ul><li>eins</li><li>zwei</li></ul>
       <table><caption>Tab</caption><thead><tr><th>A</th><th>B</th></tr></thead><tbody><tr><td>1|2</td><td><button>3</button></td></tr><tr hidden><td>x</td><td>y</td></tr></tbody></table>
       <p><button>Klick</button></p>`,
      1,
    );
    expect(md).toBe('### Titel\n\nText mit **fett** und [Link](https://a.invalid/).\n\n- eins\n- zwei\n\n**Tab**\n\n| A | B |\n|---|---|\n| 1\\|2 | 3 |');
    expect(mdTable(['x'], [['']])).toBe('| x |\n|---|\n|   |');
  });
});

describe('F1.5/F35 Antragsmonat im KI-Export (AK9, AK10)', () => {
  it('AK9 Feld, Standard „leer“ und Herkunft stehen im Export; kein leadMonths mehr', () => {
    const { md } = exportMd();
    expect(md).toContain('(`heatPump.applicationMonth`');
    expect(md).toContain('Antragsmonat');
    expect(md).not.toContain('leadMonths');
    expect(md).not.toContain('Vorlauf Förderantrag');
    expect(md).toContain(DEFAULT_SOURCES['heatPump.applicationMonth'].text.replace(/\s+/g, ' ').trim());
  });

  it('AK9 JSON des Exports enthält applicationMonth', () => {
    const { md } = exportMd((i) => (i.heatPump.applicationMonth = '2027-03'));
    expect(jsonBlock(md)).toContain('"applicationMonth": "2027-03"');
  });
});

describe('F35 Antragsmonat: Standard „leer“ im KI-Export (AK10)', () => {
  it('AK10 KI-Export: leer = „leer (automatisch)“ mit Hinweis „automatisch: 2027-01“ und Herkunft; eigener Monat mit Standard „leer (automatisch)“', () => {
    const auto = exportMd().md;
    expect(auto).toMatch(/- \*\*Antragsmonat\*\* \(`heatPump\.applicationMonth` = `""`\): leer \(automatisch\) – Standard/);
    expect(auto).toContain('Rechner zeigt dazu: automatisch: 2027-01');
    expect(auto).toContain(DEFAULT_SOURCES['heatPump.applicationMonth'].text.replace(/\s+/g, ' ').trim());
    const fixed = exportMd((i) => (i.heatPump.applicationMonth = '2027-03')).md;
    expect(fixed).toMatch(/- \*\*Antragsmonat\*\* \(`heatPump\.applicationMonth` = `"2027-03"`\): 03\/2027 – eigener Wert\n {2}- Standardwert: leer \(automatisch\)/);
  });
});
