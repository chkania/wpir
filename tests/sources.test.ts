import { describe, expect, it } from 'vitest';
import { DEFAULT_SOURCES, OFFICIAL_REFS, SOURCE_KIND_LABEL } from '../src/core/sources';
import { SECTIONS } from '../src/ui/fields';

// Free-text fields (scenario name, notes) have no default value with an origin
const paths = SECTIONS.flatMap((s) => s.fields.filter((f) => !f.noSource).map((f) => f.path));

describe('F11 Herkunft der Standardwerte', () => {
  it('jedes Eingabefeld hat eine Herkunftsangabe', () => {
    expect(paths.filter((p) => !DEFAULT_SOURCES[p])).toEqual([]);
  });

  it('keine verwaisten Einträge', () => {
    expect(Object.keys(DEFAULT_SOURCES).filter((p) => !paths.includes(p))).toEqual([]);
  });

  it('offizielle Quellen haben Link und Stand; Texte sind nicht leer', () => {
    for (const [path, s] of Object.entries(DEFAULT_SOURCES)) {
      expect(SOURCE_KIND_LABEL[s.kind], path).toBeDefined();
      expect(s.text.length, path).toBeGreaterThan(10);
      if (s.kind === 'quelle' || s.kind === 'markt') {
        expect(s.url, path).toMatch(/^https:\/\//);
        expect(s.asOf, path).toBeTruthy();
      }
    }
  });

  it('F11.4 offizielle Fundstellen: nur für bekannte Felder, mit https-Link', () => {
    for (const [path, refs] of Object.entries(OFFICIAL_REFS)) {
      expect(DEFAULT_SOURCES[path], path).toBeDefined();
      for (const r of refs) expect(r.url, path).toMatch(/^https:\/\//);
    }
    // every KfW funding rule refers to the guideline (Richtlinie) or fact sheet (Merkblatt)
    for (const p of paths.filter((x) => x.startsWith('funding.'))) {
      expect(OFFICIAL_REFS[p]?.some((r) => /Richtlinie|Merkblatt/.test(r.label)), p).toBe(true);
    }
    expect(OFFICIAL_REFS['building.hasChild'].map((r) => r.label).join()).toMatch(/Nr\. 8\.4\.5/);
  });

  it('Schätzungen und Annahmen sind als solche gekennzeichnet', () => {
    expect(DEFAULT_SOURCES['oldHeating.replacementCost'].text).toMatch(/Keine amtliche Kostenerhebung/);
    expect(DEFAULT_SOURCES['heatPump.investment'].kind).toBe('schaetzung');
    expect(DEFAULT_SOURCES['financing.followUpRate'].kind).toBe('annahme');
  });
});

describe('F1.5 Antragsmonat Herkunft (AK11)', () => {
  it('AK11 heatPump.applicationMonth hat eine Herkunftsangabe; heatPump.leadMonths ist entfernt', () => {
    expect(DEFAULT_SOURCES['heatPump.applicationMonth']).toBeDefined();
    expect(DEFAULT_SOURCES['heatPump.applicationMonth'].text).toContain('4 Monate');
    expect(OFFICIAL_REFS['heatPump.applicationMonth']).toBeDefined();
    expect(DEFAULT_SOURCES['heatPump.leadMonths']).toBeUndefined();
    expect(OFFICIAL_REFS['heatPump.leadMonths']).toBeUndefined();
    expect(paths).toContain('heatPump.applicationMonth');
    expect(paths).not.toContain('heatPump.leadMonths');
  });
});
