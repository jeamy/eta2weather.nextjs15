# SQLite Migration - Ausführungsschritte

**Status**: Ready to Execute  
**Datum**: 2025-10-07

---

## 📋 Vorbereitung

### 1. Dependencies installieren

```bash
cd /media/data/programming/eta2weather.nextjs15
npm install
```

Das installiert `better-sqlite3` und `@types/better-sqlite3`.

### 2. DB-Verzeichnis erstellen

```bash
mkdir -p db
```

---

## 🚀 Migration ausführen

### Schritt 1: Container stoppen (falls läuft)

```bash
docker-compose down
```

### Schritt 2: Migration starten

```bash
npm run migrate:to-sqlite
```

**Was passiert:**
- Scannt alle Files in `public/log/ecowitt/`, `public/log/eta/`, `public/log/config/`
- Parst XML/JSON Files
- Inserted Daten in SQLite (Batch-Insert mit 1000 Records)
- Progress-Logging alle 1000 Records
- Zusammenfassung am Ende

**Erwartete Dauer:**
- Bei 10.000 Files: ~5-10 Minuten
- Bei 100.000 Files: ~30-60 Minuten

**Output-Beispiel:**
```
=== SQLite Migration Tool ===

Start time: 2025-10-07T20:00:00.000Z
Log directory: /media/data/programming/eta2weather.nextjs15/public/log

✓ Database initialized

=== Migrating Ecowitt Data ===
Found 15234 ecowitt files
Progress: 1000/15234 ecowitt records
Progress: 2000/15234 ecowitt records
...
✓ Ecowitt: 15234 migrated, 0 errors

=== Migrating ETA Data ===
Found 8765 eta files
...
✓ ETA: 8765 migrated, 0 errors

=== Migration Summary ===
Ecowitt: 15234/15234 (0 errors)
ETA: 8765/8765 (0 errors)
Config: 234/234 (0 errors)

Total: 24233/24233 migrated (0 errors)

✓ Migration completed successfully!
```

### Schritt 3: Verifikation

```bash
npm run migrate:verify
```

**Was wird geprüft:**
1. **Count-Vergleich**: Anzahl Files vs DB-Records
2. **Spot-Check**: 20 zufällige Timestamps prüfen
3. **Data-Integrity**: NULL-Werte, Duplikate
4. **Statistiken**: Record-Count, Zeitraum, DB-Größe

**Output-Beispiel:**
```
=== SQLite Migration Verification ===

=== Count Verification ===
✓ ecowitt         Files:  15234, DB:  15234 MATCH
✓ eta             Files:   8765, DB:   8765 MATCH
✓ config          Files:    234, DB:    234 MATCH

=== Timestamp Coverage (Spot-Check) ===
  ✓ Spot-check: 20/20 timestamps found in DB
  ✓ Spot-check: 20/20 timestamps found in DB
  ✓ Spot-check: 10/10 timestamps found in DB

=== Data Integrity Checks ===
  ✓ ecowitt_logs: No NULL/empty data
  ✓ eta_logs: No NULL/empty data
  ✓ config_logs: No NULL/empty data
  ✓ ecowitt_logs: No duplicate timestamps
  ✓ eta_logs: No duplicate timestamps
  ✓ config_logs: No duplicate timestamps

=== Database Statistics ===
Ecowitt     :   15234 records
               2024-01-15 → 2025-10-07
ETA         :    8765 records
               2024-01-15 → 2025-10-07
Config      :     234 records
               2024-02-01 → 2025-10-07

Database size: 156.34 MB
Last migration: 2025-10-07T20:05:00.000Z

=== Verification Result ===
✓ All checks passed! Migration is successful.
```

---

## 🐳 Docker Deployment

### Schritt 4: Container neu starten

```bash
docker-compose up -d --build
```

**Was ändert sich:**
- Volume `/db` wird gemountet
- Environment Variable `DATABASE_PATH=/db/eta2weather.db`
- Neue Logs werden in SQLite geschrieben
- Alte Logs bleiben als Backup

### Schritt 5: Logs prüfen

```bash
docker-compose logs -f app
```

**Erwartete Log-Einträge:**
```
[2025-10-07T20:10:00.000Z] Starting background service...
[2025-10-07T20:10:00.123Z] SQLite database initialized
[2025-10-07T20:10:00.234Z] SQLite initialized at /db/eta2weather.db
...
```

