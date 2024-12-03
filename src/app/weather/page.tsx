'use client';

import dynamic from 'next/dynamic';
import { useEffect, useState, useRef } from 'react';
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
  ChartTypeRegistry,
  TooltipItem,
  ScriptableContext,
  ScriptableScaleContext,
} from 'chart.js';
import zoomPlugin from 'chartjs-plugin-zoom';
import config from '@/config/f_etacfg.json';

const Line = dynamic(
  () => import('react-chartjs-2').then(mod => mod.Line),
  { ssr: false }
);

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  TimeScale,
  zoomPlugin
);

interface WeatherData {
  timestamp: string;
  temperature: number;
  pressure: number;
  humidity: number;
  channels: {
    [key: string]: {
      temperature: number;
      humidity: number;
    }
  };
}

type TimeRange = '24h' | '7d' | '30d';

type ChannelKey = 'CH1' | 'CH2' | 'CH3' | 'CH5' | 'CH6' | 'CH7' | 'CH8';

interface ConfigType {
  channelNames: {
    [K in ChannelKey]: string;
  };
  // ... other config properties
}

// Type assertion for the imported config
const typedConfig = config as ConfigType;

export default function WeatherPage() {
  const [weatherData, setWeatherData] = useState<WeatherData[]>([]);
  const [timeRange, setTimeRange] = useState<TimeRange>('24h');
  const mainChartRef = useRef<any>(null);
  const channelTempChartRef = useRef<any>(null);
  const channelHumidityChartRef = useRef<any>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch(`/api/weather?range=${timeRange}`);
        const data = await response.json();
        setWeatherData(data);
      } catch (error) {
        console.error('Error fetching weather data:', error);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [timeRange]);

  const handleResetZoom = (chartRef: any) => {
    if (chartRef.current) {
      chartRef.current.resetZoom();
    }
  };

  const formatDate = (timestamp: string) => {
    const date = new Date(timestamp);
    switch (timeRange) {
      case '24h':
        return date.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
      case '7d':
        return date.toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit' });
      case '30d':
        return date.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });
      default:
        return date.toLocaleString('de-DE');
    }
  };

  const getTitleText = () => {
    switch (timeRange) {
      case '24h':
        return 'Wetterdaten der letzten 24 Stunden';
      case '7d':
        return 'Wetterdaten der letzten 7 Tage';
      case '30d':
        return 'Wetterdaten der letzten 30 Tage';
    }
  };

  const mainChartOptions: any = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      mode: 'index' as const,
      intersect: false,
    },
    plugins: {
      tooltip: {
        callbacks: {
          title: (context: TooltipItem<'line'>[]) => {
            const timestamp = weatherData[context[0].dataIndex].timestamp;
            return new Date(timestamp).toLocaleString('de-DE', {
              day: '2-digit',
              month: '2-digit',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit'
            });
          },
          label: (context: TooltipItem<'line'>) => {
            let label = context.dataset.label || '';
            let value = context.parsed.y;
            
            if (label === 'Temperatur') {
              return `${label}: ${value.toFixed(1)}°C`;
            } else if (label === 'Luftdruck') {
              return `${label}: ${value.toFixed(1)} hPa`;
            } else if (label === 'Luftfeuchtigkeit') {
              return `${label}: ${value.toFixed(1)}%`;
            }
            return label;
          }
        }
      },
      title: {
        display: true,
        text: getTitleText(),
        font: {
          family: "var(--font-geist-mono)"
        }
      },
      legend: {
        labels: {
          font: {
            family: "var(--font-geist-mono)"
          }
        }
      },
      zoom: {
        pan: {
          enabled: true,
          mode: 'x' as const,
        },
        zoom: {
          wheel: {
            enabled: true,
          },
          pinch: {
            enabled: true,
          },
          mode: 'x' as const,
        },
      },
    },
    scales: {
      y: {
        type: 'linear' as const,
        display: true,
        position: 'left' as const,
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
          color: (context: ScriptableScaleContext) => {
            if (context.tick.value === 0) {
              return 'rgba(0, 0, 0, 0.3)';
            }
            return 'rgba(0, 0, 0, 0.1)';
          },
          lineWidth: (context: ScriptableScaleContext) => {
            if (context.tick.value === 0) {
              return 2;
            }
            return 1;
          }
        }
      },
      y1: {
        type: 'linear' as const,
        display: true,
        position: 'right' as const,
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
        type: 'linear' as const,
        display: true,
        position: 'right' as const,
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
      x: {
        ticks: {
          font: {
            family: "var(--font-geist-mono)"
          }
        }
      }
    },
  };

  const channelTempChartOptions: any = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      mode: 'index' as const,
      intersect: false,
    },
    plugins: {
      tooltip: {
        callbacks: {
          title: (context: TooltipItem<'line'>[]) => {
            const timestamp = weatherData[context[0].dataIndex].timestamp;
            return new Date(timestamp).toLocaleString('de-DE', {
              day: '2-digit',
              month: '2-digit',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit'
            });
          }
        }
      },
      title: {
        display: true,
        text: 'Temperatur Kanäle',
        font: {
          family: "var(--font-geist-mono)"
        }
      },
      legend: {
        labels: {
          font: {
            family: "var(--font-geist-mono)"
          }
        }
      },
      zoom: {
        pan: {
          enabled: true,
          mode: 'x' as const,
        },
        zoom: {
          wheel: {
            enabled: true,
          },
          pinch: {
            enabled: true,
          },
          mode: 'x' as const,
        },
      },
    },
    scales: {
      y: {
        type: 'linear' as const,
        display: true,
        position: 'left' as const,
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
          color: (context: ScriptableScaleContext) => {
            if (context.tick.value === 0) {
              return 'rgba(0, 0, 0, 0.3)';
            }
            return 'rgba(0, 0, 0, 0.1)';
          },
          lineWidth: (context: ScriptableScaleContext) => {
            if (context.tick.value === 0) {
              return 2;
            }
            return 1;
          }
        }
      },
      x: {
        ticks: {
          font: {
            family: "var(--font-geist-mono)"
          }
        }
      }
    },
  };

  const channelHumidityChartOptions: any = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      mode: 'index' as const,
      intersect: false,
    },
    plugins: {
      tooltip: {
        callbacks: {
          title: (context: TooltipItem<'line'>[]) => {
            const timestamp = weatherData[context[0].dataIndex].timestamp;
            return new Date(timestamp).toLocaleString('de-DE', {
              day: '2-digit',
              month: '2-digit',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit'
            });
          }
        }
      },
      title: {
        display: true,
        text: 'Luftfeuchtigkeit Kanäle',
        font: {
          family: "var(--font-geist-mono)"
        }
      },
      legend: {
        labels: {
          font: {
            family: "var(--font-geist-mono)"
          }
        }
      },
      zoom: {
        pan: {
          enabled: true,
          mode: 'x' as const,
        },
        zoom: {
          wheel: {
            enabled: true,
          },
          pinch: {
            enabled: true,
          },
          mode: 'x' as const,
        },
      },
    },
    scales: {
      y: {
        type: 'linear' as const,
        display: true,
        position: 'left' as const,
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
      x: {
        ticks: {
          font: {
            family: "var(--font-geist-mono)"
          }
        }
      }
    },
  };

  const channelColors = {
    ch1: { border: 'rgb(255, 99, 132)', background: 'rgba(255, 99, 132, 0.5)' },
    ch2: { border: 'rgb(53, 162, 235)', background: 'rgba(53, 162, 235, 0.5)' },
    ch3: { border: 'rgb(75, 192, 192)', background: 'rgba(75, 192, 192, 0.5)' },
    ch5: { border: 'rgb(255, 159, 64)', background: 'rgba(255, 159, 64, 0.5)' },
    ch6: { border: 'rgb(153, 102, 255)', background: 'rgba(153, 102, 255, 0.5)' },
    ch7: { border: 'rgb(201, 203, 207)', background: 'rgba(201, 203, 207, 0.5)' }
  };

  const channelTempChartData = {
    labels: weatherData.map(d => formatDate(d.timestamp)),
    datasets: Object.entries(channelColors).map(([channel, colors]) => ({
      label: `${typedConfig.channelNames[channel.toUpperCase() as ChannelKey] || channel.toUpperCase()}`,
      data: weatherData.map(d => d.channels?.[channel]?.temperature ?? null),
      borderColor: colors.border,
      backgroundColor: colors.background,
      borderWidth: 1,
      pointRadius: 1,
      pointHoverRadius: 3,
      yAxisID: 'y',
    })),
  };

  const channelHumidityChartData = {
    labels: weatherData.map(d => formatDate(d.timestamp)),
    datasets: Object.entries(channelColors).map(([channel, colors]) => ({
      label: `${typedConfig.channelNames[channel.toUpperCase() as ChannelKey] || channel.toUpperCase()}`,
      data: weatherData.map(d => d.channels?.[channel]?.humidity ?? null),
      borderColor: colors.border,
      backgroundColor: colors.background,
      borderWidth: 1,
      pointRadius: 1,
      pointHoverRadius: 3,
      yAxisID: 'y',
    })),
  };

  const mainChartData: any = {
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

  return (
    <div className="p-4">
      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="mb-6">
          <h2 className="text-xl font-semibold mb-4 text-center" style={{ fontFamily: 'var(--font-geist-mono)' }}>Zeitraum auswählen</h2>
          <div className="flex justify-center space-x-4">
            <button
              onClick={() => setTimeRange('24h')}
              className={`transition-colors ${
                timeRange === '24h'
                  ? 'text-blue-500'
                  : 'text-gray-700 hover:bg-gray-200'
              }`}
              style={{ fontFamily: 'var(--font-geist-mono)' }}
            >
              24 Stunden
            </button>
            <button
              onClick={() => setTimeRange('7d')}
              className={`transition-colors ${
                timeRange === '7d'
                  ? 'text-blue-500'
                  : 'text-gray-700 hover:bg-gray-200'
              }`}
              style={{ fontFamily: 'var(--font-geist-mono)' }}
            >
              7 Tage
            </button>
            <button
              onClick={() => setTimeRange('30d')}
              className={`transition-colors ${
                timeRange === '30d'
                  ? 'text-blue-500'
                  : 'text-gray-700 hover:bg-gray-200'
              }`}
              style={{ fontFamily: 'var(--font-geist-mono)' }}
            >
              30 Tage
            </button>
          </div>
        </div>

        {/* Main Chart */}
        <div className="mb-8 w-full">
          <div className="flex justify-end mb-2">
            <button
              onClick={() => handleResetZoom(mainChartRef)}
              className="p-1 text-gray-500 hover:text-gray-700 transition-colors"
              title="Zoom zurücksetzen"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 15 3 9m0 0 6-6M3 9h12a6 6 0 0 1 0 12h-3" />
              </svg>
            </button>
          </div>
          <div className="w-full" style={{ height: '400px' }}>
            <Line ref={mainChartRef} options={mainChartOptions} data={mainChartData} />
          </div>
        </div>

        {/* Channel Temperature Chart */}
        <div className="mb-8 w-full">
          <div className="flex justify-end mb-2">
            <button
              onClick={() => handleResetZoom(channelTempChartRef)}
              className="p-1 text-gray-500 hover:text-gray-700 transition-colors"
              title="Zoom zurücksetzen"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 15 3 9m0 0 6-6M3 9h12a6 6 0 0 1 0 12h-3" />
              </svg>
            </button>
          </div>
          <div className="w-full" style={{ height: '400px' }}>
            <Line ref={channelTempChartRef} options={channelTempChartOptions} data={channelTempChartData} />
          </div>
        </div>

        {/* Channel Humidity Chart */}
        <div className="w-full">
          <div className="flex justify-end mb-2">
            <button
              onClick={() => handleResetZoom(channelHumidityChartRef)}
              className="p-1 text-gray-500 hover:text-gray-700 transition-colors"
              title="Zoom zurücksetzen"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 15 3 9m0 0 6-6M3 9h12a6 6 0 0 1 0 12h-3" />
              </svg>
            </button>
          </div>
          <div className="w-full" style={{ height: '400px' }}>
            <Line ref={channelHumidityChartRef} options={channelHumidityChartOptions} data={channelHumidityChartData} />
          </div>
        </div>
      </div>
    </div>
  );
}
