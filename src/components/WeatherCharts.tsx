'use client';

import { useEffect, useMemo, useCallback } from 'react';
import type {
  ChartOptions,
  Chart as ChartJS,
} from 'chart.js';
import {
  Chart,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import zoomPlugin from 'chartjs-plugin-zoom';
import { ArrowPathIcon } from '@heroicons/react/24/outline';
import { de } from 'date-fns/locale';
import 'chartjs-adapter-date-fns';
import { TimeScale, TimeSeriesScale } from 'chart.js';

// Register Chart.js components
Chart.register(
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

// Set default locale for Chart.js
Chart.defaults.locale = 'de';

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
  channelNames: { [key: string]: string };
}

// Colors for different channels - using a function to generate colors dynamically
const getChannelColor = (index: number) => {
  // Base colors that will be cycled through
  const baseColors = [
    { border: 'rgb(255, 99, 132)', background: 'rgba(255, 99, 132, 0.5)' },   // Red
    { border: 'rgb(53, 162, 235)', background: 'rgba(53, 162, 235, 0.5)' },   // Blue
    { border: 'rgb(255, 159, 64)', background: 'rgba(255, 159, 64, 0.5)' },   // Orange
    { border: 'rgb(75, 192, 192)', background: 'rgba(75, 192, 192, 0.5)' },   // Teal
    { border: 'rgb(153, 102, 255)', background: 'rgba(153, 102, 255, 0.5)' }, // Purple
    { border: 'rgb(255, 205, 86)', background: 'rgba(255, 205, 86, 0.5)' },   // Yellow
    { border: 'rgb(201, 203, 207)', background: 'rgba(201, 203, 207, 0.5)' }, // Gray
    { border: 'rgb(54, 162, 235)', background: 'rgba(54, 162, 235, 0.5)' },   // Light Blue
    { border: 'rgb(255, 0, 255)', background: 'rgba(255, 0, 255, 0.5)' },     // Magenta
    { border: 'rgb(0, 128, 0)', background: 'rgba(0, 128, 0, 0.5)' }          // Green
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
  getChannelName,
  channelNames
}: WeatherChartsProps) {
  
  useEffect(() => {
    // Register all required components
    Chart.register(
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
  }, []);

  type ChartRef = ChartJS<'line'>;

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

  // Memoize channels array with specific order
  const channels = useMemo(() => {
    const channelOrder = ['ch8', 'ch5', 'ch2', 'ch1', 'ch6', 'ch3', 'ch7'];
    return channelOrder.filter(ch => weatherData[0]?.channels && ch in weatherData[0].channels);
  }, [weatherData]);

  // Create channel datasets with temperature or humidity data
  const createChannelDatasets = useCallback((channels: string[], type: 'temperature' | 'humidity') => {
    const datasets = channels.map((channel, index) => {
      const color = getChannelColor(index);
      const upperChannel = 'CH' + channel.substring(2).toUpperCase();
      const displayName = channelNames[upperChannel] || upperChannel;
      return {
        label: displayName,
        data: weatherData.map((data) => {
          const channelData = data.channels[channel];
          return channelData ? channelData[type] : null;
        }),
        borderColor: color.border,
        backgroundColor: color.background,
        borderWidth: 1,
        pointRadius: 1,
        pointHoverRadius: 3,
      };
    });

    return {
      labels: weatherData.map((data) => data.timestamp),
      datasets,
    };
  }, [weatherData, channelNames]);

  // Memoize main chart data with indoor data and pressure
  const mainChartDataUpdated = useMemo(() => {
    return {
      labels: weatherData.map((data) => data.timestamp),
      datasets: [
        {
          label: 'Außentemperatur (°C)',
          data: weatherData.map((data) => data.temperature),
          borderColor: 'rgb(255, 99, 132)',
          backgroundColor: 'rgba(255, 99, 132, 0.5)',
          yAxisID: 'y-temperature',
          borderWidth: 1,
          pointRadius: 1,
          pointHoverRadius: 3,
        },
        {
          label: 'Innentemperatur (°C)',
          data: weatherData.map((data) => data.indoor?.temperature),
          borderColor: 'rgb(75, 192, 192)',
          backgroundColor: 'rgba(75, 192, 192, 0.5)',
          yAxisID: 'y-temperature',
          borderWidth: 1,
          pointRadius: 1,
          pointHoverRadius: 3,
        },
        {
          label: 'Außenluftfeuchtigkeit (%)',
          data: weatherData.map((data) => data.humidity),
          borderColor: 'rgb(53, 162, 235)',
          backgroundColor: 'rgba(53, 162, 235, 0.5)',
          yAxisID: 'y-humidity',
          borderWidth: 1,
          pointRadius: 1,
          pointHoverRadius: 3,
        },
        {
          label: 'Innenluftfeuchtigkeit (%)',
          data: weatherData.map((data) => data.indoor?.humidity),
          borderColor: 'rgb(255, 159, 64)',
          backgroundColor: 'rgba(255, 159, 64, 0.5)',
          yAxisID: 'y-humidity',
          borderWidth: 1,
          pointRadius: 1,
          pointHoverRadius: 3,
        },
        {
          label: 'Luftdruck (hPa)',
          data: weatherData.map((data) => data.pressure),
          borderColor: 'rgb(128, 128, 128)',
          backgroundColor: 'rgba(128, 128, 128, 0.5)',
          yAxisID: 'y-pressure',
          borderWidth: 1,
          pointRadius: 1,
          pointHoverRadius: 3,
        },
      ],
    };
  }, [weatherData]);

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
          color: (context: any) => {
            if (context.tick.value === 0) {
              return 'rgba(0, 0, 0, 1.0)'; // Black color for zero line
            }
            return 'rgba(0, 0, 0, 0.1)'; // Default light gray for other lines
          },
          lineWidth: (context: any) => {
            if (context.tick.value === 0) {
              return 2; // Thicker line for zero
            }
            return 1; // Default thickness for other lines
          }
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

  const getTimeUnit = useCallback((timeRange: string) => {
    switch (timeRange) {
      case '24h':
        return 'hour';
      case '7d':
      case '30d':
        return 'day';
      default:
        return 'month';
    }
  }, []);

  const createChannelOptions = useCallback((title: string, unit: string, type: 'temperature' | 'humidity'): ChartOptions<'line'> => {
    return {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: {
          type: 'time' as const,
          time: {
            unit: getTimeUnit(timeRange),
            displayFormats: {
              hour: 'HH:mm',
              day: 'dd.MM',
              week: 'dd.MM',
              month: 'MM.yyyy'
            }
          },
          title: {
            display: true,
            text: 'Zeit'
          }
        },
        y: {
          type: 'linear' as const,
          display: true,
          position: 'left' as const,
          title: {
            display: true,
            text: type === 'temperature' ? 'Temperatur (°C)' : 'Luftfeuchtigkeit (%)'
          },
          grid: {
            drawOnChartArea: true,
            color: (context: any) => {
              if (type === 'temperature' && context.tick.value === 0) {
                return 'rgba(0, 0, 0, 1.0)';
              }
              return 'rgba(0, 0, 0, 0.1)';
            },
            lineWidth: (context: any) => {
              if (type === 'temperature' && context.tick.value === 0) {
                return 2;
              }
              return 1;
            }
          }
        }
      },
      plugins: {
        title: {
          display: true,
          text: title
        },
        zoom: {
          pan: {
            enabled: true,
            mode: 'x'
          },
          zoom: {
            wheel: {
              enabled: true
            },
            pinch: {
              enabled: true
            },
            mode: 'x'
          }
        },
        tooltip: {
          callbacks: {
            label: function(context: any) {
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
      }
    } as ChartOptions<'line'>;
  }, [timeRange, getTimeUnit]);

  const channelTempChartOptionsUpdated = createChannelOptions('Temperatur', '°C', 'temperature');
  const channelHumidityChartOptionsUpdated = createChannelOptions('Luftfeuchtigkeit', '%', 'humidity');

  if (!weatherData || weatherData.length === 0) {
    return (
      <div className="flex items-center justify-center h-96">
        <p className="text-gray-500">No weather data available</p>
      </div>
    );
  }

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
          <h2 className="text-xl font-semibold flex-grow">Temperatur</h2>
          <ResetZoomButton chartRef={channelTempChartRef} />
        </div>
        <div className="relative aspect-[21/9]">
          <Line ref={channelTempChartRef} options={channelTempChartOptionsUpdated} data={createChannelDatasets(channels, 'temperature')} />
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-lg p-4">
        <div className="flex items-center mb-4">
          <h2 className="text-xl font-semibold flex-grow">Luftfeuchtigkeit</h2>
          <ResetZoomButton chartRef={channelHumidityChartRef} />
        </div>
        <div className="relative aspect-[21/9]">
          <Line ref={channelHumidityChartRef} options={channelHumidityChartOptionsUpdated} data={createChannelDatasets(channels, 'humidity')} />
        </div>
      </div>
    </div>
  );
}
