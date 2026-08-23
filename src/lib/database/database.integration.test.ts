import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import Database from 'better-sqlite3';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`FAIL: ${message}`);
  console.log(`PASS: ${message}`);
}

function weatherPayload(temperature: number) {
  return {
    outdoor: {
      temperature: { value: temperature },
      humidity: { value: 71 },
    },
    pressure: { relative: { value: 1013 } },
    indoor: {
      temperature: { value: 21 },
      humidity: { value: 44 },
    },
    temp_and_humidity_ch1: {
      temperature: { value: 18 },
      humidity: { value: 52 },
    },
  };
}

function createPreviousYearDatabase(filePath: string, timestamp: string, year: number): void {
  const database = new Database(filePath);
  try {
    database.exec(`
      CREATE TABLE ecowitt_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp TEXT NOT NULL,
        year INTEGER NOT NULL,
        month INTEGER NOT NULL,
        day INTEGER NOT NULL,
        hour INTEGER NOT NULL,
        minute INTEGER NOT NULL,
        data TEXT NOT NULL,
        UNIQUE(year, month, day, hour, minute)
      );
      CREATE TABLE eta_logs (id INTEGER PRIMARY KEY AUTOINCREMENT, timestamp TEXT NOT NULL);
      CREATE TABLE config_logs (id INTEGER PRIMARY KEY AUTOINCREMENT, timestamp TEXT NOT NULL);
      CREATE TABLE temp_diff_logs (id INTEGER PRIMARY KEY AUTOINCREMENT, timestamp TEXT NOT NULL);
      CREATE TABLE min_temp_status_logs (id INTEGER PRIMARY KEY AUTOINCREMENT, timestamp TEXT NOT NULL);
    `);
    const date = new Date(timestamp);
    database.prepare(`
      INSERT INTO ecowitt_logs (timestamp, year, month, day, hour, minute, data)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      timestamp,
      year,
      date.getMonth() + 1,
      date.getDate(),
      date.getHours(),
      date.getMinutes(),
      JSON.stringify(weatherPayload(-2)),
    );
  } finally {
    database.close();
  }
}

async function main(): Promise<void> {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'eta2weather-db-integration-'));
  process.env.DATABASE_PATH = path.join(tempDir, 'database.db');

  const { DatabaseService } = await import('./sqliteService');
  const { DatabaseHelpers } = await import('./dbHelpers');
  const { GET: getDatabaseLog } = await import('../../app/api/logs/[...path]/route');
  const { GET: listLogs } = await import('../../app/api/logs/route');

  const service = DatabaseService.getInstance();

  try {
  await service.initialize();

  const boundaryEnd = new Date(new Date().getFullYear(), 0, 1, 12, 0, 0, 0);
  const previousTimestamp = new Date(boundaryEnd.getTime() - 12 * 60 * 60 * 1000).toISOString();
  const currentTimestamp = new Date(boundaryEnd.getTime() - 60 * 60 * 1000).toISOString();
  const previousYear = boundaryEnd.getFullYear() - 1;
  const currentYear = boundaryEnd.getFullYear();

  createPreviousYearDatabase(
    path.join(tempDir, `eta2weather_${previousYear}.db`),
    previousTimestamp,
    previousYear,
  );

  const currentDatabase = service.getDatabase();
  const currentDate = new Date(currentTimestamp);
  currentDatabase.prepare(`
    INSERT INTO ecowitt_logs (timestamp, year, month, day, hour, minute, data)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    currentTimestamp,
    currentYear,
    currentDate.getMonth() + 1,
    currentDate.getDate(),
    currentDate.getHours(),
    currentDate.getMinutes(),
    JSON.stringify(weatherPayload(3)),
  );

  const helpers = new DatabaseHelpers();
  const rows = await helpers.getWeatherData('24h', boundaryEnd);
  assert(rows.length === 2, 'weather query combines rows across the year boundary');
  assert(rows[0].timestamp === previousTimestamp, 'cross-year weather rows remain chronological');
  assert(rows[0].channels.ch1.temperature === 18, 'cross-year query uses normal channel parsing');

  const logPaths = await helpers.getLogsAsFilePaths('ecowitt', 1);
  assert(logPaths.length === 1, 'SQLite-backed log listing enforces its requested limit');
  assert(logPaths[0].includes('-id'), 'SQLite-backed log listing returns addressable row identifiers');

  const response = await getDatabaseLog(
    new Request(`http://localhost/api/logs/${logPaths[0]}`),
    { params: Promise.resolve({ path: logPaths[0].split('/') }) },
  );
  const body = await response.text();
  assert(response.status === 200, 'virtual SQLite log path is served through the API route');
  assert(response.headers.get('content-type')?.includes('application/xml'), 'virtual weather log has XML content type');
  assert(body.includes('<ecowittData'), 'virtual weather log renders the stored database payload');

  const listResponse = await listLogs(new Request('http://localhost/api/logs?limit=1'));
  const listedLogs = await listResponse.json() as Array<{ time: string; date: string }>;
  assert(/^\d{2}:\d{2}:\d{2}$/.test(listedLogs[0]?.time || ''), 'log list preserves seconds in display time');
  assert(/T\d{2}:\d{2}:\d{2}$/.test(listedLogs[0]?.date || ''), 'log list preserves seconds in sort timestamp');
  } finally {
    await service.close();
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

void main();
