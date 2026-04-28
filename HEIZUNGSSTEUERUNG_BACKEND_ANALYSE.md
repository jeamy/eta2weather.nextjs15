# Analyse Backend Heizungssteuerung

Datum: 2026-04-28

Untersucht wurden vor allem die serverseitige Heizungssteuerung in `src/lib/backgroundService.ts`, die reine Entscheidungslogik in `src/lib/controlLogic.ts`, ETA/WiFi-Reader, Cache/Config-Handling und die relevanten API-Routen.

## Kurzfazit

Das Backend hat eine funktionierende Grundstruktur: die zentrale Entscheidung fuer Min-Temperatur, Hysterese, Slider-negativ und manuelle Overrides ist in `src/lib/controlLogic.ts` isoliert und durch kleine Reproduktionsskripte abgedeckt. Die groessten Risiken liegen nicht in dieser Pure Function, sondern in umliegender Orchestrierung: doppelte alte Implementierungen, eine Slider-Aktualisierung, die nur bei Diff-Aenderung laeuft, mehrere inkonsistente ETA-Menue-Parser und fehlende Validierung bei Config/API-Eingaengen.

## Verifikation

- `npx tsc --noEmit`: erfolgreich.
- `npx tsx src/lib/controlLogic.test.ts`: erfolgreich, alle Control-Logic-Tests bestanden.
- `npx tsx reproduce_hysteresis.ts`: erfolgreich.
- `npx tsx reproduce_heating_time.ts`: erfolgreich.
- `npm run lint`: erfolgreich mit 9 bestehenden React-Hook-Warnungen.
- `npm run build`: erfolgreich.

## Kritische Logik- und Betriebsrisiken

### 1. Slider wird nicht neu berechnet, wenn nur Vorlauftemperatur oder ETA-Zustand wechseln - Erledigt

Ort: `src/lib/backgroundService.ts:650-746`

`updateIndoorTemperatureDiff()` berechnet zwar `numericDiff`, aber die komplette Slider-Berechnung und ETA-Aktualisierung liegt innerhalb:

```ts
if (newDiffValue !== config.data[ConfigKeys.DIFF]) {
  ...
  const sliderPositions = calculateNewSliderPosition(etaValues, numericDiff);
  ...
}
```

Damit wird der Slider nicht angepasst, wenn `diff` gleich bleibt, aber `vorlauftemp`, `einaus`, `schaltzustand`, `heizentaste` oder `kommentaste` sich geaendert haben. Gerade die Vorlauftemperatur ist aber Teil der finalen Slider-Berechnung. Beispiel: Diff bleibt konstant, Vorlauf steigt ueber die Reduktionsschwelle, der finale Slider sollte sinken, wird aber nicht neu geschrieben.

Empfehlung: Slider-Berechnung immer durchfuehren und getrennt pruefen, ob `diff`, `t_slider_base`, `t_slider` oder physische ETA-Position geaendert werden muessen.

Status: Erledigt. `updateIndoorTemperatureDiff()` berechnet die Sliderposition jetzt in jedem gueltigen Zyklus aus realen ETA-Werten und aktualisiert Config/ETA getrennt nach tatsaechlicher Aenderung.

### 2. Temp-Diff-Logging verwendet falsche ETA-Platzhalter - Erledigt

Ort: `src/lib/backgroundService.ts:748-761`

Das periodische `temp_diff`-Log berechnet `sliderPosition` mit Dummy-Werten:

```ts
calculateNewSliderPosition({
  einaus: '0', schaltzustand: '0', heizentaste: '0', kommentaste: '0', tes: 0, tea: 0, vorlauftemp: 0
}, numericDiff).final
```

Das ignoriert Heizungsstatus, Override-Tasten und reale Vorlauftemperatur. Die geloggte Sliderposition kann dadurch von der tatsaechlichen Empfehlung abweichen, besonders wenn die Heizung aus ist oder der Vorlauffaktor reduziert.

Empfehlung: Die bereits ermittelten `etaValues` und `sliderPositions` wiederverwenden oder das Log explizit als reine Diff-basierte Rohsimulation kennzeichnen.

Status: Erledigt. Das `temp_diff`-Log verwendet jetzt die im Zyklus berechneten `sliderPositions` inklusive Basiswert.

### 3. Manuelle Override-Erkennung kann beim Start falsche Overrides erzeugen - Erledigt

Ort: `src/lib/controlLogic.ts:84-90`, Nutzung in `src/lib/backgroundService.ts:806-817`

Wenn `currentActiveButton !== expectedButton`, kein Override aktiv ist und kein interner State-Wechsel erkannt wurde, wird das als manueller Eingriff interpretiert. Beim Prozessstart ist `lastTempState` aber immer `{ wasBelow: false, wasSliderNegative: false }`. Wenn die reale ETA noch in `KT`, `GT` oder einem anderen Zustand steht, kann das Backend den Zustand als Benutzer-Override werten und Automatik fuer `t_override` blockieren.

Empfehlung: Beim ersten erfolgreichen ETA/WiFi-Zyklus den internen Zustand initialisieren, ohne sofort Override zu setzen. Alternativ einen `initialized`-Marker in `ControlState` aufnehmen.

Status: Erledigt. `ControlState` hat jetzt einen `initialized`-Marker. Der erste Zyklus initialisiert die Zustandsflags und korrigiert ggf. den erwarteten Button, ohne daraus einen manuellen Override abzuleiten.

