import { useState, useEffect } from 'react';
import { WifiData } from '@/reader/functions/types-constants/WifiConstants';
import { useSelector } from 'react-redux';
import { RootState } from '@/redux';
import { ConfigKeys } from '@/reader/functions/types-constants/ConfigConstants';

interface WifiTabProps {
  data?: WifiData;
}

export default function WifiTab({ data }: WifiTabProps) {
  const [activeTab, setActiveTab] = useState(0);
  const [editingChannel, setEditingChannel] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [channelNames, setChannelNames] = useState<Record<string, string>>({});

  // Load channel names on component mount
  useEffect(() => {
    const loadChannelNames = async () => {
      try {
        const response = await fetch('/api/channelnames');
        if (response.ok) {
          const names = await response.json();
          setChannelNames(names || {});
        }
      } catch (error) {
        console.error('Error loading channel names:', error);
      }
    };
    loadChannelNames();
  }, []);

  // Extract all available channels from data
  const channelData = Object.entries(data || {})
    .filter(([key]) => key.startsWith('temp_and_humidity_ch') && parseInt(key.replace('temp_and_humidity_ch', '')) <= 8)
    .reduce((acc, [key, value]) => {
      const channelNum = key.replace('temp_and_humidity_ch', '');
      const channelKey = `CH${channelNum}`;
      acc[channelKey] = value;
      return acc;
    }, {} as Record<string, any>);

  const handleEditStart = (channelKey: string) => {
    setEditingChannel(channelKey);
    setEditValue(channelNames[channelKey] || channelKey);
  };

  const handleSave = async () => {
    if (!editingChannel) return;

    try {
      const updatedNames = { ...channelNames, [editingChannel]: editValue };
      const response = await fetch('/api/channelnames', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updatedNames)
      });

      if (!response.ok) {
        throw new Error('Failed to update channel name');
      }

      setChannelNames(updatedNames);
      setEditingChannel(null);
    } catch (error) {
      console.error('Error updating channel name:', error);
      alert('Failed to update channel name');
    }
  };

  const handleCancel = () => {
    setEditingChannel(null);
    setEditValue('');
  };

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

  const renderChannelName = (channelKey: string) => {
    if (editingChannel === channelKey) {
      return (
        <div className="flex items-center space-x-2">
          <input
            type="text"
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            className="px-2 py-1 border rounded text-sm w-32"
            autoFocus
          />
          <button
            onClick={handleSave}
            className="text-green-600 hover:text-green-800 px-1"
            title="Save"
          >
            ✓
          </button>
          <button
            onClick={handleCancel}
            className="text-red-600 hover:text-red-800 px-1"
            title="Cancel"
          >
            ✗
          </button>
        </div>
      );
    }
    return (
      <span
        onClick={() => handleEditStart(channelKey)}
        className="cursor-pointer hover:text-blue-600"
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handleEditStart(channelKey);
          }
        }}
      >
        {channelNames[channelKey] || channelKey}
      </span>
    );
  };

  const renderValue = (key: string, value: any) => {
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
                      {renderChannelName(channelKey)}
                    </h3>
                    <div className="space-y-">
                      {renderValue(channelKey, channelValue)}
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
                      {renderValue(key, value)}
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
