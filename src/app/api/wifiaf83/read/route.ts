import { NextResponse } from 'next/server';
import { WifiAf83Api } from '@/reader/functions/WifiAf83Api';
import { getConfig, getWifiAf83Data } from '@/utils/cache';
import { WifiAF83Data } from '@/reader/functions/types-constants/WifiAf83';
import { parseNum } from '@/utils/numberParser';
import { getFreshWifiMeasurementTime, getMaxFreshDataAge, getWifiMeasurementTime } from '@/lib/controlFreshness';

export async function GET(request: Request) {
  const wifiApi = new WifiAf83Api();

  try {
    let fallback = false;
    const allData = await getWifiAf83Data((s) => wifiApi.getAllRealtime(s), request.signal, {
      onFallback: () => { fallback = true; },
    });

    // Extract and validate temperature values
    const outdoorTemp = parseNum(allData.outdoor?.temperature?.value);
    const indoorTemp = parseNum(allData.indoor?.temperature?.value);

    if (outdoorTemp === null || indoorTemp === null) {
      throw new Error('Invalid temperature values');
    }

    const outdoorTime = allData.outdoor?.temperature?.time;
    const indoorTime = allData.indoor?.temperature?.time;
    const measurementTime = getWifiMeasurementTime(outdoorTime, indoorTime);
    const config = await getConfig();
    const fresh = getFreshWifiMeasurementTime(
      outdoorTime, indoorTime, Date.now(), getMaxFreshDataAge(config.t_update_timer, 600000),
    );

    const transformedData: WifiAF83Data = {
      time: measurementTime ?? 0,
      datestring: measurementTime === null ? '' : new Date(measurementTime).toLocaleString('de-DE', {
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
      allData: null,
      stale: fallback || fresh === null,
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