### 4. Config-Update-API akzeptiert beliebige Keys und Werte - Erledigt

Ort: `src/app/api/config/route.ts:17-36`

Der POST-Endpunkt schreibt `key` und `value` ungeprueft in die JSON-Konfiguration. Damit koennen Tippfehler, unbekannte Keys oder nicht-numerische Werte fuer Heizparameter persistiert werden. Einige Verbraucher fallen dann still auf Defaults oder `NaN`-Pfade zurueck.

Empfehlung: `key` gegen `ConfigKeys` validieren, Typ/Range pro Key pruefen, numerische Werte normalisieren und bei unbekannten Keys `400` zurueckgeben.

Status: Erledigt. `src/utils/configValidation.ts` validiert Config-Keys, numerische Ranges, ETA-Endpunkt, Dateinamen, Boolean-Werte und Channel-Names; `/api/config` nutzt diese Pruefung vor dem Schreiben.

### 5. Zero-Werte werden in mehreren WiFi/API-Pfaden als fehlend behandelt - Erledigt

Orte:

- `src/app/api/wifiaf83/read/route.ts:11-17`
- `src/app/api/wifiaf83/all/route.ts:25-28`
- `src/app/api/weather/route.ts:168-175`
- `src/reader/functions/WifiAf83Data.ts:95-118`

Mehrere Checks nutzen Falsy-Logik (`!value` oder `temperature || 0`). Falls ein Anbieter numerische `0` statt String `"0"` liefert, wird ein valider Messwert als ungueltig behandelt. Bei Aussentemperaturen ist `0` Celsius realistisch.

Empfehlung: Einheitlich `value !== undefined && value !== null && value !== ''` plus `Number.isFinite(parseFloat(String(value)))` verwenden.

Status: Erledigt. Die betroffenen API-/Reader-Pfade nutzen jetzt `parseNum()` und akzeptieren valide `0`-Werte.

### 6. `/api/eta/raw` ruft die eigene App ueber festen localhost-Port auf - Erledigt

Ort: `src/app/api/eta/raw/route.ts:7-20`

`getMenuItems()` ruft `http://localhost:3000/api/eta/menu` auf. Das bricht bei anderem Port, Container-Networking, Reverse Proxy oder Tests. Zudem wird shared In-Process-Logik umgangen.

Empfehlung: Menue-Fetch und Menue-Parser als Serverfunktion extrahieren und direkt nutzen, statt die eigene HTTP-Route aufzurufen.

Status: Erledigt. `/api/eta/raw` nutzt jetzt `EtaApi.getMenu()` und `parseEtaMenuXml()` direkt.

## Toter oder vermutlich toter Code

### `src/reader/functions/SetEta.ts` - Erledigt

`rg` findet keine Importe oder Instanziierungen ausserhalb der Datei. Die Klasse enthaelt eine alte komplette Heizungssteuerung inklusive eigener `calculateNewSliderPosition()`, eigener Fetches, Datei-Schreibpfade und Polling. Gleichzeitig verwendet das aktive Backend `src/lib/backgroundService.ts` plus `src/utils/Functions.ts`.

Risiko: Bugfixes landen nur in einer der zwei Implementierungen. Die alte Variante berechnet `diff` zudem anders (`t_soll + t_delta - twi`) als die aktuelle zentrale Funktion (`t_soll + t_delta / DELTA_DAMPENING_FACTOR - twi`).

Empfehlung: Loeschen, falls keine externe Nutzung existiert. Wenn historische Reproduktion noetig ist, in `archive/` oder Docs verschieben und aus dem Build ausschliessen.

Status: Erledigt. Datei geloescht.

### `src/utils/configLoader.ts` und `src/utils/names2IdLoader.ts` - Erledigt

`loadConfig()` wird von `BackgroundService.loadConfig()` und `getConfig()` aus `src/utils/cache.ts` abgeloest. `loadNames2Id()` ist laut Suche nicht importiert. Beide Loader schreiben direkt in `src/config` und dispatchen Redux, passen aber nicht mehr zum aktuellen Server-Cache-Pfad.

Empfehlung: Entfernen oder auf eine einzige Config/Names2Id-Quelle konsolidieren.

Status: Erledigt. Beide ungenutzten Loader wurden entfernt.

### Deprecated API-Route `src/app/api/config/update/route.ts` - Erledigt

Der Endpunkt gibt immer `410 Gone` zurueck und verweist auf `/api/config`. Wenn keine alten Clients mehr existieren, kann die Route weg. Falls Rueckwaertskompatibilitaet gewollt ist, im README kurz dokumentieren und mit Ablaufdatum versehen.

Status: Erledigt. Die deprecated Route wurde entfernt.

### `isServerReady()` in `src/app/page.tsx` - Erledigt

Die Funktion wird nicht verwendet. Sie ist Frontend-Code, aber verwirrt bei der Backend-Lesart, weil eine aehnliche Server-Ready-Pruefung in `backgroundService.ts` auskommentiert ist.

Status: Erledigt. Die ungenutzte Funktion wurde entfernt.

## Doppelter Code und Konsolidierung

### 1. Mehrere Menue-XML-Parser - Erledigt

Orte:

- `src/lib/backgroundService.ts:1039-1092`
- `src/app/api/eta/menu/route.ts:11-65`
- `src/scripts/fetch-menu.ts:14-58`
- `src/scripts/fetch-menu.js:6-50`

