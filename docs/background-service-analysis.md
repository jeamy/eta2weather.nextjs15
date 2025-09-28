# Background Service Analyse & ToDo

Datum: 2025-09-28

## Scope

Analysierte Teile:
- `src/lib/backgroundService.ts`
- `src/reader/functions/EtaApi.ts`, `src/reader/functions/WifiAf83Api.ts`
- `src/utils/cache.ts`, `src/utils/logging.ts`
- `src/components/BackgroundSync.tsx`, `src/components/ConfigData.tsx`, `src/components/EtaData.tsx`, `src/components/ZeitfensterTab.tsx`
- API-Routen: `src/app/api/**`
- Server-Bootstrap: `server.ts`

## Architektur-Überblick
- Start in `server.ts` via `BackgroundService.getInstance().start()`.
- `BackgroundService` lädt Config (Datei), watcht sie (`fs.watch` + Debounce), pollt ETA-Menü + Variablen in Batches (5er), pollt WiFi-AF83 (mit Cache+Fallback) und schreibt alles in den serverseitigen Redux-Store.
- Logging auf Disk unter `public/log/<type>/<yyyy>/<mm>/<dd>/` via `logData()`.
- Client hält sich mit `BackgroundSync` per `API.BACKGROUND_STATUS` synchron (nur `config` bei Veränderung, alle anderen Zustände immer).

## Findings

- **[Leak-Risiko: Timeout-Promises + kein Abort]**
  - `backgroundService.ts` → `loadAndStoreData()` → `fetchWithRetry()` nutzt `Promise.race` mit Timeout, aber ohne `clearTimeout` und ohne `AbortController`. Der Timeout-Timer bleibt bestehen und der originale `fetch` läuft im Hintergrund weiter.
  - Folge: Timer-/Handle-Leaks und potenziell offene HTTP-Verbindungen.

- **[Fehlender Request-Abbruch/Timeout in EtaApi]**
  - `EtaApi.fetchApi()` hat keine `AbortController`-Unterstützung; Timeouts werden nicht erzwungen. Gleiches gilt für `WifiAf83Api` (weniger kritisch, aber sinnvoll).

- **[Disk-Growth durch Logging]**
  - `src/utils/logging.ts` schreibt jede Runde auf Disk ohne Retention. Kein Memory-Leak, aber ungebremstes Logwachstum.

- **[Race-Potenzial beim Schalten von ETA-Buttons]**
  - `updateTemperatureDiff()` schaltet mehrere Buttons teils parallel (`Promise.all`) aus. Auf ETA-Seite kann das zu nicht-deterministischen Endzuständen führen.
  - Empfehlung: sequenziell und idempotent schalten (nur wenn Zustand wirklich geändert werden muss).

- **[Doppelte Slider-Updates (Server + Client)]**
  - Server: `updateIndoorTemperatureDiff()` ruft `updateSliderPosition()`.
  - Client (`ConfigData.tsx`): Effekt ruft ebenfalls `updateSliderPosition()`.
  - Beides nutzt eigene "last update"-Marker, aber unabhängig → Kollisionen möglich, besonders bei leicht veralteten `SP`-Werten.

- **[CPU-Overhead: Shortkey-Lookup]**
  - In `loadAndStoreData()` pro URI `Object.keys(defaultNames2Id).find(...)` (O(N) je Eintrag). Bei vielen URIs teuer – Map vorzugsweise vorberechnen.

- **[Re-Parsing Menü bei jedem Lauf]**
  - `getMenu()` + `parseMenuXML()` laufen jedes Intervall. Wenn Menü selten ändert, ist das unnötiger Overhead.

- **[Client-Fetch nicht abgebrochen]**
  - `BackgroundSync.tsx` bricht laufende Fetches beim Unmount/Interval-Neusetzung nicht explizit ab (UX/Netzwerk-Optimierung).

- **[API-Konstanten-Konsistenz]**
  - In `ConfigData.tsx` wird beim "Manual override" einmal `'/api/config'` hart-codiert (Zeile ~431). Sollte `API.CONFIG` sein (Konsistenz-Regel).

- **[Einheiten-Mismatch: t_override (ms vs. Minuten)]**
  - `ConfigData.tsx` speichert `t_override` in Millisekunden (Minuten × 60000).
  - `BackgroundService.updateTemperatureDiff()` interpretiert `t_override` als Minuten und multipliziert erneut mit 60.000.
  - `EtaData.tsx` behandelt `config.t_override` ebenfalls als Minuten.
  - Wirkung: Manuelle Override-Zeitfenster werden viel zu lang. Vereinheitlichen (empfohlen: immer ms in Config) und an allen Call-Sites korrekt umrechnen.

- **[Zwei Config-Update-Endpunkte]**
  - Es existieren `src/app/api/config/route.ts` (genutzt) und `src/app/api/config/update/route.ts` (redundant). Doppelte Pfade erhöhen die Verwechslungsgefahr.

- **[Dynamic Route params await]**
  - `src/app/api/logs/[...path]/route.ts` verwendet korrekt `params: Promise` und `await` (entspricht Best Practice/Memory-Hinweis).

## Zusammenspiel mit der GUI

- **[Buttons schalten]**
  - GUI (`EtaData.tsx`) schaltet Buttons via `API.ETA_UPDATE` sequenziell und validiert Zustand; BackgroundService kann ebenfalls schalten (Temperatur-Logik).
  - Handlungsbedarf: Invarianten (AA vs. manuelle Tasten) zentral im Server sicherstellen und Button-Schaltfolgen strikt sequenziell halten. GUI-Schalten bleibt, aber ohne parallele Massenschaltungen.

