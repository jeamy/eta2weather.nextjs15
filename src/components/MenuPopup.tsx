"use client";

import { useEffect, useState, useCallback } from 'react';
import { MenuNode } from '../types/menu';
import { ParsedXmlData } from '@/reader/functions/types-constants/EtaConstants';
import { formatValue } from '@/utils/formatters';
import { API } from '@/constants/apiPaths';

interface MenuPopupProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  menuItems: MenuNode[];
}

export default function MenuPopup({ isOpen, onClose, title, menuItems }: MenuPopupProps) {
  const [values, setValues] = useState<Record<string, ParsedXmlData>>({});
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<Record<string, string>>({});

  const fetchItem = useCallback(async (item: MenuNode) => {
    if (item.uri) {
      try {
        setLoading(prev => ({ ...prev, [item.uri]: true }));
        setError(prev => ({ ...prev, [item.uri]: '' }));
        
        const response = await fetch(`${API.ETA_READ_MENU_DATA}?uri=${encodeURIComponent(item.uri)}`);
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const result = await response.json();
        
        if (result.success && result.data) {
          setValues(prev => ({
            ...prev,
            [item.uri]: result.data
          }));
        } else {
          throw new Error(result.error || 'Failed to fetch data');
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'An error occurred';
        setError(prev => ({ ...prev, [item.uri]: errorMessage }));
        console.error(`Error fetching value for ${item.uri}:`, error);
      } finally {
        setLoading(prev => ({ ...prev, [item.uri]: false }));
      }
    }
    
    if (item.children && item.children.length > 0) {
      await Promise.all(item.children.map(fetchItem));
    }
  }, []);

  useEffect(() => {
    if (isOpen && menuItems.length > 0) {
      setValues({}); // Reset values when opening
      setError({}); // Reset errors when opening
      Promise.all(menuItems.map(fetchItem));
    }
  }, [isOpen, menuItems, fetchItem]);

  const renderValue = useCallback((data: ParsedXmlData) => {
    const { text, color } = formatValue(data);
    return <span className={color}>{text}</span>;
  }, []);

  const renderMenuItem = (item: MenuNode, index: number, parentKey: string = '') => {
    const itemKey = `${parentKey}${index}-${item.name}`;
    
    return (
      <li key={itemKey} className="text-sm">
        <div className="flex items-center group relative">
          <div className={`flex-1 ${parentKey ? 'ml-4' : ''}`}>
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
        {item.children && item.children.length > 0 && (
          <ul className="mt-1 space-y-1">
            {item.children.map((child, childIndex) => renderMenuItem(child, childIndex, itemKey))}
          </ul>
        )}
      </li>
    );
  };

  if (!isOpen) return null;

  return (
    <>
      <div 
        className="fixed inset-0 bg-black/30 transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <div className="relative w-full max-w-md transform overflow-hidden rounded-2xl bg-white p-6 text-left align-middle shadow-xl transition-all max-h-[80vh] overflow-y-auto">
          <h3 className="text-lg font-medium leading-6 text-gray-900 mb-4">
            {title}
          </h3>

          <div className="mt-2">
            <ul className="space-y-2 list-disc pl-4">
              {menuItems.map((item, index) => renderMenuItem(item, index))}
            </ul>
          </div>

          <button
            onClick={onClose}
            className="absolute right-4 top-4 inline-flex h-6 w-6 items-center justify-center rounded-full text-gray-400 hover:text-gray-500 focus:outline-none"
            aria-label="Close"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
    </>
  );
}