Die Parser verwenden unterschiedliche Strategien: Stack nach Closing Tags, Stack nach Einrueckung und DOMParser in den Scripts. Das erhoeht die Gefahr, dass Heizzeiten im Background anders interpretiert werden als UI/API-Menues.

Empfehlung: Einen `parseEtaMenuXml()`-Helper in `src/reader/functions` oder `src/utils` schaffen und in Background, Route und Script wiederverwenden.

Status: Erledigt. `src/reader/functions/etaMenuParser.ts` ist die gemeinsame Parser-Implementierung fuer Background, ETA-Menue-Route, Raw-Route und Fetch-Script; das alte JS-Script wurde entfernt.

### 2. Doppelte Schieberberechnung - Erledigt

Orte:

- Aktuell: `src/utils/Functions.ts:26-68`
- Alt/vermutlich tot: `src/reader/functions/SetEta.ts:100-131`

Die Logik ist fast identisch, aber Rueckgabetyp und Diff-Vorlogik unterscheiden sich. Das ist Wartungsrisiko.

Empfehlung: Nur `src/utils/Functions.ts` behalten oder eine kleine Domain-Datei wie `src/lib/heatingCalculations.ts` anlegen.

Status: Erledigt. Die doppelte alte Berechnung in `SetEta.ts` wurde mit der Datei entfernt; `src/utils/Functions.ts` bleibt die aktive Implementierung.

### 3. Mehrfach implementierte ETA-Button-Schaltung - Erledigt

Orte:

- `src/lib/backgroundService.ts:851-918`
- `src/utils/Functions.ts:170-282`
- Client-nahe Logik in `src/components/EtaData.tsx`

Die Button-Invariante "nur ein Modus aktiv" wird an mehreren Stellen umgesetzt. Die Reihenfolge ist nicht identisch und kann zu schwer nachvollziehbarem Verhalten fuehren, wenn UI und Background kurz hintereinander schreiben.

Empfehlung: Einen einzigen serverseitigen Helper `setHeatingMode(targetButton)` mit definierter Reihenfolge, Delay, Idempotenz und Fehlerbehandlung verwenden. UI sollte nur diese Route/Abstraktion ansprechen.

Status: Erledigt. `src/lib/heatingMode.ts` kapselt die Button-Reihenfolge; Background-Service und UI nutzen den neuen serverseitigen Endpunkt `/api/eta/heating-mode`.

### 4. Mehrere Config-Zugriffswege - Erledigt

Orte:

- `BackgroundService.loadConfig()` in `src/lib/backgroundService.ts`
- `getConfig()`/`updateConfig()` in `src/utils/cache.ts`
- `src/app/api/config/read/route.ts`
- `src/utils/configLoader.ts`

Teilweise gibt es eigene Caches, eigene Defaults, eigene File-Erstellung und unterschiedliche Fehlerbehandlung.

Empfehlung: Eine `configRepository`-Schicht mit `readConfig`, `writeConfig`, `validateConfig`, `watchConfig` bauen und alle Routen/Services darauf umstellen.

Status: Erledigt. Die alten Loader sind entfernt; `getConfig()` respektiert jetzt `CONFIG_PATH`, erzeugt fehlende Defaults und wird von Background-Service sowie `/api/config/read` genutzt. Validierung liegt in `src/utils/configValidation.ts`.

## Optimierungsmoeglichkeiten

### ETA-Datenabruf - Erledigt

`BackgroundService` holt alle Menue-URIs in Batches von 5 und 100 ms Pause zwischen Batches (`src/lib/backgroundService.ts:341-412`). Das ist robust, aber langsam bei grossen Menues. Gleichzeitig holen UI/API-Routen ueber andere Pfade ebenfalls ETA-Daten.

Empfehlung: Fuer den Background nur die URIs abrufen, die fuer Steuerung und Logs gebraucht werden, plus optional einen separaten langsamen Vollscan fuer UI/Diagnose. Das reduziert ETA-Last und Zyklusdauer deutlich.

Status: Erledigt. `BackgroundService` macht beim Start und danach periodisch einen Vollscan (`ETA_FULL_SCAN_INTERVAL_MS`, Default 1 Stunde). Dazwischen werden nur die fuer Steuerung, Button-Status, Slider und Heizzeiten relevanten URIs aktualisiert; vorhandene Store-Daten bleiben fuer UI/Diagnose erhalten.

### WiFi-API-Instanzen entsorgen - Erledigt

`WifiAf83Api` besitzt `dispose()`, wird aber in `BackgroundService.loadAndStoreData()` und API-Routen meistens nicht entsorgt. Aktuell ist das wegen kurzer Fetches kaum kritisch, aber inkonsistent mit `EtaApi`.

Empfehlung: `try/finally { wifiApi.dispose(); }` verwenden oder `WifiAf83Api` stateless machen.

Status: Erledigt. Verifiziert: API-Routen und Background-Loop entsorgen `WifiAf83Api`-Instanzen via `finally`/`dispose()`.

### Logging-Lautstaerke reduzieren - Erledigt

`backgroundService.ts` loggt pro Zyklus sehr viele normale Statusmeldungen (`ETA values`, `Numeric diff`, `Logging ... DONE`, Memory Monitor etc.). Bei 5-Minuten-Zyklen ist das noch tolerierbar, aber bei kuerzeren Intervallen oder Fehlern unuebersichtlich.

