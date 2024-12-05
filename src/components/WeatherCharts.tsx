'use client';

import { useEffect, useMemo, useCallback } from 'react';
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
import { Line } from 'react-chartjs-2';
import zoomPlugin from 'chartjs-plugin-zoom';
import { ArrowPathIcon } from '@heroicons/react/24/outline';
import { de } from 'date-fns/locale';
import 'chartjs-adapter-date-fns';

// Initialize Chart.js in useEffect
const initChart = () => {
  ChartJS.register(
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Legend,
    TimeScale,
    TimeSeriesScale,
    zoomPlugin
  );
};

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

interface WeatherChartsProps {
  weatherData: WeatherData[];
  timeRange: string;
  onTimeRangeChange: (range: string) => void;
  resetZoom: () => void;
  mainChartRef: React.RefObject<ChartJS<'line'>>;
  channelTempChartRef: React.RefObject<ChartJS<'line'>>;
  channelHumidityChartRef: React.RefObject<ChartJS<'line'>>;
  mainChartOptions: ChartOptions<'line'>;
  channelTempChartOptions: ChartOptions<'line'>;
  channelHumidityChartOptions: ChartOptions<'line'>;
  mainChartData: any;
  channelTempChartData: any;
  channelHumidityChartData: any;
  getChannelName: (channel: string) => string;
}

// Colors for different channels - using a function to generate colors dynamically
const getChannelColor = (index: number) => {
  // Base colors that will be cycled through
  const baseColors = [
    { border: 'rgb(255, 99, 132)', background: 'rgba(255, 99, 132, 0.5)' },
    { border: 'rgb(53, 162, 235)', background: 'rgba(53, 162, 235, 0.5)' },
    { border: 'rgb(255, 159, 64)', background: 'rgba(255, 159, 64, 0.5)' },
    { border: 'rgb(75, 192, 192)', background: 'rgba(75, 192, 192, 0.5)' },
    { border: 'rgb(153, 102, 255)', background: 'rgba(153, 102, 255, 0.5)' },
    { border: 'rgb(255, 205, 86)', background: 'rgba(255, 205, 86, 0.5)' },
    { border: 'rgb(201, 203, 207)', background: 'rgba(201, 203, 207, 0.5)' },
    { border: 'rgb(54, 162, 235)', background: 'rgba(54, 162, 235, 0.5)' },
  ];
  
  // Cycle through the colors if we have more channels than colors
  return baseColors[index % baseColors.length];
};

