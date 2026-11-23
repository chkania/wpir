# Wärmepumpen-Investitionsrechner

SPA (Vite + TypeScript, ohne UI-Framework, Chart.js) zur Wirtschaftlichkeitsrechnung Gas/Öl → Wärmepumpe.

## Vor jeder Änderung
1. `docs/anforderungen/README.md` (Index) und die betroffenen Anforderungsdateien lesen – eine Datei je Anforderung (`F13-….md`, `N7-….md`, Unterpunkte F13.1… darin); dazu `entscheidungen.md` (E*), `annahmen.md` (A*), `quellen.md`, `aenderungsprotokoll.md`.
2. `npm test` muss vorher und nachher grün sein (Regressionsschutz).
3. Neue/geänderte Anforderung → Pflegeregeln in `docs/anforderungen/README.md` befolgen (Datei, Index, Test-Verweis, Änderungsprotokoll) und Test ergänzen.
   Neue Felder oder Bedienfunktionen auch im Benutzerhandbuch `docs/BENUTZERHANDBUCH.md` beschreiben (`tests/help.test.ts` prüft das).
4. Ändert sich ein Ergebnis bewusst, schlägt `tests/regression.test.ts` fehl → prüfen, dann `npm test -- -u` und in `docs/anforderungen/aenderungsprotokoll.md` begründen.

## Struktur
- `src/core/` – reiner Rechenkern ohne DOM (monatliche Simulation):
  - `defaults.ts` – alle Förder-/Preis-/Steuerannahmen (einzige Stelle für Konditionen)
  - `sources.ts` – Herkunft jedes Standardwerts (Popover „i“); bei Änderung eines Defaults mitpflegen, neues Feld braucht Eintrag (Test erzwingt das)
  - `default-history.ts` – frühere Standardwerte (F22.4); Default geändert → neuer Eintrag mit Datum und altem Wert, damit gespeicherte Eingaben und Dateien den Hinweis „Neue Standardwerte“ zeigen (ältere Einträge nie ändern)
  - `prices.ts` (Energiepreise, CO₂-Pfad, Bio-Treppe), `funding.ts` (KfW 458, 358/359), `tax.ts` (§ 35c), `loan.ts` (Annuitätendarlehen)
  - `validate.ts` – Grenzen/Prüfung aller Eingaben aus Link, Datei und Speicher (neues Zahlenfeld mit Schleifen-/Divisionswirkung → Grenze in `NUMBER_LIMITS`, neues Monats-/Auswahlfeld → `MONTH_FIELDS`/`SELECT_VALUES`)
  - `house.ts` – Einordnung des Hauses (F18): kWh/m², Effizienzklasse, Baualter, Sanierung, Heizlast; `prices.ts#energySplit` teilt den Verbrauch in Raumwärme/Warmwasser/Kochen (F17)
  - `simulation.ts` (Szenarien ref/kfw/tax, Amortisation), `compare.ts` (Installationszeitpunkte), `burden.ts` (monatliche Belastung, F36; Karte in `src/ui/burden.ts`), `events.ts` (wichtige Ereignisse & Hinweise, F10), `tariff.ts` (Stromtarifvergleich, F13), `serialize.ts` (localStorage/Link/JSON)