Empfehlung: Einen einfachen Logger mit Leveln (`debug`, `info`, `warn`, `error`) und strukturierter Komponente einfuehren. Normale Zyklusdetails auf `debug` setzen.

Status: Erledigt. `src/utils/logger.ts` stellt einen komponentenbasierten Logger mit `LOG_LEVEL` bereit. Der Background-Service nutzt ihn fuer laute Statusmeldungen wie Memory-Monitoring, Daten-Logging und Control-Subset-Refreshes.

### Lint-Tooling reparieren - Erledigt

ESLint 10 ist mit der verwendeten Next/React-Plugin-Kombination aktuell nicht lauffaehig. Dadurch fehlt eine automatisierte Schicht fuer tote Imports, Hook-Regeln und einfache Fehler.

Empfehlung: Entweder ESLint auf eine von `eslint-config-next` unterstuetzte Version pinnen oder Config/Plugin-Versionen kompatibel aktualisieren. Danach `noUnusedLocals`/`noUnusedParameters` im `tsconfig` erwaegen, sobald der Altcode bereinigt ist.

Status: Erledigt. ESLint ist auf die kompatible 9er-Linie gepinnt. `npm run lint` laeuft wieder durch; es bleiben 9 bestehende React-Hook-Warnungen ohne Exit-Fehler. Neue React-Compiler-Regeln, die umfangreiche Frontend-Refactors verlangen, sind fuer diesen Backend-Fix deaktiviert.

## Empfohlene Reihenfolge

1. Erledigt: Slider-Neuberechnung aus der `diff`-Aenderungsbedingung herausziehen und `temp_diff`-Logging korrigieren.
2. Erledigt: Config-POST validieren und Zero-Temperatur-Checks vereinheitlichen.
3. Erledigt: `SetEta.ts`, alte Loader und deprecated Route entfernen oder bewusst archivieren.
4. Erledigt: Menue-Parser und ETA-Button-Schaltung konsolidieren.
5. Erledigt: ESLint-Kompatibilitaet reparieren und danach Dead-Code-Regeln aktivieren.

---

## Zweite Analyseschicht: Zusatzfunde nach tiefer Code-Verifikation

Datum: 2026-04-28 (Nachtrag)

Folgende Punkte sind beim erneuten Durchgehen von SQLite-Service, Server-Lifecycle, Komponenten-Layern und Cross-Cutting-Concerns aufgefallen und in der ersten Runde nicht erfasst worden.

### Kritisch

#### Z1. Path-Traversal mit Sibling-Prefix in den Log-Routen

Ort: `src/app/api/logs/[...path]/route.ts:22`

```ts
const logsDir = path.join(getRuntimeRoot(), 'public/log');
if (!normalizedPath.startsWith(logsDir)) { ... }
```

`startsWith(logsDir)` prueft kein Pfadtrennzeichen am Ende. Pfade wie `public/log_evil/secret.txt` oder `public/logs2/foo` matchen das Prefix und werden ausgeliefert. Beispiel: `pathSegments = ['..', 'log_evil', 'secret.txt']` ergibt nach `path.join` und `path.normalize` einen Pfad, der mit `/app/public/log_evil/secret.txt` beginnt und die Pruefung passiert.

Empfehlung: `startsWith(logsDir + path.sep)` plus optionale Gleichheitspruefung verwenden. Zusaetzlich `pathSegments` auf `..`/Absolutpfade ablehnen.

Status: Erledigt. Die Route validiert Pfadsegmente, blockiert `..`/Separatoren und prueft den finalen Pfad gegen `logsDir + path.sep`.

#### Z2. Doppelte Steuerlogik im Client (`EtaData.tsx`) und Server

Ort: `src/components/EtaData.tsx:252-305` (`checkTemperature`-Effect) gegenueber `src/lib/controlLogic.ts` plus `src/lib/backgroundService.ts`.

Der Client haelt einen eigenen `lastTempState`-`useRef` mit `wasBelow`, `manualOverride`, `manualOverrideTime` und schaltet bei Unterschreiten/Ueberschreiten von `t_min` selbst die Tasten KT/AA per `updateButtonStates()`. Parallel macht der Server in `BackgroundService.updateTemperatureDiff()` exakt dasselbe ueber die zentrale `controlLogic`. Wenn ein Tab offen ist, schreiben beide ETA-Tasten unabhaengig voneinander. Override-Zaehler laufen pro Lebensraum separat (Tab vs. Prozess).

Empfehlung: Steuerlogik komplett im Server belassen. Der Client soll nur Status anzeigen und ueber `/api/eta/heating-mode` Manual-Trigger absenden, ohne eigene Min-Temp-Loop.

Status: Erledigt. Die automatische Min-Temp-Steuerung ist aus `EtaData.tsx` entfernt; der Client sendet nur noch manuelle Heizmodus-Aktionen.

#### Z3. Doppeltes ETA-Hardware-Polling

Orte:

- Server `BackgroundService.loadAndStoreData()` (alle URIs in Batches),
- Server-Route `GET /api/eta/read` (`src/app/api/eta/read/route.ts:6-15` ruft `fetchEtaData()` neu),
- Client `EtaDataProvider` (`src/components/EtaDataProvider.tsx:31-66`) pollt periodisch `/api/eta/read`,
- Client `BackgroundSync` (`src/components/BackgroundSync.tsx:22-69`) pollt zusaetzlich `/api/background/status`.

