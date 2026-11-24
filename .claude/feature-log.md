# Laufbuch der Agentenkette `/feature`

Je Lauf ein Abschnitt, neueste unten. Der Skill `feature` hängt ihn nach Schritt 7 an; `/feature-retro` wertet das Laufbuch aus. Tokens und Dauer aus den Abschluss-Meldungen der Agenten (Summe aller Durchgänge), gerundet.

Felder:
- **Stufen:** je Stufe Modell, Durchgänge, Tokens, Dauer.
- **Spät gefunden:** Befunde, die erst in einer späteren Stufe auffielen – mit der Stufe, die sie hätte verhindern können.
- **Nutzer:** Rückfragen und Eingriffe.
- **Notiz:** Besonderheiten des Laufs (z. B. Prozessänderungen danach).

## 2026-11-19 – F37 Gespeicherte Szenarien (PR #62)

- Stufen:
  - Anforderung (Haiku): 2 Durchgänge, 105 k, 3 min
  - Anforderungs-Review (Opus): 2 Durchgänge, 90 k, 5 min
  - Umsetzung (Haiku): 4 Runden, 385 k, 18 min
  - Code-Review (Opus): 2 Durchgänge (beide OK, nur geringe Befunde), 100 k, 4 min
  - QA (Opus): 2 Durchgänge (1. Mängel), 95 k, 8 min
- Spät gefunden:
  - Code-Review: Lesefehler des Speichers konnte beim Speichern alle Einträge ersetzen → Umsetzung.
  - Code-Review: Invariante „lesbar ⇒ Import wirft nicht“ ohne Test → Umsetzung.
  - QA: 13 Zeilen / 11 Verzweigungen in `app.ts` ohne Test, A14-Teil ohne Test → Umsetzung.
  - QA: Bundle +5,2 % ohne Begründung → Umsetzung.
  - Anforderungs-Review: 15 Befunde (u. a. Warnfenster vor Abrufen, F22.4, Datenschutz, Grenzfälle) → Anforderung.
- Nutzer: 6 Rückfragen (Anforderung), 2 (Review), 1 Push-Entscheidung.
- Notiz: Lauf vor der Verschlankung. Danach: gezielte Tests, Review nur am Diff/Delta, QA mit einem Coverage-Lauf und Basis-Messung, Sonnet für Code-Review und QA, geringe Befunde gebündelt, Berichte ≤ 30 Zeilen.

## 2026-11-19 – F38 Werkzeugleiste mit Menüs

- Stufen:
  - Anforderung (Haiku): 2 Durchgänge, 105 k, 3 min
  - Anforderungs-Review (Opus): 1 Durchgang (2 Runden), 84 k, 4 min
  - Umsetzung (Haiku): 3 Runden, 350 k, 13 min
  - Code-Review (Sonnet): 2 Durchgänge (1. Änderungen), 60 k, 2 min
  - QA (Sonnet): 1 Durchgang (Freigabe, mit Browserprüfung), 40 k, 2 min
- Spät gefunden:
  - Code-Review: neue CSS-Regel wirkte auf die Doku-Seiten (Leiste in eigener Zeile) → Umsetzung (Abgrenzung stand in der Anforderung).
  - Code-Review: `box-shadow` am Menüpanel trotz „ohne Schatten“ → Umsetzung.
  - Code-Review: Fokusrückgabe-Tests (Warnfenster, Export, Dateiauswahl-cancel) fehlten → Umsetzung.
  - Anforderungs-Review: 10 Befunde (zwei Dialogtexte mit altem Ort, Fokus bei abgeschaltetem Hinweis, CSS-Selektoren, Layout „darunter“) → Anforderung.
- Nutzer: 2 Rückfragen (Anforderung), 0 im Review.
- Notiz: erster Lauf nach der Verschlankung. Weniger Durchgänge und Tokens als F37 (Umsetzung 350 k statt 385 k, QA 40 k statt 95 k, Code-Review 60 k statt 100 k); die QA-Mängel aus F37 (Testlücken, Bundle-Begründung) traten nicht mehr auf.

## 2026-11-20 – F39 Weg zum Angebot und zur Förderung

