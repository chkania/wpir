---
name: annahmen-mcp
description: Prüft die Förder- und Rechtswerte des Rechners gegen die Wissensbasis des MCP-Servers wpir-mcp und zeigt die Abweichungen.
disable-model-invocation: true
---

1. Prüfe mit `npm run check:mcp`, dass der Server erreichbar ist und der Vertrag stimmt. Schlägt das fehl, zeige dem Nutzer die Meldung und höre auf (der Server ist möglicherweise noch nicht bei Vercel bereitgestellt, die URL steht in `.mcp.json`).
2. Prüfe, ob die MCP-Werkzeuge in **dieser Sitzung** geladen sind (z. B. `mcp__wpir-mcp__list_keys` über ToolSearch suchen). Claude Code lädt Projekt-MCP-Server nur beim Sitzungsstart; fehlen die Werkzeuge, melde das dem Nutzer mit dem Hinweis: Claude Code neu starten, dem Projekt-Server `wpir-mcp` beim Start vertrauen, mit `/mcp` prüfen, dass er verbunden ist, und `/annahmen-mcp` wiederholen. Starte den Agenten dann nicht.
3. Starte den Agenten `assumptions-checker` ohne weitere Vorgaben.
4. Gib seinen Bericht unverändert wieder, einschließlich des Abschnitts „Von Hand verglichen“, falls vorhanden. Ändere keine Dateien; bei Abweichungen frage den Nutzer, ob du sie einzeln gegen die Quelle prüfen sollst (Seite öffnen), bevor etwas angepasst wird.
