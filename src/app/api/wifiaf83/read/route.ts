import { NextResponse } from 'next/server';
import { WifiAf83Api } from '@/reader/functions/WifiAf83Api';
import { getWifiAf83Data } from '@/utils/cache';

export async function GET() {
  try {
    const wifiApi = new WifiAf83Api();
    const data = await getWifiAf83Data(() => wifiApi.getAllRealtime());
    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('Error in fetchWifiAf83Data:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch weather data' },
      { status: 500 }
    );
  }
}