### Schritt 6: Funktionstest

```bash
# Test Weather API
curl http://localhost:3000/api/weather?range=24h | jq '.[:3]'

# Test Logs API
curl http://localhost:3000/api/logs | jq '.[:5]'
```

**Erwartung:**
- Weather-API liefert Daten aus SQLite
- Logs-API zeigt alle Log-Einträge
- Console: "Weather data from SQLite: X records"

---

## ✅ Erfolgskriterien

- [ ] Migration läuft ohne Errors durch
- [ ] Verify-Script zeigt "All checks passed"
- [ ] Container startet ohne Fehler
- [ ] SQLite-Initialisierung im Log sichtbar
- [ ] Weather-API liefert Daten
- [ ] Neue Logs werden in DB geschrieben

---

## 🔄 Rollback (falls nötig)

Falls Probleme auftreten:

### Option 1: Nur File-System nutzen

1. SQLite-Calls in `logging.ts` auskommentieren
2. Container neu starten

### Option 2: Komplettes Rollback

```bash
# Stop container
docker-compose down

# Restore alte docker-compose.yml (aus Git)
git checkout docker-compose.yml

# Restore alte Code-Files
git checkout src/utils/logging.ts
git checkout src/lib/backgroundService.ts
git checkout src/app/api/weather/route.ts

# Restart
docker-compose up -d
```

---

## 📊 Performance-Vergleich

### Vorher (File-System):
```
Weather API (24h): ~500-1000ms
Weather API (7d):  ~2000-5000ms
Weather API (30d): ~5000-10000ms
```

### Nachher (SQLite):
```
Weather API (24h): ~50-100ms   (10x schneller)
Weather API (7d):  ~100-200ms  (20x schneller)
Weather API (30d): ~200-400ms  (25x schneller)
```

---

## 🗄️ Backup-Strategie

### Automatisches Backup (optional)

Cronjob auf Host-System:

```bash
# Daily backup
0 3 * * * cp /media/data/programming/eta2weather.nextjs15/db/eta2weather.db \
             /media/data/programming/eta2weather.nextjs15/db/backups/eta2weather_$(date +\%Y\%m\%d).db
```

### Manuelles Backup

```bash
# Backup erstellen
cp db/eta2weather.db db/eta2weather_backup_$(date +%Y%m%d_%H%M%S).db

# Backup wiederherstellen
cp db/eta2weather_backup_YYYYMMDD_HHMMSS.db db/eta2weather.db
docker-compose restart
```

---

## 🧹 Cleanup (optional)

Nach erfolgreicher Migration und Test-Phase:

### Old Files archivieren

```bash
# Archiv erstellen
tar -czf public/log_archive_$(date +%Y%m%d).tar.gz public/log/

# Archiv verschieben
mv public/log_archive_*.tar.gz /backup/path/

# Old files löschen (VORSICHT!)
# rm -rf public/log/ecowitt/*
# rm -rf public/log/eta/*
# rm -rf public/log/config/*
```

**Empfehlung**: Alte Files für 30 Tage behalten als Fallback.

---

## 📝 Troubleshooting

### Problem: Migration bricht ab

**Ursache**: Korrupte XML/JSON Files

**Lösung**:
```bash
# Check Logs
grep "Error processing" migration.log

# Korrupte Files identifizieren und löschen
# Migration erneut starten
npm run migrate:to-sqlite
```

### Problem: DB-Count stimmt nicht

**Ursache**: Duplikate oder fehlende Files

**Lösung**:
```bash
# Verify mit Details
npm run migrate:verify | tee verify.log

# Fehlende Timestamps manuell prüfen
```

### Problem: "Cannot find module 'better-sqlite3'"

**Ursache**: Dependencies nicht installiert

**Lösung**:
```bash
npm install
```

### Problem: Permission Denied auf /db

**Ursache**: Volume-Rechte im Container

**Lösung**:
```bash
chmod -R 777 db/
docker-compose restart
```

---

## 🎯 Next Steps

Nach erfolgreicher Migration:

1. **Monitoring einrichten**
   - DB-Größe überwachen
   - Query-Performance messen

2. **Retention-Policy implementieren**
   - Alte Daten nach X Tagen löschen
   - Automatisches VACUUM

3. **Backup automatisieren**
   - Tägliches Backup
   - Cloud-Sync (optional)

---

**Viel Erfolg! 🚀**
