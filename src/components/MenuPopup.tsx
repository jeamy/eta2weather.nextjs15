"use client";

import { Fragment, useEffect, useState, useCallback } from 'react';
import { Dialog, Transition } from '@headlessui/react';
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
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={onClose}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black/30" aria-hidden="true" />
        </Transition.Child>

        <div className="fixed inset-0 flex items-center justify-center p-4">
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-300"
            enterFrom="opacity-0 scale-95"
            enterTo="opacity-100 scale-100"
            leave="ease-in duration-200"
            leaveFrom="opacity-100 scale-100"
            leaveTo="opacity-0 scale-95"
          >
            <Dialog.Panel className="w-full max-w-md transform overflow-hidden rounded-2xl bg-white p-6 text-left align-middle shadow-xl max-h-[80vh] overflow-y-auto">
              <Dialog.Title as="h3" className="text-lg font-medium leading-6 text-gray-900 mb-4">
                {title}
              </Dialog.Title>

              <div className="mt-2">
                <ul className="space-y-2 list-disc pl-4">
                  {menuItems.map((item, index) => renderMenuItem(item, index))}
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
            </Dialog.Panel>
          </Transition.Child>
        </div>
      </Dialog>
    </Transition>
  );
}
