/**
 * Origin of the default values (F11). For every input field it documents where the default comes from.
 * Important: label honestly – "Schätzung" (estimate) means: no specific survey, but a plausible
 * assumption with a typical range. Keep this file in sync when changing defaults.ts.
 */

export type SourceKind = 'quelle' | 'gesetz' | 'markt' | 'schaetzung' | 'beispiel' | 'technik' | 'annahme';

export interface DefaultSource {
  kind: SourceKind;
  text: string;
  url?: string;
  /** Retrieval date or status, if relevant. */
  asOf?: string;
}

export interface OfficialRef {
  /** Document and reference, e.g. "BEG-EM-Richtlinie Nr. 8.4.5". */
  label: string;
  url: string;
}

export const SOURCE_KIND_LABEL: Record<SourceKind, string> = {
  quelle: 'Offizielle Quelle',
  gesetz: 'Gesetz / Regelung',
  markt: 'Marktdaten (recherchiert)',
  schaetzung: 'Schätzung',
  beispiel: 'Beispielwert',
  technik: 'Technischer Richtwert',
  annahme: 'Modellannahme',
};

const KFW_458 =
  'https://www.kfw.de/inlandsfoerderung/Privatpersonen/Bestehende-Immobilie/F%C3%B6rderprodukte/Heizungsf%C3%B6rderung-f%C3%BCr-Privatpersonen-Wohngeb%C3%A4ude-(458)/';
const KFW_358 =
  'https://www.kfw.de/inlandsfoerderung/Privatpersonen/Bestehende-Immobilie/F%C3%B6rderprodukte/Einzelma%C3%9Fnahmen-Erg%C3%A4nzungskredit-Wohngeb%C3%A4ude-(358-359)/';
const ESTG_35C = 'https://www.gesetze-im-internet.de/estg/__35c.html';
/** BEG-EM guideline (Förderrichtlinie) of 17.08.2026 – also used for the official references below (F11.4). */
const RL = 'https://www.bundesanzeiger.de/pub/publication/jLXvW09kHTQoDINAdoC/content/jLXvW09kHTQoDINAdoC/BAnz%20AT%2027.08.2026%20B1.pdf?inline';
const GMODG = 'https://www.co2online.de/modernisieren-und-bauen/sanierung-modernisierung/gebaeudeenergiegesetz-geg/';
const ASOF = '11.11.2026';
const mkt = (text: string, url: string, asOf = ASOF): DefaultSource => ({ kind: 'markt', text, url, asOf });

const kfw = (text: string): DefaultSource => ({ kind: 'quelle', text, url: KFW_458, asOf: ASOF });
const kfwLoan = (text: string): DefaultSource => ({ kind: 'quelle', text, url: KFW_358, asOf: ASOF });
const tax = (text: string): DefaultSource => ({ kind: 'gesetz', text, url: ESTG_35C });
const own = 'Bitte durch den eigenen Wert ersetzen.';

