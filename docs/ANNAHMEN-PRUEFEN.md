# Annahmen automatisch vorprüfen

`npm run verify:assumptions` gleicht die zeitkritischen Standardwerte des Rechners mit ihren Quellen ab (F22.3). Das sind Förderregeln, Gesetze und Marktpreise. Es ergänzt die vierteljährliche Checkliste aus dem Issue „Annahmen prüfen“ (F22.1): Das Werkzeug liest die Quellen vorab und zeigt dir, wo du genauer hinschauen solltest.

Das Werkzeug **schreibt nur einen Bericht**. Werte änderst du weiterhin von Hand. Wie das geht, steht im Prüf-Issue und in [CONTRIBUTING.md](../CONTRIBUTING.md#annahmen-aktuell-halten).

## Alternative: Abgleich mit dem MCP-Server

Ohne API-Schlüssel: Förder- und Rechtswerte lassen sich in Claude Code gegen die Wissensbasis des MCP-Servers `wpir-mcp` prüfen (F22.5, eigenes Repo [chkania/wpir-mcp](https://github.com/chkania/wpir-mcp)). `/annahmen-mcp` startet den Agenten `assumptions-checker`, der die Standardwerte mit `check_value` vergleicht und nur berichtet. `npm run check:mcp` prüft vorab, dass der Server erreichbar ist und seine Feldpfade zum Rechner passen. Der Server enthält Regeln mit Quelle und Prüfdatum, keine Marktpreise; die bleiben bei `verify:assumptions`.

### Wünsche an den MCP-Server

Der Server `wpir-mcp` liegt in einem eigenen Repo. Diese Punkte sind dort offen und müssen dort umgesetzt werden:

- **Neue Schlüssel mit Referenzwert:** `financing.kfwTermYears` (4–35 Jahre), `financing.kfwGraceYears` (1–5), `financing.kfwFixYears` (10 bei Laufzeit ab 6 Jahren).
- **Prüfbare Werte für Fakten ohne Feldpfad:** `prices.co2Path` (Korridor je Jahr) und `heatPump.para14aReduction` (Bereich als Min/Max), damit `check_value` sie vergleicht.
- **Neue Fakten:** UBA-Strommix (`prices.gridCo2Path`), BAFA-CO₂-Faktoren (`prices.gasCo2Factor`, `prices.oilCo2Factor`), Fraunhofer-JAZ (`heatPump.jaz`), Bewilligungsfrist KfW 458 (Annahme A10 zur Dreijahresregel F1.7).

Jeweils mit Quelle, soweit sie in `src/core/sources.ts` schon steht.

## Was geprüft wird

Das Werkzeug prüft dieselben Werte wie die Checkliste. Dazu gehört jedes Eingabefeld, dessen Standardwert in `src/core/sources.ts` als „Offizielle Quelle“, „Gesetz / Regelung“ oder „Marktdaten“ eingetragen ist und einen Link hat. Neue Felder mit Quelle kommen also automatisch dazu.

So läuft die Prüfung:

1. Werte mit derselben Quelle werden zusammengefasst. Pro Quelle gibt es einen Download und eine Anfrage an Claude (`claude-opus-5-5`).
2. HTML-Seiten werden als Text geschickt, PDFs als Dokument.
3. Claude bekommt für jeden Wert drei Angaben: den Standardwert, die Bezeichnung und den Herkunftstext aus `sources.ts`. Zu jedem Wert gibt es ein Urteil zurück, dazu den Wert aus der Quelle und eine **wörtliche Textstelle** als Beleg. Mögliche Urteile:
   - **bestätigt**: Die Quelle nennt denselben Wert.
   - **Abweichung**: Die Quelle nennt für diese Größe einen anderen Wert.
   - **unklar**: Die Quelle nennt die Größe nicht oder nicht eindeutig.
4. Bei HTML-Quellen prüft das Werkzeug, ob die Textstelle wirklich in der Seite steht. Fehlt sie dort, wird aus „bestätigt“ oder „Abweichung“ ein „unklar“. So landet kein unbelegtes Urteil im Bericht. Bei PDFs ist dieser Abgleich nicht möglich.
5. Quellen, die nicht abrufbar oder zu groß sind, stehen gesondert im Bericht. Seiten werden nie stillschweigend gekürzt. Dasselbe gilt für fehlgeschlagene Anfragen an Claude.
6. Wiederholt sich ein Fehler bei jeder Quelle (Anmeldung, Berechtigung, zu wenig Guthaben im API-Konto), bricht der Lauf sofort ab. Dann wird kein Bericht geschrieben.

## Aufruf

Einmalig den API-Schlüssel hinterlegen:

```bash
cp .env.example .env.local
```

Dann in `.env.local` den Wert `ANTHROPIC_API_KEY` eintragen. Die Datei wird nicht versioniert. Alternativ meldest du dich einmal mit `ant auth login` an.

```bash
npm run verify:assumptions -- --list
```

Zeigt nur, welche Werte aus welchen Quellen geprüft würden. Das ruft die API nicht auf und kostet nichts.

```bash
npm run verify:assumptions
```

Prüft alle Werte und schreibt den Bericht nach `reports/annahmen-JJJJ-MM-TT.md`. Der Ordner wird nicht versioniert.

```bash
npm run verify:assumptions -- --only funding.
```

Prüft nur Werte, deren Pfad so beginnt, etwa `funding.` für die KfW-Förderung oder `tax.` für § 35c.

Weitere Optionen: `--out <datei>` für einen anderen Ort des Berichts.

**Kosten:** Ein vollständiger Lauf (rund 20 Quellen) kostet derzeit etwa 1 $ über die Claude-API. Mit `--only` wird es entsprechend weniger.

## Bericht auswerten

Der Bericht hat diese Abschnitte, in dieser Reihenfolge:

1. **Abweichungen**
2. **Unklar**
3. **Quelle nicht abrufbar**
4. **Prüfung fehlgeschlagen**
5. **Bestätigt**

Jede Zeile enthält den Wert im Rechner, den Wert laut Quelle, die Textstelle und einen Link zur Quelle.

- **Abweichung:** Quelle selbst öffnen und den Wert prüfen. Bei Marktpreisen ist nicht jede Schwankung ein Grund zur Änderung. Bestätigt sich die Abweichung, änderst du `defaults.ts` und `sources.ts` wie im Prüf-Issue beschrieben, samt Regressions-Snapshots und [Änderungsprotokoll](anforderungen/aenderungsprotokoll.md).
- **Unklar:** Diesen Wert wie bisher von Hand prüfen. Häufige Ursachen: Die Seite nennt den Wert nur in einem verlinkten Merkblatt, oder ein Teil der Seite wird erst per JavaScript nachgeladen.
- **Bestätigt:** Diesen Punkt kannst du in der Checkliste abhaken. Ein Blick auf die Textstelle reicht.

Das Werkzeug ersetzt nicht die eigene Prüfung. Es sagt dir, wo du anfangen solltest. `FUNDING_SOURCE_DATE` setzt du erst, wenn die Prüfung abgeschlossen ist.
