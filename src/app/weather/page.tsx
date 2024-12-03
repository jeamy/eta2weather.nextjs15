'use client';

import dynamic from 'next/dynamic';
import { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { useSelector } from 'react-redux';
import { RootState } from '@/redux';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  TimeScale,
  ChartOptions,
  TimeSeriesScale,
  ScriptableScaleContext,
} from 'chart.js';

// Dynamically import WeatherCharts component with no SSR
const WeatherCharts = dynamic(
  () => import('@/components/WeatherCharts'),
  { ssr: false }
);

interface WeatherData {
  timestamp: string;
  temperature: number;
  humidity: number;
  pressure: number;
  channels: {
    [key: string]: {
      temperature: number;
      humidity: number;
    };
  };
}

type TimeRange = '24h' | '7d' | '30d' | '1m';

interface WeatherPageProps {
  // Add any props that WeatherPage component might receive
}

// Register ChartJS components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  TimeScale,
  TimeSeriesScale
);

export default function WeatherPage(props: WeatherPageProps) {
  const [weatherData, setWeatherData] = useState<WeatherData[]>([]);
  const [timeRange, setTimeRange] = useState<TimeRange>('24h');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mainChartRef = useRef<ChartJS<'line'> | null>(null);
  const channelTempChartRef = useRef<ChartJS<'line'> | null>(null);
  const channelHumidityChartRef = useRef<ChartJS<'line'> | null>(null);

  
  // Get channel names from Redux store at the top level
  const reduxConfig = useSelector((state: RootState) => state.config);

  console.log('Weather page config state:', {
    isInitialized: reduxConfig.isInitialized,
    channelNames: reduxConfig?.data?.channelNames
  });

  // Function to get channel name from config
  const getChannelName = useCallback((channel: string) => {
    // Only use config if it's initialized
    if (reduxConfig.isInitialized && reduxConfig.data.channelNames) {
      const channelKey = `CH${channel}`.toUpperCase();
      const configName = reduxConfig.data.channelNames[channelKey];
      if (configName) return configName;
    }
    return `CH${channel}`;
  }, [reduxConfig]);

  // Utility function to generate consistent colors for channels
  const getChannelColor = (channel: string): { border: string; background: string } => {
    const baseColors = [
      { border: 'rgb(255, 99, 132)', background: 'rgba(255, 99, 132, 0.5)' },
      { border: 'rgb(53, 162, 235)', background: 'rgba(53, 162, 235, 0.5)' },
      { border: 'rgb(255, 159, 64)', background: 'rgba(255, 159, 64, 0.5)' },
      { border: 'rgb(75, 192, 192)', background: 'rgba(75, 192, 192, 0.5)' },
      { border: 'rgb(153, 102, 255)', background: 'rgba(153, 102, 255, 0.5)' },
      { border: 'rgb(255, 205, 86)', background: 'rgba(255, 205, 86, 0.5)' },
      { border: 'rgb(201, 203, 207)', background: 'rgba(201, 203, 207, 0.5)' },
      { border: 'rgb(54, 162, 235)', background: 'rgba(54, 162, 235, 0.5)' },
    ] as const;
    
    // Ensure we have a valid numeric index
    const channelNum = Math.max(1, parseInt(channel) || 1);
    const index = (channelNum - 1) % baseColors.length;
    
    return baseColors[index];
  };

  const formatDate = (timestamp: string): string => {
    const date = new Date(timestamp);
    switch (timeRange) {
      case '24h':
        return date.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
      case '7d':
        return date.toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit' });
      case '30d':
        return date.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });
      case '1m':
        return date.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });
      default:
        return date.toLocaleString('de-DE');
    }
  };

  const formatFullDateTime = (timestamp: string): string => {
    const date = new Date(timestamp);
    return date.toLocaleString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  const getTitleText = (): string => {
    switch (timeRange) {
      case '24h':
        return 'Wetterdaten der letzten 24 Stunden';
      case '7d':
        return 'Wetterdaten der letzten 7 Tage';
      case '30d':
        return 'Wetterdaten der letzten 30 Tage';
      case '1m':
        return 'Wetterdaten des letzten Monats';
      default:
        return 'Wetterdaten';
    }
  };

  const resetZoom = useCallback((chartRef: React.RefObject<ChartJS<'line'> | null>) => {
    if (chartRef.current) {
      chartRef.current.resetZoom();
    }
  }, []);

  // Memoize chart data to prevent unnecessary recalculations
  const memoizedChartData = useMemo(() => {
    if (!weatherData.length) return null;

    const channels = weatherData[0].channels || {};
    const channelKeys = Object.keys(channels);

    return {
      mainChartData: {
        labels: weatherData.map(d => formatDate(d.timestamp)),
        datasets: [
          {
            label: 'Temperatur',
            data: weatherData.map(d => d.temperature),
            borderColor: 'rgb(255, 99, 132)',
            backgroundColor: 'rgba(255, 99, 132, 0.5)',
            borderWidth: 1,
            pointRadius: 1,
            pointHoverRadius: 3,
            yAxisID: 'y',
          },
          {
            label: 'Luftdruck',
            data: weatherData.map(d => d.pressure),
            borderColor: 'rgb(53, 162, 235)',
            backgroundColor: 'rgba(53, 162, 235, 0.5)',
            borderWidth: 1,
            pointRadius: 1,
            pointHoverRadius: 3,
            yAxisID: 'y1',
          },
          {
            label: 'Luftfeuchtigkeit',
            data: weatherData.map(d => d.humidity),
            borderColor: 'rgb(75, 192, 192)',
            backgroundColor: 'rgba(75, 192, 192, 0.5)',
            borderWidth: 1,
            pointRadius: 1,
            pointHoverRadius: 3,
            yAxisID: 'y2',
          },
        ],
      },
      channelTempChartData: channelKeys.length > 0 ? {
        labels: weatherData.map(d => formatDate(d.timestamp)),
        datasets: channelKeys.map((channel) => {
          console.log('Processing channel:', channel);
          const color = getChannelColor(channel);
          // Extract the channel number and convert to uppercase for consistent lookup
          const channelNum = channel.replace(/[^\d]/g, '');
          const name = getChannelName(channelNum);
          console.log('Channel name result:', name);
          return {
            label: `${name} (°C)`,
            data: weatherData.map(d => d.channels[channel]?.temperature || 0),
            borderColor: color.border,
            backgroundColor: color.background,
            borderWidth: 1,
            pointRadius: 1,
            pointHoverRadius: 3,
            yAxisID: 'y',
          };
        }),
      } : { labels: [], datasets: [] },
      channelHumidityChartData: channelKeys.length > 0 ? {
        labels: weatherData.map(d => formatDate(d.timestamp)),
        datasets: channelKeys.map((channel) => {
          console.log('Processing channel (humidity):', channel);
          const color = getChannelColor(channel);
          // Extract the channel number and convert to uppercase for consistent lookup
          const channelNum = channel.replace(/[^\d]/g, '');
          const name = getChannelName(channelNum);
          console.log('Channel name result (humidity):', name);
          return {
            label: `${name} (%)`,
            data: weatherData.map(d => d.channels[channel]?.humidity || 0),
            borderColor: color.border,
            backgroundColor: color.background,
            borderWidth: 1,
            pointRadius: 1,
            pointHoverRadius: 3,
            yAxisID: 'y',
          };
        }),
      } : { labels: [], datasets: [] },
    };
  }, [weatherData, timeRange, getChannelName]);

  // Implement data fetching with SWR for better caching and revalidation
  const fetchWeatherData = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const controller = new AbortController();
      const signal = controller.signal;
      
      const response = await fetch(`/api/weather?range=${timeRange}`, {
        signal,
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      setWeatherData(data);
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        return; // Ignore abort errors
      }
      console.error('Error fetching weather data:', error);
      setError(error instanceof Error ? error.message : 'Failed to fetch weather data');
    } finally {
      setIsLoading(false);
    }
  }, [timeRange]);

  useEffect(() => {
    const controller = new AbortController();
    fetchWeatherData();
    
    // Implement intelligent polling based on time range
    const pollInterval = timeRange === '24h' ? 60000 : // 1 minute for 24h
                        timeRange === '7d' ? 300000 : // 5 minutes for 7d
                        timeRange === '30d' ? 900000 : // 15 minutes for 30d
                        3600000; // 1 hour for 1m
    
    const interval = setInterval(fetchWeatherData, pollInterval);

    return () => {
      controller.abort();
      clearInterval(interval);
    };
  }, [timeRange, fetchWeatherData]);

  const mainChartOptions = {
    responsive: true,
    interaction: {
      mode: 'index' as const,
      intersect: false,
    },
    plugins: {
      title: {
        display: true,
        text: getTitleText(),
      },
      zoom: {
        zoom: {
          wheel: {
            enabled: true,
          },
          pinch: {
            enabled: true,
          },
          mode: 'x',
        },
        pan: {
          enabled: true,
          mode: 'x',
        },
      },
    },
    scales: {
      x: {
        type: 'time',
        time: {
          unit: timeRange === '24h' ? 'hour' : 'day',
        },
        title: {
          display: true,
          text: 'Zeit',
        },
      },
      y: {
        type: 'linear' as const,
        display: true,
        position: 'left' as const,
        title: {
          display: true,
          text: 'Temperatur (°C)',
        },
        grid: {
          drawZero: true,
          borderWidth: (context: ScriptableScaleContext) => {
            return context.tick.value === 0 ? 5 : 1;  // Much thicker zero line
          },
          lineWidth: (context: ScriptableScaleContext) => {
            return context.tick.value === 0 ? 5 : 1;  // Much thicker zero line
          },
          color: (context: ScriptableScaleContext) => {
            return context.tick.value === 0 ? 'rgba(0, 0, 0, 0.5)' : 'rgba(0, 0, 0, 0.1)';  // Even darker zero line
          },
        },
      },
      y1: {
        type: 'linear' as const,
        display: true,
        position: 'right' as const,
        title: {
          display: true,
          text: 'Luftdruck (hPa)',
        },
        grid: {
          drawOnChartArea: false,
        },
      },
      y2: {
        type: 'linear' as const,
        display: true,
        position: 'right' as const,
        title: {
          display: true,
          text: 'Luftfeuchtigkeit (%)',
        },
        grid: {
          drawOnChartArea: false,
        },
      },
    },
  };

  const createChannelOptions = (title: string, unit: string) => ({
    responsive: true,
    interaction: {
      mode: 'index' as const,
      intersect: false,
    },
    plugins: {
      title: {
        display: true,
        text: title,
      },
      zoom: {
        zoom: {
          wheel: {
            enabled: true,
          },
          pinch: {
            enabled: true,
          },
          mode: 'x',
        },
        pan: {
          enabled: true,
          mode: 'x',
        },
      },
    },
    scales: {
      x: {
        type: 'time',
        time: {
          unit: timeRange === '24h' ? 'hour' : 'day',
        },
        title: {
          display: true,
          text: 'Zeit',
        },
      },
      y: {
        type: 'linear' as const,
        display: true,
        position: 'left' as const,
        title: {
          display: true,
          text: `${title} (${unit})`,
        },
        grid: {
          drawZero: true,
          borderWidth: (context: ScriptableScaleContext) => {
            return context.tick.value === 0 ? 5 : 1;  // Much thicker zero line
          },
          lineWidth: (context: ScriptableScaleContext) => {
            return context.tick.value === 0 ? 5 : 1;  // Much thicker zero line
          },
          color: (context: ScriptableScaleContext) => {
            return context.tick.value === 0 ? 'rgba(0, 0, 0, 0.5)' : 'rgba(0, 0, 0, 0.1)';  // Even darker zero line
          },
        },
      },
    },
  });

  const channelTempChartOptions = createChannelOptions('Kanal Temperaturen', '°C');
  const channelHumidityChartOptions = createChannelOptions('Kanal Luftfeuchtigkeit', '%');

  const handleTimeRangeChange = (range: TimeRange) => {
    setTimeRange(range);
  };

  // Add error boundary component
  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center p-6 bg-red-50 rounded-lg shadow-lg">
          <h2 className="text-red-800 text-xl font-semibold mb-3">Error Loading Weather Data</h2>
          <p className="text-red-600 mb-4">{error}</p>
          <button
            onClick={() => fetchWeatherData()}
            className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (isLoading && weatherData.length === 0) {
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
        weatherData={weatherData}
        resetZoom={resetZoom}
        mainChartRef={mainChartRef}
        channelTempChartRef={channelTempChartRef}
        channelHumidityChartRef={channelHumidityChartRef}
        mainChartOptions={mainChartOptions}
        channelTempChartOptions={channelTempChartOptions}
        channelHumidityChartOptions={channelHumidityChartOptions}
        mainChartData={memoizedChartData?.mainChartData}
        channelTempChartData={memoizedChartData?.channelTempChartData}
        channelHumidityChartData={memoizedChartData?.channelHumidityChartData}
        timeRange={timeRange}
        onTimeRangeChange={handleTimeRangeChange}
      />
      <div className="flex gap-2">
        <button
          onClick={() => handleTimeRangeChange('24h')}
          className={`px-3 py-1 rounded ${
            timeRange === '24h'
              ? 'bg-blue-100 text-blue-600'
              : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          24h
        </button>
        <button
          onClick={() => handleTimeRangeChange('7d')}
          className={`px-3 py-1 rounded ${
            timeRange === '7d'
              ? 'bg-blue-100 text-blue-600'
              : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          7d
        </button>
        <button
          onClick={() => handleTimeRangeChange('30d')}
          className={`px-3 py-1 rounded ${
            timeRange === '30d'
              ? 'bg-blue-100 text-blue-600'
              : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          30d
        </button>
        <button
          onClick={() => handleTimeRangeChange('1m')}
          className={`px-3 py-1 rounded ${
            timeRange === '1m'
              ? 'bg-blue-100 text-blue-600'
              : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          1m
        </button>
      </div>
    </div>
  );
}