- **[Slider setzen]**
  - Doppelter Pfad (Server + Client). Empfehlung: Slider-Update zentral im Server durchführen, Client nur anzeigen. Dadurch weniger Kollisionen und klarere Verantwortlichkeiten.

- **[Konfiguration]**
  - GUI schreibt Config via `API.CONFIG` (Cache + Datei). BackgroundService pickt Änderungen via `fs.watch` auf und reinitialisiert ggf. `EtaApi`, passt Intervalle an.
  - Synchronität: `BackgroundSync` aktualisiert `config` nur bei Veränderung. Potenziell kann während der kurzen Latenz die Client-Config neuer sein als die Server-Config – kein funktionaler Konflikt. Optional: Client kann `lastConfigRef` direkt nach erfolgreichem POST synchronisieren.
  - Achtung: Einheiten-Mismatch bei `t_override`, siehe Findings. Führt zu überlangen Overrides; kurzfristig zu beheben.

- **[ZeitfensterTab]**
  - Nutzt `API.ETA_UPDATE` pro URI; UI ist bereits defensiv mit reduzierter Parallelität (`useEtaData` mit limitierter Concurrency). Keine akuten Race-Probleme im UI sichtbar.

## Empfehlungen (konkret)

1) Zeitgesteuerte Abbrüche + Cleanup
- [ERLEDIGT] `EtaApi.fetchApi()` um `AbortController` erweitert und optionales `signal` durchgereicht.
- [ERLEDIGT] In `backgroundService.fetchWithRetry()` werden Timeout-Timer gecleart und bei Timeout via `AbortController` abgebrochen.
- [Optional] `WifiAf83Api` ebenfalls mit Timeout/Abort ausstatten.

2) Button-Schaltlogik härten
- [ERLEDIGT] In `updateTemperatureDiff()` sind alle Schaltvorgänge strikt sequenziell und idempotent. Zusätzlich kurze Delays zwischen Gerät-Calls (Rate Control).

3) Slider-Update zentralisieren
- [ERLEDIGT] Client-Effekt in `ConfigData.tsx` entfernt. Slider-Regel komplett im `BackgroundService`.

3b) Config-Einheiten normalisieren (t_override)
- [ERLEDIGT] `t_override` einheitlich in Millisekunden in der Config; Server/Client verwenden ms konsistent.
- [ERLEDIGT] `BackgroundService.updateTemperatureDiff()` nutzt ms direkt.
- [ERLEDIGT] `EtaData.tsx` nutzt ms; Log-Ausgaben zeigen Minuten zur Lesbarkeit.

4) Performance-Verbesserungen
- [ERLEDIGT] `idToShortkey`-Map einmalig bauen und nutzen.
- [ERLEDIGT] Menü-Hash (SHA-1) cachen; `parseMenuXML()`/`getAllUris()` nur bei Hash-Änderung.

5) Logging-Strategie
- [ERLEDIGT] Retention (Standard 14 Tage) implementiert; tägliche Bereinigung älterer Logs in `monitorMemoryUsage()`.

6) UI-Optimierungen
- [ERLEDIGT] `BackgroundSync.tsx`: Fetch wird mit `AbortController` abgebrochen (Unmount/Intervallwechsel).
- [ERLEDIGT] `ConfigData.tsx`: `'/api/config'` → `API.CONFIG`. `config/update` Route ist deprecaten (410 Gone).

7) Sonstiges
- Beibehalten: Batchgröße 5 + Retry mit Backoff ist solide. Optional p-limit für feinere Kontrolle.

## Umsetzung (Stand 2025-09-28)

- **[Abort/Timeout]**
  - `src/reader/functions/EtaApi.ts`: `signal`-Support in `fetchApi`, `getUserVar`, `setUserVar`, `getMenu`.
  - `src/lib/backgroundService.ts`: `getMenu()` und `fetchWithRetry()` mit `AbortController` + Timer-Cleanup (try/finally).
- **[Sequenzielles/idempotentes Schalten + Rate Control]**
  - `updateTemperatureDiff()` schaltet Tasten sequenziell; nur bei tatsächlichem Zustandswechsel; Delay zwischen Calls (env: `ETA_CALL_DELAY_MS`).
- **[Slider-Update zentralisiert]**
  - `src/components/ConfigData.tsx`: Client-Effekt entfernt; Server setzt SP.
- **[t_override in ms]**
  - Server/Client konsistent; Default bereits ms. Logging zeigt Minuten.
- **[Performance]**
  - `idToShort`-Map.
  - Menü-/URI-Cache via SHA-1 Content-Hash.
- **[Client Fetch Abbruch]**
  - `BackgroundSync.tsx` bricht laufende Requests korrekt ab.
- **[API-Konstanten + Route-Bereinigung]**
  - `API.CONFIG` überall; `CONFIG_UPDATE` entfernt; alte Route liefert 410.
- **[Logging-Retention]**
  - `pruneOldLogs()` in `src/utils/logging.ts`; täglicher Aufruf im Memory-Monitor.
- **[Monitoring erweitert]**
  - Event-Loop-Delay (`monitorEventLoopDelay`), optionale Handle-Anzahl, periodische Ausgabe.


## ToDo (restlich/optional)

- **[Optional]** `WifiAf83Api` mit `AbortController`/Timeout absichern (analog `EtaApi`).
- **[Optional]** Feinere Request-Steuerung mit `p-limit` (bei Bedarf/Lastspitzen).
- **[Optional]** Weitere Monitoring-Kennzahlen (z.B. per OS-spezifischen Stats), falls nötig.

## Status
Analyse abgeschlossen; Hauptpunkte implementiert. Offene Punkte sind optional/Feintuning.
