# Feature profile

Projektprofil für das Plugin `chk-sdlc` (Format: `docs/PROFILE.md` im Repo `chkania/claude-chk-sdlc`).

## Project
Wärmepumpen-Investitionsrechner: SPA (Vite + TypeScript, Chart.js) zur Wirtschaftlichkeitsrechnung Gas/Öl → Wärmepumpe. Rahmen: `docs/anforderungen/produktbeschreibung.md`.

## Paths
- Anforderungen: docs/anforderungen/
- Prüfliste: .claude/requirements-checklist.md
- Laufbuch: .claude/feature-log.md
- Standard-Branch: main

## Commands
- Tests gezielt: `npx vitest run --reporter=dot <tests/datei.test.ts …>` oder `npx vitest related --run --reporter=dot <geänderte src-Dateien>`
- Tests vollständig: `npm test -- --reporter=dot`
- Tests mit Abdeckung: `npm run test:coverage -- --reporter=dot`
- Build/Typprüfung: `npm run build`
- Basis-Messung: nach `npm run build` die Dateigrößen in `dist/assets` in eine Datei schreiben

## Cleanup after test runs
Ändert ein Lauf die eingecheckte `.vitest/json/output.json`: `git checkout -- .vitest/json/output.json`.

## Documentation duties (implementer)
- Anforderungen nach den Pflegeregeln in `docs/anforderungen/README.md` (Datei, Index, Test-Verweis, Änderungsprotokoll).
- Neue Felder und Bedienfunktionen in `docs/BENUTZERHANDBUCH.md` (`tests/help.test.ts` prüft das).
- Neue Eingabefelder, Defaults, Seiten und Export-Bereiche: Hinweise in `CLAUDE.md` (Struktur) befolgen (`fields.ts`, `types.ts`, `defaults.ts`, `sources.ts`, `default-history.ts`, `validate.ts`, KI-Export, Rechenweg, `DOC_PAGES`/Sitemap).
- Ändert sich das Default-Ergebnis bewusst: `npm test -- -u` und Begründung mit Vorher/Nachher-Werten im Änderungsprotokoll.
- Wächst das Haupt-Bundle spürbar: Grund im Änderungsprotokoll.

## Review focus (code review)
- Korrekt: Rechnung (Vorzeichen: positiv = Ausgabe, negativ = Einnahme; Monat, Szenario ref/kfw/tax, Preissteigerung, Rundung); alte Daten aus Speicher, Link (`#z=`) und Datei bleiben ladbar.
- Performant: keine zweite Simulation je Eingabe; Chart.js nur nachgeladen (`chart-render`, N14); keine schweren statischen Importe im Haupt-Bundle.
- Sicher: dynamische Texte mit `escapeHtml`; keine Inline-Skripte/-Handler/`style="…"` (CSP); nie Eingaben, URL-Hash oder Szenario-Bezeichnung an Matomo.
- Struktur: Rechenkern `src/core/` ohne DOM; Konditionen nur in `defaults.ts`; Sprache laut `CLAUDE.md` (Code Englisch, UI Deutsch).

## QA criteria
- Mindestabdeckung laut `vite.config.ts` (gesamt 90 % Zeilen / 78 % Verzweigungen, `src/core` 95 / 85, `src/ui` 80 / 65).
- Performance: Dateigrößen in `dist/assets` mit der Basis-Messung vergleichen; Zuwachs des Haupt-Bundles über 5 % ist ein Mangel, außer das Änderungsprotokoll begründet ihn. `chart-render` nie statisch importiert (N14). Laufzeit von `runAll` nur messen, wenn der Diff `src/core/` außerhalb reiner Hilfsfunktionen ändert.
- Barrierefreiheit (N7): `tests/a11y.test.ts` grün; neue Bedienelemente beschriftet und per Tastatur erreichbar; Konventionen zu Farben, Fokus, Fehlertexten, Diagrammen aus `CLAUDE.md`. Browser-Prüfung (400 px, Hell und Dunkel, z. B. `playwright-core` gegen `npm run build` + `npx vite preview --port 4173`) nur, wenn der Diff CSS oder Markup neuer/geänderter Bedienelemente enthält.
- Dokumentation: Anforderung, Änderungsprotokoll, Handbuch ergänzt (`tests/help.test.ts` grün).
