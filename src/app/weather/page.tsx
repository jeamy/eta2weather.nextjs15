'use client';

import dynamic from 'next/dynamic';
import { useEffect, useRef, useState } from 'react';
import { useSelector } from 'react-redux';
import { RootState } from '@/redux';

// Dynamically import WeatherCharts component
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

const WeatherPage = () => {
  const [weatherData, setWeatherData] = useState<WeatherData[]>([]);
  const mainChartRef = useRef(null);
  const channelTempChartRef = useRef(null);
  const channelHumidityChartRef = useRef(null);

  const resetZoom = (chartRef: any) => {
    if (chartRef.current) {
      chartRef.current.resetZoom();
    }
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch('/api/weather');
        if (!response.ok) throw new Error('Failed to fetch weather data');
        const data = await response.json();
        setWeatherData(data);
      } catch (error) {
        console.error('Error fetching weather data:', error);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 60000); // Update every minute

    return () => clearInterval(interval);
  }, []);

  const mainChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      mode: 'index' as const,
      intersect: false,
    },
    plugins: {
      tooltip: {
        callbacks: {
          title: (context: any[]) => {
            const timestamp = weatherData[context[0].dataIndex].timestamp;
            return new Date(timestamp).toLocaleString('de-DE', {
              day: '2-digit',
              month: '2-digit',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit'
            });
          },
          label: (context: any) => {
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
        text: 'Wetterdaten',
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

  const channelTempChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      mode: 'index' as const,
      intersect: false,
    },
    plugins: {
      tooltip: {
        callbacks: {
          title: (context: any[]) => {
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
      x: {
        ticks: {
          font: {
            family: "var(--font-geist-mono)"
          }
        }
      }
    },
  };

  const channelHumidityChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      mode: 'index' as const,
      intersect: false,
    },
    plugins: {
      tooltip: {
        callbacks: {
          title: (context: any[]) => {
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

  const mainChartData = {
    labels: weatherData.map(d => new Date(d.timestamp).toLocaleString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })),
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

  const channelTempChartData = {
    labels: weatherData.map(d => new Date(d.timestamp).toLocaleString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })),
    datasets: Object.entries(channelColors).map(([channel, colors]) => ({
      label: channel.toUpperCase(),
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
    labels: weatherData.map(d => new Date(d.timestamp).toLocaleString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })),
    datasets: Object.entries(channelColors).map(([channel, colors]) => ({
      label: channel.toUpperCase(),
      data: weatherData.map(d => d.channels?.[channel]?.humidity ?? null),
      borderColor: colors.border,
      backgroundColor: colors.background,
      borderWidth: 1,
      pointRadius: 1,
      pointHoverRadius: 3,
      yAxisID: 'y',
    })),
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
      />
    </div>
  );
};

export default WeatherPage;
