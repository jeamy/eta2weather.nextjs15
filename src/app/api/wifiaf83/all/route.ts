import { NextResponse } from 'next/server';
import { WifiAf83Api } from '@/reader/functions/WifiAf83Api';
import { logData } from '@/utils/logging';
import { getWifiAf83Data } from '@/utils/cache';
import { WifiData } from '@/reader/functions/types-constants/WifiConstants';

export async function GET() {
  try {
    const wifiApi = new WifiAf83Api();
    const allData = await getWifiAf83Data(() => wifiApi.getAllRealtime());

    // Log raw data for debugging
//    console.log('Raw WifiAf83 data:', JSON.stringify(allData, null, 2));

    // Handle both direct API response and cached file format
    const data = allData.data || allData;

    // Validate that we have the required data
    if (!data.outdoor?.temperature?.value || !data.indoor?.temperature?.value) {
      throw new Error('Invalid data structure');
    }

    // Log all data
    await logData('ecowitt', { data, timestamp: Date.now() });
    
    return NextResponse.json({ 
      success: true, 
      data: data
    });
  } catch (error) {
    console.error('Error in getAllWifiAf83Data:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch weather data' },
      { status: 500 }
    );
  }
}
