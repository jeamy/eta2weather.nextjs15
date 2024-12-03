'use client';

import { useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';
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
import zoomPlugin from 'chartjs-plugin-zoom';
import { ArrowPathIcon } from '@heroicons/react/24/outline';
import { de } from 'date-fns/locale';
import 'chartjs-adapter-date-fns';

// Dynamically import Line component with SSR disabled
const Line = dynamic(
  () => import('react-chartjs-2').then(mod => mod.Line),
  { ssr: false }
);

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

interface WeatherChartsProps {
  weatherData: any[];
  resetZoom: (chartRef: any) => void;
  mainChartRef: any;
  channelTempChartRef: any;
  channelHumidityChartRef: any;
  mainChartOptions: any;
  channelTempChartOptions: any;
  channelHumidityChartOptions: any;
  mainChartData: any;
  channelTempChartData: any;
  channelHumidityChartData: any;
  timeRange: '24h' | '7d' | '30d';
  onTimeRangeChange: (range: '24h' | '7d' | '30d') => void;
}

const WeatherCharts = ({
  weatherData,
  resetZoom,
  mainChartRef,
  channelTempChartRef,
  channelHumidityChartRef,
  mainChartOptions,
  channelTempChartOptions,
  channelHumidityChartOptions,
  channelTempChartData,
  channelHumidityChartData,
  timeRange,
  onTimeRangeChange,
}: WeatherChartsProps) => {
  useEffect(() => {
    initChart();
  }, []);

  if (!weatherData || weatherData.length === 0) {
    return <div>Loading...</div>;
  }

  const mainChartData = {
    labels: weatherData.map((data) => data.timestamp),
    datasets: [
      {
        label: 'Temperatur (°C)',
        data: weatherData.map((data) => data.temperature),
        borderColor: 'rgb(255, 99, 132)',
        backgroundColor: 'rgba(255, 99, 132, 0.5)',
        yAxisID: 'y-temperature',
      },
      {
        label: 'Luftfeuchtigkeit (%)',
        data: weatherData.map((data) => data.humidity),
        borderColor: 'rgb(53, 162, 235)',
        backgroundColor: 'rgba(53, 162, 235, 0.5)',
        yAxisID: 'y-humidity',
      },
      {
        label: 'Luftdruck (hPa)',
        data: weatherData.map((data) => data.pressure),
        borderColor: 'rgb(75, 192, 192)',
        backgroundColor: 'rgba(75, 192, 192, 0.5)',
        yAxisID: 'y-pressure',
      },
    ],
  };

  const mainChartOptionsUpdated: ChartOptions<'line'> = {
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
          unit: timeRange === '24h' ? 'hour' : 'day',
          displayFormats: {
            hour: 'HH:mm',
            day: 'MMM d',
          },
        },
        ticks: {
          maxRotation: 0,
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
  };

  const channelTempChartOptionsUpdated: ChartOptions<'line'> = {
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
          unit: timeRange === '24h' ? 'hour' : 'day',
          displayFormats: {
            hour: 'HH:mm',
            day: 'MMM d',
          },
        },
        ticks: {
          maxRotation: 0,
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
          drawOnChartArea: true,
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
              label += context.parsed.y.toFixed(1) + ' °C';
            }
            return label;
          }
        }
      }
    },
  };

  const channelHumidityChartOptionsUpdated: ChartOptions<'line'> = {
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
          unit: timeRange === '24h' ? 'hour' : 'day',
          displayFormats: {
            hour: 'HH:mm',
            day: 'MMM d',
          },
        },
        ticks: {
          maxRotation: 0,
        },
      },
      y: {
        type: 'linear' as const,
        display: true,
        position: 'left' as const,
        title: {
          display: true,
          text: 'Luftfeuchtigkeit (%)',
        },
        grid: {
          drawOnChartArea: true,
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
              label += context.parsed.y.toFixed(1) + ' %';
            }
            return label;
          }
        }
      }
    },
  };

  return (
    <div className="space-y-8">
      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="mb-6">
          <h2 className="text-xl font-semibold mb-4 text-center" style={{ fontFamily: 'var(--font-geist-mono)' }}>
            Zeitraum auswählen
          </h2>
          <div className="flex justify-center space-x-4">
            <button
              onClick={() => onTimeRangeChange('24h')}
              className={`px-4 py-2 rounded-md transition-colors ${
                timeRange === '24h'
                  ? 'text-blue-500'
                  : 'text-gray-700 hover:bg-gray-100'
              }`}
              style={{ fontFamily: 'var(--font-geist-mono)' }}
            >
              24 Stunden
            </button>
            <button
              onClick={() => onTimeRangeChange('7d')}
              className={`px-4 py-2 rounded-md transition-colors ${
                timeRange === '7d'
                  ? 'text-blue-500'
                  : 'text-gray-700 hover:bg-gray-100'
              }`}
              style={{ fontFamily: 'var(--font-geist-mono)' }}
            >
              7 Tage
            </button>
            <button
              onClick={() => onTimeRangeChange('30d')}
              className={`px-4 py-2 rounded-md transition-colors ${
                timeRange === '30d'
                  ? 'text-blue-500'
                  : 'text-gray-700 hover:bg-gray-100'
              }`}
              style={{ fontFamily: 'var(--font-geist-mono)' }}
            >
              30 Tage
            </button>
          </div>
        </div>

        <div className="relative">
          <div className="absolute right-0 top-0 z-10">
            <button
              onClick={() => resetZoom(mainChartRef)}
              className="p-2 text-gray-600 hover:text-gray-800"
              title="Reset zoom"
            >
              <ArrowPathIcon className="h-5 w-5" />
            </button>
          </div>
          <div className="h-[400px]">
            <Line ref={mainChartRef} options={mainChartOptionsUpdated} data={mainChartData} />
          </div>
        </div>

        <div className="relative">
          <div className="absolute right-0 top-0 z-10">
            <button
              onClick={() => resetZoom(channelTempChartRef)}
              className="p-2 text-gray-600 hover:text-gray-800"
              title="Reset zoom"
            >
              <ArrowPathIcon className="h-5 w-5" />
            </button>
          </div>
          <div className="h-[400px]">
            <Line
              ref={channelTempChartRef}
              options={channelTempChartOptionsUpdated}
              data={channelTempChartData}
            />
          </div>
        </div>

        <div className="relative">
          <div className="absolute right-0 top-0 z-10">
            <button
              onClick={() => resetZoom(channelHumidityChartRef)}
              className="p-2 text-gray-600 hover:text-gray-800"
              title="Reset zoom"
            >
              <ArrowPathIcon className="h-5 w-5" />
            </button>
          </div>
          <div className="h-[400px]">
            <Line
              ref={channelHumidityChartRef}
              options={channelHumidityChartOptionsUpdated}
              data={channelHumidityChartData}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default WeatherCharts;
