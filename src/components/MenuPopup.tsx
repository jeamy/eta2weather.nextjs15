"use client";

import { useEffect, useState } from 'react';
import { Dialog } from '@headlessui/react';
import { MenuNode } from '../types/menu';
import { ParsedXmlData } from '@/reader/functions/types-constants/EtaConstants';

interface MenuPopupProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  menuItems: MenuNode[];
}

export default function MenuPopup({ isOpen, onClose, title, menuItems }: MenuPopupProps) {
  const [values, setValues] = useState<Record<string, ParsedXmlData>>({});
  const [loading, setLoading] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const fetchValues = async () => {
      const fetchItem = async (item: MenuNode) => {
        if (item.uri) {
          try {
            setLoading(prev => ({ ...prev, [item.uri]: true }));
            
            const response = await fetch(`/api/eta/readMenuData?uri=${encodeURIComponent(item.uri)}`);
            const result = await response.json();

            if (result.success && result.data) {
              setValues(prev => ({
                ...prev,
                [item.uri]: result.data
              }));
            } else {
              console.error(`Error fetching value for ${item.uri}:`, result.error);
            }
          } catch (error) {
            console.error(`Error fetching value for ${item.uri}:`, error);
          } finally {
            setLoading(prev => ({ ...prev, [item.uri]: false }));
          }
        }
        
        if (item.children && item.children.length > 0) {
          for (const childItem of item.children) {
            await fetchItem(childItem);
          }
        }
      };

      for (const item of menuItems) {
        await fetchItem(item);
      }
    };

    if (isOpen && menuItems.length > 0) {
      setValues({}); // Reset values when opening
      fetchValues();
    }
  }, [isOpen, menuItems]);

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

  const renderMenuItem = (item: MenuNode, level: number = 0) => {
    return (
      <li key={item.uri} className="text-sm">
        <div className="flex items-center group relative">
          <div className={`flex-1 ${level > 0 ? 'ml-4' : ''}`}>
            <span 
              className="text-gray-700 cursor-help"
              title={item.uri}
            >
              {item.name}
            </span>
          </div>
          {item.uri && (
            <div className="flex justify-end min-w-[8rem]">
              {loading[item.uri] ? (
                <span className="text-gray-400">Loading...</span>
              ) : values[item.uri] ? (
                <div 
                  className="tabular-nums cursor-help"
                  title={item.uri}
                >
                  <span className={`inline-block min-w-[3rem] text-right ${formatValue(values[item.uri]).color}`}>
                    {formatValue(values[item.uri]).text}
                  </span>
                  {values[item.uri].unit && (
                    <span className="text-gray-500 ml-1 inline-block">
                      {values[item.uri].unit}
                    </span>
                  )}
                </div>
              ) : null}
            </div>
          )}
        </div>
        {item.children && item.children.length > 0 && (
          <ul className="space-y-2 mt-2">
            {item.children.map(childItem => renderMenuItem(childItem, level + 1))}
          </ul>
        )}
      </li>
    );
  };

  return (
    <Dialog
      open={isOpen}
      onClose={onClose}
      className="relative z-50"
    >
      <div className="fixed inset-0 bg-black/30" aria-hidden="true" />

      <div className="fixed inset-0 flex items-center justify-center p-4">
        <div className="w-full max-w-md transform overflow-hidden rounded-2xl bg-white p-6 text-left align-middle shadow-xl max-h-[80vh] overflow-y-auto">
          <h3 className="text-lg font-medium leading-6 text-gray-900 mb-4">
            {title}
          </h3>

          <div className="mt-2">
            <ul className="space-y-2 list-disc pl-4">
              {menuItems.map(item => renderMenuItem(item))}
            </ul>
          </div>

          <div className="mt-4">
            <button
              type="button"
              className="inline-flex justify-center rounded-md border border-transparent bg-blue-100 px-4 py-2 text-sm font-medium text-blue-900 hover:bg-blue-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
              onClick={onClose}
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </Dialog>
  );
}