- Stufen:
  - Anforderung (Haiku): 2 Durchgänge, 132 k, 5 min
  - Anforderungs-Review (Opus): 1 Durchgang (2 Runden), 128 k, 6 min
  - Umsetzung (Haiku): 3 Runden, 318 k, 11 min (Tests/Build durch Bash-Sperre nur teilweise selbst ausgeführt, Hauptsitzung übernahm)
  - Code-Review (Sonnet): 3 Durchgänge (1. und 2. Änderungen), ≈ 170 k, 3 min
  - QA (Sonnet): 1 Durchgang (Freigabe, mit Browser: 400 px, Druck, ohne JS), ≈ 60 k, 6 min
- Spät gefunden:
  - Anforderungs-Review: Reihenfolge der Förderschritte stimmte nicht mit dem Merkblatt (BzA → Vertrag → Antrag) → Anforderung (Merkblatt nicht gelesen, A16 als Lücke offen gelassen).
  - Anforderungs-Review: Dokumentseiten druckten leer (Druckregel) → Anforderung.
  - Code-Review: dieselbe Förderreihenfolge in ANGEBOT.md erneut falsch, kein Reihenfolge-Test → Umsetzung.
  - Code-Review: Leerzeichen im Seitenfuß, Aussage zum Link-Inhalt ohne Fundstelle → Umsetzung.
  - Code-Review: Druckfix im Dunkelmodus erzeugte neuen hohen Fehler (geerbte Textfarbe) → Umsetzung; nur im echten Browser nachprüfbar.
- Nutzer: 4 Rückfragen (Anforderung), 2 Zwischenfreigaben, 0 im Review.
- Notiz: Neue Freigaben (Kurzfassung, geprüfte Anforderung) vor Umsetzung eingehalten. Bash-Sperren behinderten den Implementierer; Muster zum Prüfen für die Retro: Haiku-Umsetzer ohne eigenen Testlauf.

## 2026-11-20 – Haushaltseinkommen als Auswahl von Einkommensbereichen (F5.4)

- Stufen:
  - Anforderung (Haiku): 2 Durchgänge, 121 k, 12 min
  - Anforderungs-Review (Opus): 1 Durchgang (2 Runden), 106 k, 5 min
  - Umsetzung (Haiku): 2 Runden, 261 k, 11 min
  - Code-Review (Sonnet): 1 Durchgang (OK), 50 k, 1 min
  - QA (Sonnet): 2 Durchgänge (1. Mangel: Test fehlte), 80 k, 6 min (mit Browser: Altdaten aus Speicher, Link, Datei)
