import { NextResponse } from 'next/server';
import { WifiAf83Api } from '@/reader/functions/WifiAf83Api';

export async function GET() {
  const wifiApi = new WifiAf83Api();

  try {
    const response = await wifiApi.getAllRealtime();
    
    // Check if the response has the expected structure
    if (!response || response.code !== 0) {
      throw new Error(`Failed to fetch WifiAf83 data: ${response?.msg || 'Unknown error'}`);
    }

    // console.log("WifiAf83 data: ", response);
    
    return NextResponse.json({ 
      success: true, 
      data: response.data 
    });
  } catch (error) {
    console.error('Error in getAllRealtime:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch weather data' },
      { status: 500 }
    );
  }
}
