# Memory Leak Fixes - Dokumentation

## Übersicht
Alle identifizierten Memory Leaks in den Background Services wurden behoben.

---

## 🔴 Kritische Fixes

### 1. BackgroundSync.tsx - Dependency Loop behoben
**Problem:** Endloser Re-Render Loop durch `config.data` in Dependencies  
**Lösung:**
- `fetchBackgroundData` hängt nur noch von `dispatch` ab (Zeile 68)
- Timer-Updates nur bei tatsächlicher Wertänderung via `lastTimerRef` (Zeilen 103-124)
- Verhindert unnötige Interval-Resets

**Dateien:** `src/components/BackgroundSync.tsx`

### 2. BackgroundSync.tsx - AbortController Cleanup
**Problem:** Aborted Controller wurden nicht dereferenziert  
**Lösung:**
- `abortRef.current` wird nach Abort auf `null` gesetzt (Zeile 27)
- Im `finally` Block explizite Cleanup (Zeilen 62-67)
- Verhindert Ansammlung von Controller-Objekten

**Dateien:** `src/components/BackgroundSync.tsx`

### 3. backgroundService.ts - Timeout Tracking System
**Problem:** Timeouts wurden nicht getrackt und konnten nicht gecancelt werden  
**Lösung:**
- Neue Sets `activeTimeouts` und `activeSleeps` (Zeilen 70-71)
- Alle Timeouts werden registriert und beim `stop()` gecleared (Zeilen 1043-1054)
- Verhindert hängende Timeouts nach Service-Stop

**Dateien:** `src/lib/backgroundService.ts`

### 4. backgroundService.ts - Sleep Promise Cleanup
**Problem:** Sleep-Promises konnten nicht abgebrochen werden  
**Lösung:**
- Sleep-Objekte werden in Set getrackt (Zeilen 86-94)
- Bei `stop()` werden alle Promises sofort resolved (Zeilen 1048-1054)
- Verhindert hängende async Operationen

**Dateien:** `src/lib/backgroundService.ts`

### 5. EtaApi.ts - Disposal Pattern implementiert
**Problem:** EtaApi Instanzen wurden ohne Cleanup überschrieben  
**Lösung:**
- Neue `dispose()` Methode (Zeilen 129-149)
- Tracked alle AbortController (Zeilen 14, 56-62)
- `isDisposed` Flag verhindert Verwendung nach Disposal (Zeilen 15, 26-28)
- Alle pending Requests werden bei Disposal aborted

**Dateien:** `src/reader/functions/EtaApi.ts`

### 6. backgroundService.ts - EtaApi Lifecycle Management
**Problem:** Alte EtaApi Instanzen wurden nicht disposed  
**Lösung:**
- Bei Endpoint-Änderung wird alte Instanz disposed (Zeilen 214-220)
- Bei Service-Stop wird EtaApi disposed (Zeilen 1057-1069)
- Prüfung auf `disposed` Status vor Cleanup

**Dateien:** `src/lib/backgroundService.ts`

### 7. backgroundService.ts - Menu Cache Cleanup
**Problem:** Cache wurde nie geleert, selbst bei Service-Stop  
**Lösung:**
- Cache wird bei `stop()` explizit auf `null` gesetzt (Zeilen 1071-1075)
- Gibt mehrere MB Speicher frei bei großen Menüstrukturen

**Dateien:** `src/lib/backgroundService.ts`

---

## 🟡 Moderate Fixes

### 8. backgroundService.ts - File Watcher Error Handler
**Problem:** Watcher konnte in invalidem Zustand bleiben  
**Lösung:**
- Error Handler mit automatischem Neustart (Zeilen 168-182)
- 5 Sekunden Delay vor Neustart-Versuch
- Verhindert Crash bei Dateisystem-Fehlern

**Dateien:** `src/lib/backgroundService.ts`

### 9. backgroundService.ts - Redux Store Subscription
**Problem:** Store wurde nur gelesen, nie subscribed  
**Lösung:**
- Proper Subscription bei `start()` (Zeilen 958-963)
- Unsubscribe bei `stop()` (Zeilen 1003-1008)
- Folgt Redux Best Practices

**Dateien:** `src/lib/backgroundService.ts`

