# Changelog

Alle wesentlichen Änderungen am Wärmepumpen-Investitionsrechner. Das Format orientiert sich an
[Keep a Changelog](https://keepachangelog.com/de/1.1.0/), die Versionsnummern folgen
[Semantic Versioning](https://semver.org/lang/de/). Jede für Nutzer sichtbare Änderung bekommt sofort eine neue Version – es gibt keine gesammelten Releases. Ab Version 1.1.0 werden Version und Einträge automatisch aus den Commit-Nachrichten erzeugt (siehe `CONTRIBUTING.md`):

- **Major** (x.0.0): inkompatible Änderungen, z. B. am Format von Export-Dateien oder geteilten Links, die ältere Stände nicht mehr übernehmen können.
- **Minor** (1.x.0): neue Funktionen oder Eingaben sowie bewusst geänderte Rechenmodelle oder Standardwerte (Ergebnisse können sich ändern).
- **Patch** (1.0.x): Fehlerkorrekturen, Texte, Darstellung – ohne neue Funktionen.

## 1.33.0 – 2026-11-28

### Neu
- Einflussgrößen mit Schiebereglern statt Diagramm-Reiter (#80)

## 1.32.1 – 2026-11-24

### Fehlerkorrekturen
- Besucherstatistik zählt automatisierte Browser nicht mehr (#79)

## 1.32.0 – 2026-11-23

### Neu
- Einbaujahr der Heizung höchstens bis zum aktuellen Monat (#76)

## 1.31.0 – 2026-11-23

### Neu
- Gültiger Zeitraum für Inbetriebnahme und Heizung (#75)

## 1.30.0 – 2026-11-22

### Neu
- Förderantrag: Antragsmonat statt Vorlauf in Monaten (#72)

## 1.29.0 – 2026-11-20

### Neu
- Haushaltseinkommen als Auswahl von Einkommensbereichen statt Zahleneingabe (#70)

## 1.28.0 – 2026-11-20

### Neu
- Seite „Weg zum Angebot und zur Förderung“ mit Checklisten für Angebot, Förderantrag und Abnahme (#69)

## 1.27.0 – 2026-11-19

### Neu
- Werkzeugleiste mit Menüs – Hilfe prominent, Umschalter in der Kopfzeile

## 1.26.0 – 2026-11-19

### Neu
- Mehrere Szenarien im Browser speichern, abrufen, aktualisieren und löschen – auch für den Variantenvergleich

## 1.25.0 – 2026-11-19

### Neu
- Laufende Kosten des intelligenten Messsystems (Pflicht für die KfW-Förderung) (#60)

## 1.24.0 – 2026-11-18

### Neu
- Monatliche Belastung je Szenario im Vergleich zu heute
- Zuschuss und Steuererstattungen tilgen auch den Bankkredit
- Kostenfreies Sondertilgungsrecht pro Jahr für den Bankkredit
- KI-Export enthält die monatliche Belastung

### Fehlerkorrekturen
- Eigenkapital-Felder heißen „Weg mit KfW-Zuschuss“ und „Weg mit Steuerbonus“

## 1.23.0 – 2026-11-18

### Neu
- Export für KI-Assistenten als Markdown-Datei mit allen Eingaben, Standardwerten und Rechenweg

### Fehlerkorrekturen
- Potential fix for pull request finding 'CodeQL / Incomplete string escaping or encoding'

## 1.22.0 – 2026-11-18

### Neu
- Inbetriebnahme der Heizung als Monat – Klimageschwindigkeitsbonus monatsgenau geprüft (#57)

## 1.21.0 – 2026-11-18

### Neu
- Standardwerte aktualisiert und Hinweis „Neue Standardwerte“ für gespeicherte Eingaben und Dateien (#56)

## 1.20.1 – 2026-11-18

### Fehlerkorrekturen
- Hilfe erklärt den offenen Stichtag der neuen Grundförderung und den Vorlauf bei frühem Förderantrag (#55)

## 1.20.0 – 2026-11-18

### Neu
- Links zu Unterlagen im Szenario, mit Adresse und QR-Code im Bericht (#54)

## 1.19.8 – 2026-11-18

### Fehlerkorrekturen
- Modale Dialoge haben oben einen Schließen-Button statt des Fokus auf der Überschrift (#53)

## 1.19.7 – 2026-11-17

### Fehlerkorrekturen
- Rechenweg öffnet im selben Tab wie die übrigen eigenen Seiten (#52)

## 1.19.6 – 2026-11-17

### Fehlerkorrekturen
- Seite für Suchmaschinen verbessert: Schrift vorladen, lesbarere Einführung, Bildtitel, JSON-LD, Cache (#51)

## 1.19.5 – 2026-11-17

### Fehlerkorrekturen
- Beim Laden springt die Seite nicht mehr zwischen statischer Einführung und Rechner (#49)

## 1.19.4 – 2026-11-17

### Fehlerkorrekturen
- Fokusrahmen der Einführungsüberschrift nur bei Tastaturbedienung (#48)

## 1.19.3 – 2026-11-17

### Fehlerkorrekturen
- Dialoge öffnen auf dem Smartphone oben statt mit dem Button am Ende (#47)

## 1.19.2 – 2026-11-17

### Fehlerkorrekturen
- Deployment übernimmt .htaccess aus dem Build (#46)

## 1.19.1 – 2026-11-17

### Fehlerkorrekturen
- Prüfschritt im Deployment hatte ein fehlendes Anführungszeichen (#45)

## 1.19.0 – 2026-11-17

### Neu
- Einführung für Suchmaschinen nachgebessert, .htaccess wird mit dem Deployment übertragen (#44)

## 1.18.0 – 2026-11-17

### Neu
- Bessere Auffindbarkeit – Inhalt ohne JavaScript, vorgerenderte Hilfe- und Rechtsseiten, neuer Titel, Linkvorschau mit Bild

### Fehlerkorrekturen
- Testhilfe entfernt HTML-Tags ohne unvollständigen Regex (CodeQL-Hinweise)

## 1.17.0 – 2026-11-17

### Neu
- Rechenweg – eigene Seite mit allen Zwischenwerten und Erklärungen zu den Kennzahlen (#42)

## 1.16.0 – 2026-11-17

### Neu
- Text unter dem QR-Code im Bericht öffnet per Klick den Rechner mit den Eingaben (#41)

## 1.15.2 – 2026-11-15

### Fehlerkorrekturen
- Lange Texte im Variantenvergleich brechen um statt die Tabelle zu verbreitern (#40)

## 1.15.1 – 2026-11-15

### Fehlerkorrekturen
- Variantenvergleich zeigt unter „Aktuelle Eingaben“ den jetzigen Stand des Rechners, Heizölpreis bei Gasheizung ausgeblendet (#39)

## 1.15.0 – 2026-11-15

### Neu
- Absoluter Verbrauch für Warmwasser und Kochen, Hinweis zur JAZ bei geänderter Schätzung (#38)

## 1.14.0 – 2026-11-15

### Neu
- Hinweis auf persönliche Daten vor Teilen und Export, Warnung vor dem Überschreiben bei Import und Zurücksetzen
- Variantenübernahme fragt im eigenen Fenster statt per Browser-Rückfrage

## 1.13.1 – 2026-11-15

### Fehlerkorrekturen
- Links zum Quellcode zeigen auf github.com/chkania/wpir (#36)

## 1.13.0 – 2026-11-15

### Neu
- Unterstützen per Überweisung mit GiroCode (#35)

## 1.12.0 – 2026-11-15

### Neu
- Schaltfläche „Unterstützen“ mit Buy Me a Coffee und PayPal; Badges in der README (#34)

## 1.11.1 – 2026-11-15

### Fehlerkorrekturen
- Hilfe, Impressum, Datenschutz und Lizenzen öffnen im selben Tab (#33)

## 1.11.0 – 2026-11-15

### Neu
- Hinweis, wenn der Start der Betrachtung in der Zukunft liegt (#32)

## 1.10.8 – 2026-11-15

### Fehlerkorrekturen
- Quellenhinweis zur Untergrenze der förderfähigen Kosten verweist auf die Förderrichtlinie
- Potential fix for pull request finding 'CodeQL / Incomplete string escaping or encoding'

## 1.10.7 – 2026-11-15

### Fehlerkorrekturen
- Potential fix for code scanning alert no. 4: Incomplete multi-character sanitization
- Potential fix for pull request finding 'CodeQL / Incomplete multi-character sanitization'
- Inhaltsverzeichnis der Hilfe zeigt „&“ und Code in Überschriften wieder richtig

## 1.10.6 – 2026-11-15

### Fehlerkorrekturen
- Potential fix for code scanning alert no. 2: Cache Poisoning via execution of untrusted code (#28)

## 1.10.5 – 2026-11-15

### Fehlerkorrekturen
- Potential fix for code scanning alert no. 3: Incomplete multi-character sanitization (#26)

## 1.10.4 – 2026-11-15

### Fehlerkorrekturen
- Potential fix for code scanning alert no. 2: Cache Poisoning via execution of untrusted code (#27)

## 1.10.3 – 2026-11-15

### Fehlerkorrekturen
- Potential fix for code scanning alert no. 1: Cache Poisoning via execution of untrusted code
- Potential fix for code scanning alert no. 4: Incomplete multi-character sanitization
- Potential fix for pull request finding 'CodeQL / Incomplete multi-character sanitization'

## 1.10.2 – 2026-11-15

### Fehlerkorrekturen
- Update DATENSCHUTZ.md
- Update IMPRESSUM.md

## 1.10.1 – 2026-11-15

### Fehlerkorrekturen
- Externe Links und QR-Label werden maskiert, Berichtsdatum und Tarifhinweis korrigiert
- Expertenwerte für Förderung und Steuer werden begrenzt

## 1.10.0 – 2026-11-15

### Neu
- Link mit Werten und QR-Code im Bericht verwenden die kurze Adresse wpir.de (#21)

## 1.9.1 – 2026-11-15

### Fehlerkorrekturen
- Suchmaschinen finden die Hauptadresse (kanonische Adresse, robots.txt, Sitemap)

### Verbessert
- Rechner lädt schneller – Diagramme werden nachgeladen, Quellenhinweise entstehen erst beim Öffnen

## 1.9.0 – 2026-11-15

### Neu
- Name wieder „Wärmepumpen-Investitionsrechner“ (#16)

## 1.8.0 – 2026-11-15

### Neu
- Kasten „Über diesen Rechner“ mit der Entstehungsgeschichte, verlinkt aus Kopf und Einführung (#15)

## 1.7.0 – 2026-11-14

### Neu
- CO₂-Bilanz – eingesparte Tonnen CO₂ mit Strommix, Ökostromtarif und Bio-Anteil
- Jahresarbeitszahl aus Heizflächen, Wärmequelle und Wärmebedarf schätzen
- Einflussgrößen – welche Annahmen das Ergebnis am stärksten beeinflussen
- PV-Anlage im Monatsmodell mit Speicher und Haushaltsstrom statt festem PV-Anteil
- Diagramm „Energie je Monat“ – Bedarf gegenüber Gas, Öl und Strom
- Bericht zum Drucken bzw. als PDF für Energieberatung, Handwerksbetrieb oder Bank
- QR-Code im Bericht öffnet die Berechnung; kürzere Links mit Werten
- Varianten vergleichen – Kennzahlen, Kostenkurven und Unterschiede nebeneinander

### Fehlerkorrekturen
- Versionsnummer öffnet die Änderungen im selben Tab

## 1.6.0 – 2026-11-14

### Neu
- Neuer Name „Wärmepumpen-Umrüstungsrechner“, neues Logo, nur noch modernes Design und Abschnitte auf-/zuklappen (#13)

## 1.5.0 – 2026-11-14

### Neu
- Regelmäßige Prüfung der Annahmen (#12)

## 1.4.0 – 2026-11-14

### Neu
- Einführung für Erstbesucher und Weiterempfehlen per WhatsApp, Threema, E-Mail und Link (#11)

## 1.3.0 – 2026-11-14

### Neu
- Link zum GitHub-Repository und Einladung zur Mitarbeit (#8)

## 1.2.0 – 2026-11-14

### Neu
- Besucherstatistik mit Matomo, Impressum und Datenschutzerklärung (#7)

## 1.1.0 – 2026-11-14

### Neu
- „Wann umrüsten?“ erklärt, warum der günstigste Zeitpunkt am günstigsten ist: Vergleich mit dem vorherigen und nächsten Zeitpunkt nach Kostenarten, Hauptgrund und Ursachen (Heizwinter, Zuschuss, Steuerbonus, Ersatzkessel, steigende Investitionskosten, Restwert).

### Sonstiges
- Fünf Beispieldateien zum Import im Ordner `beispiele/` (Altbau mit Ölheizung, Gas-Brennwert mit PV und Steuerbonus, vermietetes Mehrfamilienhaus, Reihenhaus mit Sondertilgung und Gasherd, Stresstest mit teurem Strom); Übersicht in `beispiele/README.md`.

## 1.0.0 – 2026-11-12

Erste veröffentlichte Version.

### Rechnung
- Monatliche Simulation über einen wählbaren Zeitraum (Standard 20 Jahre) für drei Szenarien: ohne Wärmepumpe, Wärmepumpe mit KfW-Zuschuss, Wärmepumpe mit Steuerbonus (§ 35c EStG); Endwert mit Opportunitätszins.
- Energiepreise mit eigener Steigerung ab dem Startmonat, CO₂-Preispfad (BEHG/ETS2), Bio-Treppe für neue fossile Kessel; Gas oder Heizöl.
- Verbrauch aufgeteilt in Raumwärme, Warmwasser und Kochen; Kochen nach dem Umstieg mit Induktion (inkl. Kochfeld) oder weiter mit Gas.
- Ersatzkessel bei Ausfall der Altanlage, Ersatz-Wärmepumpe nach Ablauf der Lebensdauer, Restwerte am Ende.
- KfW-Heizungsförderung 458 nach Richtlinie vom 17.08.2026: Grundförderung, Wertschöpfungs-Bonus, Klimageschwindigkeitsbonus mit Degression, Einkommensbonus, Höchstbeträge.
- Finanzierung mit KfW-Ergänzungskredit 358/359 (abschaltbar) und Bankkredit, Zinsbindung und Anschlusszins; Zuschuss als Sondertilgung; Einmalzahlung (z. B. Lebensversicherung) als Sondertilgung mit eigenem Termin, Kreditbedingungen und Zinsersparnis.
- Stromkostenvergleich mit und ohne Wärmepumpentarif inkl. Zählerschrank-Umbau und § 14a EnWG je Zähler.
- Vergleich verschiedener Umrüstzeitpunkte.

### Oberfläche
- Kennzahlen, wichtige Ereignisse und Hinweise, Einordnung des Hauses (kWh/m², Effizienzklasse, Baualter, Sanierung, Heizlast), Diagramme mit Datentabellen, Jahresübersicht.
- Herkunft jedes Standardwerts mit offiziellen Fundstellen im Info-Popover.
- Szenario-Bezeichnung und Bemerkungen; Speichern im Browser, Link teilen, Export und Import.
- Zwei Designs (Modern, Klassisch) mit Hell/Dunkel/Auto; barrierearm nach WCAG 2.1 AA.
- Benutzerhandbuch, Lizenz und Lizenzen von Drittanbietern als eigene Seiten.

### Sicherheit
- Prüfung aller Werte aus Links, Dateien und Browser-Speicher; geteilte Links überschreiben eigene Eingaben nicht ohne Zustimmung; Content-Security-Policy im Build.

### Lizenz
- PolyForm Noncommercial License 1.0.0.
