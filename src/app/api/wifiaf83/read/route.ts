import { NextResponse } from 'next/server';
import { WifiAf83Api } from '@/reader/functions/WifiAf83Api';
import { getWifiAf83Data } from '@/utils/cache';
import { WifiAF83Data } from '@/reader/functions/types-constants/WifiAf83';

export async function GET() {
  try {
    const wifiApi = new WifiAf83Api();
    const allData = await getWifiAf83Data(() => wifiApi.getAllRealtime());

    // Extract and validate temperature values
    const outdoorTemp = allData.outdoor?.temperature?.value;
    const indoorTemp = allData.indoor?.temperature?.value;

    if (!outdoorTemp || !indoorTemp) {
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
      temperature: parseFloat(outdoorTemp),
      indoorTemperature: parseFloat(indoorTemp)
    };

    return NextResponse.json({ success: true, data: transformedData });
  } catch (error) {
    console.error('Error in fetchWifiAf83Data:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch weather data' },
      { status: 500 }
    );
  }
}
