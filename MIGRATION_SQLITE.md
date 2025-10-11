# SQLite Migrations-Plan für eta2weather

**Status**: Planung  
**Datum**: 2025-10-07  
**Ziel**: Migration von File-basierter Speicherung zu SQLite

---

## 📊 Datenbank-Schema

### Tabellen-Design

```sql
-- 1. ECOWITT Wetterdaten
CREATE TABLE ecowitt_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp TEXT NOT NULL,
    year INTEGER NOT NULL,
    month INTEGER NOT NULL,
    day INTEGER NOT NULL,
    hour INTEGER NOT NULL,
    minute INTEGER NOT NULL,
    data TEXT NOT NULL,  -- JSON-serialisiert
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(year, month, day, hour, minute)
);
CREATE INDEX idx_ecowitt_timestamp ON ecowitt_logs(timestamp);
CREATE INDEX idx_ecowitt_date ON ecowitt_logs(year, month, day);

-- 2. ETA Heizungsdaten
CREATE TABLE eta_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp TEXT NOT NULL,
    year INTEGER NOT NULL,
    month INTEGER NOT NULL,
    day INTEGER NOT NULL,
    hour INTEGER NOT NULL,
    minute INTEGER NOT NULL,
    data TEXT NOT NULL,  -- JSON-serialisiert (key-value pairs)
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(year, month, day, hour, minute)
);
CREATE INDEX idx_eta_timestamp ON eta_logs(timestamp);
CREATE INDEX idx_eta_date ON eta_logs(year, month, day);

-- 3. Config-Änderungen
CREATE TABLE config_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp TEXT NOT NULL,
    year INTEGER NOT NULL,
    month INTEGER NOT NULL,
    day INTEGER NOT NULL,
    hour INTEGER NOT NULL,
    minute INTEGER NOT NULL,
    data TEXT NOT NULL,  -- JSON-serialisiert
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(year, month, day, hour, minute)
);
CREATE INDEX idx_config_timestamp ON config_logs(timestamp);

-- 4. Temperatur-Differenz Updates
CREATE TABLE temp_diff_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp TEXT NOT NULL,
    diff REAL NOT NULL,
    slider_position INTEGER,
    t_soll REAL,
    t_delta REAL,
    indoor_temp REAL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_temp_diff_timestamp ON temp_diff_logs(timestamp);

-- 5. Min-Temperatur-Status
CREATE TABLE min_temp_status_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp TEXT NOT NULL,
    diff REAL NOT NULL,
    status TEXT NOT NULL,  -- 'dropped below' oder 'rose above'
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_min_temp_status_timestamp ON min_temp_status_logs(timestamp);

-- 6. Metadaten für Migrations-Tracking
CREATE TABLE migration_metadata (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

---

## 🏗️ Implementierungs-Plan

### Phase 1: Grundlagen

#### 1.1 Dependencies hinzufügen
```bash
npm install better-sqlite3 @types/better-sqlite3
```

**package.json**:
```json
{
  "dependencies": {
    "better-sqlite3": "^11.0.0"
  },
  "devDependencies": {
    "@types/better-sqlite3": "^7.6.8"
  }
}
```

#### 1.2 SQLite Service erstellen

**Datei**: `/src/lib/database/sqliteService.ts`

Funktionen:
- Connection Management (Singleton Pattern)
- Schema-Initialisierung beim Start
- CRUD-Operationen für alle Log-Typen
- Transaction-Support für Batch-Inserts
- Cleanup/Disposal-Methoden für Memory-Leaks
- WAL-Mode für bessere Performance

**Datei**: `/src/lib/database/dbHelpers.ts`

Utilities:
- Query-Builder für häufige Abfragen
- Datum-Range-Queries (24h, 7d, 30d)
- Aggregations-Funktionen für Weather-API
- Sampling-Funktionen für große Datenmengen

---

### Phase 2: Migrations-Script

#### 2.1 Migration-Tool erstellen

**Datei**: `/src/scripts/migrateToSqlite.ts`

**Funktionalität**:

1. **Directory Scanner**
   - Rekursives Durchlaufen von `public/log/`
   - Filter nach XML/JSON Files
   - Sortierung nach Timestamp

2. **XML Parser**
   - Parse ecowitt, eta, temp_diff, min_temp_status
   - Extract Timestamp aus Dateinamen
   - Extract Data aus CDATA/XML-Content
   - Fehler-Handling für korrupte Files

3. **JSON Parser**
   - Parse config Files
   - Validierung der Struktur

4. **Batch Insert**
   - Sammle Records (1000 pro Batch)
   - Transaction für jeden Batch
   - Progress-Logging alle 10.000 Records
   - Error-Recovery mit Resume-Point

5. **Validierung**
   - Count: Files vs DB-Records
   - Spot-Check: Random Samples vergleichen
   - Report: Fehler & Warnings

**Ausführung**:
```bash
npm run migrate:to-sqlite
```

**Script in package.json**:
```json
{
  "scripts": {
    "migrate:to-sqlite": "tsx src/scripts/migrateToSqlite.ts",
    "migrate:verify": "tsx src/scripts/verifySqliteMigration.ts"
  }
}
```

#### 2.2 Rollback-Mechanismus

- **Original-Dateien behalten**: Keine Files löschen während Migration
- **Idempotent**: Migration kann wiederholt werden (UNIQUE Constraints)
- **Verify-Command**: Vergleich File-Count vs DB-Count
- **Backup**: SQLite-DB vor Migration sichern

---

### Phase 3: Service-Anpassungen

#### 3.1 Logging Service

**Datei**: `/src/utils/logging.ts`

**Änderungen**:

```typescript
// VORHER: File-System writes
export const logData = async (type: LogType, data: any) => {
    const now = new Date();
    const filePath = path.join(process.cwd(), 'public', 'log', type, ...);
    await fs.promises.writeFile(filePath, formattedData);
}