export const DEFAULT_SOURCES: Record<string, DefaultSource> = {
  // ---------- Existing heating (Bestandsheizung) ----------
  'oldHeating.fuel': { kind: 'beispiel', text: `Beispiel Erdgas. ${own}` },
  'oldHeating.consumption': {
    kind: 'beispiel',
    text: `Beispielverbrauch eines unsanierten bis teilsanierten Einfamilienhauses (20.000 kWh Gas bzw. 2.000 l Öl). ${own} Am besten der Durchschnitt mehrerer Jahresabrechnungen.`,
  },
  'oldHeating.dhwViaHeating': { kind: 'beispiel', text: `Standard: Warmwasser über die Heizung (häufigster Fall bei Gas- und Ölheizungen). ${own}` },
  'oldHeating.dhwShare': { kind: 'schaetzung', text: 'Schätzung: Warmwasser macht in Einfamilienhäusern meist 10–20 % des Heizenergieverbrauchs aus, in gut gedämmten Häusern deutlich mehr. Grob: 500–800 kWh Wärme je Person und Jahr. Keine konkrete Erhebung.' },
  'oldHeating.cookingWithGas': { kind: 'beispiel', text: `Standard: kein Gasherd. ${own}` },
  'oldHeating.cookingShare': { kind: 'schaetzung', text: 'Schätzung: Ein Gasherd braucht im Haushalt etwa 300–600 kWh im Jahr, das sind bei 20.000 kWh Gesamtverbrauch rund 2–3 %. Keine konkrete Erhebung.' },
  'oldHeating.cookingAfter': { kind: 'annahme', text: 'Standard: Umstieg auf ein Induktionskochfeld; dann entfällt der Gasanschluss samt Grundpreis. Bleibt der Gasherd, laufen Grundpreis und Gaskosten weiter.' },
  'oldHeating.cookingSwitchCost': { kind: 'schaetzung', text: 'Schätzung: Induktionskochfelder kosten etwa 300–1.500 €, dazu Einbau durch den Elektriker (Herdanschluss meist vorhanden) und ggf. induktionsgeeignete Töpfe. Keine konkrete Erhebung – bitte Angebot einsetzen.' },
  'oldHeating.efficiency': {
    kind: 'technik',
    text: 'Typischer Jahresnutzungsgrad eines Brennwert- bzw. guten Niedertemperaturkessels (ältere Kessel eher 80–85 %). Bestimmt, wie viel Nutzwärme aus dem Brennstoff entsteht.',
  },
  'oldHeating.installedMonth': { kind: 'beispiel', text: `Beispiel: 22 Jahre vor dem Start der Betrachtung. Monat der Inbetriebnahme steht auf dem Typenschild oder im Schornsteinfeger-Protokoll; maßgeblich für das Mindestalter beim Klimageschwindigkeitsbonus ist das Datum der Inbetriebnahme. ${own}` },
  'oldHeating.remainingLifeYears': {
    kind: 'beispiel',
    text: `Beispiel. Eigene Einschätzung, wie lange die Anlage noch hält – ggf. mit Heizungsbauer/Schornsteinfeger besprechen. ${own}`,
  },
  'oldHeating.maintenance': mkt('42watt (08/2026): Wartung einer Gasheizung 100–300 €/Jahr, Schornsteinfeger inkl. Abgaswegemessung und Feuerstättenschau 50–100 €; zusammen 200–400 €/Jahr. Default = Mitte dieser Spanne. Wartungsverträge, eine separate Gassicherheitsprüfung oder ein jährlicher Schornsteinfegertermin können darüber liegen – eigene Rechnungen verwenden.', 'https://42watt.de/magazin/gasheizung-kosten', '18.11.2026'),
  'oldHeating.replacementCost': mkt('Keine amtliche Kostenerhebung verfügbar. Schwäbisch Hall nach BKI (3. Quartal 2026): Gas-Brennwerttherme mit Pufferspeicher ca. 14.700 € netto im Altbau (13.400 € Neubau), ohne Abbruch- und Umbauarbeiten. Default = Altbau, brutto (× 1,19). Demontage der Altanlage ab ca. 1.000 €, Schornsteinsanierung ggf. +1.000–2.000 €. Für eine belastbare Rechnung ein Angebot einholen.', 'https://www.schwaebisch-hall.de/wohnen-und-leben/energie-sparen/heizung/neue-heizung-kosten.html', '18.11.2026'),
  'oldHeating.replacementEfficiency': { kind: 'technik', text: 'Typischer Jahresnutzungsgrad eines neuen Brennwertkessels.' },
  'oldHeating.replacementLifeYears': { kind: 'schaetzung', text: 'Schätzung der üblichen Nutzungsdauer eines Gas-/Ölkessels (ca. 18–25 Jahre).' },

  // ---------- Energy prices ----------
  'prices.gasPriceCt': mkt('BDEW-Gaspreisanalyse: Ø 12,23 ct/kWh im Oktober 2026 (Einfamilienhaus, brutto inkl. CO₂-Abgabe); Destatis: Ø 11,58 ct/kWh im 1. Halbjahr 2026. Neukundentarife liegen aktuell eher bei 12,4–14,4 ct/kWh. Arbeitspreis aus der eigenen Gasrechnung eintragen.', 'https://www.bdew.de/service/daten-und-grafiken/bdew-gaspreisanalyse/'),
  'prices.gasBaseFee': { kind: 'schaetzung', text: 'Kein bundesweiter Durchschnitt gefunden. Beispiele aus Preisblättern 2026: ca. 110–190 €/Jahr brutto (z. B. Grundversorgung Stadtwerke Stade 171 €). Default = Mittelwert. Steht auf der eigenen Gasrechnung.' },
  'prices.gasIncrease': {
    kind: 'annahme',
    text: 'Modellannahme für die Steigerung des Gaspreises ohne CO₂-Anteil (Beschaffung, Netzentgelte, Umlagen). Der CO₂-Anteil wird separat über den CO₂-Preispfad gerechnet.',
  },
  'prices.oilPriceEur': mkt('esyoil-Tagesdurchschnitt am 11.11.2026: 164,20 € je 100 l bei 3.000 l Abnahme (TECSON Anfang November: 175,50 €). Der Preis lag damit rund 80 % über Vorjahr und schwankt stark – letzte eigene Lieferrechnung bzw. aktuelles Angebot verwenden.', 'https://www.esyoil.com/news/rohoel-wird-reichlicher-oelprodukte-bleiben-knapp?id=109267'),
  'prices.oilIncrease': { kind: 'annahme', text: 'Modellannahme für die Preissteigerung ohne CO₂-Anteil.' },
  'prices.co2Path': {
    kind: 'gesetz',
    text: '2026 und 2027: Preiskorridor 55–65 €/t nach BEHG (Korridor für 2027 durch BEHG-Novelle verlängert, weil der EU-Emissionshandel ETS2 auf den 01.01.2028 verschoben wurde). Ab 2028 bildet sich der Preis im ETS2 am Markt – der Pfad bis 220 €/t ist eine Modellannahme.',
    url: 'https://www.advant-beiten.com/en/news/behg-novelle-co2-preis-bleibt-2027-im-korridor-von-55-bis-65-euro',
    asOf: ASOF,
  },
  'prices.bioEnabled': {
    kind: 'gesetz',
    text: 'Gebäudemodernisierungsgesetz (Nachfolger des GEG, in Kraft seit 29.07.2026): neu eingebaute Gas-/Ölheizungen müssen ab 2029 einen steigenden Bio-Anteil nutzen („Bio-Treppe").',
    url: GMODG,
    asOf: ASOF,
  },
  'prices.bioSteps': {
    kind: 'gesetz',
    text: 'Stufen der Bio-Treppe laut Gebäudemodernisierungsgesetz (Zusammenfassung co2online): 2029 10 %, 2030 15 %, 2035 30 %, 2040 60 %.',
    url: GMODG,
    asOf: ASOF,
  },
  'prices.bioPremiumCt': mkt('Finanztip: Tarife mit 100 % Biogas kosten mindestens 3 ct/kWh mehr als normale Gastarife (rund +30 %). Künftige Preise für Biomethan/Bioöl sind unsicher.', 'https://finanztip.de/gaspreisvergleich/oekogas-label', 'Juli 2026'),
  'prices.gasCo2Factor': {
    kind: 'technik',
    text: 'Emissionsfaktor Erdgas 0,201 kg CO₂/kWh (bezogen auf den Heizwert), wie in den CO₂-Faktoren des BAFA bzw. im Brennstoffemissionshandel verwendet.',
  },
  'prices.gridCo2Path': {
    kind: 'quelle',
    text: 'Umweltbundesamt: 2025 wurden je verbrauchter Kilowattstunde Strom bei der Erzeugung durchschnittlich 344 g CO₂ ausgestoßen (Schätzung; 2024: 353 g, 2023: 379 g). Der weitere Pfad ist eine Modellannahme: Er sinkt mit dem Ausbau der erneuerbaren Energien (Ziel 80 % am Bruttostromverbrauch 2030, Klimaneutralität 2045), langsamer als die Ziele vorgeben. Mit „Ökostromtarif“ zählt der Netzstrom mit 0 g/kWh; selbst erzeugter PV-Strom wird über den PV-Eigenanteil als CO₂-frei gerechnet.',
    url: 'https://www.umweltbundesamt.de/themen/co2-emissionen-pro-kilowattstunde-strom-2025-nur',
    asOf: 'März 2026',
  },
  'prices.currentBioShare': { kind: 'beispiel', text: 'Standard 0 % (reines Erdgas bzw. Heizöl). Biogas-Tarife enthalten oft 5–20 % Biomethan, einige 100 %. Der Anteil steht in der Tarifbeschreibung bzw. auf der Rechnung. In der CO₂-Bilanz gilt er wie im Brennstoffemissionshandel als klimaneutral. Bei einem neuen Kessel zählt mindestens der Anteil der Bio-Treppe; den dafür nötigen Aufpreis rechnet der Rechner nur für den Teil, der über den heutigen Anteil hinausgeht.' },
  'prices.oilCo2Factor': { kind: 'technik', text: 'Emissionsfaktor Heizöl 0,266 kg CO₂/kWh (bezogen auf den Heizwert), wie in den CO₂-Faktoren des BAFA verwendet.' },
  'prices.oilKwhPerLiter': { kind: 'technik', text: 'Heizwert von Heizöl EL: rund 10 kWh je Liter.' },
  'prices.cookingElecFactor': { kind: 'technik', text: 'Ein Gasherd nutzt etwa 40–55 % der Energie für das Kochgut, ein Induktionskochfeld etwa 80–90 %. Je kWh Gas braucht Induktion daher grob 0,5–0,6 kWh Strom (Schätzung).' },

  // ---------- Heat pump ----------
  'heatPump.installMonth': { kind: 'annahme', text: 'Annahme: Inbetriebnahme 6 Monate nach Start (Planung, Förderantrag, Lieferzeit). Eigenen Plan eintragen.' },
  'heatPump.investment': { kind: 'schaetzung', text: 'Keine amtliche Kostenerhebung verfügbar. Ratgeber nennen für Luft/Wasser-Wärmepumpen im Einfamilienhaus inkl. Installation meist 27.000–40.000 € (für Bestandsgebäude teils bis ca. 43.000 €); günstigere Angaben (ab ca. 15.000 €) beziehen sich meist auf einfache Fälle. Angebot einholen.' },
  'heatPump.eligibleShare': { kind: 'annahme', text: 'Annahme: alle Kosten förderfähig. Förderfähig sind neben der Wärmepumpe u. a. Umfeldmaßnahmen wie Heizkörpertausch, Elektroinstallation, Fundament, Demontage und Entsorgung der Altanlage. Nicht förderfähige Posten aus dem Angebot abziehen.' },
  'heatPump.extraCost': { kind: 'beispiel', text: 'Standard 0 €. Hier nur Kosten eintragen, die nicht förderfähig sind, z. B. die Stilllegung des Gasanschlusses durch den Netzbetreiber. Ausbau und Entsorgung der Altanlage einschließlich Öl- oder Gastank sind dagegen förderfähig.' },
  'heatPump.source': { kind: 'beispiel', text: 'Standard: Luft/Wasser-Wärmepumpe, die mit Abstand häufigste Bauart im Bestand. Erdwärme (Sole/Wasser) erreicht im Feldtest des Fraunhofer ISE im Mittel eine JAZ von 4,3 statt 3,4, kostet aber deutlich mehr (Bohrung oder Kollektor).' },
  'heatPump.emitter': { kind: 'beispiel', text: 'Standard: normale Heizkörper. Für die JAZ-Schätzung angenommene Vorlauftemperatur an kalten Tagen: Fußbodenheizung ca. 35 °C, große (Niedertemperatur-)Heizkörper ca. 42 °C, normale Heizkörper ca. 50 °C – je nach Wärmebedarf je m² etwas mehr oder weniger. Grobe Schätzung; im Feldtest des Fraunhofer ISE kamen ausreichend große Heizkörper mit ähnlich niedrigen Temperaturen aus wie Flächenheizungen.' },
  'heatPump.jaz': { kind: 'quelle', text: 'Fraunhofer ISE, Feldtest „WP-QS im Bestand“: Außenluft-Wärmepumpen in Bestandsgebäuden erreichten im Mittel eine Jahresarbeitszahl von 3,3 (Bandbreite 2,4–4,0; Zwischenergebnis 2024). Laut Berichten zum Abschluss 2025 lag der Mittelwert bei 3,4. Höher bei niedriger Vorlauftemperatur und bei Erdwärme.', url: 'https://www.ise.fraunhofer.de/de/presse-und-medien/news/2024/waermepumpenfeldstest-zwischenergebnisse-bestaetigen-effizienten-betrieb-auch-im-altbau.html', asOf: '2024' },
  'heatPump.maintenance': mkt('co2online: Wartung einer Wärmepumpe im Einfamilienhaus 110–220 €, im Mittel 140 €. Kein Schornsteinfeger mehr nötig.', 'https://www.co2online.de/energie-sparen/heizenergie-sparen/heizkosten-sparen/heizungswartung/'),
  'heatPump.lifeYears': { kind: 'schaetzung', text: 'Schätzung der üblichen Nutzungsdauer (ca. 18–25 Jahre). Wirkt auf den Restwert am Ende.' },
  'heatPump.applicationMonth': {
    kind: 'annahme',
    text: 'Standard: leer – automatisch ca. 4 Monate vor Inbetriebnahme (Annahme, ohne amtliche Angabe). Der Antrag muss vor Vorhabenbeginn gestellt werden; das Antragsdatum bestimmt Boni und Höchstbeträge. Den Monat eintragen, sobald der Antrag feststeht.',
    url: KFW_458,
  },
  'heatPump.euOrigin': { kind: 'beispiel', text: 'Annahme: Wärmepumpe aus der EU. Ohne EU-Ursprung gibt es ab dem 1. Quartal 2027 nur 15 % Grundförderung (kein Wertschöpfungs-Bonus). Herkunft beim Angebot erfragen.' },

  // ---------- Electricity ----------
  'heatPump.separateTariff': { kind: 'annahme', text: 'Annahme: eigener Zähler mit Wärmepumpentarif. Ohne separaten Tarif läuft die WP über den Haushaltsstrom.' },
  'heatPump.elecPriceCt': mkt('Verivox: günstigste Wärmepumpentarife für Neukunden um 20,7 ct/kWh (7.500 kWh/Jahr); Ratgeber nennen für übliche WP-Tarife 22–28 ct/kWh, Bestandsverträge oft mehr. Default = typischer Neuvertrag. Tarife vergleichen.', 'https://www.verivox.de/heizstrom/waermepumpenstrom-preisentwicklung/'),
  'heatPump.meterFee': { kind: 'schaetzung', text: 'Schätzung für den Grundpreis des Wärmepumpentarifs pro Jahr. Das intelligente Messsystem steht in einem eigenen Feld.' },
  'heatPump.smartMeterFee': {
    kind: 'gesetz',
    text: 'Für die KfW-Förderung muss ein intelligentes Messsystem (iMSys) mit Steuerungseinrichtung bestellt werden (Infoblatt Nr. 4.1.3.2; Ausnahme: bis 4,2 kW elektrisch nur iMSys, oder am Hausanschluss ist schon eines vorhanden). Preisobergrenzen § 30 MsbG für den Anschlussnutzer: iMSys bei steuerbarer Verbrauchseinrichtung nach § 14a EnWG 50 € brutto pro Jahr, Steuerungseinrichtung zusätzlich 50 €. Default = 100 €/Jahr, ohne Preissteigerung. Das einmalige Einbauentgelt ist förderfähig und gehört zur Investition. Ist am Haushaltszähler schon ein iMSys mit Steuerung vorhanden und bezahlt, 0 eintragen.',
    url: 'https://www.gesetze-im-internet.de/messbg/__30.html',
    asOf: ASOF,
  },
  'heatPump.meterSetupCost': { kind: 'beispiel', text: 'Standard 0 €. Hier die Mehrkosten für den zweiten Zählerplatz eintragen (z. B. Erweiterung oder Neuaufbau des Zählerschranks). Die Kosten hängen stark vom Zustand des Zählerschranks ab – Angebot vom Elektriker einholen. Ein Teil des Umbaus kann ohnehin nötig sein: Für die Förderung muss ein intelligentes Messsystem mit Steuerungseinrichtung bestellt werden; dessen Einbauentgelt ist förderfähig und gehört nicht hierher.' },
  'heatPump.meterSetupEligible': { kind: 'annahme', text: 'Annahme: nicht förderfähig. Das Infoblatt nennt als förderfähig die „notwendigen Netzanschlüsse“ der Wärmepumpe sowie das intelligente Messsystem mit Steuerungseinrichtung, aber nicht ausdrücklich einen zweiten Zählerplatz für einen günstigeren Tarif. Ob der Umbau anerkannt wird, klärt der Fachbetrieb bzw. Energieeffizienz-Experte bei der Bestätigung zum Antrag.' },
  'heatPump.householdPriceCt': mkt('BDEW-Strompreisanalyse: durchschnittlicher Haushaltsstrompreis 2026 bisher 37,3 ct/kWh (brutto). Eigene Stromrechnung verwenden.', 'https://www.bdew.de/service/daten-und-grafiken/bdew-strompreisanalyse/'),
  'heatPump.elecIncrease': { kind: 'annahme', text: 'Modellannahme für die jährliche Strompreissteigerung.' },
  'heatPump.para14aReduction': {
    kind: 'gesetz',
    text: '§ 14a EnWG, Festlegung der Bundesnetzagentur: steuerbare Wärmepumpen erhalten reduzierte Netzentgelte (Modul 1 = Pauschale aus 80 € brutto + netzgebietsabhängigem Anteil). Beispiele 2026: Stadtwerke Mengen 152,56 € brutto, Stadtwerke Northeim 106,31 €. Default = mittlerer Wert; Preisblatt des eigenen Netzbetreibers prüfen.',
    url: 'https://www.vattenfall.de/steuerbare-verbrauchseinrichtungen-14a-enwg',
  },
  'heatPump.existing14aOnHousehold': { kind: 'annahme', text: 'Annahme: Am Haushaltszähler ist noch kein steuerbares Gerät angemeldet. Hintergrund (Bundesnetzagentur): Die pauschale Netzentgeltreduzierung (Modul 1) wird je Marktlokation gewährt, über die der Verbrauch der steuerbaren Verbrauchseinrichtung abgerechnet wird. Sie bleibt gleich hoch, auch wenn dort mehrere steuerbare Verbrauchseinrichtungen (Wärmepumpe, Wallbox, Klimaanlage, Batteriespeicher) betrieben werden. Mit eigenem WP-Zähler (eigene Marktlokation) gibt es die Pauschale dort zusätzlich. Standard: nein.', url: 'https://www.bundesnetzagentur.de/DE/Vportal/Energie/SteuerbareVBE/Netzentgelt_table.html', asOf: ASOF },
  'heatPump.greenElectricity': { kind: 'beispiel', text: 'Standard: kein Ökostromtarif. Mit Ökostromtarif wird der Netzstrom in der CO₂-Bilanz mit 0 g CO₂/kWh gerechnet (marktbezogene Bilanzierung über Herkunftsnachweise, wie sie Energieversorger ausweisen). Ortsbezogen gerechnet ändert ein Ökostromtarif den deutschen Strommix nicht – dann das Häkchen weglassen.' },
  'heatPump.pvKwp': { kind: 'beispiel', text: 'Standard 0 (keine PV-Anlage). Der Rechner verteilt den Jahresertrag typisch über die Monate (Dezember ca. 2 %, Juni/Juli je ca. 13 %), zieht zuerst den Haushaltsstrom ab und rechnet nur gleichzeitig verbrauchten Strom an: Von der monatlichen Überschneidung aus Erzeugung und Verbrauch wird ohne Speicher die Hälfte direkt genutzt (Modellannahme). So bleibt für die Wärmepumpe im Winter wenig PV-Strom.' },
  'heatPump.pvYield': { kind: 'schaetzung', text: 'In Deutschland erzeugt eine PV-Anlage je nach Region, Ausrichtung und Neigung etwa 800–1.100 kWh je kWp und Jahr; 950 kWh/kWp ist ein üblicher Mittelwert für Süd- bis Südwest-Dächer. Der tatsächliche Wert steht im Anlagenmonitor oder in der Jahresabrechnung.' },
  'heatPump.batteryKwh': { kind: 'beispiel', text: 'Standard 0 (kein Speicher). Modell: höchstens eine volle Ladung je Tag mit 90 % Wirkungsgrad, begrenzt durch den Überschuss des Monats und den noch nicht gedeckten Verbrauch. Im Winter gibt es kaum Überschuss – der Speicher hilft der Wärmepumpe dann wenig.' },
  'heatPump.householdKwh': { kind: 'schaetzung', text: 'Typischer Stromverbrauch ohne Wärmepumpe und ohne Elektroauto: 2 Personen ca. 2.500–3.000 kWh, 3–4 Personen ca. 3.500–4.500 kWh im Jahr. Steht auf der Stromrechnung (Verbrauch vor der Wärmepumpe).' },
  'heatPump.feedInCt': {
    kind: 'gesetz',
    text: 'EEG-Einspeisevergütung für Teileinspeisung ≤ 10 kWp: 7,70 ct/kWh für Anlagen mit Inbetriebnahme 01.08.–31.12.2026 (davor 7,78 ct). Sinkt halbjährlich um 1 %; maßgeblich ist der Satz bei Inbetriebnahme der eigenen PV-Anlage.',
    url: 'https://www.dgs.de/wp-content/uploads/2026/08/260801_dgs_arbeitshilfe_eeg_verguetungssaetze.pdf',
    asOf: '01.08.2026',
  },

  // ---------- Household & building ----------
  'building.ownerOccupied': { kind: 'beispiel', text: 'Beispiel: selbstgenutzt. Voraussetzung für Klimageschwindigkeits- und Einkommensbonus sowie den Steuerbonus.' },
  'building.units': { kind: 'beispiel', text: `Beispiel Einfamilienhaus. ${own}` },
  'building.constructionYear': { kind: 'beispiel', text: `Beispiel: 40 Jahre vor dem Startjahr. Für den Steuerbonus muss das Gebäude bei Abschluss mindestens 10 Jahre alt sein; außerdem dient das Baujahr der Einordnung des Hauses. ${own}` },
  'building.heatedArea': { kind: 'beispiel', text: `Beispiel für ein Einfamilienhaus. Die beheizte Wohnfläche steht im Kaufvertrag, in der Wohnflächenberechnung oder im Energieausweis. ${own}` },
  'building.renovationYear': { kind: 'beispiel', text: `Standard 0 = keine energetische Sanierung bekannt. ${own}` },
  'building.renovationScope': { kind: 'annahme', text: 'Einzelmaßnahmen (z. B. Fenstertausch, Dachdämmung) senken den Verbrauch typischerweise um 10–25 %, eine umfassende Sanierung der Hülle um 40–60 % – grobe Erfahrungswerte für die Einordnung.' },
  'building.incomeRange': { kind: 'beispiel', text: 'Beispielbereich (ohne Einkommensbonus). Maßgeblich ist der Durchschnitt der zu versteuernden Einkommen des 2. und 3. Jahres vor Antragseingang (Antrag 2026 → 2023 und 2024) aller im Haushalt gemeldeten Eigentümer und deren Partner; Minderjährige zählen nicht. Nachweis nur per Einkommensteuerbescheid. Bitte den Bereich wählen, der zu Ihrem Durchschnitt passt.' },
  'building.hasChild': { kind: 'beispiel', text: 'Familienzuschlag: Ist mindestens ein Kind unter 18 (bei Antragstellung) mit Hauptwohnsitz in der Wohneinheit gemeldet und besteht für es Kindergeldberechtigung im Haushalt, erhöhen sich die Einkommensgrenzen einmalig um 10.000 € – unabhängig von der Zahl der Kinder. Nachweis per Meldebestätigung.' },
  'building.incomeTax': { kind: 'annahme', text: 'Standard 0 = keine Begrenzung. Liegt die Einkommensteuer unter dem jährlichen Steuerbonus, verfällt der Rest (kein Vor-/Rücktrag).' },

  // ---------- Financing ----------
  'financing.kfwEquity': { kind: 'beispiel', text: `Beispiel. ${own}` },
  'financing.taxEquity': { kind: 'beispiel', text: `Beispiel. ${own}` },
  'financing.kfwRate358': {
    kind: 'markt',
    text: 'KfW-Seite zeigte keine Zinsen. Laut hausvoraus.de (Stand 10.11.2026): KfW 358 1,48 % Sollzins bei 10 Jahren Laufzeit, 2,68 % bei 35 Jahren (jeweils 10 Jahre Zinsbindung). Default 2,2 % = geschätzt für 20 Jahre Laufzeit. Verbindlich ist der Zins am Tag der Zusage – bei der Hausbank erfragen.',
    url: 'https://hausvoraus.de/kosten-foerderung/kfw/zinsentwicklung/',
    asOf: '10.11.2026',
  },
  'financing.kfwRate359': {
    kind: 'markt',
    text: 'Laut hausvoraus.de (Stand 10.11.2026): KfW 359 4,53 % Sollzins bei 10 Jahren, 4,63 % bei 35 Jahren Laufzeit. Verbindlich ist der Zins am Tag der Zusage.',
    url: 'https://hausvoraus.de/kosten-foerderung/kfw/zinsentwicklung/',
    asOf: '10.11.2026',
  },
  'financing.kfwTermYears': kfwLoan('Wählbar sind Laufzeiten von 4 bis 35 Jahren; 20 Jahre als mittlere Annahme.'),
  'financing.kfwGraceYears': kfwLoan('Je nach Laufzeit 1–5 tilgungsfreie Anlaufjahre möglich; 1 Jahr als Annahme.'),
  'financing.kfwFixYears': kfwLoan('Zinsbindung bei Laufzeiten ab 6 Jahren: 10 Jahre.'),
  'financing.followUpRate': { kind: 'annahme', text: 'Annahme für den Zins nach Ende der Zinsbindung (Prolongationsangebot der KfW ist heute nicht bekannt).' },
  'financing.useKfwLoan': { kind: 'annahme', text: 'Annahme: Der KfW-Ergänzungskredit wird beantragt. Er ist optional – der Zuschuss (458) wird auch ohne Kredit gewährt. Ohne Haken läuft der Finanzierungsbedarf über den Bankkredit.' },
  'financing.subsidyAsSpecialRepayment': kfwLoan('Während der Zinsbindung sind Sondertilgungen ab 5.000 € ohne Vorfälligkeitsentschädigung möglich; die Laufzeit verkürzt sich. Ohne KfW-Kredit tilgt der Zuschuss den Bankkredit nach den Regeln für Verbraucherdarlehen (§ 500 Abs. 2, § 502 BGB).'),
  'financing.subsidyDelayMonths': { kind: 'annahme', text: 'Annahme: Auszahlung ca. 3 Monate nach Inbetriebnahme (Nachweis im KfW-Portal, Prüfung).' },
  'financing.bankRate': mkt('Verivox: Median-Zins der über das Portal abgeschlossenen Ratenkredite (10.000–30.000 €, 36–84 Monate) im Oktober 2026 6,22 % effektiv; Beispiel Commerzbank (11/2026, 15.000 €, 60 Monate) 6,44 %. Der Durchschnitt aller Banken liegt laut Bundesbank höher (Konsumentenkredite September 2026: 8,91 %), grundschuldbesicherte Modernisierungskredite niedriger (ca. 4,3 %). Default = etwas über dem Portal-Median, weil die Laufzeit hier länger ist. Angebote vergleichen.', 'https://www.verivox.de/kredit/zinsen/', '18.11.2026'),
  'financing.bankTermYears': { kind: 'annahme', text: 'Annahme für die Laufzeit des Bankkredits.' },
  'financing.bankGraceYears': { kind: 'annahme', text: 'Annahme: sofortige Tilgung.' },
  'financing.taxRefundMonth': { kind: 'annahme', text: 'Annahme: Steuerbescheid und Erstattung im Juni des Folgejahres.' },
  'financing.taxRefundAsSpecialRepayment': {
    kind: 'annahme',
    text: 'Annahme: Die Steuererstattungen fließen in die Tilgung des Bankkredits – bei einem Kreditzins über dem Opportunitätszins meist günstiger, als das Geld liegen zu lassen. Verbraucherdarlehen dürfen jederzeit teilweise vorzeitig zurückgezahlt werden; die Vorfälligkeitsentschädigung beträgt höchstens 1 % (§ 500 Abs. 2, § 502 BGB).',
    url: 'https://www.gesetze-im-internet.de/bgb/__502.html',
  },
  'financing.windfallAmount': { kind: 'beispiel', text: 'Standard 0 € (keine Einmalzahlung). Hier z. B. die Auszahlung einer fälligen Lebensversicherung eintragen. Eingesetztes Geld zählt als Ausgabe; mit dem Opportunitätszins wird berücksichtigt, dass es sonst Zinsen bringen würde.' },
  'financing.windfallMonth': { kind: 'beispiel', text: 'Beispiel: 5 Jahre nach Start. Fälligkeitstermin laut Versicherungsvertrag eintragen.' },
  'financing.windfallRepayMonth': { kind: 'annahme', text: 'Standard: leer – die Sondertilgung erfolgt im Monat, in dem das Geld verfügbar ist. Ein späterer Termin kann sinnvoll sein (z. B. Zinsbindungsende abwarten oder Bankkredit kurz vor Laufzeitende); früher als verfügbar ist nicht möglich.' },
  'financing.windfallTarget': { kind: 'annahme', text: 'Automatisch wird zuerst der Kredit mit dem höchsten aktuellen Zins getilgt – das spart am meisten Zinsen. Ist die Sondertilgung dort nach den Kreditbedingungen nicht möglich (z. B. KfW nach Ende der Zinsbindung nur vollständig), wird der andere Kredit versucht.' },
  'financing.kfwMinPrepay': { kind: 'quelle', text: 'Außerplanmäßige Tilgungen sind ab einem Mindestbetrag von 5.000 € innerhalb der ersten Zinsbindung jederzeit kostenfrei möglich. Nach Ablauf der ersten Zinsbindung nur noch vollständig und gegen Vorfälligkeitsentschädigung. Gilt auch für den Zuschuss als Sondertilgung.', url: KFW_358, asOf: ASOF },
  'financing.kfwFeeAfterFix': { kind: 'annahme', text: 'Annahme: Die Höhe der Vorfälligkeitsentschädigung nach Ende der Zinsbindung legt der Finanzierungspartner fest; das Merkblatt nennt keinen Wert. Vor einer vollständigen Rückzahlung bei der Bank erfragen.' },
  'financing.bankPrepayFee': { kind: 'gesetz', text: 'Verbraucherdarlehen dürfen jederzeit ganz oder teilweise vorzeitig zurückgezahlt werden (§ 500 Abs. 2 BGB). Die Vorfälligkeitsentschädigung beträgt höchstens 1 % des vorzeitig zurückgezahlten Betrags und nie mehr als die Sollzinsen bis zum Laufzeitende (§ 502 BGB). Viele Banken erlauben Sondertilgungen kostenfrei – dann 0 % eintragen.', url: 'https://www.gesetze-im-internet.de/bgb/__502.html' },
  'financing.bankPrepayFeeShort': { kind: 'gesetz', text: 'Beträgt die Restlaufzeit höchstens ein Jahr, ist die Entschädigung auf 0,5 % begrenzt (§ 502 Abs. 3 BGB).', url: 'https://www.gesetze-im-internet.de/bgb/__502.html' },
  'financing.bankFreePrepayShare': {
    kind: 'annahme',
    text: 'Standard 0 % (kein kostenfreies Kontingent). Viele Ratenkredite und Modernisierungskredite erlauben kostenfreie Sondertilgungen bis zu einem Anteil des Kreditbetrags je Jahr (z. B. 5 % oder 10 %) oder unbegrenzt – Wert aus dem eigenen Kreditvertrag eintragen. Unbegrenzt kostenfrei: „Bank: Vorfälligkeitsentschädigung“ auf 0 % setzen.',
  },
  'financing.bankFreePrepayAmount': {
    kind: 'annahme',
    text: 'Standard 0 € (kein festes Kontingent). Manche Kreditverträge nennen statt eines Anteils einen festen Betrag je Jahr, der kostenfrei getilgt werden darf – Wert aus dem eigenen Kreditvertrag eintragen.',
  },

  // ---------- Analysis period (Betrachtungszeitraum) ----------
  'general.startMonth': { kind: 'annahme', text: 'Aktueller Monat beim ersten Öffnen.' },
  'general.horizonYears': { kind: 'annahme', text: 'Annahme: 20 Jahre ≈ Lebensdauer einer Wärmepumpe.' },
  'general.opportunityRate': { kind: 'annahme', text: 'Annahme: entgangene Verzinsung des eingesetzten Geldes, etwa auf Tagesgeld-/Festgeldniveau.' },
  'general.costIncrease': { kind: 'annahme', text: 'Annahme: allgemeine Teuerung von 2 % p. a., orientiert am Inflationsziel der EZB.' },
  'general.investIncrease': { kind: 'annahme', text: 'Annahme: Anschaffungspreise steigen mit 2 % p. a. (wirkt nur bei späterem Kauf).' },
  'general.residualValue': { kind: 'annahme', text: 'Annahme: linearer Restwert von am Ende noch nutzbaren Anlagen wird gutgeschrieben, damit spät gekaufte Anlagen fair bewertet werden.' },
  'compare.stepMonths': { kind: 'annahme', text: 'Halbjahresschritte passend zu den halbjährlichen Förderabsenkungen (Februar/August).' },
  'compare.count': { kind: 'annahme', text: '9 Zeitpunkte = Umrüstung heute bis in 4 Jahren.' },

  // ---------- KfW 458 ----------
  'funding.grundRate': kfw('Grundförderung 30 % der förderfähigen Kosten.'),
  'funding.grundRateNewFrom': {
    kind: 'annahme',
    text: 'Die Richtlinie nennt nur „ab dem ersten Quartal 2027“; die Detailregelung soll im Laufe des 1. Quartals 2027 folgen. Angenommen: Anträge ab Januar 2027. Ab dann gelten 15 % Grundförderung plus 15 % Wertschöpfungs-Bonus für Wärmepumpen mit EU-Ursprung.',
  },
  'funding.grundRateNew': { kind: 'gesetz', text: 'Ab dem ersten Quartal 2027 beträgt der Fördersatz für Wärmepumpen 15 % (statt 30 %).' },
  'funding.wsbRate': { kind: 'gesetz', text: 'Wertschöpfungs-Bonus von 15 Prozentpunkten ab dem ersten Quartal 2027, wenn die Wärmepumpe ihren Ursprung in der EU hat. Details (Nachweis des Ursprungs) stehen noch aus.' },
  'funding.kgbRate': kfw('Klimageschwindigkeitsbonus 16 % (selbstgenutzt; Ersatz von Öl- oder ≥ 20 Jahre alter Gasheizung).'),
  'funding.kgbStep': kfw('Ab 01.02.2027 sinkt der Bonus halbjährlich (01.02./01.08.) um 4 Prozentpunkte.'),
  'funding.kgbDegressionStart': kfw('Erste Absenkung zum 01.02.2027.'),
  'funding.kgbEnd': kfw('Für Anträge ab dem 01.08.2028 wird kein Klimageschwindigkeitsbonus mehr gewährt.'),
  'funding.kgbMinGasAge': kfw('Gas- und Biomasseheizungen: Inbetriebnahme muss bei Antragstellung mindestens 20 Jahre zurückliegen. Öl-, Kohle-, Gas-Etagen- und Nachtspeicherheizungen unabhängig vom Alter. Die alte Heizung muss funktionstüchtig sein und fachgerecht entsorgt werden.'),
  'funding.incomeLimit1': kfw('Einkommensbonus 40 % bis 30.000 € zu versteuerndes Haushaltseinkommen (seit 21.07.2026).'),
  'funding.incomeRate1': kfw('Einkommensbonus 40 % in der untersten Stufe.'),
  'funding.incomeLimit2': kfw('30 % bis 40.000 €.'),
  'funding.incomeRate2': kfw('30 % in der zweiten Stufe.'),
  'funding.incomeLimit3': kfw('10 % bis 50.000 €.'),
  'funding.incomeRate3': kfw('10 % in der dritten Stufe.'),
  'funding.incomeChildShift': kfw('Mit mindestens einem kindergeldberechtigten Kind unter 18 erhöhen sich alle Grenzen um 10.000 €.'),
  'funding.maxRate': kfw('Höchstfördersatz 70 % (Grundförderung + Boni).'),
  'funding.maxRateLowIncome': kfw('Obergrenze 80 % bei zu versteuerndem Haushaltsjahreseinkommen bis 30.000 € (mit Familienzuschlag bis 40.000 €), sonst 70 %.'),
  'funding.cap1': kfw('Förderfähige Kosten: 28.000 € für die erste Wohneinheit.'),
  'funding.capStep': kfw('Ab 01.02.2027 sinkt der Höchstbetrag der ersten Wohneinheit halbjährlich um 750 €.'),
  'funding.capDegressionStart': kfw('Erste Absenkung zum 01.02.2027.'),
  'funding.capFloor': {
    kind: 'quelle',
    text: 'BEG-EM-Richtlinie Nr. 8.3.1 (Tabelle der Zeiträume): Die Absenkung endet, ab 1. August 2030 gelten 22.000 € für die erste Wohneinheit (die Richtlinie gilt bis 31.12.2030, Nr. 10). KfW-Seite und Merkblatt 458 nennen nur die halbjährliche Absenkung um 750 €, keine Untergrenze.',
    url: RL,
    asOf: '15.11.2026',
  },
  'funding.cap2to6': kfw('2. bis 6. Wohneinheit je 15.000 €.'),
  'funding.cap7plus': kfw('Ab der 7. Wohneinheit je 8.000 €.'),
  'funding.loanMaxPerUnit': kfwLoan('Ergänzungskredit bis 120.000 € je Wohneinheit.'),
  'funding.loan358IncomeLimit': kfwLoan('Zinsverbilligter Kredit 358 bis 90.000 € zu versteuerndes Haushaltseinkommen.'),

  // ---------- § 35c ----------
  'tax.rateYear1': tax('7 % der Aufwendungen im Jahr des Abschlusses (max. 14.000 €).'),
  'tax.rateYear2': tax('7 % im Folgejahr (max. 14.000 €).'),
  'tax.rateYear3': tax('6 % im zweiten Folgejahr (max. 12.000 €).'),
  'tax.maxBonus': tax('Höchstens 40.000 € Steuerermäßigung je Objekt.'),
  'tax.maxCost': tax('Begünstigte Aufwendungen bis 200.000 € (rechnerisch: 40.000 € Höchstbetrag ÷ 20 % Steuerermäßigung).'),
  'tax.deadline': tax('Gilt für Maßnahmen, die nach dem 31.12.2019 begonnen und vor dem 01.01.2030 abgeschlossen sind (§ 52 Abs. 35a EStG).'),
  'tax.minBuildingAge': tax('Das Gebäude muss bei Beginn der Maßnahme älter als 10 Jahre sein.'),
  'general.vat': { kind: 'gesetz', text: 'Regelsteuersatz 19 % (UStG), gilt für Gas, Heizöl und Strom.' },
};

