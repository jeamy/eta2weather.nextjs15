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
    <div className="tabs">
      <div className="card__header">
        <h2 className="text-lg font-semibold">ETA Data</h2>
        {lastUpdated && (
          <span className="text-xs text-gray-500">Zuletzt aktualisiert: {new Date(lastUpdated).toLocaleTimeString()}</span>
        )}
        <button
          onClick={handleRefresh}
          className="btn btn--ghost"
          disabled={isRefreshing}
          title="Aktualisieren"
        >
          <ArrowPathIcon className={`w-5 h-5 ${isRefreshing ? 'animate-spin' : ''}`} />
        </button>
      </div>
      <div>
        <div className="tabs__list tabs__list--sticky" role="tablist" aria-label="ETA categories">
          {menuItems.map((category, categoryIndex) => (
            <button
              key={`tab-${categoryIndex}-${category.name}`}
              onClick={() => setSelectedIndex(categoryIndex)}
              className={`tabs__button ${selectedIndex === categoryIndex ? 'tabs__button--active' : ''}`}
              role="tab"
              id={`tab-eta-${categoryIndex}`}
              aria-selected={selectedIndex === categoryIndex}
              aria-controls={`panel-eta-${categoryIndex}`}
              tabIndex={selectedIndex === categoryIndex ? 0 : -1}
              title={category.name}
            >
              <span className="tabs__icon">{getTabIcon(category.name)}</span>
              <span className="tabs__label">{category.name}</span>
            </button>
          ))}
        </div>
        <div>
          {menuItems.map((category, categoryIndex) => (
            <div
              key={`panel-${categoryIndex}-${category.name}`}
              className="tabs__panel"
              id={`panel-eta-${categoryIndex}`}
              role="tabpanel"
              aria-labelledby={`tab-eta-${categoryIndex}`}
              hidden={selectedIndex !== categoryIndex}
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
