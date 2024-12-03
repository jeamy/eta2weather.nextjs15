'use client';

import dynamic from 'next/dynamic';
import { useEffect, useState, useRef, useCallback } from 'react';
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

  const resetZoom = useCallback((chartRef: React.RefObject<ChartJS<'line'> | null>) => {
    if (chartRef.current) {
      chartRef.current.resetZoom();
    }
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const response = await fetch(`/api/weather?range=${timeRange}`);
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        setWeatherData(data);
      } catch (error) {
        console.error('Error fetching weather data:', error);
        setError(error instanceof Error ? error.message : 'Failed to fetch weather data');
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 60000); // Update every minute

    return () => clearInterval(interval);
  }, [timeRange]);

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center p-4 bg-red-50 rounded-lg">
          <h2 className="text-red-800 text-lg font-semibold mb-2">Error</h2>
          <p className="text-red-600">{error}</p>
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

  const formatDate = (timestamp: string) => {
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

  const formatFullDateTime = (timestamp: string) => {
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

  const getTitleText = () => {
    switch (timeRange) {
      case '24h':
        return 'Wetterdaten der letzten 24 Stunden';
      case '7d':
        return 'Wetterdaten der letzten 7 Tage';
      case '30d':
        return 'Wetterdaten der letzten 30 Tage';
      case '1m':
        return 'Wetterdaten des letzten Monats';
    }
  };

  const mainChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      mode: 'index',
      intersect: false,
    },
    plugins: {
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
      tooltip: {
        callbacks: {
          title: (context: any[]) => {
            const timestamp = weatherData[context[0].dataIndex].timestamp;
            return formatFullDateTime(timestamp);
          },
          label: (context: any) => {
            let label = context.dataset.label || '';
            let value = context.parsed.y;
            
            if (label === 'Temperatur' || label.includes('CH')) {
              return `${label}: ${value.toFixed(1)}°C`;
            } else if (label === 'Luftfeuchtigkeit') {
              return `${label}: ${value.toFixed(0)}%`;
            } else if (label === 'Luftdruck') {
              return `${label}: ${value.toFixed(1)} hPa`;
            }
            return `${label}: ${value}`;
          },
        }
      },
      title: {
        display: true,
        text: getTitleText(),
        font: {
          family: "var(--font-geist-mono)"
        }
      },
    },
    scales: {
      x: {
        type: 'time',
        time: {
          unit: timeRange === '24h' ? 'hour' : 'day',
          displayFormats: {
            hour: 'HH:mm',
            day: 'dd.MM.',
          },
          tooltipFormat: 'dd.MM.yyyy HH:mm:ss'
        },
        ticks: {
          font: {
            family: "var(--font-geist-mono)"
          },
          maxRotation: 0,
          callback: function(value: any) {
            const date = new Date(value);
            return formatDate(date.toISOString());
          }
        },
        grid: {
          display: true,
          drawBorder: true,
        },
      },
      y: {
        type: 'linear',
        display: true,
        position: 'left',
        title: {
          display: true,
          text: 'Temperatur (°C)',
          font: {
            family: "var(--font-geist-mono)"
          }
        },
        ticks: {
          font: {
            family: "var(--font-geist-mono)"
          }
        },
        grid: {
          color: (context: any) => {
            if (context.tick.value === 0) {
              return 'rgba(0, 0, 0, 0.3)';
            }
            return 'rgba(0, 0, 0, 0.1)';
          },
          lineWidth: (context: any) => {
            if (context.tick.value === 0) {
              return 2;
            }
            return 1;
          }
        }
      },
      y1: {
        type: 'linear',
        display: true,
        position: 'right',
        title: {
          display: true,
          text: 'Luftdruck (hPa)',
          font: {
            family: "var(--font-geist-mono)"
          }
        },
        grid: {
          drawOnChartArea: false,
        },
        ticks: {
          font: {
            family: "var(--font-geist-mono)"
          }
        }
      },
      y2: {
        type: 'linear',
        display: true,
        position: 'right',
        title: {
          display: true,
          text: 'Luftfeuchtigkeit (%)',
          font: {
            family: "var(--font-geist-mono)"
          }
        },
        grid: {
          drawOnChartArea: false,
        },
        ticks: {
          font: {
            family: "var(--font-geist-mono)"
          }
        }
      },
    },
  };

  const channelTempChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      mode: 'index',
      intersect: false,
    },
    plugins: {
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
      tooltip: {
        callbacks: {
          title: (context: any[]) => {
            const timestamp = weatherData[context[0].dataIndex].timestamp;
            return formatFullDateTime(timestamp);
          },
        }
      },
      title: {
        display: true,
        text: 'Kanal Temperaturen',
        font: {
          family: "var(--font-geist-mono)"
        }
      },
    },
    scales: {
      x: {
        type: 'time',
        time: {
          unit: timeRange === '24h' ? 'hour' : 'day',
          displayFormats: {
            hour: 'HH:mm',
            day: 'dd.MM.',
          },
          tooltipFormat: 'dd.MM.yyyy HH:mm:ss'
        },
        ticks: {
          font: {
            family: "var(--font-geist-mono)"
          },
          maxRotation: 0,
          callback: function(value: any) {
            const date = new Date(value);
            return formatDate(date.toISOString());
          }
        },
        grid: {
          display: true,
          drawBorder: true,
        },
      },
      y: {
        type: 'linear',
        display: true,
        position: 'left',
        title: {
          display: true,
          text: 'Temperatur (°C)',
          font: {
            family: "var(--font-geist-mono)"
          }
        },
        ticks: {
          font: {
            family: "var(--font-geist-mono)"
          }
        },
        grid: {
          color: (context: any) => {
            if (context.tick.value === 0) {
              return 'rgba(0, 0, 0, 0.3)';
            }
            return 'rgba(0, 0, 0, 0.1)';
          },
          lineWidth: (context: any) => {
            if (context.tick.value === 0) {
              return 2;
            }
            return 1;
          }
        }
      },
    },
  };

  const channelHumidityChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      mode: 'index',
      intersect: false,
    },
    plugins: {
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
      tooltip: {
        callbacks: {
          title: (context: any[]) => {
            const timestamp = weatherData[context[0].dataIndex].timestamp;
            return formatFullDateTime(timestamp);
          },
        }
      },
      title: {
        display: true,
        text: 'Kanal Luftfeuchtigkeit',
        font: {
          family: "var(--font-geist-mono)"
        }
      },
    },
    scales: {
      x: {
        type: 'time',
        time: {
          unit: timeRange === '24h' ? 'hour' : 'day',
          displayFormats: {
            hour: 'HH:mm',
            day: 'dd.MM.',
          },
          tooltipFormat: 'dd.MM.yyyy HH:mm:ss'
        },
        ticks: {
          font: {
            family: "var(--font-geist-mono)"
          },
          maxRotation: 0,
          callback: function(value: any) {
            const date = new Date(value);
            return formatDate(date.toISOString());
          }
        },
        grid: {
          display: true,
          drawBorder: true,
        },
      },
      y: {
        type: 'linear',
        display: true,
        position: 'left',
        title: {
          display: true,
          text: 'Luftfeuchtigkeit (%)',
          font: {
            family: "var(--font-geist-mono)"
          }
        },
        ticks: {
          font: {
            family: "var(--font-geist-mono)"
          }
        },
        min: 0,
        max: 100
      },
    },
  };

  const baseColors = [
    { border: '#FF6384', background: 'rgba(255, 99, 132, 0.2)' },
    { border: '#36A2EB', background: 'rgba(54, 162, 235, 0.2)' },
    { border: '#FFCE56', background: 'rgba(255, 206, 86, 0.2)' },
    { border: '#4BC0C0', background: 'rgba(75, 192, 192, 0.2)' },
    { border: '#9966FF', background: 'rgba(153, 102, 255, 0.2)' },
    { border: '#FF9F40', background: 'rgba(255, 159, 64, 0.2)' },
    { border: '#EA80FC', background: 'rgba(234, 128, 252, 0.2)' },
    { border: '#B388FF', background: 'rgba(179, 136, 255, 0.2)' }
  ];

  const getChannelColor = (channel: string) => {
    // Ensure we get a positive index
    const channelNum = Math.abs(parseInt(channel) || 1);
    const index = ((channelNum - 1) % baseColors.length + baseColors.length) % baseColors.length;
    
    return {
      border: baseColors[index].border,
      background: baseColors[index].background
    };
  };

  const mainChartData = {
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
  };

  const channelTempChartData = weatherData.length > 0 ? {
    labels: weatherData.map(d => formatDate(d.timestamp)),
    datasets: Object.keys(weatherData[0].channels || {}).map((channel) => {
      const color = getChannelColor(channel);
      return {
        label: `CH${channel}`,
        data: weatherData.map(d => d.channels[channel].temperature),
        borderColor: color.border,
        backgroundColor: color.background,
        borderWidth: 1,
        pointRadius: 1,
        pointHoverRadius: 3,
        yAxisID: 'y',
      };
    }),
  } : { labels: [], datasets: [] };

  const channelHumidityChartData = weatherData.length > 0 ? {
    labels: weatherData.map(d => formatDate(d.timestamp)),
    datasets: Object.keys(weatherData[0].channels || {}).map((channel) => {
      const color = getChannelColor(channel);
      return {
        label: `CH${channel}`,
        data: weatherData.map(d => d.channels[channel].humidity),
        borderColor: color.border,
        backgroundColor: color.background,
        borderWidth: 1,
        pointRadius: 1,
        pointHoverRadius: 3,
        yAxisID: 'y',
      };
    }),
  } : { labels: [], datasets: [] };

  const handleTimeRangeChange = (range: TimeRange) => {
    setTimeRange(range);
  };

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
        mainChartData={mainChartData}
        channelTempChartData={channelTempChartData}
        channelHumidityChartData={channelHumidityChartData}
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