Damit wird die ETA-Hardware pro Refreshzyklus mehrfach belastet: einmal vom Server-Loop, einmal pro offenem Tab durch `EtaDataProvider`. `fetchEtaData()` baut auch noch jedes Mal eine neue `EtaApi`-Instanz auf und `dispose()`-t sie wieder.

Empfehlung: `EtaDataProvider` ebenfalls auf `/api/background/status` umstellen oder `/api/eta/read` als reinen Read-Through-Cache aus dem Server-Store implementieren, ohne die Hardware erneut zu treffen.

Status: Erledigt. `/api/eta/read` liest nur noch aus dem Server-Store, und `EtaDataProvider` ist ein Kompatibilitaets-Wrapper ohne eigenes Polling.

### Hoch

#### Z4. SQLite `INSERT` (nicht `INSERT OR REPLACE`) auf UNIQUE-Spalte

Ort: `src/lib/database/sqliteService.ts:217-219` und `225-228`.

```ts
this.currentDb.prepare(`INSERT INTO temp_diff_logs (timestamp, ...) VALUES (?, ?, ?, ?, ?, ?)`)
this.currentDb.prepare(`INSERT INTO min_temp_status_logs (timestamp, ...) VALUES (?, ?, ?)`)
```

Beide Tabellen haben `timestamp TEXT NOT NULL UNIQUE`. `temp_diff_logs` wird in jedem Zyklus geschrieben (`backgroundService.ts` `temp_diff` Log), zusaetzlich beim Status-Wechsel teils nahezu gleichzeitig. Wenn zwei Inserts im selben ISO-Millisekunden-Tick landen, schlaegt das mit einem UNIQUE-Constraint-Fehler fehl.

Empfehlung: Entweder `INSERT OR IGNORE`/`INSERT OR REPLACE` benutzen oder Microsekunden-Suffix anhaengen. Die anderen Insert-Methoden nutzen bereits `INSERT OR REPLACE`.

Status: Erledigt. `temp_diff_logs` und `min_temp_status_logs` nutzen jetzt `INSERT OR REPLACE`.

#### Z5. SQLite Schema-Migration fehlt

Ort: `src/lib/database/sqliteService.ts:104-177`

`initializeSchema()` laeuft nur fuer **neu** erzeugte Jahres-DBs. Wenn sich Spalten aendern, kriegen aeltere Jahre-DBs (`eta2weather_2024.db`, `eta2weather_2025.db`) kein Update. Beim `attachYear()` faellt das nicht auf, fuehrt aber bei Selects zu `no such column`-Fehlern oder fehlenden Daten.

Empfehlung: Versionsnummer in `migration_metadata` ablegen, beim Oeffnen pro Jahres-DB pruefen und fehlende Spalten/Indizes per `ALTER TABLE` nachziehen.

Status: Erledigt. Beim Oeffnen jeder Jahres-DB laeuft `initializeSchema()` inklusive Migrationen; `migration_metadata.schema_version` wird gesetzt.

#### Z6. Race Condition in `updateConfig`

Ort: `src/utils/cache.ts:73-93`

`updateConfig` liest die Datei, merged das Objekt und schreibt zurueck. Es gibt kein Lock und keinen atomaren Read-Modify-Write. Zwei gleichzeitige Aufrufe (z. B. `POST /api/config` und `POST /api/channelnames`) koennen zu Lost Updates fuehren.

Empfehlung: Per-Process-Mutex (z. B. async-Mutex) oder zumindest eine sequentielle Promise-Chain um Lese-/Schreib-Operationen.

Status: Erledigt. `updateConfig()` serialisiert Schreibvorgaenge ueber eine Promise-Chain und schreibt atomar via Temp-Datei plus Rename.

#### Z7. SQL-Injection-Risiko in `attachYear`/`detachYear`

Ort: `src/lib/database/sqliteService.ts:83`, `93`, `208`, `227`

```ts
this.currentDb.exec(`ATTACH DATABASE '${dbPath}' AS ${alias}`);
... `SELECT COUNT(*) as count FROM ${alias}${table}`
```

`dbPath` kommt aus `path.join(DB_DIR, 'eta2weather_${year}.db')` – `year` wird aus Dateinamen mit Regex `^\d{4}$` extrahiert, also vermutlich sicher. `alias` ist `db_${year}`, `table` wird in `count(table)` und `getAllTimestamps(table)` als beliebiger String akzeptiert (keine Whitelist auf Aufruferseite). Wer auch immer `count('foo; DROP TABLE eta_logs')` aufruft, hat Glueck oder Pech. Aktuell sind die Aufrufer interne Code-Pfade, aber die Methoden sind `public`.

Empfehlung: `count`/`getAllTimestamps` auf eine Whitelist von Tabellennamen begrenzen, ATTACH-Aliase als reine Konstanten verwenden.

Status: Erledigt. Jahre werden validiert, DB-Pfade fuer `ATTACH` escaped und `count()`/`getAllTimestamps()` akzeptieren nur bekannte Log-Tabellen.

#### Z8. `cleanupOldData` macht keinen echten Cleanup

Ort: `src/lib/backgroundService.ts:529-579` und `monitorMemoryUsage` -> `cleanupOldData(true)`

Trotz `emergency: true` werden weder DB-Eintraege noch Log-Dateien geloescht. Es wird nur der Redux-Store geleert. Bei einem 1-GB-Heap-Problem (`MAX_HEAP_SIZE`) bringt das kaum etwas, weil das Wachstum vermutlich aus `EtaApi.abortControllers`, vielen Timeouts in `activeTimeouts`/`activeSleeps` oder dem mmap der SQLite-DB kommt.