// ---------- Official references (F11.4) ----------
const M458 = 'https://www.kfw.de/PDF/Download-Center/F%C3%B6rderprogramme-(Inlandsf%C3%B6rderung)/PDF-Dokumente/6000005131_M_458.pdf';
const M358 = 'https://www.kfw.de/PDF/Download-Center/F%C3%B6rderprogramme-(Inlandsf%C3%B6rderung)/PDF-Dokumente/6000005135_M_358_359.pdf';
const INFOBLATT = 'https://www.kfw.de/PDF/Download-Center/F%C3%B6rderprogramme-(Inlandsf%C3%B6rderung)/PDF-Dokumente/6000004863_Infoblatt_BEG_F%C3%B6rderf%C3%A4hige_Ma%C3%9Fnahmen.pdf';

const rl = (nr: string): OfficialRef => ({ label: `BEG-EM-Richtlinie vom 17.08.2026 (BAnz AT 27.08.2026 B1), Nr. ${nr}`, url: RL });
const m458 = (where: string): OfficialRef => ({ label: `KfW-Merkblatt 458 (Stand 09/2026), ${where}`, url: M458 });
const m358 = (where: string): OfficialRef => ({ label: `KfW-Merkblatt 358/359 (Stand 09/2026), ${where}`, url: M358 });
const info = (nr: string): OfficialRef => ({ label: `KfW-Infoblatt förderfähige Maßnahmen (Version 11.1, 11/2026), Nr. ${nr}`, url: INFOBLATT });
const law = (label: string, url: string): OfficialRef => ({ label, url });
const ESTG = (abs: string) => law(`§ 35c ${abs} EStG`, ESTG_35C);

