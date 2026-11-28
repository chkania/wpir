# F27 – Einflussgrößen (Sensitivitätsanalyse)

- F27.1 `src/core/sensitivity.ts`: Je Annahme eine Variante niedriger und eine höher, alle anderen unverändert; Ergebnis ist die Ersparnis mit Wärmepumpe (Referenz minus bester Weg, je Variante neu bestimmt). Annahmen und Variation: Gas- bzw. Heizölpreis heute ±20 %, Steigerung Gas- bzw. Heizölpreis ±2 Prozentpunkte (Beschriftung je nach Energieträger), Strompreis heute (WP- und Haushaltstarif) ±20 %, Steigerung Strompreis ±2 Prozentpunkte, JAZ ±0,5 (mindestens 1), Investition ±20 %, CO₂-Preispfad ±30 %, Kreditzinsen (KfW 358/359, Bank, Anschlusszins) ±1 Prozentpunkt (nur wenn im Basisfall ein Kredit läuft), Opportunitätszins ±1 Prozentpunkt (nicht unter 0). Sortiert nach Spanne, größte zuerst. *(Test: sensitivity)*
- F27.2 (geändert) Der Diagramm-Reiter „Einflussgrößen“ entfällt: keine Tornado-Grafik, kein Satz „Am stärksten wirkt …“, keine Tabelle in `chartTables()`. Die Diagrammleiste hat fünf Reiter. Ersetzt durch die Karte F27.3–F27.14. *(Test: sensitivity-card)*
- F27.3 Eigener Abschnitt (Karte) „Einflussgrößen“ auf der Ergebnisseite, direkt nach dem Diagrammbereich und vor „Details“ (`#details`). Bis zu sieben Schieberegler in fester Reihenfolge, beschriftet wie die Formularfelder:
  1. Steigerung Gaspreis (ohne CO₂) bzw. Steigerung Ölpreis (ohne CO₂), je nach Brennstoff (`prices.gasIncrease` / `prices.oilIncrease`)
  2. Steigerung Strompreis (`heatPump.elecIncrease`)
  3. Jahresarbeitszahl (JAZ) (`heatPump.jaz`)
  4. Investition gesamt (brutto) (`heatPump.investment`)
  5. CO₂-Preis (Faktor auf `prices.co2Path`; nur wenn der Pfad mindestens einen Stützpunkt hat)
  6. Kreditzinsen (KfW 358, KfW 359, Bank, Anschlusszins); nur wenn im Basisfall ein Kredit läuft (`run.kfw.loans.length + run.tax.loans.length > 0`, wie F27.1)
  7. Opportunitätszins (`general.opportunityRate`)
  „Gas-/Ölpreis heute“ und „Strompreis heute“ sind keine Regler. *(Test: sensitivity-slider, sensitivity-card)*
- F27.4 Mechanik: Die Voreinstellung jedes Reglers ist der Wert der Eingabe im Formular. Die Regler wirken nur auf den Ergebnisblock der Einflussgrößen (F27.8). Sie verändern weder die Eingabe im Formular noch `inputs`. *(Test: sensitivity-card)*
- F27.5 Spannen, ausgehend vom Wert der Eingabe (Basis B):
  - Steigerungen (Gas/Öl, Strom): B − 20 bis B + 20 Prozentpunkte. Untere Grenze 0 %; liegt B schon unter 0 %, ist B die untere Grenze. Beispiel: B = 2 % ergibt 0 % bis 22 %.
  - CO₂-Preis: Faktor 70 % bis 130 % auf den ganzen Preispfad. Alle Stützpunkte werden mit demselben Faktor skaliert, gerundet wie F27.1 auf 0,01 €/t. Angezeigt wird der letzte Stützpunkt (Standard 2045), wie in F27.1 und im KI-Export; dadurch sind Kopfbereich und Abschnitt identisch, solange kein Regler verschoben ist. Standardpfad: 2045: 220 €/t ergibt 154 bis 286 €/t; der Stützpunkt 2030 geht von 110 auf 77 bis 143 €/t.
  - Investition: B × 0,8 bis B × 1,2. Bei B = 0 ist der Regler deaktiviert und zeigt „keine Spanne“.
  - JAZ: B − 2 bis B + 2. Untere Grenze 1,0; liegt B darunter (nur aus Link oder Datei möglich), ist B die untere Grenze.
  - Kreditzinsen: Der Regler zeigt die Änderung −5 bis +5 Prozentpunkte (Voreinstellung 0). KfW 358, KfW 359, Bank und Anschlusszins ändern sich um dieselbe Differenz. Jeder Zins für sich fällt nicht unter 0 %; liegt er schon darunter, nicht unter seinen Eingabewert.
  - Opportunitätszins: B − 5 bis B + 5 Prozentpunkte. Untere Grenze 0 %; liegt B darunter, ist B die untere Grenze.
  - Obergrenze überall höchstens die Grenze aus `NUMBER_LIMITS` (`validate.ts`), z. B. 100 % bei Steigerungen und Zinsen, 10 bei der JAZ.
  Die Voreinstellung liegt wegen der Untergrenzen nicht immer in der Mitte. *(Test: sensitivity-slider)*
