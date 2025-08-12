import { useState, useEffect, useRef, useCallback, useMemo, memo, ReactElement } from 'react';
import { WifiData } from '@/reader/functions/types-constants/WifiConstants';
import { deTranslations } from '@/translations/de';
import { API } from '@/constants/apiPaths';
import {
  HomeIcon,
  BuildingOfficeIcon,
  SignalIcon,
  SunIcon,
  CloudIcon,
  ArrowPathIcon,
  BeakerIcon,
  Battery50Icon,
} from '@heroicons/react/24/outline';

interface WifiTabProps {
  data?: WifiData;
}

// Hoist static icon mapping to module scope to avoid recreating on each render
const categoryIcons: Record<string, ReactElement> = {
  [deTranslations.categories['Outdoor']]: <BuildingOfficeIcon className="w-5 h-5" />,
  [deTranslations.categories['Indoor']]: <HomeIcon className="w-5 h-5" />,
  [deTranslations.categories['Channels']]: <SignalIcon className="w-5 h-5" />,
  [deTranslations.categories['Solar & UVI']]: <SunIcon className="w-5 h-5" />,
  [deTranslations.categories['Rainfall']]: <CloudIcon className="w-5 h-5" />,
  [deTranslations.categories['Wind']]: <ArrowPathIcon className="w-5 h-5" />,
  [deTranslations.categories['Pressure']]: <BeakerIcon className="w-5 h-5" />,
  [deTranslations.categories['Battery']]: <Battery50Icon className="w-5 h-5" />,
};

