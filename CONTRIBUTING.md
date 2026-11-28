# Mitarbeit

Schön, dass du mithelfen möchtest! Der Wärmepumpen-Investitionsrechner soll Menschen eine ehrliche Grundlage für eine große Entscheidung geben – das gelingt nur, wenn Annahmen, Förderregeln und Preise aktuell bleiben. Dafür ist deine Hilfe willkommen:

- **Ohne Programmierkenntnisse:** Melde Fehler, unplausible Ergebnisse oder veraltete Werte über das Formular [Fehler oder veralteter Wert](https://github.com/chkania/wpir/issues/new?template=bug_report.yml) – am besten mit Quelle. Auch deine Rückmeldung zu unklaren Texten oder zur Bedienbarkeit hilft sehr.
- **Mit Programmierkenntnissen:** Schick einen Pull Request nach dem Ablauf unten. Bei größeren Änderungen lohnt es sich, die Idee vorher kurz zu besprechen – am einfachsten über das Formular [Idee oder Frage](https://github.com/chkania/wpir/issues/new?template=feature_request.yml).

## Ablauf

1. Kurzlebigen Branch von `main` anlegen, z. B. `feat/pv-vergleich` oder `fix/export-dateiname`.
2. Änderung umsetzen; `npm test` und `npm run build` müssen grün sein (siehe `CLAUDE.md` und `docs/anforderungen/`). Die CI misst außerdem die Testabdeckung (`npm run test:coverage`): Neue Rechenlogik braucht Tests, sonst kann die Mindestabdeckung des Rechenkerns (95 % der Zeilen, 85 % der Verzweigungen) unterschritten werden.
3. Pull Request auf `main` öffnen. Der **PR-Titel** muss dem Format unten entsprechen (Workflow „PR-Titel“ prüft das).
4. Nach grüner CI per **Squash-Merge** zusammenführen – der PR-Titel wird zur Commit-Nachricht auf `main`.
   GitHub übernimmt dabei die Nachrichten aller Commits des PRs in den Squash-Commit (`* feat: …`). Enthält der PR mehrere Commits im Commit-Format, bekommt jeder einen eigenen Eintrag im Changelog, und der PR-Titel selbst erscheint dort nicht. Bei nur einem Commit oder ohne solche Commits wird der PR-Titel zum einzigen Eintrag.
   Deshalb auch Commits auf dem Branch im Format unten und aus Nutzersicht schreiben. Korrekturen an einer Änderung, die noch nicht auf `main` ist, nicht als `fix:` committen, sondern als `refactor:`, `test:` oder `chore:`. Sonst erscheinen sie als Fehlerkorrektur im Changelog.
5. Der Workflow „Release“ leitet daraus automatisch die neue Version ab, schreibt `package.json`, `package-lock.json` und `CHANGELOG.md` und committet `chore(release): x.y.z` auf `main`.

**Version und Changelog nie von Hand ändern.** Dadurch gibt es bei paralleler Arbeit keine Konflikte um Versionsnummern: Die Nummer entsteht erst auf `main`, nacheinander für jeden Merge.

Direkte Commits auf `main` sind möglich; dann zählt jede einzelne Commit-Nachricht.

## Mit Claude Code: die Agentenkette `/chk-sdlc:feature`

Wenn du mit [Claude Code](https://claude.com/claude-code) arbeitest, kannst du eine Änderung von der Idee bis zum Pull Request von einer Kette spezialisierter Agenten erledigen lassen. Das ist ein Angebot, keine Pflicht: Der Ablauf oben gilt genauso, wenn du von Hand arbeitest, und das Ergebnis der Kette ist ein ganz normaler Pull Request.

**Einrichten (einmalig):** Die Kette kommt aus dem Plugin `chk-sdlc` ([chkania/claude-chk-sdlc](https://github.com/chkania/claude-chk-sdlc)). `.claude/settings.json` aktiviert es; beim ersten Öffnen des Projekts in Claude Code vertraust du dem Marketplace und installierst das Plugin (sonst: `claude plugin marketplace add chkania/claude-chk-sdlc`, dann `claude plugin install chk-sdlc@claude-chk-sdlc --scope project`).

**Starten:** im Projektverzeichnis in Claude Code

```
/chk-sdlc:feature Mehrere Szenarien im Browser speichern und vergleichen
```

Beschreib die Idee so, wie du sie einem Menschen erklären würdest – was du erreichen willst und warum. Die Kette legt einen Branch von `main` an und durchläuft diese Stufen:

| Stufe | Agent | Was passiert |
|---|---|---|
| 1. Anforderung | `requirements-author` | Leitet aus deiner Beschreibung eine Anforderung mit IDs, prüfbaren Akzeptanzkriterien und betroffenen Bereichen ab. Was nur du entscheiden kannst, fragt er dich (Auswahlfragen). Prüft die Anforderung dann in einer Runde selbst. |
| 2. Anforderungs-Review | `requirements-reviewer` | Prüft die Anforderung in höchstens zwei Runden erneut auf Vollständigkeit und Widersprüche zu bestehenden Anforderungen und verbessert sie. Die geprüfte Fassung liegt als Datei bereit, du liest sie und gibst sie frei; erst dann beginnt die Umsetzung. |
| 3. Umsetzung | `implementer` | Schreibt Code, Tests und Dokumentation (Anforderungsdatei, Änderungsprotokoll, Benutzerhandbuch). Führt während der Arbeit nur die betroffenen Tests aus, die ganze Suite und den Build einmal am Ende. |
| 4. Code-Review | `code-reviewer` | Prüft am Diff, ob der Code korrekt, performant und sinnvoll umgesetzt ist (ohne eigene Testläufe). Hohe und mittlere Befunde gehen zurück an die Umsetzung, danach wird nur das Delta erneut geprüft. |
| 5. QA | `qa` | Prüft Tests und Testabdeckung (ein Lauf), ob die neuen bzw. geänderten Tests fachlich zur Anforderung passen (richtig, vollständig, aussagekräftig; nur diese Tests), Build, Performance (Bundle-Größe gegenüber dem Ausgangsstand) und Barrierefreiheit, bei neuen Bedienelementen auch im echten Browser. Mängel gehen zurück an die Umsetzung, danach folgen erneut Code-Review und QA für das Geänderte. |

Geringe Befunde sammelt die Kette und lässt sie nach der Freigabe in einem Rutsch beheben. Zwischenstände landen als lokale Commits und werden vor dem Push zu einem Commit zusammengefasst.

**Prozess verbessern:** Jeder Lauf hinterlässt ein paar Zeilen im Laufbuch [.claude/feature-log.md](.claude/feature-log.md) – Aufwand je Stufe und welche Befunde erst spät auffielen. `/chk-sdlc:retro` wertet es aus (Agent `process-retro`, Sonnet) und schlägt höchstens drei Änderungen an Agenten oder Skill vor; du entscheidest, welche übernommen werden. Die Kette empfiehlt eine Retro nach fünf Läufen oder wenn eine Stufe drei Durchgänge brauchte.

Die Agenten 1 und 2 schreiben keinen Code; die Reviewer und die QA ändern keine Dateien. Beide Anforderungsagenten arbeiten mit derselben Prüfliste ([.claude/requirements-checklist.md](.claude/requirements-checklist.md)), die auch beschreibt, wie eine Anforderung aufgebaut ist.

**Wo du gefragt wirst:**
- bei Rückfragen zur Anforderung (Stufe 1 und 2),
- zur **Zwischenfreigabe der Anforderung** nach Stufe 1: Du bekommst eine kurze Zusammenfassung und entscheidest, ob sie so an den Review geht,
- zur **Freigabe der geprüften Anforderung**: Du bekommst die Datei samt Kurzfassung und entscheidest, ob die Umsetzung beginnt oder die Anforderung geändert wird,
- wenn sich Code-Review und Umsetzung nach zwei Durchgängen nicht einig werden oder die QA nach drei Durchgängen noch Mängel findet – dann hält die Kette an und legt dir die offenen Punkte vor; passen die Tests auch nach dem zweiten QA-Durchgang nicht zur Anforderung, fragt sie dich sofort, wie sie weiter vorgehen soll,
- vor dem Push: Erst nach der Freigabe durch die QA wird committet (Commit-Format wie unten), und erst auf deine Bestätigung gepusht und der Pull Request erstellt.

**Danach:** Der Pull Request durchläuft dieselbe CI und dasselbe Review wie jeder andere. Prüf die Anforderung und den Code selbst, bevor du ihn zur Zusammenführung freigibst – du bleibst die Autorin bzw. der Autor.

Agenten, Modelle und Ablauf sind im Plugin-Repo [chkania/claude-chk-sdlc](https://github.com/chkania/claude-chk-sdlc) beschrieben. Was für dieses Projekt gilt (Testbefehle, QA-Kriterien, Review-Schwerpunkte), steht in [.claude/feature-profile.md](.claude/feature-profile.md). Du kannst einzelne Agenten auch direkt nutzen, z. B. „Lass den Agenten `chk-sdlc:qa` meine Änderungen prüfen“.

## Sprache

- **Englisch:** Kommentare im Quellcode (auch JSDoc, YAML, CSS, HTML) sowie Namen von Klassen, Typen, Funktionen/Methoden, Variablen und Dateien. Fachbegriffe in Kommentaren bekommen beim ersten Vorkommen den deutschen Begriff in Klammern, z. B. `special repayment (Sondertilgung)`, `early repayment charge (Vorfälligkeitsentschädigung)`, `SPF (JAZ)`.
- **Deutsch:** alle für Nutzer sichtbaren Texte (Oberfläche, Meldungen, Benutzerhandbuch, Changelog) und die Beschreibung in Commit-Nachrichten bzw. PR-Titeln, weil sie unverändert im Changelog erscheint.

## Commit-Nachrichten (Conventional Commits)

Format nach [Conventional Commits 1.0.0](https://www.conventionalcommits.org/de/v1.0.0/), Version nach [Semantic Versioning 2.0.0](https://semver.org/lang/de/):

```
<typ>[(bereich)][!]: <beschreibung>

[optionaler Text]

[optionale Fußzeilen, z. B. BREAKING CHANGE: …]
```

| Typ | Wann | Version | Rubrik im Changelog |
|---|---|---|
| `feat` | neue Funktion oder Eingabe, bewusst geändertes Rechenmodell oder Standardwerte | MINOR (1.**x**.0) | Neu |
| `fix` | Fehlerkorrektur, korrigierte Texte oder Darstellung | PATCH (1.0.**x**) | Fehlerkorrekturen |
| `perf` | spürbare Verbesserung ohne neue Funktion (z. B. schneller) | PATCH | Verbessert |
| `!` nach Typ/Bereich oder Fußzeile `BREAKING CHANGE:` | inkompatibel: ältere Export-Dateien oder geteilte Links werden nicht mehr übernommen | MAJOR (**x**.0.0) | Inkompatible Änderungen |
| `docs`, `test`, `refactor`, `style`, `build`, `ci`, `chore`, `revert` | für Nutzer nicht sichtbar | keine | – |

Die **Beschreibung** erscheint unverändert im Changelog: auf Deutsch, aus Sicht der Nutzer, ohne Punkt am Ende.

Beispiele:

```
feat: Begründung des günstigsten Umrüstzeitpunkts
fix(export): Dateiname ohne Sonderzeichen
perf: Zeitpunktvergleich rechnet doppelt so schnell
feat!: neues Exportformat mit Szenario-Liste

BREAKING CHANGE: Export-Dateien vor Version 2.0 können nicht mehr geladen werden
docs: Benutzerhandbuch zum Tarifvergleich ergänzt
chore(deps): bump vite from 6.4.6 to 6.4.7
```

Vorschau, was der nächste Release ergäbe: `npm run release:preview`. Einen Titel prüfen: `node scripts/release.ts --lint "feat: …"`.

## Annahmen aktuell halten

Jedes Quartal legt der Workflow „Annahmen prüfen“ ein Issue mit einer Checkliste aller Standardwerte an, die sich ändern können (Förderregeln, Gesetze, Preise) – mit Links zu den Quellen. Hilf gern beim Abhaken: Quelle öffnen, Wert vergleichen, Abweichungen im Issue notieren oder direkt per Pull Request korrigieren (`src/core/defaults.ts` und `src/core/sources.ts`, danach `FUNDING_SOURCE_DATE` auf das Prüfdatum setzen). Mit eigenem Claude-API-Schlüssel kannst du die Quellen vorab automatisch abgleichen lassen: [docs/ANNAHMEN-PRUEFEN.md](docs/ANNAHMEN-PRUEFEN.md).

## Abhängigkeiten

Dependabot öffnet wöchentlich PRs (`chore(deps): …`, `ci(deps): …`); Patch-/Minor-Updates werden nach grünen Tests automatisch gemergt und erzeugen keine neue Version. Soll ein Update im Changelog erscheinen (z. B. sichtbare Korrektur in Chart.js), den PR-Titel vor dem Merge auf `fix(deps): …` ändern.
