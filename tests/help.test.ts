import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { headingText, renderHelp, slugify } from '../src/help';
import { SECTIONS } from '../src/ui/fields';

const read = (f: string) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');
const handbook = read('docs/BENUTZERHANDBUCH.md');

describe('F15 Benutzerhandbuch – Vollständigkeit', () => {
  it('jeder Eingabe-Abschnitt und jedes Feld ist beschrieben', () => {
    const missing: string[] = [];
    for (const s of SECTIONS) {
      if (!handbook.includes(s.title)) missing.push(`Abschnitt: ${s.title}`);
      for (const f of s.fields) if (!handbook.includes(f.label)) missing.push(`${s.title} → ${f.label}`);
    }
    expect(missing).toEqual([]);
  });

  it('alle Funktionen der Werkzeugleiste sind beschrieben', () => {
    for (const t of ['Einführung', 'Weiterempfehlen', 'Unterstützen', 'Link mit Werten teilen', 'Varianten vergleichen', 'Bericht drucken', 'Gespeicherte Szenarien', 'Export', 'Import', 'Zurücksetzen', 'Hilfe', 'Hell | Dunkel | Auto']) {
      expect(handbook, t).toContain(`### ${t}`);
    }
  });

  it('A10 Handbuch beschreibt die Menüs „Szenarien“, „Teilen & Export“ und „Mehr“, die Kurzbeschriftungen und den Umschalter oben rechts', () => {
    for (const t of ['„Szenarien“', '„Teilen & Export“', '„Mehr“', '„Vergleichen“', '„Bericht“', 'rechts oben', '„Mehr“ › „Einführung“']) {
      expect(handbook, t).toContain(t);
    }
  });

  it('F24 Alle auf-/zuklappen ist beschrieben', () => {
    expect(handbook).toContain('„Alle aufklappen“');
    expect(handbook).toContain('„Alle zuklappen“');
  });

  it('Mitmachen: Ideenliste ist im Handbuch', () => {
    expect(handbook).toContain('### Ideen für die Weiterentwicklung');
    for (const t of ['Förderprogramme der Länder', 'Förderprogramme der Kommunen', 'Wohnungseigentümergemeinschaften', 'Vermieter']) {
      expect(handbook).toContain(`- ${t}`);
    }
  });

  it('F39.5 Handbuch: Abschnitt „Angebot und Förderung“ mit Link und Kasten „Nächste Schritte“', () => {
    expect(handbook).toMatch(/^## Angebot und Förderung$/m);
    expect(handbook).toContain('[Weg zum Angebot und zur Förderung](./angebot.html)');
    expect(handbook).toContain('**Nächste Schritte**');
    const { html } = renderHelp(handbook);
    expect(html).toContain('<a href="./angebot.html">');
  });

  it('F19.3 Entstehung des Rechners ist beschrieben', () => {
    expect(handbook).toContain('## Über diesen Rechner');
    expect(handbook).toContain('rein privates Hobbyprojekt');
  });

  it('F32.4 Rechenweg: Link, Teilen für Fehlermeldungen und Hinweis auf persönliche Daten', () => {
    expect(handbook).toContain('## Rechenweg');
    expect(handbook).toContain('[Rechenweg](./rechenweg.html)');
    expect(handbook).toContain('### Rechenweg mit eigenen Werten teilen');
    expect(handbook).toContain('Link zu diesem Rechenweg kopieren');
    expect(handbook).toMatch(/Haushaltseinkommen[^\n]*öffentlich/);
    const { html } = renderHelp(handbook);
    expect(html).toContain('<a href="./rechenweg.html">');
  });

  it('F5.4/F15 Handbuch beschreibt Einkommensbereiche, Grenzen einschließlich, Vereinfachung und den Kind-Zuschlag ohne KfW 358', () => {
    const row = (label: string) => handbook.split('\n').find((l) => l.startsWith(`| **${label}**`)) ?? '';
    expect(row('Zu versteuerndes Haushaltseinkommen')).toMatch(/Auswahl eines Einkommensbereichs/);
    expect(row('Zu versteuerndes Haushaltseinkommen')).toMatch(/Grenzen sind einschließlich/);
    expect(row('Zu versteuerndes Haushaltseinkommen')).toMatch(/obere[n]? Grenze des gewählten Bereichs/);
    expect(row('Kindergeldberechtigtes Kind unter 18')).toContain('Die Grenzen des Einkommensbonus steigen um 10.000 € (nicht beim KfW-Kredit 358).');
  });

  it('alle Ergebnisbereiche sind beschrieben', () => {
    for (const t of ['Kennzahlen', 'Wichtige Ereignisse & Hinweise', 'Diagramme', 'Stromkosten: mit oder ohne Wärmepumpentarif', 'Wann umrüsten?', 'Jahresübersicht', 'Monatliche Belastung']) {
      expect(handbook, t).toContain(t);
    }
  });
});

describe('F15 Hilfeseite – Darstellung', () => {
  it('Anker-IDs mit Umlauten, eindeutig, Inhaltsverzeichnis aus h2/h3', () => {
    expect(slugify('Hell | Dunkel | Auto')).toBe('hell-dunkel-auto');
    expect(slugify('Wann umrüsten?')).toBe('wann-umruesten');
    const { toc, html, title } = renderHelp(handbook);
    expect(title).toBe('Benutzerhandbuch');
    expect(toc.length).toBeGreaterThan(20);
    expect(new Set(toc.map((t) => t.id)).size).toBe(toc.length);
    expect(toc.find((t) => t.text === 'Link mit Werten teilen')).toMatchObject({ id: 'link-mit-werten-teilen', level: 3 });
    expect(html).toContain('<h3 id="link-mit-werten-teilen">');
    expect(html).toContain('<div class="table-wrap"><table>');
  });

  it('Inhaltsverzeichnis: Klartext der Überschrift, ohne neues Markup', () => {
    const { toc } = renderHelp('# T\n\n## Haushalt & Gebäude\n\n## Feld `jaz` und **fett**\n');
    expect(toc.map((t) => t.text)).toEqual(['Haushalt & Gebäude', 'Feld jaz und fett']);
    expect(toc[0].id).toBe('haushalt-gebaeude');
    expect(headingText('<scr<b>ipt>alert(1)</scr</b>ipt>')).toBe('alert(1)');
    expect(headingText('a <b>b</b> &amp;lt;c&amp;gt; <i')).toBe('a b &lt;c&gt; i');
  });

  it('doppelte Überschriften erhalten eindeutige IDs', () => {
    const { toc } = renderHelp('## A\n\n## A\n');
    expect(toc.map((t) => t.id)).toEqual(['a', 'a-2']);
  });
});

describe('F19 Projektlinks und Mitmachen', () => {
  it('Handbuch, README und CONTRIBUTING laden zur Mitarbeit ein und verlinken das Repository', async () => {
    const { REPO_URL, BUG_REPORT_URL, CONTRIBUTING_URL, FEATURE_REQUEST_URL } = await import('../src/project');
    expect(REPO_URL).toBe('https://github.com/chkania/wpir');
    const handbook = read('docs/BENUTZERHANDBUCH.md');
    expect(handbook).toMatch(/^## Mitmachen$/m);
    for (const url of [REPO_URL, BUG_REPORT_URL, CONTRIBUTING_URL, FEATURE_REQUEST_URL]) expect(handbook).toContain(url);
    // the linked issue forms exist
    expect(read('.github/ISSUE_TEMPLATE/feature_request.yml')).toContain('labels: [enhancement]');
    expect(read('.github/ISSUE_TEMPLATE/bug_report.yml')).toContain('labels: [bug]');
    expect(read('README.md')).toMatch(/^## Mitmachen$/m);
    expect(read('README.md')).toContain(BUG_REPORT_URL);
    expect(read('CONTRIBUTING.md')).toContain(BUG_REPORT_URL);
    expect(read('CONTRIBUTING.md')).toContain(FEATURE_REQUEST_URL);
  });

  it('F19.4 Unterstützen: Buy Me a Coffee und PayPal in Handbuch, README und Datenschutz; Badges in der README', async () => {
    const { PAYPAL_URL, BUY_ME_A_COFFEE_URL } = await import('../src/project');
    expect(PAYPAL_URL).toBe('https://paypal.me/ChristophKania');
    expect(BUY_ME_A_COFFEE_URL).toBe('https://buymeacoffee.com/chkania');
    const readme = read('README.md');
    for (const doc of [read('docs/BENUTZERHANDBUCH.md'), readme]) {
      expect(doc).toContain(`](${PAYPAL_URL})`);
      expect(doc).toContain(`](${BUY_ME_A_COFFEE_URL})`);
    }
    for (const wf of ['ci.yml', 'deploy.yml']) expect(readme).toContain(`/actions/workflows/${wf}/badge.svg`);
    expect(readme).toMatch(/^\[!\[CI\]/m);
    expect(read('docs/DATENSCHUTZ.md')).toMatch(/\*\*Unterstützen \(Buy Me a Coffee, PayPal\):\*\*/);
  });

  it('Dokumentseiten verlinken das Repository im Seitenfuß', async () => {
    const { renderDocPage } = await import('../src/doc-page');
    const { REPO_URL } = await import('../src/project');
    expect(renderDocPage({ markdown: '# T\n\nx', subtitle: 's' }).html).toContain(`<a href="${REPO_URL}">`);
  });
});

describe('F1.5 Handbuch Antragsmonat (AK12)', () => {
  it('AK12 beschreibt Feld, Automatik (leer = 4 Monate vor Inbetriebnahme) und festen Monat; „Vorlauf Förderantrag“ entfällt', () => {
    for (const t of ['**Antragsmonat**', 'automatisch', '4 Monaten vor der Inbetriebnahme', 'festen Antragsmonat', 'Früher Antrag, späterer Einbau']) {
      expect(handbook, t).toContain(t);
    }
    expect(handbook).not.toContain('| **Vorlauf Förderantrag** |');
  });
});
