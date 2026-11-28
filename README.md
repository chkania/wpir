# Wärmepumpen-Investitionsrechner

[![CI](https://github.com/chkania/wpir/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/chkania/wpir/actions/workflows/ci.yml)
[![Deploy](https://github.com/chkania/wpir/actions/workflows/deploy.yml/badge.svg?branch=main)](https://github.com/chkania/wpir/actions/workflows/deploy.yml)
[![Version](https://img.shields.io/github/package-json/v/chkania/wpir?label=Version)](CHANGELOG.md)
[![Lizenz: PolyForm Noncommercial 1.0.0](https://img.shields.io/badge/Lizenz-PolyForm%20Noncommercial%201.0.0-blue)](LICENSE.md)
[![Rechner öffnen](https://img.shields.io/badge/Rechner-waermepumpen--investitionsrechner.de-2ea44f)](https://waermepumpen-investitionsrechner.de/)
[![Buy me a coffee](https://img.shields.io/badge/Buy%20me%20a%20coffee-FFDD00?logo=buymeacoffee&logoColor=black)](https://buymeacoffee.com/chkania)
[![PayPal](https://img.shields.io/badge/PayPal-Spenden-00457C?logo=paypal&logoColor=white)](https://paypal.me/ChristophKania)

Rechnet den Umstieg von einer Gas- oder Ölheizung auf eine Wärmepumpe durch – mit steigenden Energie- und CO₂-Preisen,
KfW-Heizungsförderung (458), Ergänzungskredit (358/359), Bankkredit, Steuerbonus (§ 35c EStG) und einem Vergleich
verschiedener Umrüstzeitpunkte.

```bash
npm install
npm run dev      # http://localhost:5173
npm test         # Regressionstests
npm run test:coverage  # Tests mit Testabdeckung (Bericht: coverage/index.html)
npm run build    # statische Dateien in dist/ (z. B. für GitHub Pages)
```

Veröffentlichung auf einem Webspace per SSH: [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).

Bedienung: [docs/BENUTZERHANDBUCH.md](docs/BENUTZERHANDBUCH.md) – im Browser unter `hilfe.html` bzw. über „Hilfe“ im Rechner.

Anforderungen, Annahmen und Quellen: [docs/anforderungen/](docs/anforderungen/README.md) (eine Datei je Anforderung).

Die aktuelle Version und alle Änderungen stehen in [CHANGELOG.md](CHANGELOG.md) (im Browser: `changelog.html`). Versionierung nach [Semantic Versioning](https://semver.org/lang/de/), automatisch aus den Commit-Nachrichten – Ablauf und Commit-Format in [CONTRIBUTING.md](CONTRIBUTING.md).

Keine Finanz-, Steuer- oder Förderberatung; alle Angaben ohne Gewähr.

## Entstehung

Am Anfang stand eine persönliche Frage: Lohnt sich der Umstieg auf eine Wärmepumpe auch finanziell? Die Antworten, die ich fand, waren oft sehr allgemein oder beruhten auf Annahmen, die nicht zum eigenen Haus passten. Also habe ich selbst nachgerechnet – Förderrichtlinien, Energie- und CO₂-Preise, Steuerbonus, Kredite –, und aus dieser Recherche ist Schritt für Schritt dieser Rechner entstanden.

Er ist ein rein privates Hobbyprojekt, ohne Auftraggeber, Werbung oder kommerzielles Interesse. Ich bin kein Fachmann für Heizungstechnik oder Energieberatung, sondern habe mich gründlich eingelesen; deshalb ist jede Annahme mit ihrer Herkunft offengelegt (`src/core/sources.ts`, [docs/anforderungen/](docs/anforderungen/README.md)). Hinweise auf Fehler oder veraltete Werte sind herzlich willkommen. – Christoph Kania

## Mitmachen

Förderprogramme, Energiepreise und Steuerregeln ändern sich laufend – der Rechner lebt davon, dass Menschen mit Erfahrung, Fachwissen oder einfach einem wachen Blick ihn aktuell halten. Mach mit, jeder Beitrag zählt:

- **Melde Fehler oder veraltete Annahmen** – über das Formular [Fehler oder veralteter Wert](https://github.com/chkania/wpir/issues/new?template=bug_report.yml), am besten mit Quelle.
- **Bring deine Ideen ein** – fehlende Szenarien, unklare Erklärungen, bessere Darstellungen.
- **Entwickle mit** – Rechenlogik, Texte, Tests, Barrierefreiheit. Ablauf, Commit-Format und Konventionen findest du in [CONTRIBUTING.md](CONTRIBUTING.md); `CLAUDE.md` und `docs/anforderungen/` beschreiben Struktur und Anforderungen. Mit Claude Code kannst du eine Änderung auch von einer Agentenkette umsetzen lassen (`/chk-sdlc:feature`, [Ablauf](CONTRIBUTING.md#mit-claude-code-die-agentenkette-chk-sdlcfeature)).

Auch kleine Beiträge wie ein korrigierter Tippfehler oder eine geprüfte Quelle helfen – schön, wenn du dabei bist!

Du möchtest das Hobbyprojekt einfach so unterstützen? Über einen Kaffee freue ich mich: [Buy me a coffee](https://buymeacoffee.com/chkania) oder [PayPal](https://paypal.me/ChristophKania). Freiwillig – der Rechner bleibt kostenlos und werbefrei.

## Lizenz

Copyright © 2026 Christoph Kania. Veröffentlicht unter der [PolyForm Noncommercial License 1.0.0](LICENSE.md) (im Browser: `lizenz.html`):
Nutzung, Änderung und Weitergabe sind für **nicht-kommerzielle Zwecke** kostenfrei erlaubt (private Nutzung,
Forschung, Bildung, gemeinnützige Organisationen, Behörden). Für kommerzielle Nutzung ist eine gesonderte
Vereinbarung nötig. Hinweis: Das ist eine „Source available“-Lizenz, keine Open-Source-Lizenz im Sinne der OSI.

Enthaltene Bibliotheken und Schriften stehen unter eigenen Lizenzen (MIT, SIL OFL 1.1), siehe
[THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md) (im Browser: `lizenzen-drittanbieter.html`) – nach Änderungen an den Abhängigkeiten mit `npm run notices` neu erzeugen.