// NACHHER: SQLite writes
export const logData = async (type: LogType, data: any) => {
    const db = DatabaseService.getInstance();
    
    switch(type) {
        case 'ecowitt':
            await db.insertEcowittLog(data);
            break;
        case 'eta':
            await db.insertEtaLog(data);
            break;
        case 'config':
            await db.insertConfigLog(data);
            break;
        case 'temp_diff':
            await db.insertTempDiffLog(data);
            break;
        case 'min_temp_status':
            await db.insertMinTempStatusLog(data);
            break;
    }
}
```

**Kompatibilität**: `getLogFiles()`

```typescript
// NACHHER: SQLite-Wrapper mit gleichem Interface
export const getLogFiles = async (type: LogType) => {
    const db = DatabaseService.getInstance();
    // Query DB, formatiere als File-Paths für Kompatibilität
    return await db.getLogsAsFilePaths(type);
}
```

#### 3.2 Cache Service

**Datei**: `/src/utils/cache.ts`

**KEINE Änderungen nötig**:
- WiFi-Daten: Bleiben in Memory-Cache + `/src/config/f_wifiaf89.json`
- Config: Bleibt in `/src/config/f_etacfg.json`
- Names2Id: Bleibt in `/src/config/f_names2id.json`

Logs werden in SQLite geschrieben, aber Cache-Mechanismus bleibt unverändert.

---

### Phase 4: API-Endpunkte anpassen

#### 4.1 Weather API

**Datei**: `/src/app/api/weather/route.ts`

**Änderungen**:

```typescript
// VORHER: File-System Scan + XML-Parsing
export async function GET(request: Request) {
    const baseDir = path.join(process.cwd(), 'public/log/ecowitt');
    const files = await getXmlFiles(yearDir, range);
    const weatherData = await processXmlFiles(files, range);
    return NextResponse.json(weatherData);
}