- Spät gefunden:
  - Anforderungs-Review: Lücke in den Bereichen (Durchschnitt mit 50 Cent, „30.001–40.000“ ließ 30.000,50 € unzugeordnet) → Anforderung.
  - Anforderungs-Review: Handbuchzeile „Grenzen steigen um 10.000 €“ galt nach Quelle nur für den Einkommensbonus, nicht für KfW 358 → Anforderung (Familienzuschlag-Frage im Original geklärt).
  - Anforderungs-Review: Beispieldateien beispiele/*.json fehlten in den betroffenen Bereichen → Anforderung.
  - QA: Test zu „Expertengrenzen“ (F5.4) fehlte, obwohl in der Anforderung gefordert → Umsetzung.
- Nutzer: 3 Rückfragen (Anforderung), 2 Freigaben, 0 im Review.
- Notiz: Wie bei F39 führte die Hauptsitzung Tests/Build aus; der Umsetzer konnte sie diesmal selbst ausführen. Keine Snapshot-Änderung (Kernvorgabe).

## 2026-11-22 – Antragsmonat-Feld statt Vorlauf in Monaten (F1.4–F1.6)

- Stufen:
  - Anforderung (Haiku): 3 Durchgänge, ≈ 440 k, ≈ 6 min (erster Lauf nach Nutzer-Rückfragen zum Umfang)
  - Umsetzung (Haiku): 5 Läufe inkl. Bugfix, ≈ 1,4 M, Dauer nicht verlässlich (Wartezeiten)
  - Code-Review (Standard): 2 Durchgänge (1. OK, nur geringe Befunde; 2. Delta der Testkorrekturen OK), ≈ 75 k, ≈ 1 min
  - QA (Standard): 2 Durchgänge (1. Mängel: Testlücken AK6/AK8, 2. Freigabe), ≈ 108 k
- Spät gefunden:
  - QA: AK6-Test war tautologisch, AK8 (Szenarien/Varianten) ohne Test → Umsetzung.
  - Code-Review: JSDoc-Platzierung, Konstante für Vorlauf-Text → Umsetzung (gering).
  - Nach Freigabe: komplett geleertes Antragsfeld zeigte Eingabefehler (Chromium setzt bei Teil-Leeren badInput, beim vollständigen Leeren kein Ereignis) → Bugfix, Chromium-Messung vor Umsetzung.
  - Profil fehlte nach Branch-Wechsel (lag nur auf chore/sdlc-plugin) → Hauptsitzung stellte es wieder her.
- Nutzer: 4 Rückfragen zum Umfang und Verhalten (Abstand 4, Vergleich, Migration, Vorbelegung), 2 zu Rechenweg-Format und Leerfeld-Text, 1 Freigabe Anforderung, 1 Freigabe Bugfix; Branch-Basis über fetch-Auflösung.
- Notiz: Bash-Sperre durch rtk-Hook im Auto-Modus blockierte Tests und Commits, bis der Auto-Modus verlassen wurde. Tests und Build führte die Hauptsitzung nach Entsperrung selbst aus.

Retro 2026-11-20: 4 Läufe (F37, F38, F39, F5.4). Der Anforderungs-Review fand in 4 von 4 Läufen 3 bis 15 Befunde (Quellen und Bestandsfundorte nicht geprüft), und in 4 von 4 Läufen fehlte ein von der Anforderung verlangter Test. Übernommen: V1 Fundort-Suche und Quellenprüfung im Autor, V2 Abgleich Anforderung gegen Tests und Abgrenzung im Implementer, V3 nur eine Prüfrunde im Autor. Messen bei den nächsten zwei Läufen: Tokens des Autors und Zahl der Review-Befunde; zeigt sich mehr Review-Aufwand, V3 zurücknehmen. Nutzer-Rückfragen lassen sich aus dem Laufbuch nicht als Standardannahmen ableiten (nur Anzahl, kein Inhalt) – künftig den Inhalt der Rückfragen im Laufbuch festhalten.

## 2026-11-24 – N10 Automatisierte Browser nicht erfassen (Matomo)

- Stufen:
  - Anforderung (requirements-author): 1 Durchgang, 76 k, 1 min
  - Anforderungs-Review (requirements-reviewer): 1 Durchgang (2 Runden intern), 58 k, 2 min
  - Umsetzung (implementer): 2 Durchgänge (Umsetzung, Befunde aus Review/QA), 154 k, 4 min
  - Code-Review (code-reviewer): 1 Durchgang (OK, nur geringe Befunde), 29 k, <1 min
  - QA (qa): 1 Durchgang (APPROVED), 31 k, 2 min
- Spät gefunden:
  - Anforderungs-Review: happy-dom liefert `navigator.webdriver === true`, zwei bestehende Tests wären rot geworden; Annahme im Entwurf falsch → Anforderung.
  - Anforderungs-Review: Matomo-Details (Teilstring-Abgleich, neuer Chrome-Headless ohne `HeadlessChrome`) nicht belegt → Anforderung.
  - Code-Review/QA: Testtiefe bei Stub ohne `navigator` (Skript nicht geprüft), Testname falsch zugeordnet → Umsetzung.
- Nutzer: Anforderung übernehmen (1), Anforderung freigeben (1), Agentenkette nach Neuladen fortsetzen (1).
- Notiz: Agenten waren nach Ausführung der Kette nicht mehr verfügbar; nach `/reload-plugins` wieder da. Profil lag bereits auf origin/main (#77); eigenes Entwurfsprofil nicht übernommen. Reviewer hat keine Datei schreiben können; Freigabe-Fassung von mir gespeichert.