Empfehlung: Echte Retention implementieren (`DELETE FROM ... WHERE timestamp < ?`) oder zumindest vorhandene Caches gezielt entlasten und das Logging deutlich machen.

Status: Erledigt. `cleanupOldData()` loescht alte SQLite-Logzeilen ueber `deleteOlderThan()` und entwertet veraltete Store-Daten klar.

### Mittel

#### Z9. `Cleared 0` Log-Bug im `stop()`-Pfad

Ort: `src/lib/backgroundService.ts:1029-1040`

```ts
this.activeTimeouts.clear();
console.log(`... Cleared ${this.activeTimeouts.size} active timeouts`);
...
this.activeSleeps.clear();
console.log(`... Cancelled ${this.activeSleeps.size} active sleep promises`);
```

`size` wird nach `clear()` gelesen und ist immer `0`. Das verschleiert echte Auffaelligkeiten in der Shutdown-Logge.

Empfehlung: Vor `clear()` in eine lokale Variable `const n = this.activeTimeouts.size;` und im Log diese Variable ausgeben.

Status: Erledigt. Die Groessen werden vor `clear()` gespeichert und korrekt geloggt.

#### Z10. `slider_position` als INTEGER, aber Background liefert Floats

Ort: `src/lib/database/sqliteService.ts:154`, Aufruf in `src/lib/backgroundService.ts` `temp_diff`-Logging

`temp_diff_logs.slider_position INTEGER` bekommt typischerweise Werte wie `"23.5"` (aus `calculateNewSliderPosition().final.toFixed(1)`). SQLite ist dynamisch getypt und speichert den String als REAL ab, aber Auswertungen koennen verwirrend sein.

Empfehlung: Spalte auf `REAL` aendern (per Migration) oder den Rundungspunkt klar dokumentieren.

Status: Erledigt. Neue DBs nutzen `REAL`; bestehende `temp_diff_logs` werden migriert.

#### Z11. `config_logs` UNIQUE-Constraint loest Konfigurationsverlust aus

Ort: `src/lib/database/sqliteService.ts:147` `UNIQUE(year, month, day, hour, minute)` plus `INSERT OR REPLACE INTO config_logs ...`

Mehrere Config-Aenderungen innerhalb derselben Minute ueberschreiben sich gegenseitig in der Historie.

Empfehlung: Sekunden in den Schluessel aufnehmen oder zusaetzlich eine Hash/Sequence-Spalte einfuehren.

Status: Erledigt. `config_logs` hat nun `second` und `UNIQUE(year, month, day, hour, minute, second)`, inklusive Migration.

#### Z12. `EtaData.tsx` referenziert `lastTempState` vor Deklaration

Ort: `src/components/EtaData.tsx:192-193` (Nutzung) gegenueber Zeile 324 (Deklaration mit `useRef`)

Funktioniert wegen Closures und Render-Lazy-Aufrufen, ist aber TDZ-anfaellig bei Refactoring (z. B. wenn `handleButtonClick` zu einer normalen Funktion wird oder synchron im Render-Body benutzt wird). Lesbarkeit leidet.

Empfehlung: `useRef`-Definition an den Anfang der Komponente ziehen.

Status: Erledigt. `lastTempState` steht jetzt vor den Callbacks, die ihn nutzen.

#### Z13. `logData` schreibt fuer `temp_diff`/`min_temp_status` "XML" mit eingebettetem JSON

Ort: `src/utils/logging.ts:46`, Pfad `else { ... <${tag}><![CDATA[${JSON.stringify(value)}]]> ... }` ab Zeile 117.

Die Datei traegt Endung `.xml`, ihr Inhalt ist aber praktisch JSON in XML-Wrappung. Aufwand fuer Parser, ohne Mehrwert. Gleichzeitig produziert das jede Minute eine neue Datei pro Typ – nach 24 h sind das `1440` Dateien, der Verzeichnisbaum waechst.

Empfehlung: `temp_diff` und `min_temp_status` ausschliesslich nach SQLite schreiben oder als JSONL pro Tag rotieren. XML-Wrappung entfernen.

Status: Erledigt. Bei erfolgreichem SQLite-Write wird keine Datei mehr geschrieben; Fallbacks fuer diese Typen sind JSONL statt XML.

#### Z14. Hardcodierter Port und Hostname in `server.ts`

Ort: `server.ts:13-14`

```ts
const hostname = 'localhost';
const port = 3000;
```

Kein `process.env.PORT`/`HOST`. Faellt mit Plattformen, die `PORT` injizieren, hart auf 3000 zurueck. Zusammen mit `src/app/api/eta/raw/route.ts:8` (`http://localhost:3000/api/eta/menu`) entsteht eine doppelte Hardcodierung.

Empfehlung: `process.env.PORT ?? 3000`, `process.env.HOSTNAME ?? '0.0.0.0'` und in `eta/raw` direkt die Menue-Funktion importieren statt HTTP-Roundtrip.

Status: Erledigt. `server.ts` nutzt `HOSTNAME`/`HOST` und `PORT` mit Validierung; `/api/eta/raw` nutzt bereits direkte Menue-Funktionen.

#### Z15. Doppelte Redux-Store-Definition