// NACHHER: Direct SQL Query
export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const range = searchParams.get('range') || '24h';
    
    const db = DatabaseService.getInstance();
    const weatherData = await db.getWeatherData(range);
    
    return NextResponse.json(weatherData, {
        headers: { 'Cache-Control': `public, max-age=${ttl}` }
    });
}
```

**Performance-Vorteile**:
- Keine File-System-Scans
- Keine XML-Parsing-Overhead
- Effiziente SQL-Queries mit Indizes
- Built-in Sampling/Aggregation

**SQL-Query Beispiel**:
```sql
-- 24h Range
SELECT timestamp, data 
FROM ecowitt_logs 
WHERE timestamp >= datetime('now', '-24 hours')
ORDER BY timestamp;

-- 7d Range mit Sampling (jeder 5. Eintrag)
SELECT timestamp, data 
FROM ecowitt_logs 
WHERE timestamp >= datetime('now', '-7 days')
  AND id % 5 = 0
ORDER BY timestamp;
```

#### 4.2 Logs API

**Datei**: `/src/app/api/logs/route.ts`

**KEINE Code-Änderungen nötig**:
```typescript
// getLogFiles() behält Interface, nutzt intern SQLite
const [ecowittLogs, etaLogs, ...] = await Promise.all([
    getLogFiles('ecowitt'),  // Wrapper -> SQLite
    getLogFiles('eta'),
    // ...
]);
```

#### 4.3 Logs Detail API

**Datei**: `/src/app/api/logs/[...path]/route.ts`

**Hybrid-Ansatz** (Abwärtskompatibilität):

```typescript
export async function GET(request: Request, { params }) {
    const { path: pathSegments } = await params;
    
    // 1. Versuche aus DB zu laden (neue Daten)
    const db = DatabaseService.getInstance();
    const logData = await db.getLogByPath(pathSegments);
    
    if (logData) {
        return NextResponse.json(logData);
    }
    
    // 2. Fallback: File-System (alte migrierte Daten)
    const filePath = path.join(process.cwd(), 'public', 'log', ...pathSegments);
    const fileBuffer = await fs.readFile(filePath);
    return new NextResponse(fileBuffer, { headers: { ... } });
}
```

---

### Phase 5: Background Service

**Datei**: `/src/lib/backgroundService.ts`

#### 5.1 Startup-Logik erweitern

```typescript
export class BackgroundService {
    async start() {
        console.log(`${this.getTimestamp()} Starting Background Service...`);
        
        // NEU: Initialisiere SQLite
        const db = DatabaseService.getInstance();
        await db.initialize();
        console.log(`${this.getTimestamp()} SQLite initialized`);
        
        // Rest bleibt gleich
        await this.loadConfig();
        this.startMemoryMonitoring();
        // ...
    }
}
```

#### 5.2 Cleanup-Logik erweitern

```typescript
async dispose() {
    console.log(`${this.getTimestamp()} Disposing Background Service...`);
    
    // Existing cleanup...
    this.clearAllTimeouts();
    
    // NEU: SQLite Connection schließen
    const db = DatabaseService.getInstance();
    await db.close();
    
    console.log(`${this.getTimestamp()} Background Service disposed`);
}
```

#### 5.3 Log-Calls

**KEINE Änderungen nötig**:
```typescript
// Line 199
await logData('config', newConfig);

// Line 409
await logData('eta', menuData);

// Line 455
await logData('ecowitt', transformedData);

// Line 618
await logData('temp_diff', { ... });

// Line 709
await logData('min_temp_status', { ... });
```

Alle Calls bleiben identisch, nur die interne Implementierung von `logData()` ändert sich.

---

### Phase 6: Docker & Deployment

#### 6.1 Docker-Compose Anpassung

**Datei**: `docker-compose.yml`

```yaml
services:
  app:
    image: eta2weather
    build:
      context: .
      dockerfile: Dockerfile
    container_name: eta2weather
    restart: always
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - DATABASE_PATH=/db/eta2weather.db  # NEU
    volumes:
      - ./db:/db                           # NEU: SQLite Volume
      - ./public/log:/app/public/log       # BEHALTEN: Legacy/Backup
      - ./src/config:/app/src/config
