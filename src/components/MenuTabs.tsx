import { Tab } from '@headlessui/react';
import { useEffect, useState } from 'react';
import { MenuNode } from '@/types/menu';
import { ParsedXmlData } from '@/reader/functions/types-constants/EtaConstants';

interface MenuTabsProps {
  menuItems?: MenuNode[];
}

export default function MenuTabs({ menuItems = [] }: MenuTabsProps) {
  const [values, setValues] = useState<Record<string, ParsedXmlData>>({});
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const [selectedTab, setSelectedTab] = useState(0);

  const fetchValues = async (uri: string) => {
    if (!uri) return;
    setLoading(prev => ({ ...prev, [uri]: true }));
    try {
      const response = await fetch(`/api/eta/readMenuData?uri=${encodeURIComponent(uri)}`);
      const result = await response.json();
      console.log('Fetched value for', uri, ':', result);

      if (result.success && result.data) {
        setValues(prev => {
          const newValues = { ...prev, [uri]: result.data };
          console.log('Updated values:', newValues);
          return newValues;
        });
      } else {
        console.error(`Error fetching value for ${uri}:`, result.error);
      }
    } catch (error) {
      console.error('Error fetching value:', error);
    } finally {
      setLoading(prev => ({ ...prev, [uri]: false }));
    }
  };

  useEffect(() => {
    console.log('Menu items:', menuItems);
    const fetchAllValues = async () => {
      if (!menuItems?.length) return;
      
      for (const category of menuItems) {
        if (category.children) {
          for (const item of category.children) {
            if (item.children) {
              for (const subItem of item.children) {
                if (subItem.uri) {
                  console.log('Fetching value for:', subItem.uri);
                  await fetchValues(subItem.uri);
                }
              }
            }
          }
        }
      }
    };
    fetchAllValues();
  }, [menuItems]);

  const formatValue = (data: ParsedXmlData): { text: JSX.Element | string; color: string } => {
    const value = data.strValue || data.value;
    
    if (typeof value === 'undefined' || value === null) {
      return { text: 'N/A', color: "text-gray-500" };
    }

    // Handle special text cases
    if (value === "Ein") return { text: "Ein", color: "text-green-600" };
    if (value === "Aus") return { text: "Aus", color: "text-red-600" };
    if (value === "xxx") return { text: "---", color: "text-blue-600" };
    
    // Handle time format "Xm Ys"
    if (typeof value === 'string') {
      const timeMatch = value.match(/(\d+)m\s+(\d+(?:,\d+)?)s/);
      if (timeMatch) {
        const minutes = timeMatch[1];
        const seconds = timeMatch[2].replace(',', '.');
        return { 
          text: (
            <>{minutes}<span className="text-gray-500"> m</span>  {seconds}</>
          ),
          color: "text-gray-900" 
        };
      }
    }
    
    // Try to convert to number
    const numValue = typeof value === 'string' ? parseFloat(value) : value;
    
    // If not a valid number, return the original text
    if (isNaN(numValue)) {
      return { text: value.toString(), color: "text-gray-900" };
    }
    
    // Special handling for "Letzte Änderung"
    if (data.name === "Letzte Änderung") {
      const hours = Math.floor(numValue / 3600);
      const minutes = Math.floor((numValue % 3600) / 60);
      const seconds = Math.floor(numValue % 60);
      return { 
        text: `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`,
        color: "text-gray-900" 
      };
    }
    
    // Handle numeric values
    const scaleFactor = data.scaleFactor ? Number(data.scaleFactor) : 1;
//    const decPlaces = data.decPlaces ? Number(data.decPlaces) : 0;
    const decPlaces = 1;
//    const scaled = numValue / (scaleFactor * Math.pow(10, decPlaces));
    const scaled = numValue;
    return { text: scaled.toFixed(decPlaces), color: "text-gray-900" };
  };

  return (
    <div className="w-1/2 px-4">
      <Tab.Group
        selectedIndex={selectedTab}
        onChange={setSelectedTab}
        className="space-y-2"
      >
        <Tab.List className="flex space-x-1 rounded-xl bg-blue-900/20 p-1">
          {menuItems.map((category, categoryIndex) => (
            <Tab
              key={`tab-${categoryIndex}-${category.name}`}
              className={({ selected }) =>
                `w-full rounded-lg py-2.5 text-sm font-medium leading-5 text-blue-700
                  ring-white ring-opacity-60 ring-offset-2 ring-offset-blue-400 focus:outline-none focus:ring-2
                  ${selected
                  ? 'bg-white shadow'
                  : 'text-blue-100 hover:bg-white/[0.12] hover:text-white'
                }`
              }
            >
              {category.name}
            </Tab>
          ))}
        </Tab.List>

        <Tab.Panels className="mt-2">
          {menuItems.map((category, categoryIndex) => (
            <Tab.Panel
              key={`panel-${categoryIndex}-${category.name}`}
              className="rounded-xl bg-white p-3 ring-white ring-opacity-60 ring-offset-2 ring-offset-blue-400 focus:outline-none focus:ring-2
                border border-gray-200 shadow-lg"
            >
              <div className="space-y-4">
                {category.children?.map((item, itemIndex) => (
                  <div key={`section-${categoryIndex}-${itemIndex}-${item.name}`} className="space-y-2">
                    <h3 className="text-lg font-medium text-gray-900">{item.name}</h3>
                    {item.children?.map((subItem, subItemIndex) => (
                      <div key={`item-${categoryIndex}-${itemIndex}-${subItemIndex}-${subItem.name}`} className="pl-4">
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-gray-700">{subItem.name}</span>
                          {subItem.uri && (
                            <div className="flex justify-end min-w-[8rem]">
                              {loading[subItem.uri] ? (
                                <span className="text-gray-400">Loading...</span>
                              ) : values[subItem.uri] ? (
                                <div 
                                  className="tabular-nums cursor-help"
                                  title={subItem.uri}
                                >
                                  {(() => {
                                    console.log('Rendering value for', subItem.uri, ':', values[subItem.uri]);
                                    return null;
                                  })()}
                                  <span className={`inline-block min-w-[3rem] text-right ${formatValue(values[subItem.uri]).color}`}>
                                    {formatValue(values[subItem.uri]).text}
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
                    ))}
                  </div>
                ))}
              </div>
            </Tab.Panel>
          ))}
        </Tab.Panels>
      </Tab.Group>
    </div>
  );
}