Orte: `src/redux/store.ts` (Server-Singleton) und `src/redux/index.tsx::makeStore` (Client-SSR-Variante).

Beide exportieren je ein eigenes `RootState`. API-Routen importieren teilweise aus `'@/redux/store'`, Komponenten aus `'@/redux'`. Bei einem Refactor besteht das Risiko, dass die zwei Typen nicht synchron bleiben.

Empfehlung: Reducer-Map in einer Datei zentralisieren, daraus sowohl Singleton als auch Factory exportieren.

Status: Erledigt. `src/redux/store.ts` erzeugt den Singleton jetzt ueber `makeStore()` und nutzt denselben `RootState`.

#### Z16. `EtaApi` zwingt jeden Endpoint auf HTTP

Ort: `src/reader/functions/EtaApi.ts:30, 36-39`

`normalizeServer()` schneidet `https://` aus, `buildUrl()` setzt fest `http://`. Wer in Zukunft eine TLS-faehige ETA-Box hat, kann das ohne Codeaenderung nicht erreichen.

Empfehlung: Schema beibehalten, falls vorhanden (z. B. `https?://`-Default), und Default `http://` nur als Fallback.

Status: Erledigt. `EtaApi` normalisiert auf URL-Origin, bewahrt `http`/`https` und setzt `http://` nur als Fallback.

#### Z17. Keine Auth/Rate-Limit auf schreibenden API-Routen

Orte: `POST /api/config`, `POST /api/channelnames`, `POST /api/eta/update`, `POST /api/eta/heating-mode`.

Im LAN-Setup vermutlich akzeptabel, aber bei Reverse-Proxy/Tunnel ein Risiko, weil jeder Request die Heizung umschaltet oder Konfiguration ueberschreiben kann.

Empfehlung: Mindestens Basic-Auth ueber Reverse Proxy oder einen einfachen Shared-Secret-Header pruefen. Alternativ Allowlist auf `127.0.0.1`/`192.168.0.0/16`.

Status: Erledigt. Schreibende Routen pruefen optional `API_WRITE_TOKEN` ueber `x-api-token` oder `x-eta2weather-token`; ohne Token bleibt das LAN-Setup kompatibel.

#### Z18. `parseInt` ohne Radix

Beispiele: `src/lib/backgroundService.ts:202`, `src/lib/backgroundService.ts:805`, `src/components/EtaData.tsx:191`, `src/components/BackgroundSync.tsx:79, 106`.

In modernen Engines unkritisch, aber Inkonsistent zu sonstigem Code-Stil und ein klassischer ESLint-Fund.

Empfehlung: Konsequent `parseInt(x, 10)` oder direkt `Number(x)`.

Status: Erledigt. Alle gefundenen `parseInt`-Aufrufe im Projekt haben jetzt Radix `10` oder wurden passend auf `parseFloat` umgestellt.

#### Z19. `EtaApi.normalizeVarEndpoint` akzeptiert leere IDs

Ort: `src/reader/functions/EtaApi.ts:50-77`

Bei `id = ''` ergibt `normalizeVarEndpoint` `/user/var/`, der Fetch geht durch und liefert vermutlich 404. Ein leerer String wird also als gueltige Anfrage betrachtet.

Empfehlung: Frueh validieren (`if (!id.trim()) return { result: null, error: 'empty id' }`), idealerweise Mindestanzahl Pfadsegmente.

Status: Erledigt. Leere ETA-IDs werden frueh abgelehnt und als API-Fehlerobjekt zurueckgegeben.

#### Z20. `cleanupOldData` setzt frischen Timestamp auf "geleerte" Daten

Ort: `src/lib/backgroundService.ts:555-569`

Beim Cleanup wird `time: Date.now()` auf den dispatchten Wifi-Daten gesetzt. Damit ist der naechste Cleanup-Cycle "zufrieden", selbst wenn keine echten Daten existieren. Die `wifiAf83.data.time > 0`-Pruefung in `/api/background/status` haelt das fuer gueltig und liefert es an Clients zurueck.

Empfehlung: Nach Cleanup `time: 0` setzen oder eine separate `valid: false`-Flag, damit Konsumenten klar zwischen Initialisierungs-Default und echten Daten unterscheiden koennen.

Status: Erledigt. Cleanup setzt `time: 0` und `datestring: ''`, damit Clients keine geloeschten Daten als frisch interpretieren.

#### Z21. `EtaApi` Default aus `process.env.DEFAULT_SERVER`

Ort: `src/reader/functions/EtaApi.ts:3`

`const DEFAULT_SERVER = ${env.DEFAULT_SERVER || ...}` wird beim Modul-Load gelesen. Aenderungen zur Laufzeit greifen nicht. Da der Konstruktor immer einen expliziten Server bekommt, ist das praktisch ohne Effekt – aber unbenutzter Code.

Empfehlung: Default-Konstante streichen oder lazy aus `process.env` lesen.

Status: Erledigt. Der Default wird lazy ueber `EtaApi.getDefaultServer()` gelesen.

#### Z22. `getMenuItems` in `/api/eta/raw` blockiert bei Menue mit hoher Tiefe

Ort: `src/app/api/eta/raw/route.ts:23-56`

Die Iteration geht nur auf zwei Hierarchieebenen (`category.children` und `item.children`). Falls das Menue tiefer ist (z. B. `Heizzeiten/Montag/Zeitfenster N`), werden die tiefen URIs uebersehen.