```

#### 6.2 Environment Variables

**Datei**: `.env.example`

```bash
# SQLite Database
DATABASE_PATH=/db/eta2weather.db

# Legacy (optional)
LOG_PATH=/app/public/log
```

#### 6.3 Verzeichnisstruktur

```
/media/data/programming/eta2weather.nextjs15/
├── db/
│   └── eta2weather.db              # SQLite Datenbank
├── public/log/                      # Legacy/Backup
│   ├── ecowitt/
│   ├── eta/
│   ├── config/
│   ├── temp_diff/
│   └── min_temp_status/
├── src/
│   ├── lib/
│   │   └── database/
│   │       ├── sqliteService.ts    # NEU
│   │       └── dbHelpers.ts        # NEU
│   ├── scripts/
│   │   ├── migrateToSqlite.ts      # NEU
│   │   └── verifySqliteMigration.ts # NEU
│   └── ...
└── ...
```

#### 6.4 Dockerfile Anpassungen

**Falls nötig**:
```dockerfile
# better-sqlite3 benötigt Build-Tools
RUN apk add --no-cache python3 make g++
```

---

## 🔄 Migrations-Workflow

### Schritt-für-Schritt Umsetzung

**1. Dependencies installieren**
```bash
npm install better-sqlite3 @types/better-sqlite3
```

**2. SQLite Service implementieren**
- [ ] `/src/lib/database/sqliteService.ts`
- [ ] `/src/lib/database/dbHelpers.ts`
- [ ] Schema-Initialisierung testen

**3. Migrations-Script erstellen**
- [ ] `/src/scripts/migrateToSqlite.ts`
- [ ] Testing mit Subset (100 Files)
- [ ] Testing mit Full-Dataset

**4. Logging-Service anpassen**
- [ ] `logData()` auf SQLite umstellen
- [ ] `getLogFiles()` Wrapper implementieren
- [ ] Unit-Tests

**5. API-Endpunkte anpassen**
- [ ] Weather-API auf DB umstellen
- [ ] Logs-API testen
- [ ] Performance-Tests

**6. Background Service anpassen**
- [ ] Startup-Logik erweitern
- [ ] Cleanup-Logik erweitern
- [ ] Integration-Tests

**7. Docker aktualisieren**
- [ ] docker-compose.yml anpassen
- [ ] Volume `/db` mounten
- [ ] Build & Test

**8. Migration ausführen**
```bash
# Stop container
docker-compose down

# Run migration
npm run migrate:to-sqlite

# Verify
npm run migrate:verify

# Start container
docker-compose up -d
```

**9. Monitoring**
- [ ] DB-Performance überwachen
- [ ] Disk-Space monitoring
- [ ] Error-Logging

**10. Cleanup (optional)**
- [ ] Alte Log-Files archivieren
- [ ] Retention-Policy implementieren

---

## ✅ Validierung & Testing

### Daten-Integrität prüfen

**Script**: `/src/scripts/verifySqliteMigration.ts`

```typescript
// 1. Count Comparison
const fileCount = await countXmlFiles('ecowitt');
const dbCount = await db.count('ecowitt_logs');
assert(fileCount === dbCount, 'Count mismatch!');

// 2. Spot-Check: Random Samples
for (let i = 0; i < 100; i++) {
    const randomFile = await getRandomXmlFile('ecowitt');
    const fileData = await parseXmlFile(randomFile);
    const dbData = await db.getLogByTimestamp(fileData.timestamp);
    assert(deepEqual(fileData, dbData), 'Data mismatch!');
}

