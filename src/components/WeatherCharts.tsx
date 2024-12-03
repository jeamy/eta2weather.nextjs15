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
}: WeatherChartsProps) => {
  if (!weatherData || weatherData.length === 0) {
    return <div>Loading...</div>;
  }

  return (
    <div className="space-y-8">
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
  );
};

export default WeatherCharts;