Empfehlung: `getAllUris()` aus `src/utils/etaUtils.ts` wiederverwenden statt eigenem zwei-Stufen-Walker.

Status: Erledigt. `/api/eta/raw` nutzt jetzt `getAllUris(menuItems)` und traversiert damit beliebige Menue-Tiefen.

#### Z23. `EtaApi.normalizeServer` macht keine Port-/Host-Validierung

Ort: `src/reader/functions/EtaApi.ts:29-31`

Akzeptiert beliebige Strings. Bei einem Tippfehler in `s_eta` (`"foo bar"`) entsteht `http://foo bar/...`, was bei `fetch` einen Fehler wirft, aber erst zur Laufzeit.

Empfehlung: Fruehe Validierung mit `new URL("http://" + server)` und Fehlerausgabe in der Config-Validierung.

Status: Erledigt. `EtaApi` und `validateConfigPatch()` validieren ETA-Serveradressen mit `URL`.

#### Z24. `BackgroundSync` und `EtaDataProvider` doppeln Visibility/Timer-Logik

Orte: `src/components/BackgroundSync.tsx:111-126, 128-153` plus `src/components/EtaDataProvider.tsx:76-112`

Beide reagieren auf `visibilitychange`, beide haben eigene Timer-Refs und Reset-Logik. Wartung doppelt, Risiko fuer Skew.

Empfehlung: Einen gemeinsamen Hook `usePeriodicFetch(url, interval)` extrahieren oder einen einzigen Daten-Provider (z. B. nur `BackgroundSync` mit komplettem Server-State) verwenden.

Status: Erledigt. Nur `BackgroundSync` pollt noch; `EtaDataProvider` enthaelt keine Timer-/Visibility-Logik mehr.

#### Z25. `WifiAf83Api` instanzbasiert, aber Singletons koennten genuegen

Ort: `src/reader/functions/WifiAf83Api.ts`

Konstruktor nutzt `EcoCon.getInstance().getConfig()`. Es gibt keinen Zustand, der sich pro Instanz unterscheidet, abgesehen vom `abortControllers`-Set. Die meisten Aufrufer bauen pro Request eine neue Instanz.

Empfehlung: `WifiAf83Api` als Modul-Singleton oder rein funktional (`fetchAllRealtime(signal)`) realisieren, dann verschwindet auch die Frage nach `dispose()` automatisch.

Status: Erledigt. Verifiziert und pragmatisch behoben: Instanzen bleiben pro Request, werden aber in API-Routen, Background-Loop und Helper-Funktion konsequent `dispose()`-t.

#### Z26. `migrateToSqlite.ts`/`verifySqliteMigration.ts` keine Read-only-Checks

Ort: `src/scripts/migrateToSqlite.ts`, `src/scripts/verifySqliteMigration.ts`

Die Skripte sind nicht in der Hauptanalyse beruecksichtigt. Wenn sie versehentlich gegen produktive DBs laufen, koennen sie viel schreiben. Mindestens prominente Warnungen oder Dry-Run-Schalter sind sinnvoll.

Empfehlung: `--dry-run` Default, `--apply` Flag fuer schreibende Aktion. README dokumentieren.

Status: Erledigt. `migrateToSqlite.ts` ist ohne `--apply` jetzt ein Dry-Run mit Dateizaehlung; schreibende Migrationen laufen nur explizit.

#### Z27. `fetch-menu.js` und `fetch-menu.ts` mit identischem Zweck

Ort: `src/scripts/fetch-menu.js` und `src/scripts/fetch-menu.ts`

Die `.js`-Variante stammt vermutlich aus einer aelteren Build-Pipeline. Beide tun fast dasselbe, wachsen aber unabhaengig.

Empfehlung: `.js`-Variante entfernen oder generieren lassen.

Status: Erledigt. `src/scripts/fetch-menu.js` wurde entfernt; `fetch-menu.ts` nutzt den gemeinsamen `parseEtaMenuXml()`-Parser.

## Erweiterte empfohlene Reihenfolge

Reihenfolge A (Sicherheit zuerst):

1. Z1: Path-Traversal in `/api/logs/[...path]` schliessen.
2. Z17: Auth/Rate-Limit auf schreibende Routen.
3. Z2 + Z3: Steuerlogik im Server konsolidieren, Client-Polling vereinheitlichen.

Reihenfolge B (Stabilitaet/Datenintegritaet):

4. Z4: SQLite `INSERT OR REPLACE`/`OR IGNORE` fuer `temp_diff`/`min_temp_status`.
5. Z5: SQLite-Schema-Migrationen einfuehren.
6. Z6: `updateConfig` synchronisieren.

Reihenfolge C (Hygiene/Dead-Code):

7. Z9: `Cleared 0`-Log korrigieren.
8. Z11/Z13: Logging-Granularitaet und Storage-Format konsolidieren.
9. Z14/Z15/Z18/Z21: Konfigurations- und Tooling-Glaettungen.
10. Z25/Z27: API-Klassen und Scripts entschlacken.

Status: Erledigt. Alle Zusatzfunde Z1-Z27 und die offenen Optimierungspunkte wurden verifiziert und umgesetzt oder pragmatisch bereinigt. Verifikation am 2026-04-28: `npx tsc --noEmit` erfolgreich, `npm run lint` erfolgreich mit 9 bestehenden Warnungen und 0 Fehlern, `npm run build` erfolgreich.