export const OFFICIAL_REFS: Record<string, OfficialRef[]> = {
  'oldHeating.installedMonth': [rl('8.4.4'), m458('S. 3 „Klimageschwindigkeitsbonus“')],
  'building.ownerOccupied': [m458('S. 5 „Selbstnutzende Eigentümerinnen und Eigentümer“'), rl('8.4.4, 8.4.5'), ESTG('Abs. 1')],
  'building.units': [rl('8.3.1 a'), m458('S. 4 „Wohneinheiten“')],
  'building.constructionYear': [ESTG('Abs. 1'), m458('S. 2 (Bauantrag mind. 5 Jahre zurück)')],
  'building.incomeRange': [m458('S. 5 „Haushalt“, „Haushaltsjahreseinkommen“'), rl('8.4.5'), m358('S. 2–3 (Einkommensgrenze 358)')],
  'building.hasChild': [rl('8.4.5'), m458('S. 4 „Einkommensbonus“ (Familienzuschlag), S. 8 „Meldebestätigung“')],
  'building.incomeTax': [ESTG('Abs. 1')],
  'heatPump.investment': [info('4 „Anlagen zur Wärmeerzeugung“'), info('8 „Umfeldmaßnahmen“')],
  'heatPump.eligibleShare': [info('4 und 4.2.8 „Demontagearbeiten“'), info('8 „Umfeldmaßnahmen“'), info('9 „Nicht förderfähige Maßnahmen“')],
  'heatPump.extraCost': [info('4.2.8 „Demontagearbeiten“'), info('9 „Nicht förderfähige Maßnahmen“')],
  'heatPump.installMonth': [m458('S. 6 „Antragstellung“, „Vorhabenbeginn“')],
  'heatPump.applicationMonth': [m458('S. 3 „In 6 Schritten zum Zuschuss“, S. 6 „Vorhabenbeginn“')],
  'heatPump.euOrigin': [rl('8.4.1 c, 8.4.6'), info('1.8 „Förderung von Wärmepumpen mit lokaler Wertschöpfung“')],
  'heatPump.meterSetupCost': [info('4.1.3 (notwendige Netzanschlüsse, intelligentes Messsystem)'), info('4.1.3.2 „iMSys-Bestellpflicht“')],
  'heatPump.smartMeterFee': [law('§ 30 MsbG (Preisobergrenzen)', 'https://www.gesetze-im-internet.de/messbg/__30.html'), info('4.1.3.2 „iMSys-Bestellpflicht“')],
  'heatPump.meterSetupEligible': [info('4.1.3 „Elektrisch angetriebene Wärmepumpen“'), info('4.1.3.2 „iMSys-Bestellpflicht“')],
  'heatPump.para14aReduction': [law('§ 14a EnWG', 'https://www.gesetze-im-internet.de/enwg_2005/__14a.html'), law('Bundesnetzagentur: Reduzierung des Netzentgelts (Module 1–3)', 'https://www.bundesnetzagentur.de/DE/Vportal/Energie/SteuerbareVBE/Netzentgelt_table.html')],
  'heatPump.existing14aOnHousehold': [law('Bundesnetzagentur: Reduzierung des Netzentgelts – Pauschale je Marktlokation', 'https://www.bundesnetzagentur.de/DE/Vportal/Energie/SteuerbareVBE/Netzentgelt_table.html'), law('§ 14a EnWG', 'https://www.gesetze-im-internet.de/enwg_2005/__14a.html')],
  'heatPump.feedInCt': [law('§§ 48, 49 EEG', 'https://www.gesetze-im-internet.de/eeg_2014/__48.html')],
  'prices.co2Path': [law('§ 10 BEHG (Preiskorridor)', 'https://www.gesetze-im-internet.de/behg/__10.html')],
  'general.vat': [law('§ 12 Abs. 1 UStG', 'https://www.gesetze-im-internet.de/ustg_1980/__12.html')],
  'financing.kfwRate358': [rl('8.5.2 a (Zinsverbilligung bis 90.000 €)'), m358('S. 3 „Laufzeit und Zinsbindung“')],
  'financing.kfwRate359': [rl('8.5.2 a'), m358('S. 3 „Laufzeit und Zinsbindung“')],
  'financing.kfwTermYears': [m358('S. 3 „Laufzeit und Zinsbindung“')],
  'financing.kfwGraceYears': [m358('S. 3 „Laufzeit und Zinsbindung“')],
  'financing.kfwFixYears': [m358('S. 3 „Laufzeit und Zinsbindung“')],
  'financing.followUpRate': [rl('8.5.2 b (Prolongation ohne Verbilligung)'), m358('S. 3')],
  'financing.subsidyAsSpecialRepayment': [m358('S. 5 „Tilgung“ (außerplanmäßige Tilgung ab 5.000 €)')],
  'financing.windfallRepayMonth': [m358('S. 5 „Tilgung“'), law('§ 500 Abs. 2 BGB', 'https://www.gesetze-im-internet.de/bgb/__500.html')],
  'financing.windfallTarget': [m358('S. 5 „Tilgung“'), law('§ 500 Abs. 2 BGB', 'https://www.gesetze-im-internet.de/bgb/__500.html')],
  'financing.kfwMinPrepay': [m358('S. 5 „Tilgung“')],
  'financing.kfwFeeAfterFix': [m358('S. 5 „Tilgung“'), rl('8.5.2 b (Prolongation)')],
  'financing.taxRefundAsSpecialRepayment': [law('§ 500 Abs. 2 BGB', 'https://www.gesetze-im-internet.de/bgb/__500.html'), law('§ 502 BGB', 'https://www.gesetze-im-internet.de/bgb/__502.html')],
  'financing.bankPrepayFee': [law('§ 500 Abs. 2 BGB', 'https://www.gesetze-im-internet.de/bgb/__500.html'), law('§ 502 BGB', 'https://www.gesetze-im-internet.de/bgb/__502.html')],
  'financing.bankPrepayFeeShort': [law('§ 502 Abs. 3 BGB', 'https://www.gesetze-im-internet.de/bgb/__502.html')],
  'financing.subsidyDelayMonths': [m458('S. 7 „Bewilligungszeitraum“, S. 9 „Auszahlung“')],
  'financing.kfwEquity': [rl('8.6 (Kombination Zuschuss + Ergänzungskredit)'), m458('S. 9 „Kombination mit anderen Förderprodukten“')],
  'funding.grundRate': [rl('8.4.1 c'), m458('S. 3 „Grundförderung“')],
  'funding.grundRateNewFrom': [rl('8.4.1 c, 8.4.6'), info('1.8')],
  'funding.grundRateNew': [rl('8.4.1 c')],
  'funding.wsbRate': [rl('8.4.6'), info('1.8')],
  'funding.kgbRate': [rl('8.4.4'), m458('S. 3–4 „Klimageschwindigkeitsbonus“')],
  'funding.kgbStep': [rl('8.4.4'), m458('S. 4')],
  'funding.kgbDegressionStart': [rl('8.4.4'), m458('S. 4')],
  'funding.kgbEnd': [rl('8.4.4'), m458('S. 4')],
  'funding.kgbMinGasAge': [rl('8.4.4'), m458('S. 3')],
  'funding.incomeLimit1': [rl('8.4.5'), m458('S. 4 „Einkommensbonus“')],
  'funding.incomeRate1': [rl('8.4.5'), m458('S. 4')],
  'funding.incomeLimit2': [rl('8.4.5'), m458('S. 4')],
  'funding.incomeRate2': [rl('8.4.5'), m458('S. 4')],
  'funding.incomeLimit3': [rl('8.4.5'), m458('S. 4')],
  'funding.incomeRate3': [rl('8.4.5'), m458('S. 4')],
  'funding.incomeChildShift': [rl('8.4.5'), m458('S. 4 (Familienzuschlag)')],
  'funding.maxRate': [rl('8.4.1'), m458('S. 4 „Obergrenze des Fördersatzes“')],
  'funding.maxRateLowIncome': [rl('8.4.1'), m458('S. 4 „Obergrenze des Fördersatzes“')],
  'funding.cap1': [rl('8.3.1 a'), m458('S. 4 „Förderhöchstbetrag“')],
  'funding.capStep': [rl('8.3.1 a'), m458('S. 4')],
  'funding.capDegressionStart': [rl('8.3.1 a'), m458('S. 4')],
  'funding.capFloor': [rl('8.3.1 (Tabelle der Zeiträume)')],
  'funding.cap2to6': [rl('8.3.1 a'), m458('S. 4')],
  'funding.cap7plus': [rl('8.3.1 a'), m458('S. 4')],
  'funding.loanMaxPerUnit': [rl('8.5.1'), m358('S. 3')],
  'funding.loan358IncomeLimit': [rl('8.5.2 a'), m358('S. 2–3')],
  'tax.rateYear1': [ESTG('Abs. 1')],
  'tax.rateYear2': [ESTG('Abs. 1')],
  'tax.rateYear3': [ESTG('Abs. 1')],
  'tax.maxBonus': [ESTG('Abs. 1')],
  'tax.maxCost': [ESTG('Abs. 1')],
  'tax.deadline': [ESTG('Abs. 1'), law('§ 52 Abs. 35a EStG (Anwendungszeitraum)', 'https://www.gesetze-im-internet.de/estg/__52.html'), rl('8.6 (keine Kumulierung mit § 35c für dieselbe Maßnahme)'), m458('S. 10 „Sonstige Hinweise“')],
  'tax.minBuildingAge': [ESTG('Abs. 1')],
};
