// @vitest-environment happy-dom
// @vitest-environment-options {"settings":{"handleDisabledFileLoadingAsSuccess":true}}
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { addCsp } from '../csp';
import { initAnalytics, isOptedOut, MATOMO_SITE_ID, MATOMO_URL, OPT_OUT_KEY, setOptOut } from '../src/analytics';

// happy-dom replaces import.meta.url, so resolve from the project root
const read = (f: string) => readFileSync(join(process.cwd(), f), 'utf8');
/** In-memory storage (the test environment has no usable localStorage). */
const memoryStorage = () => {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k) };
};
const commands = () => (window._paq ?? []).map((c) => c[0]);

describe('N10 Besucherstatistik (Matomo)', () => {
  afterEach(() => {
    delete window._paq;
    document.head.querySelectorAll('script[src*="matomo"]').forEach((s) => s.remove());
  });

  it('nur im Produktions-Build aktiv (nicht in Entwicklung und Tests)', () => {
    initAnalytics('Rechner', { storage: memoryStorage() });
    expect(window._paq).toBeUndefined();
    expect(document.querySelector('script[src*="matomo"]')).toBeNull();
  });

  it('N10.1 ohne Cookies, mit Do Not Track, ohne URL-Hash und mit festem Seitentitel', () => {
    location.hash = '#s=geheime-eingaben';
    document.title = 'Angebot Müller – Wärmepumpen-Investitionsrechner';
    initAnalytics('Rechner', { enabled: true, webdriver: false, storage: memoryStorage() });
    const q = window._paq!;
    expect(q).toContainEqual(['disableCookies']);
    expect(q).toContainEqual(['setDoNotTrack', true]);
    expect(q).toContainEqual(['discardHashTag', true]);
    expect(q).toContainEqual(['setDocumentTitle', 'Rechner']);
    expect(q).toContainEqual(['setSiteId', MATOMO_SITE_ID]);
    expect(q).toContainEqual(['setTrackerUrl', `${MATOMO_URL}matomo.php`]);
    // all privacy settings before the page view
    const c = commands();
    for (const cmd of ['disableCookies', 'setDoNotTrack', 'discardHashTag', 'setDocumentTitle', 'setExcludedQueryParams']) {
      expect(c.indexOf(cmd)).toBeLessThan(c.indexOf('trackPageView'));
    }
    expect(JSON.stringify(q)).not.toContain('geheime-eingaben');
    expect(JSON.stringify(q)).not.toContain('Müller');
    const excluded = q.find((x) => x[0] === 'setExcludedQueryParams')![1] as string[];
    expect(excluded).toEqual(expect.arrayContaining(['email', 'iban', 'password', 'token']));
    const script = document.querySelector<HTMLScriptElement>('script[src*="matomo"]')!;
    expect(script.src).toBe(`${MATOMO_URL}matomo.js`);
    expect(script.async).toBe(true);
  });

  it('N10 Widerspruch im Browser-Speicher verhindert die Erfassung (kein Cookie)', () => {
    const storage = memoryStorage();
    expect(isOptedOut(storage)).toBe(false);
    expect(setOptOut(true, storage)).toBe(true);
    expect(storage.getItem(OPT_OUT_KEY)).toBe('1');
    initAnalytics('Rechner', { enabled: true, webdriver: false, storage });
    expect(window._paq).toBeUndefined();
    expect(document.cookie).toBe('');
    setOptOut(false, storage);
    expect(isOptedOut(storage)).toBe(false);
    initAnalytics('Rechner', { enabled: true, webdriver: false, storage });
    expect(commands()).toContain('trackPageView');
  });

  it('nicht verfügbarer Browser-Speicher: kein Widerspruch speicherbar, keine Ausnahme', () => {
    const broken = { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('blocked'); }, removeItem: () => {} };
    expect(isOptedOut(broken)).toBe(false);
    expect(setOptOut(true, broken)).toBe(false);
    expect(setOptOut(true, null)).toBe(false);
  });

  it('alle Seiten melden sich mit festem Titel', () => {
    const pages: [string, string][] = [
      ['index.html', 'src/main.ts'],
      ['hilfe.html', 'src/help-main.ts'],
      ['lizenz.html', 'src/pages/lizenz-main.ts'],
      ['lizenzen-drittanbieter.html', 'src/pages/drittanbieter-main.ts'],
      ['changelog.html', 'src/pages/changelog-main.ts'],
      ['impressum.html', 'src/pages/impressum-main.ts'],
      ['angebot.html', 'src/pages/angebot-main.ts'],
      ['datenschutz.html', 'src/pages/datenschutz-main.ts'],
    ];
    for (const [html, entry] of pages) {
      // no tracking pixel without JavaScript: it could not respect the objection (opt-out)
      expect(read(html), html).not.toContain('matomo.php');
      expect(read(html), html).not.toMatch(/style="/);
      expect(read(entry), entry).toMatch(/initAnalytics\('[^']+'\);/);
    }
  });

  it('N10.1 WebDriver-Kennung true (explizit): keine Erfassung, kein Skript', () => {
    initAnalytics('Rechner', { enabled: true, webdriver: true, storage: memoryStorage() });
    expect(window._paq).toBeUndefined();
    expect(document.querySelector('script[src*="matomo"]')).toBeNull();
  });

  it('N10.1 ohne Option gilt der Browserwert: happy-dom meldet webdriver true, also keine Erfassung', () => {
    // guards the default: happy-dom reports navigator.webdriver === true
    expect(navigator.webdriver).toBe(true);
    initAnalytics('Rechner', { enabled: true, storage: memoryStorage() });
    expect(window._paq).toBeUndefined();
    expect(document.querySelector('script[src*="matomo"]')).toBeNull();
  });

  it('N10.1 webdriver false überschreibt den Browserwert true: Erfassung wie gewohnt', () => {
    initAnalytics('Rechner', { enabled: true, webdriver: false, storage: memoryStorage() });
    expect(commands()).toEqual(expect.arrayContaining(['disableCookies', 'setDoNotTrack', 'discardHashTag', 'setDocumentTitle', 'trackPageView', 'setSiteId', 'setTrackerUrl']));
    expect(document.querySelector('script[src*="matomo.js"]')).not.toBeNull();
    // the flag is only read in the browser, never sent to Matomo
    expect(JSON.stringify(window._paq)).not.toContain('webdriver');
  });

  it('N10.1 Browser ohne Kennung (navigator ohne webdriver): Erfassung läuft', () => {
    const stub = { navigator: {} } as unknown as Window;
    initAnalytics('Rechner', { enabled: true, win: stub, doc: document, storage: memoryStorage() });
    expect(stub._paq).toEqual(expect.arrayContaining([['trackPageView']]));
    expect(document.querySelector('script[src*="matomo.js"]')).not.toBeNull();
  });

  it('N10.1 Browser ohne navigator-Objekt: Erfassung läuft (kein Absturz)', () => {
    const stub = {} as unknown as Window;
    initAnalytics('Rechner', { enabled: true, win: stub, doc: document, storage: memoryStorage() });
    expect(stub._paq).toEqual(expect.arrayContaining([['trackPageView']]));
    expect(document.querySelector('script[src*="matomo"]')).not.toBeNull();
  });

  it('N10.1 Browserwert false (navigator.webdriver = false) ohne Option: Erfassung läuft', () => {
    const stub = { navigator: { webdriver: false } } as unknown as Window;
    initAnalytics('Rechner', { enabled: true, win: stub, doc: document, storage: memoryStorage() });
    expect(stub._paq).toEqual(expect.arrayContaining([['trackPageView']]));
  });

  it('N10.1 Datenschutzerklärung Abschnitt 4 nennt die WebDriver-Regel', () => {
    const text = read('docs/DATENSCHUTZ.md');
    const section = text.slice(text.indexOf('## 4. Plugins und Tools'), text.indexOf('## 5. Ihre Rechte'));
    expect(section).toContain('navigator.webdriver');
    expect(section).toContain('werden ebenfalls nicht erfasst');
  });

  it('N10.2 Betriebshinweis in der Anforderungsdatei: Ausschluss von HeadlessChrome in Matomo', () => {
    const text = read('docs/anforderungen/N10-besucherstatistik.md');
    expect(text).toContain('Ausgeschlossene User Agents');
    expect(text).toContain('HeadlessChrome');
    expect(text).toContain('N10.2');
  });

  it('CSP erlaubt nur zusätzlich die Matomo-Instanz', async () => {
    const out = await addCsp('<head><meta charset="UTF-8" /><script>x()</script></head>');
    const csp = /content="([^"]+)"/.exec(out)![1];
    expect(csp).toMatch(/script-src 'self' https:\/\/analytics\.chkania\.net 'sha256-/);
    expect(csp).toContain("img-src 'self' data: https://analytics.chkania.net");
    expect(csp).toContain("connect-src 'self' https://analytics.chkania.net");
    expect(csp).not.toContain('unsafe-inline');
  });
});
