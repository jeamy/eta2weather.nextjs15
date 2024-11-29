import { NextResponse } from 'next/server';
import { fetchWifiAf83Data } from '@/reader/functions/WifiAf83Data';

export async function GET() {
  try {
    // Fetch WifiAf83 data
    const wifiAf83Data = await fetchWifiAf83Data();

    return NextResponse.json({
      data: wifiAf83Data,
    });
  } catch (error) {
    console.error('Error fetching WifiAf83 data:', error);
    return NextResponse.json(
      { error: 'Failed to fetch WifiAf83 data' },
      { status: 500 }
    );
  }
}
