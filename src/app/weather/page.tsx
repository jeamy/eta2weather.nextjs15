'use client';

import { useState, useRef, useCallback } from 'react';
import dynamic from 'next/dynamic';
import type { Chart as ChartJS } from 'chart.js';
import useSWR from 'swr';

// Create a dynamic component for the charts
const WeatherCharts = dynamic(
  () => import('@/components/WeatherCharts'),
  { ssr: false }
);

// Chart options and datasets are defined within WeatherCharts (single source of truth).

interface WeatherData {
  timestamp: string;
  temperature: number;
  humidity: number;
  pressure: number;
  indoor: {
    temperature: number;
    humidity: number;
  };
  channels: {
    [key: string]: {
      temperature: number;
      humidity: number;
    };
  };
}

interface WeatherPageProps {
  // Add any props that WeatherPage component might receive
}

export default function WeatherPage(props: WeatherPageProps) {
  const [timeRange, setTimeRange] = useState<string>('24h');
  const mainChartRef = useRef<ChartJS<'line'> | null>(null);
  const channelTempChartRef = useRef<ChartJS<'line'> | null>(null);
  const channelHumidityChartRef = useRef<ChartJS<'line'> | null>(null);

  const fetcher = useCallback((url: string) =>
    fetch(url).then((res) => {
      if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
      return res.json();
    }),
  []);

  const refreshInterval =
    timeRange === '24h' ? 60000 :
    timeRange === '7d' ? 300000 :
    timeRange === '30d' ? 900000 :
    3600000;

  const { data: weatherData, error: weatherError, isLoading: isLoadingWeather, mutate: refetchWeather } =
    useSWR<WeatherData[]>(`/api/weather?range=${timeRange}`, fetcher, {
      refreshInterval,
      revalidateOnFocus: true,
      dedupingInterval: 30000,
    });

  const { data: channelNames, error: channelError, isLoading: isLoadingChannels } =
    useSWR<Record<string, string>>('/api/channelnames', fetcher, {
      revalidateOnFocus: false,
    });

  // Channel names are loaded via SWR above.

  // Channel name mapping is provided directly to WeatherCharts.

  // Colors and datasets are handled inside WeatherCharts.

  // Date/time formatting is handled by chart options inside WeatherCharts.

  // Title text is controlled within WeatherCharts.

  const resetZoom = useCallback(() => {
    if (mainChartRef.current) {
      mainChartRef.current.resetZoom();
    }
    if (channelTempChartRef.current) {
      channelTempChartRef.current.resetZoom();
    }
    if (channelHumidityChartRef.current) {
      channelHumidityChartRef.current.resetZoom();
    }
  }, []);

  // Chart data/options are computed inside WeatherCharts.

  // Weather data fetching handled by SWR.

  // Polling is configured via SWR's refreshInterval.

  // Main chart options are defined in WeatherCharts.

  // Channel chart options are defined in WeatherCharts.

  const handleTimeRangeChange = useCallback((range: string) => {
    setTimeRange(range);
  }, []);

  // Add error boundary component
  if (weatherError) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center p-6 bg-red-50 rounded-lg shadow-lg">
          <h2 className="text-red-800 text-xl font-semibold mb-3">Error Loading Weather Data</h2>
          <p className="text-red-600 mb-4">{weatherError.message}</p>
          <button
            onClick={() => refetchWeather()}
            className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (isLoadingWeather && !weatherData) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading weather data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4">
      <WeatherCharts
        weatherData={weatherData || []}
        timeRange={timeRange}
        onTimeRangeChange={handleTimeRangeChange}
        resetZoom={resetZoom}
        mainChartRef={mainChartRef}
        channelTempChartRef={channelTempChartRef}
        channelHumidityChartRef={channelHumidityChartRef}
        channelNames={channelNames || {}}
      />
    </div>
  );
}
