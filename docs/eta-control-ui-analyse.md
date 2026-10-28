# ETA Control: UI-Analyse und Modernisierungskonzept

Stand: 28. Oktober 2026

## Ziel und Abgrenzung

Diese Analyse beschreibt die Startseite der ETA2Weather-UI (`/`) anhand des aktuellen Codes. Das Modernisierungskonzept verändert weder Datenquellen, API-Aufrufe noch Steuerlogik. Es ordnet die vorhandenen Funktionen neu, vereinheitlicht ihre Darstellung und ergänzt ausschließlich ein visuelles Theme-System nach dem Vorbild von phi-spaces.

Das interaktive Konzept liegt in [eta-control-ui-mockup.html](./eta-control-ui-mockup.html). Es ist eine statische Dokumentation: Bedienelemente demonstrieren Zustände, senden aber keine Befehle an ETA oder WiFi-Geräte.

Gerenderte Referenzansichten:

- [Desktop · Dark Mode](./eta-control-ui-mockup-dark.png)
- [Desktop · Light Mode](./eta-control-ui-mockup-light.png)
- [Mobil · Dark Mode](./eta-control-ui-mockup-mobile.png)

## Aktueller Seitenaufbau

Die Startseite wird in `src/app/page.tsx` in dieser Reihenfolge zusammengesetzt:

1. globaler Header mit Navigation und ETA-Menü,
2. Übersicht (`HomeHero`),
3. dreispaltige Reihe mit Konfiguration, ETA-Steuerung und WiFi-Kerndaten,
4. zweispaltige Reihe mit ETA-Details sowie WiFi-Details und Zeitfenstern,
5. Footer mit Weather-Link und Autorenhinweis.

Auf schmalen Bildschirmen werden die Bereiche untereinander dargestellt. Die ETA-Schnellaktionen wechseln von einer Segmentauswahl zu einem Select-Feld; die Navigation wird zu einem mobilen Menü.

## Eingabefelder

### Konfiguration

Die Werte werden im Normalzustand als anklickbare Werte angezeigt. Nach Klick erscheinen Inline-Eingabe sowie Speichern- und Abbrechen-Schaltfläche.

| Feld | Typ | Grenzen/Schritt | Einheit | Verhalten |
|---|---|---:|---|---|
| Solltemperatur | Zahl | 10–25 / 0,5 | °C | Inline bearbeiten und speichern |
| Delta Override | Schalter | Auto/Manuell | – | aktiviert eine manuelle Deltatemperatur |
| Deltatemperatur | Zahl | -10–10 / 0,5 | °C | zeigt abhängig vom Override Roh- oder gedämpften Wert |
| Minimumtemperatur | Zahl | 10–25 / 0,5 | °C | Inline bearbeiten und speichern |
| Updates | Zahl | 0–10 / 0,5 | min | wird intern in Millisekunden gespeichert |
| Manual override | Zahl | 0–1440 / 1 | min | Dauer eines manuellen Heizmodus |
| ETA Server | Text | – | – | Serveradresse, Platzhalter `xxx.xxx.xxx.xxx:port` |

Zusätzlich werden nur lesbar angezeigt: Countdown bis zum nächsten Update, empfohlene Schieberposition mit Fortschrittsbalken sowie die Pfade der ETA-, WIFIAF83- und NAMES2ID-Konfiguration.

### ETA-Steuerung im aktuellen Code

- Desktop: Segmentauswahl mit `Heizen`, `Kommen`, `Auto`, `Gehen`, `Absenken`.
- Mobil: Select-Feld mit denselben fünf Modi.
- Für jeden Modus existiert zusätzlich ein eigener Switch.
- Bei aktivem manuellem Override erscheint eine Restzeitanzeige mit `Override beenden`.

Alle fünf Auswahlwege führen auf dieselbe bestehende Heizmodus-Aktion. `Auto` beendet den manuellen Override, die anderen Modi starten ihn.