// 3. Timestamp Coverage
const fileTimestamps = await getAllFileTimestamps('ecowitt');
const dbTimestamps = await db.getAllTimestamps('ecowitt_logs');
assert(setsEqual(fileTimestamps, dbTimestamps), 'Missing timestamps!');
```

### API-Response-Vergleich

```bash
# Vor Migration: Response speichern
curl http://localhost:3000/api/weather?range=24h > before.json

# Nach Migration: Response vergleichen
curl http://localhost:3000/api/weather?range=24h > after.json
diff before.json after.json
```

### Performance-Tests

```typescript
// Benchmark: File-System vs SQLite
console.time('File-System Query');
const filesData = await getWeatherDataFromFiles('24h');
console.timeEnd('File-System Query');

console.time('SQLite Query');
const dbData = await db.getWeatherData('24h');
console.timeEnd('SQLite Query');
```

---

## 🎯 Vorteile der Migration

| Aspekt | File-System | SQLite | Verbesserung |
|--------|-------------|--------|--------------|
| **Read Performance** | O(n) File Scan | O(log n) Index Lookup | **~100x schneller** |
| **Write Performance** | O(1) Single File | O(1) Single Insert | Gleich |
| **Skalierung** | Langsamer mit mehr Files | Konstant | **Besser** |
| **Queries** | Keine Aggregation | SQL Aggregationen | **Möglich** |
| **Backup** | Tausende Files | Ein File | **Einfacher** |
| **Maintenance** | Manuell | VACUUM/PRAGMA | **Automatisiert** |
| **Transactions** | Nein | ACID | **Sicher** |
| **Concurrency** | File Locks | WAL-Mode | **Besser** |

---

## 📝 Offene Punkte & Entscheidungen

### 1. Retention-Policy
**Frage**: Wie lange sollen Daten aufbewahrt werden?

Optionen:
- [ ] **Unendlich** (Disk-Space beachten)
- [ ] **1 Jahr** (Balance zwischen History & Space)
- [ ] **90 Tage** (Minimal)

**Implementierung**:
```sql
-- Automatisches Cleanup
DELETE FROM ecowitt_logs WHERE created_at < datetime('now', '-90 days');
VACUUM;
```

### 2. Backup-Strategie
**Frage**: Wie wird SQLite-DB gesichert?

Optionen:
- [ ] **Daily Backup**: Cronjob für `cp eta2weather.db backup/`
- [ ] **Export zu CSV**: Regelmäßiger Export als Fallback
- [ ] **Replizierung**: Live-Replica in Cloud

### 3. Legacy-Files
**Frage**: Was passiert mit alten Log-Files?

Optionen:
- [ ] **Behalten**: Als Backup/Archive
- [ ] **Archivieren**: tar.gz nach Migration
- [ ] **Löschen**: Nach erfolgreicher Verifikation

### 4. Migration-Downtime
**Frage**: Wie lange dauert die Migration?

Schätzung (bei 100.000 Files):
- Parse & Insert: ~30-60 Minuten
- Verify: ~10 Minuten
- **Total Downtime**: ~1 Stunde

**Mitigation**:
- Migration außerhalb der Betriebszeiten
- Oder: Dual-Write-Modus während Migration

### 5. Rollback-Plan
**Frage**: Was bei Problemen nach Migration?

Plan:
1. **Stop Container**
2. **Restore**: `docker-compose.yml` auf alte Version
3. **Files bleiben**: Fallback zu File-System
4. **Re-Deploy**: Ohne SQLite-Changes

---

## 🚀 Next Steps

1. **Review diesen Plan** mit Team/Stakeholder
2. **Entscheidungen treffen** zu offenen Punkten
3. **Test-Environment** aufsetzen
4. **Implementation starten** mit Phase 1

---

**Autor**: Cascade AI  
**Review-Status**: Draft  
**Approval**: Pending