- `src/analytics.ts` – Matomo-Besucherstatistik (N10), nur im Build; neue Seite → `initAnalytics('<fester Titel>')` im Einstieg (kein noscript-Pixel). Widerspruch per `setOptOut` auf der Datenschutzseite. Nie Eingaben, URL-Hash oder Szenario-Bezeichnung an Matomo geben.
- `angebot.html` + `docs/ANGEBOT.md` – Dokumentseite „Weg zum Angebot und zur Förderung“ (F39): Checklisten, Verweise auf neutrale Stellen, keine Beratung; wie die übrigen Dokumentseiten in `DOC_PAGES`, `DOC_LINKS`, `public/sitemap.xml`, `public/llms.txt`, `vite.config.ts`.
- `impressum.html`, `datenschutz.html` + `docs/IMPRESSUM.md`, `docs/DATENSCHUTZ.md` (N11) – rechtliche Angaben; bei neuer Datenverarbeitung (z. B. weiterer externer Dienst) Datenschutzerklärung und CSP anpassen.
- `hilfe.html` + `src/help.ts`/`help-main.ts`/`help.css` – Hilfeseite, rendert `docs/BENUTZERHANDBUCH.md`
- `lizenz.html`, `lizenzen-drittanbieter.html` + `src/pages/*` – rendern `LICENSE.md` bzw. `THIRD-PARTY-NOTICES.md`; gemeinsamer Seitenaufbau in `src/doc-page.ts` (neue Dokumentseite: HTML-Datei mit `<link rel="canonical">`, eigenem `<title>` und `<meta name="description">` (≤ 160 Zeichen), Eintrag in `vite.config.ts`, `DOC_LINKS`, `public/sitemap.xml` und – bei Markdown-Seiten – `src/pages/doc-pages.ts`, damit `prerender.ts` sie beim Build vorrendert (F33.2), `tests/seo.test.ts`). `index.html` enthält eine statische Einführung für Crawler ohne JavaScript (F33.1) – bei neuen Hauptfunktionen dort mitpflegen.
- `rechenweg.html` + `src/ui/derivation.ts` – Rechenweg (F32): Zwischenwerte und Erklärungen zu allen Kennzahlen, nur aus dem Ergebnis von `runAll` (keine zweite Rechnung); fehlt dort ein Zwischenwert, ihn in der Simulation ergänzen
- `src/ui/agent-export.ts` – Export für KI-Assistenten (F35): Markdown mit Agenten-Hinweisen, Ergebnissen, Rechenweg (HTML von `derivation.ts` → Markdown), allen Feldern samt Standardwert/Herkunft (`fields.ts`, `sources.ts`), JSON und Monatswerten; wird nachgeladen. Neue Ergebnisbereiche dort ergänzen
- `src/logo.ts` – Logo (F23) für die Kopfzeile; Favicon in `public/`, Dateien für Präsentationen und Nutzungsregeln in `docs/logo/` (Form überall gleich halten, `tests/logo.test.ts`)
- `src/ui/` – `fields.ts` (deklarative Formularfelder; neues Eingabefeld = Eintrag hier + in `types.ts`/`defaults.ts`), `app.ts`, `charts.ts` (Diagrammtabellen ohne Chart.js), `chart-render.ts` (Chart.js, wird nachgeladen – nie statisch importieren, N14)
- `tests/` – Vitest; `ui.test.ts` läuft mit happy-dom; `helpers.ts` fixiert den Stichtag 2026-11-11 und feste Testpreise (`pinPrices`/`neutral`). Markt-Defaults aktualisieren → nur Regressions-Snapshots ändern sich (`npm test -- -u`, im Änderungsprotokoll begründen).

## Version & Changelog
Semantic Versioning (N9), Quelle `package.json`; Version und `CHANGELOG.md` werden **automatisch** aus den Commit-Nachrichten abgeleitet (`scripts/release.ts`, Workflow `release.yml` nach jedem Push auf `main`). Nie von Hand ändern – sonst entstehen bei paralleler Arbeit Konflikte.
- Commit-Nachrichten/PR-Titel nach Conventional Commits (beim Squash-Merge wird jeder Commit des PRs ein eigener Changelog-Eintrag – Zwischenkorrekturen daher nicht als `fix:`), Beschreibung auf Deutsch aus Nutzersicht (erscheint so im Changelog): `feat:` neue Funktion/Eingabe/geändertes Rechenmodell/Defaults → Minor; `fix:` Fehler/Text/Darstellung → Patch; `perf:` → Patch; `!` bzw. `BREAKING CHANGE:` bei inkompatiblem Export-/Link-Format → Major; `docs/test/refactor/style/build/ci/chore` → keine Version.
- Ablauf und Beispiele: `CONTRIBUTING.md`. Vorschau: `npm run release:preview`.

## Lizenz
PolyForm Noncommercial 1.0.0 (`LICENSE.md`). Neue/aktualisierte Laufzeit-Abhängigkeit → `npm run notices` (erzeugt `THIRD-PARTY-NOTICES.md`; `tests/license.test.ts` prüft die Aktualität). Nur Abhängigkeiten mit kompatibler, freizügiger Lizenz (MIT, BSD, Apache-2.0, ISC, OFL) aufnehmen.

## CI & Dependabot
- `.github/workflows/ci.yml` – Tests, Build und `npm audit` (Laufzeit, ab „high“) für Push auf `main` und PRs.
- `.github/dependabot.yml` – wöchentliche Updates (npm mit 7 Tagen Cooldown, GitHub Actions); Patch/Minor gruppiert.
- `.github/workflows/release.yml` – leitet nach Push auf `main` die Version ab und committet `chore(release): x.y.z` (nur Node/Git, kein `npm ci`). `.github/workflows/pr-title.yml` – prüft PR-Titel auf Conventional Commits.
- `.github/workflows/deploy.yml` – nach erfolgreichem Release auf `main` (oder manuell) bauen und per SSH/rsync auf den Webspace laden (N12); Build-Job ohne Secrets (zeigt in der Zusammenfassung die Changelog-Einträge seit der Live-Version, `scripts/deploy-changelog.ts`, N12.1), Deploy-Job ohne npm; nur bei geändertem `dist/` (Inhalts-Hash in `version.json`, `scripts/content-hash.ts`, `scripts/deploy-needed.ts`, N12.2; manueller Lauf stellt immer bereit); danach prüft der Job `verify` (ohne Secrets) die Live-Seite mit `scripts/smoke-test.ts` (N15: `version.json`, Rechner rechnet, Diagramme, alle Seiten fehlerfrei). Neue Seite oder geänderte Selektoren (`#app-version`, `#kpis`, `.info-btn`, `#f-oldHeating-consumption`) → Smoketest anpassen. Einrichtung: `docs/DEPLOYMENT.md`.
- `.github/workflows/annahmen-pruefen.yml` – vierteljährliches Issue mit Checkliste der zeitkritischen Standardwerte (aus `sources.ts`, F22). Nach der Prüfung `FUNDING_SOURCE_DATE` in `defaults.ts` auf das Prüfdatum setzen (steuert den Hinweis „Annahmen möglicherweise veraltet“ nach 6 Monaten). Vorprüfung lokal mit `npm run verify:assumptions` (F22.3, `docs/ANNAHMEN-PRUEFEN.md`; nur Bericht, ändert nie `src/`).
- `.github/workflows/dependabot.yml` – prüft Dependabot-PRs ohne Schreibrechte, committet aktualisierte `THIRD-PARTY-NOTICES.md` und merged Patch/Minor automatisch (Squash); Major bleibt zur manuellen Prüfung offen. Abhängigkeits-Updates erhöhen die App-Version nicht.

