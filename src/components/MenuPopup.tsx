"use client";

import { Fragment, useEffect, useState, useCallback } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { MenuNode } from '../types/menu';
import { ParsedXmlData } from '@/reader/functions/types-constants/EtaConstants';
import { formatValue } from '@/utils/formatters';

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
        
        const response = await fetch(`/api/eta/readMenuData?uri=${encodeURIComponent(item.uri)}`);
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
              ) : null}
            </div>
          )}
        </div>

        {item.children && item.children.length > 0 && (
          <ul className="space-y-2 mt-2">
            {item.children.map((childItem, childIndex) => 
              renderMenuItem(childItem, childIndex, `${itemKey}-`)
            )}
          </ul>
        )}
      </li>
    );
  };

  return (
    <Dialog.Root open={isOpen} onOpenChange={onClose}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/30 animate-fadeIn" />
        <Dialog.Content className="fixed left-[50%] top-[50%] max-h-[85vh] w-[90vw] max-w-[800px] translate-x-[-50%] translate-y-[-50%] rounded-lg bg-white p-6 shadow-lg focus:outline-none animate-contentShow overflow-y-auto">
          <Dialog.Title className="text-xl font-semibold text-gray-900 mb-4">
            {title}
          </Dialog.Title>
          
          <div className="space-y-6">
            <ul className="space-y-2 list-disc pl-4">
              {menuItems.map((item, index) => renderMenuItem(item, index))}
            </ul>
          </div>

          <Dialog.Close asChild>
            <button
              className="absolute right-4 top-4 inline-flex h-6 w-6 items-center justify-center rounded-full text-gray-400 hover:text-gray-500 focus:outline-none"
              aria-label="Close"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
