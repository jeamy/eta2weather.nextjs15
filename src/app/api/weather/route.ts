import { NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import { DOMParser } from '@xmldom/xmldom';
import { DatabaseHelpers, getTimeRangeHours, isTimeRange, TimeRange } from '@/lib/database/dbHelpers';
import { parseNum } from '@/utils/numberParser';
import { extractWeatherChannels } from '@/utils/weatherData';

// Simple in-memory cache per range to speed up repeated requests.
// TTLs are conservative and per-range.
const cache = new Map<string, { t: number; data: any[] }>();
const CACHE_TTLS: Record<TimeRange, number> = {
  '24h': 60_000,   // 1 minute
  '7d': 5 * 60_000, // 5 minutes
  '30d': 15 * 60_000, // 15 minutes
  '1m': 15 * 60_000, // 15 minutes
};

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const requestedRange = searchParams.get('range') || '24h';
    if (!isTimeRange(requestedRange)) {
      return NextResponse.json(
        { error: `Invalid range: ${requestedRange}` },
        { status: 400 }
      );
    }
    const range = requestedRange;
    const ttl = CACHE_TTLS[range];
    const cacheKey = `weather:${range}`;
    const nowMs = Date.now();
    const cached = cache.get(cacheKey);
    if (cached && nowMs - cached.t < ttl) {
      return NextResponse.json(cached.data, {
        headers: {
          'Cache-Control': `public, max-age=${Math.floor(ttl / 1000)}`,
        },
      });
    }

    // Try to get data from SQLite first
    let weatherData: any[] = [];
    try {
      const helpers = new DatabaseHelpers();
      weatherData = await helpers.getWeatherData(range);
      console.log(`Weather data from SQLite: ${weatherData.length} records`);
      if (weatherData.length === 0) {
        throw new Error('No weather data found in SQLite');
      }
    } catch (error) {
      console.error('Error getting weather data from SQLite:', error);
      // Fallback to file-system
      // Helper to get runtime root
      const getRuntimeRoot = () => process.cwd();
      const baseDir = path.resolve(getRuntimeRoot(), 'public/log/ecowitt');
      const files = await getXmlFiles(baseDir, range);
      weatherData = await processXmlFiles(files, range);
      console.log(`Weather data from file-system: ${weatherData.length} records`);
    }

    cache.set(cacheKey, { t: nowMs, data: weatherData });

    return NextResponse.json(weatherData, {
      headers: {
        'Cache-Control': `public, max-age=${Math.floor(ttl / 1000)}`,
      },
    });
  } catch (error) {
    console.error('Error processing weather data:', error);
    return NextResponse.json({ error: 'Failed to process weather data' }, { status: 500 });
  }
}

async function getXmlFiles(baseDir: string, range: TimeRange): Promise<string[]> {
  const now = new Date();
  const startDate = new Date(now.getTime() - getTimeRangeHours(range, now) * 60 * 60 * 1000);

  // Iterate only over the required day folders instead of scanning the whole year directory.
  const files: string[] = [];
  for (
    let d = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
    d <= now;
    d.setDate(d.getDate() + 1)
  ) {
    const year = String(d.getFullYear());
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const dayDir = path.join(baseDir, year, month, day);
    try {
      const xmlFiles = (await fs.readdir(dayDir, { withFileTypes: true }))
        .filter((entry) => entry.isFile() && entry.name.endsWith('.xml'))
        .map((entry) => path.join(dayDir, entry.name));
      files.push(...xmlFiles);
    } catch {
      // ignore missing paths
    }
  }

  return files;
}

async function processXmlFiles(files: string[], range: TimeRange): Promise<any[]> {
  // Reduce IO by sampling files up-front for longer ranges.
  let filesToProcess = files;
  if (range === '7d' || range === '30d' || range === '1m') {
    const target = range === '7d' ? 1200 : 1500; // aim for ~O(1k) files max
    const step = Math.max(1, Math.ceil(files.length / target));
    filesToProcess = files.filter((_, i) => i % step === 0);
  }
  const weatherData = [];
  const parser = new DOMParser();

  for (const file of filesToProcess) {
    try {
      const xmlContent = await fs.readFile(file, 'utf-8');
      if (!xmlContent || xmlContent.trim() === '') {
        console.error(`Empty or invalid XML file: ${file}`);
        continue;
      }

      const doc = parser.parseFromString(xmlContent, 'text/xml');

      // Check if parsing was successful
      if (!doc || !doc.documentElement) {
        console.error(`Failed to parse XML document from file: ${file}`);
        continue;
      }

      const timestamp = doc.documentElement.getAttribute('timestamp');
      if (!timestamp) {
        console.error(`No timestamp found in file: ${file}`);
        continue;
      }

      const allDataNodes = doc.getElementsByTagName('allData');
      if (!allDataNodes || allDataNodes.length === 0) {
        console.error(`No allData node found in file: ${file}`);
        continue;
      }

      const allDataNode = allDataNodes[0];
      if (!allDataNode || !allDataNode.textContent) {
        console.error(`Invalid allData node or empty content in file: ${file}`);
        continue;
      }

      let data: any;
      try {
        const raw = allDataNode.textContent || '';
        data = JSON.parse(raw);
        if (typeof data === 'string') {
          // Handle double-encoded JSON
          data = JSON.parse(data);
        }
      } catch (parseError) {
        console.error(`Failed to parse JSON content from file: ${file}`, parseError);
        continue;
      }

      const outdoorTemperature = parseNum(data?.outdoor?.temperature?.value);
      const pressure = parseNum(data?.pressure?.relative?.value);
      const outdoorHumidity = parseNum(data?.outdoor?.humidity?.value);
      const indoorTemperature = parseNum(data?.indoor?.temperature?.value);
      const indoorHumidity = parseNum(data?.indoor?.humidity?.value);

      // Validate required data exists before adding
      if (outdoorTemperature === null ||
        pressure === null ||
        outdoorHumidity === null ||
        indoorTemperature === null ||
        indoorHumidity === null) {
        console.error(`Missing required data fields in file: ${file}`);
        continue;
      }

      weatherData.push({
        timestamp,
        temperature: outdoorTemperature,
        pressure,
        humidity: outdoorHumidity,
        indoor: {
          temperature: indoorTemperature,
          humidity: indoorHumidity
        },
        channels: extractWeatherChannels(data),
      });
    } catch (error) {
      console.error(`Error processing file ${file}:`, error);
    }
  }

  // Sort by timestamp and reduce data points for longer time ranges
  const sortedData = weatherData.sort((a, b) =>
    new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );

  // For longer periods, reduce the number of data points to avoid overwhelming the chart
  if (sortedData.length > 288) { // More than 24 hours of 5-minute intervals
    const interval = Math.ceil(sortedData.length / 288);
    return sortedData.filter((_, index) => index % interval === 0);
  }

  return sortedData;
}
