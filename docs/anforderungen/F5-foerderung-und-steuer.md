# F5 – Förderung und Steuer

- F5.1 **KfW 458** (Zuschuss, Antragsmonat maßgeblich; Eingabe und automatischer Monat nach F1.4–F1.6):
  - Grundförderung 30 %; ab Anträgen im 1. Quartal 2027 (angenommen ab 01/2027) für Wärmepumpen 15 % plus Wertschöpfungs-Bonus 15 % bei EU-Ursprung (Richtlinie Nr. 8.4.1 c, 8.4.6). Eingabe „Wärmepumpe mit Ursprung in der EU“ (Default: ja).
  - Klimageschwindigkeitsbonus (nur selbstgenutzt, Ersatz einer funktionstüchtigen Öl-Heizung oder einer Gasheizung ≥ 20 Jahre): 16 %, ab 02/2027 halbjährlich (Feb/Aug) −4 Prozentpunkte, ab Anträgen 08/2028 entfallen.
  - Einkommensbonus (nur selbstgenutzt, zu versteuerndes Haushaltseinkommen, eingegeben als Einkommensbereich nach F5.4): ≤ 30.000 € → 40 %, ≤ 40.000 € → 30 %, ≤ 50.000 € → 10 %; mit kindergeldberechtigtem Kind < 18 Grenzen +10.000 €. Gerechnet wird mit dem Rechenwert (Obergrenze) des gewählten Bereichs.
  - Höchstfördersatz 70 %; 80 % bei zvE bis 30.000 € bzw. 40.000 € mit Familienzuschlag (Richtlinie Nr. 8.4.1).
  - Förderfähige Kosten: 1. Wohneinheit 28.000 € (ab 02/2027 halbjährlich −750 €, Untergrenze 22.000 € ab 08/2030, Richtlinie Nr. 8.3.1 a), 2.–6. WE je 15.000 €, ab 7. WE je 8.000 €. Boni gelten nur für den Kostenanteil der selbstgenutzten WE (Kosten gleichmäßig auf WE verteilt).
  - Auszahlung `n` Monate nach Installation (Default 3). Liegt die Auszahlung nach dem Betrachtungszeitraum, wird der Zuschuss als Forderung im letzten Monat eingerechnet (wie die Ablösung einer Restschuld), mit Warnung.
  - Effizienzbonus existiert nicht mehr (nicht modelliert).
  *(Test: funding)*
- F5.2 **§ 35c EStG**: 20 % der Kosten (max. 200.000 € Kosten, max. 40.000 € Steuerermäßigung), verteilt 7 % / 7 % / 6 % auf Abschlussjahr und zwei Folgejahre; Erstattung jeweils im Folgejahr (Monat wählbar, Default Juni). Nur selbstgenutzt, Gebäude ≥ 10 Jahre, Abschluss bis 31.12.2029 (editierbar). Optional begrenzt durch die jährliche Einkommensteuerschuld (keine Erstattung darüber hinaus, kein Vor-/Rücktrag). *(Test: tax)*
- F5.3 KfW-Zuschuss und Steuerbonus werden **nicht** kombiniert; beide Wege werden als eigenständige Szenarien gerechnet (E4). *(Test: simulation)*
- F5.4 Zu versteuerndes Haushaltseinkommen als Auswahl von sechs Einkommensbereichen (Feld `building.incomeRange`, Code; Zuordnung und Rechenwerte in `src/core/income-range.ts`). Die Zahleneingabe entfällt. Jeder Bereich hat einen festen Code, eine Bezeichnung im Wortlaut der Richtlinie (Nr. 8.4.5, z. B. „Über 30 000 Euro bis 40 000 Euro“) und einen Rechenwert, die Obergrenze des Bereichs; für „über 90.000 €“ gilt 100.000 €. Grenzen sind einschließlich, Durchschnitte mit 50 Cent sind abgedeckt (z. B. 30.000,50 € → „über 30.000 bis 40.000 €“). Die Bereiche:
  - `0-30000`, „bis 30.000 €“, Rechenwert 30.000 €
  - `30001-40000`, „über 30.000 bis 40.000 €“, Rechenwert 40.000 €
  - `40001-50000`, „über 40.000 bis 50.000 €“, Rechenwert 50.000 €
  - `50001-60000`, „über 50.000 bis 60.000 €“, Rechenwert 60.000 €
  - `60001-90000`, „über 60.000 bis 90.000 €“, Rechenwert 90.000 €
  - `90001+`, „über 90.000 €“, Rechenwert 100.000 €
  Standard ist `50001-60000` (bisheriger Standard 60.000 €, Ergebnisse unverändert). Mit den Standard-Förderparametern liegt jeder Bereich vollständig in einer Stufe des Einkommensbonus (mit und ohne Kind) und in einer Kreditvariante (358 bis einschließlich 90.000 €, darüber 359, ohne Familienzuschlag); der Rechenwert ergibt deshalb dasselbe Ergebnis wie das genaue Einkommen. Ein Test stellt sicher, dass `incomeLimit1–3`, `incomeLimit1–3 + incomeChildShift` und `loan358IncomeLimit` auf einer Bereichsgrenze liegen; eine spätere Änderung der Grenzen (F22) lässt den Test fehlschlagen. Ändert jemand im Expertenbereich die Einkommensgrenzen, rechnet der Rechner mit dem Rechenwert (Obergrenze) des gewählten Bereichs. Das ist eine bewusste Vereinfachung, das Handbuch nennt sie. *(Test: income-range, income-range-migration, income-range-ui)*