export default function WeatherCharts({
  weatherData,
  timeRange,
  onTimeRangeChange,
  resetZoom,
  mainChartRef,
  channelTempChartRef,
  channelHumidityChartRef,
  mainChartOptions,
  channelTempChartOptions,
  channelHumidityChartOptions,
  mainChartData,
  channelTempChartData,
  channelHumidityChartData,
  getChannelName
}: WeatherChartsProps) {
  type ChartRef = ChartJS<'line'>;

  // Initialize Chart.js only once on component mount
  useEffect(() => {
    initChart();
  }, []);

  // Memoize time range buttons to prevent unnecessary re-renders
  const TimeRangeButtons = useMemo(() => {
    const timeRanges: { value: string; label: string }[] = [
      { value: '24h', label: '24h' },
      { value: '7d', label: '7d' },
      { value: '30d', label: '30d' },
      { value: '1m', label: '1m' },
    ];

    return (
      <div className="flex space-x-2 mb-4">
        {timeRanges.map(({ value, label }) => (
          <button
            key={value}
            onClick={() => onTimeRangeChange(value)}
            className={`px-3 py-1 rounded ${
              timeRange === value
                ? 'bg-blue-500 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            } transition-colors duration-200`}
          >
            {label}
          </button>
        ))}
      </div>
    );
  }, [timeRange, onTimeRangeChange]);

  // Memoize reset zoom buttons
  const ResetZoomButton = useCallback(({ chartRef }: { chartRef: React.RefObject<ChartRef> }) => (
    <button
      onClick={() => resetZoom()}
      className="ml-2 p-1 rounded hover:bg-gray-100 transition-colors"
      title="Reset Zoom"
    >
      <ArrowPathIcon className="h-5 w-5 text-gray-600" />
    </button>
  ), [resetZoom]);

  // Memoize main chart data
  const mainChartDataUpdated = useMemo(() => ({
    labels: weatherData.map((data) => data.timestamp),
    datasets: [
      {
        label: 'Temperatur (°C)',
        data: weatherData.map((data) => data.temperature),
        borderColor: 'rgb(255, 99, 132)',
        backgroundColor: 'rgba(255, 99, 132, 0.5)',
        yAxisID: 'y-temperature',
        borderWidth: 1,
        pointRadius: 1,
        pointHoverRadius: 3,
      },
      {
        label: 'Luftfeuchtigkeit (%)',
        data: weatherData.map((data) => data.humidity),
        borderColor: 'rgb(53, 162, 235)',
        backgroundColor: 'rgba(53, 162, 235, 0.5)',
        yAxisID: 'y-humidity',
        borderWidth: 1,
        pointRadius: 1,
        pointHoverRadius: 3,
      },
      {
        label: 'Luftdruck (hPa)',
        data: weatherData.map((data) => data.pressure),
        borderColor: 'rgb(75, 192, 192)',
        backgroundColor: 'rgba(75, 192, 192, 0.5)',
        yAxisID: 'y-pressure',
        borderWidth: 1,
        pointRadius: 1,
        pointHoverRadius: 3,
      },
    ],
  }), [weatherData]);

  // Memoize chart options
  const mainChartOptionsUpdated: ChartOptions<'line'> = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      mode: 'index' as const,
      intersect: false,
    },
    scales: {
      x: {
        type: 'time' as const,
        adapters: {
          date: {
            locale: de,
          },
        },
        time: {
          unit: timeRange === '24h' ? 'hour' : timeRange === '7d' ? 'day' : timeRange === '30d' ? 'day' : 'month',
          displayFormats: {
            hour: 'HH:mm',
            day: 'dd.MM.',
            month: 'MMM yyyy'
          },
          tooltipFormat: 'dd.MM.yyyy HH:mm',
        },
        ticks: {
          maxRotation: 0,
          source: 'auto',
          autoSkip: true,
          maxTicksLimit: timeRange === '24h' ? 12 : timeRange === '7d' ? 7 : timeRange === '30d' ? 15 : 31,
        },
      },
      'y-temperature': {
        type: 'linear' as const,
        display: true,
        position: 'left' as const,
        title: {
          display: true,
          text: 'Temperatur (°C)',
        },
        grid: {
          drawOnChartArea: true,
        },
      },
      'y-humidity': {
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
      'y-pressure': {
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
          label: function(context) {
            let label = context.dataset.label || '';
            if (label) {
              label += ': ';
            }
            if (context.parsed.y !== null) {
              if (context.dataset.yAxisID === 'y-temperature') {
                label += context.parsed.y.toFixed(1) + ' °C';
              } else if (context.dataset.yAxisID === 'y-humidity') {
                label += context.parsed.y.toFixed(1) + ' %';
              } else if (context.dataset.yAxisID === 'y-pressure') {
                label += context.parsed.y.toFixed(1) + ' hPa';
              }
            }
            return label;
          }
        }
      }
    },
  }), [timeRange]);

  // Memoize channel datasets creation
  const createChannelDatasets = useCallback((channels: string[], type: 'temperature' | 'humidity') => {
    if (!weatherData.length) return { labels: [], datasets: [] };
    
    return {
      labels: weatherData.map((data) => data.timestamp),
      datasets: channels.map((channel, index) => {
        const color = getChannelColor(index);
        const name = getChannelName(channel.replace('ch', ''));
        return {
          label: `${name} (${type === 'temperature' ? '°C' : '%'})`,
          data: weatherData.map((data) => data.channels[channel]?.[type]),
          borderColor: color.border,
          backgroundColor: color.background,
          borderWidth: 1,
          pointRadius: 1,
          pointHoverRadius: 3,
        };
      }),
    };
  }, [weatherData, getChannelName]);

  // Memoize channel options creation
  const createChannelOptions = useCallback((title: string, unit: string): ChartOptions<'line'> => ({
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      mode: 'index' as const,
      intersect: false,
    },
    scales: {
      x: {
        type: 'time' as const,
        adapters: {
          date: {
            locale: de,
          },
        },
        time: {
          unit: timeRange === '24h' ? 'hour' : timeRange === '7d' ? 'day' : timeRange === '30d' ? 'day' : 'month',
          displayFormats: {
            hour: 'HH:mm',
            day: 'dd.MM.',
            month: 'MMM yyyy'
          },
          tooltipFormat: 'dd.MM.yyyy HH:mm',
        },
        ticks: {
          maxRotation: 0,
          source: 'auto',
          autoSkip: true,
          maxTicksLimit: timeRange === '24h' ? 12 : timeRange === '7d' ? 7 : timeRange === '30d' ? 15 : 31,
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
      },
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
          label: function(context) {
            let label = context.dataset.label || '';
            if (label) {
              label += ': ';
            }
            if (context.parsed.y !== null) {
              label += context.parsed.y.toFixed(1) + ' ' + unit;
            }
            return label;
          }
        }
      }
    },
  }), [timeRange]);

  if (!weatherData || weatherData.length === 0) {
    return (
      <div className="flex items-center justify-center h-96">
        <p className="text-gray-500">No weather data available</p>
      </div>
    );
  }

  const channels = Object.keys(weatherData[0].channels).sort((a, b) => Number(a) - Number(b));

  return (
    <div className="space-y-8">
      {TimeRangeButtons}
      
      <div className="bg-white rounded-lg shadow-lg p-4">
        <div className="flex items-center mb-4">
          <h2 className="text-xl font-semibold flex-grow">Hauptsensoren</h2>
          <ResetZoomButton chartRef={mainChartRef} />
        </div>
        <div className="relative aspect-[21/9]">
          <Line ref={mainChartRef} options={mainChartOptionsUpdated} data={mainChartDataUpdated} />
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-lg p-4">
        <div className="flex items-center mb-4">
          <h2 className="text-xl font-semibold flex-grow">Temperatur Kanäle</h2>
          <ResetZoomButton chartRef={channelTempChartRef} />
        </div>
        <div className="relative aspect-[21/9]">
          <Line ref={channelTempChartRef} options={createChannelOptions('Temperatur', '°C')} data={createChannelDatasets(channels, 'temperature')} />
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-lg p-4">
        <div className="flex items-center mb-4">
          <h2 className="text-xl font-semibold flex-grow">Luftfeuchtigkeit Kanäle</h2>
          <ResetZoomButton chartRef={channelHumidityChartRef} />
        </div>
        <div className="relative aspect-[21/9]">
          <Line ref={channelHumidityChartRef} options={createChannelOptions('Luftfeuchtigkeit', '%')} data={createChannelDatasets(channels, 'humidity')} />
        </div>
      </div>
    </div>
  );
}