Die obere Segmentauswahl beziehungsweise das mobile Select und die fünf unteren Switches rufen jeweils `handleButtonClick(key)` auf. Sie haben damit dieselbe Funktion und bilden denselben exklusiven ETA-Modus doppelt ab.

### WiFi-Kanalnamen

Im Tab `Kanäle` ist jeder Kanalname per Klick oder Tastatur editierbar. Im Bearbeitungszustand erscheinen:

- Textfeld,
- Speichern (`✓`),
- Abbrechen (`✗`).

### Heiz-Zeitfenster

Für Montag bis Sonntag gibt es jeweils bis zu drei Zeitfenster:

- Startzeit als `time`-Eingabe in 15-Minuten-Schritten,
- Endzeit als `time`-Eingabe in 15-Minuten-Schritten,
- `Sync`-Checkbox pro Fenster,
- Speichern (`✓`) oder gemeinsames Speichern synchronisierter Fenster (`✓✓`),
- grafische 24-Stunden-Timeline mit verschiebbaren Zeitblöcken und Griffen.

`00:00–00:00` steht für ein inaktives Fenster. Nicht überlappende Grenzen und „Ende nach Beginn“ bleiben funktionale Anforderungen.

## Buttons und Navigation

### Globaler Header

- Markenlink `ETA Control` zur Startseite,
- `ETA Menü` mit dynamisch geladenen ETA-Menüpunkten und Popup,
- Links `Home`, `Raw Eta Data`, `System Logs`, `Weather`,
- mobil: Öffnen/Schließen des Hauptmenüs sowie die ETA-Menüpunkte im Drawer.

### Inhaltsaktionen

- ETA-Modus: fünf Schnellaktionen und fünf Modus-Switches,
- `Override beenden`,
- Konfigurationswerte: Bearbeiten durch Klick, `✓` Speichern, `✗` Abbrechen sowie eigene Plus-/Minus-Spinner,
- ETA-Detailtab: Aktualisieren,
- ETA- und WiFi-Kategorien: je ein Tab-Button,
- Kanalname: Bearbeiten, Speichern, Abbrechen,
- Zeitfenster: Speichern einzeln oder synchronisiert,
- Footer-Link `Weather`.

## Darstellungen und Zustände

### Übersicht

- Innentemperatur mit Bewertung gegen Minimum,
- Außentemperatur,
- Differenz Indoor/Soll mit Vorzeichenbedeutung,
- Schaltzustand,
- Schieberposition als Prozentwert und Balken,
- ETA- gegenüber WiFi-Außentemperatur und deren Differenz,
- Delta-Berechnung `automatisch` oder `manuell`,
- Betriebsmodus `Auto` oder `Manuell`,
- Zeitpunkt der letzten WiFi-Aktualisierung.

### ETA-Karte

- ETA-Logo und Überschrift,
- Override-Warnung mit sekundengenauer Restzeit,
- aktuelle ETA-Werte in fester Reihenfolge: Schieberposition, Außen-, Kessel- und Vorlauftemperatur, Heizkurve, Pelletbehälter, Vorrat, Schaltzustand und Ein/Aus-Taste,
- fünf Moduszustände als `EIN`/`AUS` plus Switch,
- Skeleton beim initialen Laden und Aktualisierungshinweis bei vorübergehend leerem Store,
- Toasts für Erfolg und Fehler.

### WiFi-Karte

- Außen- und Innentemperatur,
- Differenz Indoor/Soll,
- Differenz Minimum/Indoor,
- Datum und Uhrzeit des letzten Updates,
- Skeleton beim Laden.

### Detailtabs

- ETA: dynamische Kategorien aus dem ETA-Menü, Icons, Werte, Lade-/Fehlerzustände, Aktualisieren und Zeitstempel.
- WiFi: `Außen`, `Innen`, `Kanäle`, `Solar & UVI`, `Niederschlag`, `Wind`, `Luftdruck`, `Batterie`; Messwertkarten und editierbare Kanalnamen.
- Zeitfenster: Tagesgruppen, Timeline, nummerierte Fenster, Eingaben, Sync und Speicherzustand; Warnung, wenn keine Heizzeiten gefunden werden.