- F27.6 Schrittweiten: Steigerungen und Zinsen 0,1 Prozentpunkte; JAZ 0,1; Investition 100 €; CO₂-Faktor 5 Prozentpunkte (70 %, 75 % … 130 %). Die Positionen sind B + k × Schrittweite (k ganzzahlig) innerhalb der Spanne. So ist die Voreinstellung immer genau erreichbar, z. B. B = 2,05 % ergibt 0,05 % bis 22,05 %, Investition 27.345 € ergibt 21.945 € bis 32.745 €. *(Test: sensitivity-slider)*
- F27.7 Jeder Regler hat einen sichtbaren Hinweis zu seiner Bedeutung. Er nennt den Wert der Eingabe (z. B. „Ihre Eingabe: 3,0 % p. a.“, nicht „links“, weil das Formular auf schmalen Bildschirmen über den Ergebnissen steht) und die Spanne samt Art (Prozentpunkte, relativ, absolut). Bei den Steigerungen steht zusätzlich: „durchschnittliche jährliche Steigerung im Betrachtungszeitraum“. *(Test: sensitivity-card)*
- F27.8 Unter den Reglern steht ein gemeinsamer Ergebnisblock als Tabelle mit zwei Spalten: „Vorgabe“ (Ergebnis der Eingabe im Formular, also das letzte `runAll` der App) und „bei Einstellung“.
  - Die Spalte „bei Einstellung“ gilt für die Kombination aller aktuell verschobenen Regler; mehrere Regler können gleichzeitig verschoben sein.
  - Die Beschriftung nennt die verschobenen Regler mit ihren Einstellungen in der festen Reihenfolge, z. B. „Steigerung Strompreis 5,0 % p. a., JAZ 3,0“. Steht kein Regler abseits der Voreinstellung, lautet sie „keine Änderung“.
  - Zeilen und Texte wie im Kopfbereich (`renderKpis`):
    - Ohne Wärmepumpe
    - WP + KfW-Zuschuss
    - WP + Steuerbonus, bzw. „nicht möglich“
    - Ersparnis mit WP; bei negativem Wert steht in der Zelle „Mehrkosten mit WP“ und der Betrag
    - Amortisation: Monat und Dauer nach Inbetriebnahme, bzw. „nicht im Zeitraum“
    - CO₂-Einsparung; bei negativem Wert steht in der Zelle „CO₂-Mehrausstoß“ und der Betrag
  - Die Kennzahlen kommen aus einer gemeinsamen reinen Funktion, die auch der Kopfbereich nutzt.
  - Kein `aria-live`, damit nicht jeder Schritt angesagt wird.
  - Unter der Tabelle steht ein fester Hinweis: Die Amortisation liegt oft beim Kesseltausch im Referenzfall und bewegt sich mit den Reglern nur, wenn sich die Mehrkosten der Wärmepumpe bis dahin ändern. Die Amortisation wird nicht neu definiert (F8).
  *(Test: sensitivity-slider, sensitivity-card)*
- F27.9 Die Kennzahlen im Kopfbereich ändern sich durch die Regler nicht; nur Eingaben im Formular ändern sie. *(Test: sensitivity-card)*
- F27.10 Reglerstellungen werden nicht gespeichert: nicht in localStorage, nicht im Link `#z=`/`#s=`, nicht im JSON-Export, nicht im Bericht, nicht im KI-Export. Matomo erhält keine Reglerereignisse und keine Reglerwerte (N10). *(Test: sensitivity-card)*
- F27.11 Bei jeder Neuberechnung der App werden die Regler neu aufgebaut: alle stehen auf dem neuen Eingabewert, der Ergebnisblock zeigt „keine Änderung“. Das gilt bei Eingabe im Formular, Import, Link, Laden eines Szenarios, Zurücksetzen und neuen Standardwerten. Der Kredit-Regler erscheint oder entfällt je nach Basisfall. Die Schaltfläche „Auf heutige Werte zurücksetzen“ stellt alle Regler auf die Voreinstellung; dabei wird nicht neu gerechnet, die Spalte „bei Einstellung“ übernimmt das Ergebnis „Vorgabe“. *(Test: sensitivity-card)*
- F27.12 Je neuem Reglerwert höchstens ein `runAll` für die Kombination. Grundlage ist eine Kopie der Eingaben (`structuredClone`), die alle verschobenen Regler enthält. Keine Zusatzberechnungen für Sortierung oder Vergleich; die Spalte „Vorgabe“ nutzt das letzte Ergebnis der App. Wirft `runAll` einen Fehler, zeigt die Spalte „bei Einstellung“ in jeder Zeile „–“, und die Meldung steht als Text unter der Tabelle; Kopfbereich und Eingaben bleiben unverändert. *(Test: sensitivity-slider, sensitivity-card)*
- F27.13 Bedienung (N7):
  - native `input type="range"` mit sichtbarem `<label>`: Größe, Ihre Eingabe, eingestellter Wert als Text
  - Tastatur: Pfeiltasten ändern um eine Schrittweite, Pos1/Ende springen auf die Grenzen
  - `aria-valuetext` mit Einheit, z. B. „5,0 % p. a.“, „154 €/t (2045)“, „+1,0 Prozentpunkte“
  - sichtbarer Fokus (kein `outline: none`)
  - Farben nur über Tokens: Text mindestens 4,5 : 1, Spur und Griff mindestens 3 : 1
  - Hell und Dunkel; bei 400 px Breite kein waagerechtes Scrollen
  *(Test: sensitivity-card, a11y)*
- F27.14 Der KI-Export (F35.2) behält den Abschnitt „Einflussgrößen (Sensitivität)“ unverändert. `sensitivity()` und seine Spannen bleiben unverändert (F27.1). `recalc` berechnet `sens` weiter für `lastResult()` und den KI-Export. *(Test: sensitivity, agent-export, sensitivity-card)*
