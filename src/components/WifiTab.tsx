import { useState } from 'react';
import { WifiData } from '@/reader/functions/types-constants/WifiConstants';

interface WifiTabProps {
  data?: WifiData;
}

export default function WifiTab({ data }: WifiTabProps) {
  const [activeTab, setActiveTab] = useState(0);

  // Extract all available channels from data
  const channelData = Object.entries(data || {})
    .filter(([key]) => key.startsWith('temp_and_humidity_ch'))
    .reduce((acc, [key, value]) => {
      const channelNum = key.replace('temp_and_humidity_ch', '');
      acc[`CH${channelNum}`] = value;
      return acc;
    }, {} as Record<string, any>);

  const categories = {
    'Outdoor': data?.outdoor || {},
    'Indoor': data?.indoor || {},
    'Channels': channelData,
    'Solar & UVI': data?.solar_and_uvi || {},
    'Rainfall': data?.rainfall || {},
    'Wind': data?.wind || {},
    'Pressure': data?.pressure || {},
    'Battery': data?.battery || {},
  };

  const categoryEntries = Object.entries(categories);

  const renderValue = (value: any) => {
    if (typeof value === 'object') {
      if (value.value !== undefined && value.unit !== undefined) {
        return `${value.value} ${value.unit}`;
      }
      // For nested objects (like in Channels)
      return Object.entries(value).map(([subKey, subValue]: [string, any]) => (
        <div key={subKey} className="mb-2">
          <span className="text-xs text-gray-600">{subKey.replace(/_/g, ' ').toUpperCase()}: </span>
          <span className="text-sm">
            {typeof subValue === 'object' ? `${subValue.value} ${subValue.unit}` : subValue}
          </span>
        </div>
      ));
    }
    return value;
  };

  return (
    <div className="w-full px-2 sm:px-0">
      <div className="flex space-x-1 rounded-xl bg-blue-900/20 p-1 h-[58px]">
        {categoryEntries.map(([category], index) => (
          <button
            key={category}
            onClick={() => setActiveTab(index)}
            className={`
              flex-1 rounded-lg py-2.5 text-sm font-medium leading-5
              focus:outline-none focus:ring-2 ring-white/60 ring-offset-2 ring-offset-blue-400
              ${activeTab === index
                ? 'bg-white text-blue-700 shadow'
                : 'text-gray-900 hover:bg-white/[0.12] hover:text-blue-700'
              }
            `}
          >
            {category}
          </button>
        ))}
      </div>

      <div className="mt-2">
        {categoryEntries.map(([category, data], idx) => (
          <div
            key={idx}
            className={`
              rounded-xl bg-white pt-3 ring-white/60 ring-offset-2 ring-offset-blue-400 focus:outline-none focus:ring-2
              ${activeTab === idx ? 'block' : 'hidden'}
            `}
          >
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-3 gap-4 border-gray-200">
              {category === 'Channels' ? (
                // Special rendering for Channels
                Object.entries(data).map(([channelKey, channelValue]) => (
                  <div key={channelKey} className="p-4 rounded-lg bg-gray-50 shadow-lg">
                    <h3 className="text-sm font-medium text-gray-900 mb-2">
                      {channelKey}
                    </h3>
                    <div className="space-y-">
                      {renderValue(channelValue)}
                    </div>
                  </div>
                ))
              ) : (
                // Regular rendering for other categories
                Object.entries(data).map(([key, value]: [string, any]) => (
                  <div key={key} className="p-4 rounded-lg bg-gray-50 shadow-lg">
                    <h3 className="text-sm font-medium text-gray-900">
                      {key.replace(/_/g, ' ').toUpperCase()}
                    </h3>
                    <div className="mt-2 text-sm text-gray-500">
                      {renderValue(value)}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