## Befehle
- `/chk-sdlc:feature <Beschreibung>` – Agentenkette Anforderung → Review → Implementierung → Code-Review → QA (Plugin `chk-sdlc`, Profil `.claude/feature-profile.md`, Prüfliste `.claude/requirements-checklist.md`); `/chk-sdlc:retro` – Auswertung des Laufbuchs `.claude/feature-log.md`, Verbesserungsvorschläge für die Kette
- `npm run check:mcp [-- <url>]` – Verbindung und Vertrag mit dem MCP-Server `wpir-mcp` (F22.5, `.mcp.json`); `/annahmen-mcp` prüft die Förder- und Rechtswerte damit (Agent `assumptions-checker`)
- `npm run smoke [-- <url>]` – Smoketest gegen die Live-Seite oder die lokale Vorschau (N15)
- `npm run dev` – Entwicklungsserver (Port 5173, siehe `.claude/launch.json`)
- `npm test` – alle Tests · `npm run test:coverage` – Tests mit Testabdeckung (Bericht in `coverage/`, HTML unter `coverage/index.html`; in der CI als Zusammenfassung). Mindestwerte in `vite.config.ts`: gesamt 90 % Zeilen / 78 % Verzweigungen, `src/core` 95 / 85, `src/ui` 80 / 65 – Unterschreiten lässt die CI fehlschlagen; nach oben nachziehen, nie senken · `npm run build` – Typecheck + statischer Build nach `dist/`

## Konventionen
- Sprache im Code: Kommentare (auch JSDoc, YAML-/CSS-/HTML-Kommentare) sowie Namen von Klassen, Typen, Funktionen/Methoden, Variablen und Dateien immer auf **Englisch**. Deutsch bleiben alle für Nutzer sichtbaren Texte (UI, Meldungen, Handbuch, Changelog) und die Beschreibung in Commit-Nachrichten/PR-Titeln (erscheint im Changelog). Fachbegriffe im Kommentar mit dem deutschen Begriff in Klammern, beim ersten Vorkommen je Kommentar, z. B. „special repayment (Sondertilgung)“, „climate speed bonus (Klimageschwindigkeitsbonus)“, „SPF (JAZ)“.
- Design: nur „Modern“. `src/style.css` = Basisregeln, `src/style-modern.css` = moderne Schicht (nur Regeln unter `:root[data-design='modern']`, das alle HTML-Seiten fest setzen). Neue UI-Elemente in Hell und Dunkel prüfen. Dunkle Farben nur über `:root[data-theme='dark']` (keine `prefers-color-scheme`-Media-Queries).
- Sicherheit: dynamische Texte in HTML immer mit `escapeHtml`; keine Inline-Skripte/-Event-Handler/`style="…"` im Markup (CSP aus `csp.ts` im Build). Gebauten Stand prüfen: `npm run build`, dann Vorschau „preview“ (Port 4173).
- Barrierefreiheit (N7, WCAG 2.1 AA): Farben nur über Tokens; neue Text-/Flächenfarben müssen ≥ 4,5 : 1 erreichen (`tests/a11y.test.ts` prüft die Tokens), Text auf Akzentflächen mit `--on-accent`; kein `outline: none`; neue Diagramme brauchen `role="img"`-Beschreibung und eine Tabelle in `chartTables()`; Fehler als Text, nicht nur per Farbe.
- Ansprache: Rechner, Handbuch und rechtliche Seiten siezen („Sie“); alles zum Mitmachen (Kasten „Mitmachen“, gleichnamige Abschnitte in Handbuch/README, CONTRIBUTING.md) duzt („du“, kleingeschrieben).
- UI-Texte Deutsch; Beträge brutto in €; Prozentwerte intern als Anteil (0.3), im Formular als % (`type: 'percent'`).
- Kostenvorzeichen: positiv = Ausgabe, negativ = Einnahme (Zuschuss, Steuerbonus, Kreditauszahlung, Restwert).
