import { useEffect, useState, useCallback } from 'react';
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

  const fetchValues = useCallback(async (uri: string) => {
    if (!uri) return;
    
    setLoading(prev => ({ ...prev, [uri]: true }));
    setError(prev => ({ ...prev, [uri]: '' }));
    
    try {
      const response = await fetch(`/api/eta/readMenuData?uri=${encodeURIComponent(uri)}`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const result = await response.json();
      // console.log('Received data for URI:', uri, 'Data:', result.data);
      
      if (result.success && result.data) {
        setValues(prev => ({ ...prev, [uri]: result.data }));
      } else {
        throw new Error(result.error || 'Failed to fetch data');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'An error occurred';
      setError(prev => ({ ...prev, [uri]: errorMessage }));
      console.error('Error fetching value for URI:', uri, 'Error:', error);
    } finally {
      setLoading(prev => ({ ...prev, [uri]: false }));
    }
  }, []);

  useEffect(() => {
    const fetchAllValues = async () => {
      if (!menuItems?.length) return;
      
      const urisToFetch = new Set<string>();
      menuItems.forEach(category => {
        category.children?.forEach(item => {
//          console.log('Menu item:', item.name);
          if (item.name === 'Lager') {
//            console.log('Found Lager menu:', item);
            item.children?.forEach(subItem => {
              if (subItem.uri) {
                urisToFetch.add(subItem.uri);
              }
            });
          }
          item.children?.forEach(subItem => {
            if (subItem.uri) {
              urisToFetch.add(subItem.uri);
            }
          });
        });
      });

//      console.log('All URIs to fetch:', Array.from(urisToFetch));

      // Fetch values sequentially to better track issues
      for (const uri of urisToFetch) {
        await fetchValues(uri);
      }
    };

    fetchAllValues();
  }, [menuItems, fetchValues]);

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
                  <div key={itemId} className="space-y-2 ">
                    <h3 className="text-lg font-medium text-gray-900">{item.name}</h3>
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
