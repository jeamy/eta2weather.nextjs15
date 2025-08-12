import { useEffect, useState, useCallback } from 'react';
import { MenuNode } from '@/types/menu';
import { formatValue } from '@/utils/formatters';
import { getUrisForNode } from '@/utils/etaUtils';
import { useEtaData } from '@/hooks/useEtaData';
import { 
  ClockIcon, 
  CalendarIcon, 
  ChartBarIcon,
  FireIcon,
  CubeIcon,
  CircleStackIcon,
  Cog6ToothIcon,
  ArrowPathIcon
} from '@heroicons/react/24/outline';

interface EtaTabProps {
  menuItems?: MenuNode[];
}

export default function EtaTab({ menuItems = [] }: EtaTabProps) {
  const { values, loading, error, fetchValues, cleanupAllAbortControllers } = useEtaData();
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);

  const renderValue = useCallback((data: any) => {
    const { text, color } = formatValue(data);
    return <span className={color}>{text}</span>;
  }, []);

  const getTabIcon = (categoryName: string) => {
    const name = categoryName.toLowerCase();
    if (name.includes('kessel')) {
      return <FireIcon className="w-5 h-5" />;
    } else if (name.includes('lager')) {
      return <CubeIcon className="w-5 h-5" />;
    } else if (name.includes('speicher') || name.includes('boiler')) {
      return <CircleStackIcon className="w-5 h-5" />;
    } else if (name.includes('system') || name.includes('sys')) {
      return <Cog6ToothIcon className="w-5 h-5" />;
    } else if (name === 'heute') {
      return <CalendarIcon className="w-5 h-5" />;
    } else if (name === 'jetzt') {
      return <ClockIcon className="w-5 h-5" />;
    }
    return <ChartBarIcon className="w-5 h-5" />;
  };

  const fetchActiveValues = useCallback(async () => {
    if (!menuItems?.length) return;
    const activeNode = menuItems[selectedIndex];
    const uris = getUrisForNode(activeNode);
    if (!uris.length) return;
    await fetchValues(uris, { chunkSize: 100, concurrency: 3 });
    setLastUpdated(Date.now());
  }, [menuItems, selectedIndex, fetchValues]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await fetchActiveValues();
    setIsRefreshing(false);
  };

  // Initial and on-tab-change load
  useEffect(() => {
    fetchActiveValues();
    return cleanupAllAbortControllers;
  }, [fetchActiveValues, cleanupAllAbortControllers]);

  // Polling for active tab every 60s
  useEffect(() => {
    if (!menuItems?.length) return;
    const interval = setInterval(() => {
      fetchActiveValues();
    }, 60000);
    return () => clearInterval(interval);
  }, [menuItems, fetchActiveValues]);

  return (
    <div className="flex flex-col h-full">
      <div className="flex justify-between items-center h-14 mb-4">
        <h2 className="text-lg font-semibold">ETA Data</h2>
        {lastUpdated && (
          <span className="text-xs text-gray-500">Zuletzt aktualisiert: {new Date(lastUpdated).toLocaleTimeString()}</span>
        )}
        <button 
          onClick={handleRefresh}
          className="p-2 rounded-full hover:bg-gray-100 transition-colors"
          disabled={isRefreshing}
        >
          <ArrowPathIcon 
            className={`w-5 h-5 text-gray-600 ${isRefreshing ? 'animate-spin' : ''}`} 
          />
        </button>
      </div>
      <div>
        <div className="flex space-x-1 rounded-xl bg-blue-900/20 p-1 h-24">
          {menuItems.map((category, categoryIndex) => (
            <button
              key={`tab-${categoryIndex}-${category.name}`}
              onClick={() => setSelectedIndex(categoryIndex)}
              className={`w-full rounded-lg py-2 text-sm font-medium leading-5 ring-white ring-opacity-60 ring-offset-2 ring-offset-blue-400 focus:outline-none focus:ring-2 transition-colors flex flex-col items-center justify-center
                ${selectedIndex === categoryIndex 
                  ? 'bg-white text-blue-700 shadow' 
                  : 'text-black hover:bg-white/[0.12] hover:text-blue-700'}`}
              title={category.name}
            >
              {getTabIcon(category.name)}
              <span className="hidden lg:inline-block mt-1 text-xs">{category.name}</span>
            </button>
          ))}
        </div>
        <div className="mt-5">
          {menuItems.map((category, categoryIndex) => (
            <div
              key={`panel-${categoryIndex}-${category.name}`}
              className={`bg-gray-50 rounded-xl p-5 ring-white ring-opacity-60 ring-offset-2 ring-offset-blue-400 focus:outline-none focus:ring-2 border border-gray-200 shadow-lg ${
                selectedIndex === categoryIndex ? '' : 'hidden'
              }`}
            >
              <div className="space-y-4">
                {category.children?.map((item, itemIndex) => {
                  const itemId = `${categoryIndex}-${itemIndex}-${item.name}`;
                  return (
                    <div key={itemId} className="bg-white rounded-lg p-4 shadow-sm">
                      <h3 className="text-lg font-medium text-gray-900 mb-2">
                        {item.name}
                        {item.uri && (
                          <div className="flex items-center space-x-2 mt-1">
                            {loading[item.uri] ? (
                              <span className="text-gray-400">Loading...</span>
                            ) : error[item.uri] ? (
                              <span className="text-red-500">{error[item.uri]}</span>
                            ) : values[item.uri] ? (
                              renderValue(values[item.uri])
                            ) : null}
                          </div>
                        )}
                      </h3>
                      <div className="space-y-2">
                        {item.children?.map((subItem, subIndex) => {
                          const subItemId = `${itemId}-${subIndex}`;
                          return (
                            <div
                              key={subItemId}
                              className="flex items-center justify-between text-sm"
                            >
                              <span className="text-gray-600">{subItem.name}</span>
                              <div className="flex items-center space-x-2">
                                {loading[subItem.uri] ? (
                                  <span className="text-gray-400">Loading...</span>
                                ) : error[subItem.uri] ? (
                                  <span className="text-red-500">{error[subItem.uri]}</span>
                                ) : values[subItem.uri] ? (
                                  renderValue(values[subItem.uri])
                                ) : null}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
