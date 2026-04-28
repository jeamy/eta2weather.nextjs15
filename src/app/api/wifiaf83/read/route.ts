import { NextResponse } from 'next/server';
import { WifiAf83Api } from '@/reader/functions/WifiAf83Api';
import { getWifiAf83Data } from '@/utils/cache';
import { WifiAF83Data } from '@/reader/functions/types-constants/WifiAf83';
import { parseNum } from '@/utils/numberParser';

export async function GET(request: Request) {
  const wifiApi = new WifiAf83Api();

  try {
    const allData = await getWifiAf83Data((s) => wifiApi.getAllRealtime(s), request.signal);

    // Extract and validate temperature values
    const outdoorTemp = parseNum(allData.outdoor?.temperature?.value);
    const indoorTemp = parseNum(allData.indoor?.temperature?.value);

    if (outdoorTemp === null || indoorTemp === null) {
      throw new Error('Invalid temperature values');
    }

    // Transform to match WifiAF83Data interface
    const transformedData: WifiAF83Data = {
      time: Date.now(),
      datestring: new Date().toLocaleString('de-DE', {
        hour: 'numeric',
        minute: 'numeric',
        second: 'numeric',
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      }),
      temperature: outdoorTemp,
      indoorTemperature: indoorTemp,
      allData: null
    };

    return NextResponse.json({ success: true, data: transformedData });
  } catch (error) {
    console.error('Error in fetchWifiAf83Data:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch weather data' },
      { status: 500 }
    );
  } finally {
    wifiApi.dispose();
  }
}
