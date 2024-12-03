'use client';

import dynamic from 'next/dynamic';
import { Chart as ChartJS, registerables } from 'chart.js';
import zoomPlugin from 'chartjs-plugin-zoom';
import { ArrowPathIcon } from '@heroicons/react/24/outline';

// Dynamically import Line component with SSR disabled
const Line = dynamic(
  () => import('react-chartjs-2').then(mod => mod.Line),
  { ssr: false }
);

// Register Chart.js components
ChartJS.register(...registerables, zoomPlugin);

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
  mainChartData,
  channelTempChartData,
  channelHumidityChartData,
  timeRange,
  onTimeRangeChange,
}: WeatherChartsProps) => {
  if (!weatherData || weatherData.length === 0) {
    return <div>Loading...</div>;
  }

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
            <Line ref={mainChartRef} options={mainChartOptions} data={mainChartData} />
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
              options={channelTempChartOptions}
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
              options={channelHumidityChartOptions}
              data={channelHumidityChartData}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default WeatherCharts;