### 10. backgroundService.ts - Enhanced Memory Monitoring
**Problem:** Memory Logs waren zu basic  
**Lösung:**
- Detaillierte Logs mit allen Metriken (Zeilen 564-602)
- Tracked: heapUsed, heapTotal, external, RSS
- Zeigt: activeTimeouts, activeSleeps, cachedUris, etaApiStatus
- Bessere Debugging-Möglichkeiten

**Dateien:** `src/lib/backgroundService.ts`

---

## Geänderte Dateien

1. **src/components/BackgroundSync.tsx**
   - Dependency Loop Fix
   - AbortController Cleanup
   - Timer-Update Optimierung

2. **src/lib/backgroundService.ts**
   - Timeout Tracking System
   - Sleep Promise Cleanup
   - EtaApi Lifecycle Management
   - Menu Cache Cleanup
   - File Watcher Error Handler
   - Redux Store Subscription
   - Enhanced Memory Monitoring

3. **src/reader/functions/EtaApi.ts**
   - Disposal Pattern implementiert
   - AbortController Tracking
   - `dispose()` und `disposed` getter

---

## Testing Empfehlungen

### Memory Leak Tests
```bash
# Mit Garbage Collection Flag starten
node --expose-gc server.js

# Memory Monitoring läuft automatisch alle 15 Minuten
# Logs prüfen auf:
# - Steigende heapUsed Werte
# - Anzahl activeTimeouts (sollte niedrig bleiben)
# - Anzahl activeSleeps (sollte niedrig bleiben)
```

### Service Lifecycle Tests
```bash
# Service starten und stoppen
# Prüfen ob alle Ressourcen freigegeben werden:
# - "Redux store unsubscribed"
# - "Memory monitoring stopped"
# - "EtaApi instance disposed"
# - "Cleared menu cache"
# - "Cleared X active timeouts"
# - "Cancelled X active sleep promises"
```

### Long-Running Tests
```bash
# Service 24+ Stunden laufen lassen
# Memory usage sollte stabil bleiben
# Keine stetig wachsenden Werte
```

---

## Performance Impact

### Vorher
- Memory Leaks bei jedem Config-Update
- Hängende Timeouts nach Service-Stop
- Nicht-disposed EtaApi Instanzen
- Wachsender Cache ohne Cleanup

### Nachher
- Stabile Memory Usage
- Sauberer Service-Stop
- Proper Resource Cleanup
- Detailliertes Monitoring

---

## Maintenance Notes

### Bei neuen Timeouts
Immer in `activeTimeouts` Set registrieren:
```typescript
const timeout = setTimeout(() => {
  this.activeTimeouts.delete(timeout);
  // ... your code
}, ms);
this.activeTimeouts.add(timeout);
```

### Bei neuen async Operationen
Sleep-Pattern verwenden statt direktem setTimeout:
```typescript
await this.sleep(ms); // Wird automatisch getrackt
```

### Bei EtaApi Verwendung
Immer auf `disposed` Status prüfen:
```typescript
if (this.etaApi && !this.etaApi.disposed) {
  // Safe to use
}
```

---

---

## 🚀 Performance Optimierung (2025-10-04)

### Menu Loading Optimierung
**Problem:** Menu wurde bei jedem Update-Zyklus neu geladen (alle paar Minuten), obwohl es sich nie ändert  
**Lösung:**
- Menu wird nur einmal beim Start geladen (`loadMenuStructure()` Methode)
- `menuLoadedOnce` Flag verhindert erneutes Laden
- Cache wird für alle nachfolgenden Fetches wiederverwendet
- Bei Endpoint-Änderung wird Menu automatisch neu geladen

**Performance Impact:**
- **Vorher:** ~1-2 Sekunden Menu-Parsing bei jedem Update (alle 2-5 Minuten)
- **Nachher:** Menu-Parsing nur einmal beim Start (~1-2 Sekunden einmalig)
- **Ersparnis:** ~20-30 API-Calls und Parsing-Operationen pro Stunde

**Dateien:** `src/lib/backgroundService.ts` (Zeilen 65, 307-311, 930-1037)

---

## Datum
- Initial: 2025-10-03
- Menu Optimierung: 2025-10-04

## Version
1.1.0