function WifiTab({ data }: WifiTabProps) {
  const [activeTab, setActiveTab] = useState(0);
  const [editingChannel, setEditingChannel] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [channelNames, setChannelNames] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Cleanup function for abort controller
  const cleanupAbortController = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
  }, []);

  // Extract all available channels from data - memoized to prevent unnecessary recalculation
  const channelData = useMemo(() => 
    Object.entries(data || {})
      .filter(([key]) => key.startsWith('temp_and_humidity_ch') && parseInt(key.replace('temp_and_humidity_ch', '')) <= 8)
      .reduce((acc, [key, value]) => {
        const channelNum = key.replace('temp_and_humidity_ch', '');
        const channelKey = `CH${channelNum}`;
        acc[channelKey] = value;
        return acc;
      }, {} as Record<string, any>),
    [data]
  );

  // Memoize categories to prevent unnecessary recalculation
  const categories = useMemo(() => ({
    [deTranslations.categories['Outdoor']]: data?.outdoor || {},
    [deTranslations.categories['Indoor']]: data?.indoor || {},
    [deTranslations.categories['Channels']]: channelData,
    [deTranslations.categories['Solar & UVI']]: data?.solar_and_uvi || {},
    [deTranslations.categories['Rainfall']]: data?.rainfall || {},
    [deTranslations.categories['Wind']]: data?.wind || {},
    [deTranslations.categories['Pressure']]: data?.pressure || {},
    [deTranslations.categories['Battery']]: data?.battery || {},
  }), [data, channelData]);

  // Compute Channels tab index and fetch channel names only when needed
  const categoryEntries = useMemo(() => Object.entries(categories), [categories]);
  const channelsTabIndex = useMemo(
    () => categoryEntries.findIndex(([category]) => category === deTranslations.categories['Channels']),
    [categoryEntries]
  );

  useEffect(() => {
    // Only fetch when user is on Channels tab and names not yet loaded
    if (channelsTabIndex === -1 || activeTab !== channelsTabIndex) return;
    if (Object.keys(channelNames).length > 0) return;

    const loadChannelNames = async () => {
      cleanupAbortController();

      const abortController = new AbortController();
      abortControllerRef.current = abortController;

      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch(API.CHANNEL_NAMES, { signal: abortController.signal });
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const names = await response.json();
        if (!abortController.signal.aborted) {
          setChannelNames(names || {});
        }
      } catch (error) {
        if (error instanceof Error && error.name !== 'AbortError') {
          console.error('Error loading channel names:', error);
          setError(error.message);
        }
      } finally {
        if (!abortController.signal.aborted) {
          setIsLoading(false);
        }
      }
    };

    loadChannelNames();
    return () => {
      cleanupAbortController();
    };
  }, [activeTab, channelsTabIndex, channelNames, cleanupAbortController]);

  const handleEditStart = useCallback((channelKey: string) => {
    setEditingChannel(channelKey);
    setEditValue(channelNames[channelKey] || channelKey);
  }, [channelNames]);

  const handleSave = useCallback(async () => {
    if (!editingChannel) return;

    setIsLoading(true);
    setError(null);

    try {
      const updatedNames = { ...channelNames, [editingChannel]: editValue };
      const response = await fetch(API.CHANNEL_NAMES, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'Accept': 'application/json; charset=utf-8'
        },
        body: JSON.stringify(updatedNames)
      });

      if (!response.ok) {
        throw new Error('Failed to update channel name');
      }

      setChannelNames(updatedNames);
      setEditingChannel(null);
      setEditValue('');
    } catch (error) {
      console.error('Error updating channel name:', error);
      setError(error instanceof Error ? error.message : 'Failed to update channel name');
    } finally {
      setIsLoading(false);
    }
  }, [editingChannel, editValue, channelNames]);

  const handleCancel = useCallback(() => {
    setEditingChannel(null);
    setEditValue('');
  }, []);

  // categoryEntries already computed above

  // Only compute the active entry to avoid rendering hidden panels
  const activeEntry = useMemo(() => categoryEntries[activeTab] as [string, any] | undefined, [categoryEntries, activeTab]);

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
      return Object.entries(value).map(([subKey, subValue]: [string, any]) => {
        // Use the original key for translation lookup
        const translationKey = subKey.toLowerCase();
        const translation = deTranslations.measurements[translationKey] || 
                          subKey.replace(/_/g, ' ');
        
        return (
          <div key={subKey} className="mb-2">
            <span className="text-xs text-gray-600">
              {translation}: {' '}
            </span>
            <span className="text-sm">
              {typeof subValue === 'object' ? `${subValue.value} ${subValue.unit}` : subValue}
            </span>
          </div>
        );
      });
    }
    return value;
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex justify-between items-center h-14 mb-4">
        <h2 className="text-lg font-semibold">WiFi Data</h2>
      </div>
      <div className="w-full px-2 sm:px-0">
        <div className="flex space-x-1 rounded-xl bg-blue-900/20 p-1 h-24">
          {categoryEntries.map(([category], index) => (
            <button
              key={category}
              onClick={() => setActiveTab(index)}
              className={`w-full rounded-lg py-2 text-sm font-medium leading-5 ring-white ring-opacity-60 ring-offset-2 ring-offset-blue-400 focus:outline-none focus:ring-2 transition-colors flex flex-col items-center justify-center
                ${activeTab === index 
                  ? 'bg-white text-blue-700 shadow' 
                  : 'text-black hover:bg-white/[0.12] hover:text-blue-700'}`}
              title={category}
            >
              {categoryIcons[category]}
              <span className="hidden lg:inline-block mt-1 text-xs">{category}</span>
            </button>
          ))}
        </div>

        <div className="mt-2">
          {activeEntry && (() => {
            const [category, catData] = activeEntry;
            return (
              <div
                className="rounded-xl bg-white pt-3 ring-white ring-opacity-60 ring-offset-2 ring-offset-blue-400 focus:outline-none focus:ring-2"
              >
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-3 gap-4 border-gray-200">
                  {category === deTranslations.categories['Channels'] ? (
                    Object.entries(catData).map(([channelKey, channelValue]) => (
                      <div key={channelKey} className="p-4 rounded-lg bg-gray-50 shadow-lg">
                        <h3 className="text-sm font-medium text-gray-900 mb-2">
                          {renderChannelName(channelKey)} &nbsp;
                        </h3>
                        <div className="space-y-1">
                          {renderValue(channelKey, channelValue)}
                        </div>
                      </div>
                    ))
                  ) : (
                    Object.entries(catData).map(([key, value]: [string, any]) => {
                      const translationKey = key.toLowerCase();
                      const titleTranslation = deTranslations.measurements[translationKey] || key.replace(/_/g, ' ');
                      return (
                        <div key={key} className="p-4 rounded-lg bg-gray-50 shadow-lg">
                          <h3 className="text-sm font-medium text-gray-900">
                            {titleTranslation} &nbsp;
                          </h3>
                          <div className="mt-2 text-sm text-gray-500 space-y-1">
                            {renderValue(key, value)}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })()}
        </div>
      </div>
    </div>
  );
}

export default memo(WifiTab);
