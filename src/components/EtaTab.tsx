import { useEffect, useState, useCallback, useRef } from 'react';
import { MenuNode } from '@/types/menu';
import { ParsedXmlData } from '@/reader/functions/types-constants/EtaConstants';
import { formatValue } from '@/utils/formatters';
import { 
  ClockIcon, 
  CalendarIcon, 
  ChartBarIcon,
  FireIcon,
  CubeIcon,
  CircleStackIcon,
  Cog6ToothIcon
} from '@heroicons/react/24/outline';

interface EtaTabProps {
  menuItems?: MenuNode[];
}

export default function EtaTab({ menuItems = [] }: EtaTabProps) {
  const [values, setValues] = useState<Record<string, ParsedXmlData>>({});
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [error, setError] = useState<Record<string, string>>({});
  const abortControllersRef = useRef<Record<string, AbortController>>({});

  // Cleanup function for abort controllers
  const cleanupAbortController = useCallback((uri: string) => {
    if (abortControllersRef.current[uri]) {
      abortControllersRef.current[uri].abort();
      delete abortControllersRef.current[uri];
    }
  }, []);

  // Cleanup all abort controllers
  const cleanupAllAbortControllers = useCallback(() => {
    Object.keys(abortControllersRef.current).forEach(cleanupAbortController);
  }, [cleanupAbortController]);

  const fetchValues = useCallback(async (uri: string) => {
    if (!uri) return;
    
    // Cleanup any existing fetch for this URI
    cleanupAbortController(uri);
    
    // Create new AbortController for this fetch
    const abortController = new AbortController();
    abortControllersRef.current[uri] = abortController;
    
    setLoading(prev => ({ ...prev, [uri]: true }));
    setError(prev => ({ ...prev, [uri]: '' }));
    
    try {
      const response = await fetch(
        `/api/eta/readMenuData?uri=${encodeURIComponent(uri)}`,
        { signal: abortController.signal }
      );
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const result = await response.json();
      
      // Check if the request was aborted before updating state
      if (!abortController.signal.aborted) {
        if (result.success && result.data) {
          setValues(prev => ({ ...prev, [uri]: result.data }));
        } else {
          throw new Error(result.error || 'Failed to fetch data');
        }
      }
    } catch (error) {
      // Only update error state if the request wasn't aborted
      if (error instanceof Error && error.name !== 'AbortError') {
        const errorMessage = error instanceof Error ? error.message : 'An error occurred';
        setError(prev => ({ ...prev, [uri]: errorMessage }));
        console.error('Error fetching value for URI:', uri, 'Error:', error);
      }
    } finally {
      if (!abortController.signal.aborted) {
        setLoading(prev => ({ ...prev, [uri]: false }));
      }
      cleanupAbortController(uri);
    }
  }, [cleanupAbortController]);

  useEffect(() => {
    const fetchAllValues = async () => {
      if (!menuItems?.length) return;
      
      // Clear previous state when menu items change
      setValues({});
      setLoading({});
      setError({});
      cleanupAllAbortControllers();
      
      const urisToFetch = new Set<string>();
      menuItems.forEach(category => {
        category.children?.forEach(item => {
          // Add URI for the item itself if it exists
          if (item.uri) {
            urisToFetch.add(item.uri);
          }

          // Add URIs for children of all items
          item.children?.forEach(subItem => {
            if (subItem.uri) {
              urisToFetch.add(subItem.uri);
            }
          });
        });
      });

      // Fetch values sequentially to prevent overwhelming the server
      for (const uri of urisToFetch) {
        await fetchValues(uri);
        // Add a small delay between requests to prevent overwhelming the server
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    };

    fetchAllValues();

    // Cleanup function
    return () => {
      cleanupAllAbortControllers();
    };
  }, [menuItems, fetchValues, cleanupAllAbortControllers]);

  const renderValue = useCallback((data: ParsedXmlData) => {
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

  return (
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
      <div className="mt-5 ">
        {menuItems.map((category, categoryIndex) => (
          <div
            key={`panel-${categoryIndex}-${category.name}`}
            className={`bg-gray-50 rounded-xl p-5 ring-white ring-opacity-60 ring-offset-2 ring-offset-blue-400 focus:outline-none focus:ring-2 border border-gray-200 shadow-lg ${
              selectedIndex === categoryIndex ? '' : 'hidden'
            }`}
          >
            <div className="space-y-4 ">
              {category.children?.map((item, itemIndex) => {
                const itemId = `${categoryIndex}-${itemIndex}-${item.name}`;
                return (
                  <div key={itemId} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-medium text-gray-900">{item.name}</h3>
                      {item.uri && (
                        <div className="flex justify-end min-w-[8rem]">
                          {loading[item.uri] ? (
                            <span className="text-gray-400">Loading...</span>
                          ) : error[item.uri] ? (
                            <span className="text-red-500 text-sm" title={error[item.uri]}>Error</span>
                          ) : values[item.uri] ? (
                            <div 
                              className="tabular-nums cursor-help"
                              title={item.uri}
                            >
                              <span className="inline-block min-w-[3rem] text-right">
                                {renderValue(values[item.uri])}
                              </span>
                              {values[item.uri].unit && (
                                <span className="text-gray-500 ml-1 inline-block">
                                  {values[item.uri].unit}
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-gray-400">No data</span>
                          )}
                        </div>
                      )}
                    </div>
                    {item.children?.map((subItem, subItemIndex) => {
                      const subItemId = `${itemId}-${subItemIndex}-${subItem.name}`;
                      return (
                        <div key={subItemId} className="pl-4">
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-gray-700">{subItem.name}</span>
                            {subItem.uri && (
                              <div className="flex justify-end min-w-[8rem]">
                                {loading[subItem.uri] ? (
                                  <span className="text-gray-400">Loading...</span>
                                ) : error[subItem.uri] ? (
                                  <span className="text-red-500 text-sm" title={error[subItem.uri]}>Error</span>
                                ) : values[subItem.uri] ? (
                                  <div 
                                    className="tabular-nums cursor-help"
                                    title={subItem.uri}
                                  >
                                    <span className="inline-block min-w-[3rem] text-right">
                                      {renderValue(values[subItem.uri])}
                                    </span>
                                    {values[subItem.uri].unit && (
                                      <span className="text-gray-500 ml-1 inline-block">
                                        {values[subItem.uri].unit}
                                      </span>
                                    )}
                                  </div>
                                ) : (
                                  <span className="text-gray-400">No data</span>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