## Probleme der aktuellen visuellen Struktur

1. **Gleichgewichtete Karten trotz unterschiedlicher Wichtigkeit.** Heizmodus und kritische Temperaturen konkurrieren mit Serverpfaden und Detaildaten um Aufmerksamkeit.
2. **Doppelte Information ohne klare Ebenen.** Übersicht, ETA-Karte und WiFi-Karte wiederholen Temperaturen; die Wiederholung ist funktional sinnvoll, aber visuell nicht als „Entscheidung“, „Steuerung“ und „Quelle“ getrennt.
3. **Uneinheitliche Sprache und Benennung.** Deutsch und Englisch werden gemischt (`Configuration`, `ETA Data`, `WiFi Data`, `Manual override`, `Last Update`).
4. **Versteckte Editierbarkeit.** Anklickbare Werte sehen teilweise wie reine Badges oder Text aus. Ein Bearbeiten-Symbol und konsistente Hover-/Focus-Zustände fehlen.
5. **Mehrere konkurrierende ETA-Modusbedienungen.** Segmentauswahl und fünf Switches steuern dieselbe exklusive Auswahl; Switches vermitteln fälschlich, mehrere Modi könnten gleichzeitig aktiv sein.
6. **Statusfarben sind nicht systematisch.** Blau, Grün, Orange und Rot stehen je nach Stelle für Messrichtung, Erfolg, Warnung oder Modus. Text und Icon sollten die Bedeutung zusätzlich tragen.
7. **Große Logos verdrängen Nutzdaten.** Drei Bildflächen mit 125–150 px Höhe erhöhen die Scrollstrecke, ohne bei wiederholter Nutzung Information hinzuzufügen.
8. **Detailkarten verwenden feste helle Tailwind-Farben.** Klassen wie `bg-white`, `text-gray-900` und `bg-gray-50` verhindern einen vollständigen Dark Mode.
9. **Konfiguration ist zu lang für eine Primärkarte.** Häufige Regelwerte und seltene technische Pfade sind nicht getrennt.
10. **Header hat keinen Systemzustand.** Ob Daten aktuell sind, wird erst in einzelnen Karten sichtbar.

## Modernes, funktionsgleiches Design

### Informationshierarchie

- **Ebene 1 – Anlagenzustand:** kompakte Statusleiste und sechs KPI-Kacheln ganz oben.
- **Ebene 2 – unmittelbare Steuerung:** ETA-Heizmodus als prominenteste Karte; die fünf vorhandenen Switches bilden allein die exklusive Auswahl.
- **Ebene 3 – Regelparameter:** kompakte Konfigurationskarte mit deutlich erkennbaren Editieraktionen.
- **Ebene 4 – Quellenwerte:** ETA- und WiFi-Werte in ruhigen Tabellenzeilen.
- **Ebene 5 – Details:** ETA-/WiFi-Tabs und Wochen-Zeitplan als große Arbeitsbereiche unterhalb des ersten Viewports.

Die obere Segmentleiste wurde nach Prüfung entfernt: Sie und die unteren Switches führen dieselbe Aktion aus. Die fünf Switches bleiben als einzige Bedienung erhalten und werden als `ETA-Heizmodus` bezeichnet. Der aktive Modus ist zusätzlich zu seiner Schalterstellung farblich markiert. Damit entfällt die Doppelbedienung, ohne eine Steuerfunktion zu verlieren.

### Theme-System nach phi-spaces

Das Mockup übernimmt das phi-spaces-Prinzip:

- `data-mode="dark|light"` auf dem Wurzelelement,
- Modusschalter `☾` / `☀`,
- separate Palettenauswahl,
- Farb-Tokens `--color-a`, `--color-b`, `--color-c`,
- daraus abgeleitete Flächen-, Linien-, Text- und Akzentfarben,
- Speicherung von Modus und Palette im Browser,
- initiale Auswahl aus gespeicherter Einstellung, sonst Systempräferenz.

Das Mockup enthält alle 14 aktuellen phi-spaces-Paletten. Für ETA Control wird `Jade-Mono` als gut passende Vorauswahl gezeigt: Grün steht hier für Energiefluss und aktiven Betrieb, ohne Warn- oder Fehlerzustände zu übernehmen.

Statusfarben bleiben unabhängig von der Palette:

- Grün: normal/aktiv/erfolgreich,
- Gelb: Override, Aufmerksamkeit oder verzögerte Daten,
- Rot: Fehler oder kritischer Zustand,
- Akzentfarbe: Auswahl, Fokus, editierbares Feld und neutrale Datenvisualisierung.

### Komponentenregeln

- Zahlen verwenden tabellarische Ziffern und höhere visuelle Priorität als Labels.
- Karten besitzen einheitlichen Radius, Rand, Innenabstand und Kopfbereich.
- Editierbare Werte erhalten Stift-Icon, Fokusrahmen und Tooltip; reine Werte nicht.
- Icons ergänzen Text, ersetzen ihn bei wichtigen Aktionen nicht.
- Jede Statusfarbe wird durch Text, Symbol oder Form ergänzt.
- Touch-Ziele sind mindestens 44 × 44 px.
- Skeleton, leer, lädt, Fehler und deaktiviert werden in beiden Modi explizit gestaltet.
- Alle festen Hellfarben werden durch semantische CSS-Variablen ersetzt.

## Responsive Verhalten

- **ab 1180 px:** KPI-Zeile, zwei Hauptspalten; ETA-Steuerung breiter als Konfiguration/WiFi; Detailbereich zweispaltig.
- **760–1179 px:** zwei KPI-Spalten/Auto-Fit, Hauptkarten untereinander oder 1:1; Tabs horizontal scrollbar.
- **unter 760 px:** eine Spalte, kompakter Header, Navigation im Drawer, Theme-Palette als Select, Modusauswahl als Select oder horizontal scrollbar.
- Zeitfenster behalten ihre 44-px-Eingaben und werden nicht in eine schwer bedienbare Mini-Timeline gezwungen.

## Umsetzungsreihenfolge ohne Funktionsänderung

1. Theme-Tokens und gespeicherten Dark/Light-/Palettenzustand ergänzen.
2. feste `gray`-/`white`-Farben in den Startseitenkomponenten durch semantische Tokens ersetzen.
3. Header um Anlagenzustand und Theme-Steuerung erweitern.
4. existierende Komponenten nur per Layout/CSS in die neue Hierarchie setzen; API-Handler und Redux-Flüsse unverändert lassen.
5. Logos auf kleine Marken-Icons reduzieren, Alt-Texte beibehalten.
6. Editierbarkeit, Fokus, Tastaturbedienung und Fehlermeldungen visuell vereinheitlichen.
7. visuelle Regressionen für Dark/Light, Desktop/Mobil sowie Laden/Fehler/Override prüfen.

## Abnahmekriterien

- Alle oben inventarisierten Felder, Buttons, Links, Tabs, Switches, Zeitfenster und Zustände bleiben erreichbar.
- Kein API-Pfad, Payload, Redux-State oder Kontrollalgorithmus wird verändert.
- Modus und Palette bleiben nach Reload erhalten; ohne gespeicherte Auswahl gilt die Betriebssystempräferenz.
- Textkontrast erfüllt mindestens WCAG AA; Fokus ist in allen Paletten sichtbar.
- Desktop, Tablet und Mobil enthalten dieselben Funktionen.
- Override, aktiver ETA-Modus, Lade-/Fehlerzustände und deaktivierte Speicherbuttons sind auch ohne Farbe erkennbar.
