import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { DOMParser } from 'xmldom';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const range = searchParams.get('range') || '24h';
    
    const baseDir = path.join(process.cwd(), 'public/log/ecowitt');
    const currentYear = new Date().getFullYear().toString();
    const yearDir = path.join(baseDir, currentYear);
    
    // Get XML files based on the requested time range
    const files = await getXmlFiles(yearDir, range);
    const weatherData = await processXmlFiles(files);

    return NextResponse.json(weatherData);
  } catch (error) {
    console.error('Error processing weather data:', error);
    return NextResponse.json({ error: 'Failed to process weather data' }, { status: 500 });
  }
}

async function getXmlFiles(yearDir: string, range: string): Promise<string[]> {
  const now = new Date();
  const currentYear = new Date().getFullYear();
  let startDate: Date;

  switch (range) {
    case '7d':
      startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      break;
    case '30d':
      startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      break;
    default: // '24h'
      startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  }

  const files: string[] = [];
  const months = fs.readdirSync(yearDir);

  for (const month of months) {
    const monthDir = path.join(yearDir, month);
    const days = fs.readdirSync(monthDir);
    
    for (const day of days) {
      const dayDir = path.join(monthDir, day);
      if (!fs.statSync(dayDir).isDirectory()) continue;

      // Parse the date from the directory structure
      const fileDate = new Date(currentYear, parseInt(month) - 1, parseInt(day));
      
      if (fileDate >= startDate && fileDate <= now) {
        const xmlFiles = fs.readdirSync(dayDir)
          .filter(file => file.endsWith('.xml'))
          .map(file => path.join(dayDir, file));
        
        files.push(...xmlFiles);
      }
    }
  }

  return files;
}

async function processXmlFiles(files: string[]): Promise<any[]> {
  const weatherData = [];
  const parser = new DOMParser();

  for (const file of files) {
    try {
      const xmlContent = fs.readFileSync(file, 'utf-8');
      const doc = parser.parseFromString(xmlContent, 'text/xml');
      
      const timestamp = doc.documentElement.getAttribute('timestamp');
      if (!timestamp) continue;

      const allDataNode = doc.getElementsByTagName('allData')[0];
      if (allDataNode && allDataNode.textContent) {
        const data = JSON.parse(allDataNode.textContent);
        
        weatherData.push({
          timestamp,
          temperature: parseFloat(data.outdoor.temperature.value),
          pressure: parseFloat(data.pressure.relative.value),
          humidity: parseFloat(data.outdoor.humidity.value),
          channels: {
            ch1: {
              temperature: parseFloat(data.temp_and_humidity_ch1.temperature.value),
              humidity: parseFloat(data.temp_and_humidity_ch1.humidity.value)
            },
            ch2: {
              temperature: parseFloat(data.temp_and_humidity_ch2.temperature.value),
              humidity: parseFloat(data.temp_and_humidity_ch2.humidity.value)
            },
            ch3: {
              temperature: parseFloat(data.temp_and_humidity_ch3.temperature.value),
              humidity: parseFloat(data.temp_and_humidity_ch3.humidity.value)
            },
            ch5: {
              temperature: parseFloat(data.temp_and_humidity_ch5.temperature.value),
              humidity: parseFloat(data.temp_and_humidity_ch5.humidity.value)
            },
            ch6: {
              temperature: parseFloat(data.temp_and_humidity_ch6.temperature.value),
              humidity: parseFloat(data.temp_and_humidity_ch6.humidity.value)
            },
            ch7: {
              temperature: parseFloat(data.temp_and_humidity_ch7.temperature.value),
              humidity: parseFloat(data.temp_and_humidity_ch7.humidity.value)
            }
          }
        });
      }
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
