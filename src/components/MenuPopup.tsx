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
      for (const item of menuItems) {
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
      }
    };

    if (isOpen && menuItems.length > 0) {
      setValues({}); // Reset values when opening
      fetchValues();
    }
  }, [isOpen, menuItems]);

  return (
    <Dialog
      open={isOpen}
      onClose={onClose}
      className="relative z-50"
    >
      <div className="fixed inset-0 bg-black/30" aria-hidden="true" />

      <div className="fixed inset-0 flex items-center justify-center p-4">
        <div className="w-full max-w-md transform overflow-hidden rounded-2xl bg-white p-6 text-left align-middle shadow-xl">
          <h3 className="text-lg font-medium leading-6 text-gray-900 mb-4">
            {title}
          </h3>

          <div className="mt-2">
            <div className="space-y-4">
              {menuItems.map((item) => (
                <div key={item.uri} className="flex justify-between items-center">
                  <span className="text-sm text-gray-700">{item.name}</span>
                  {item.uri && (
                    <div className="text-sm font-medium text-gray-900">
                      {loading[item.uri] ? (
                        <span className="text-gray-400">Loading...</span>
                      ) : values[item.uri] ? (
                        <div className="flex justify-between gap-4">
                          <span>{values[item.uri].strValue || values[item.uri].value}</span>
                          {values[item.uri].unit && (
                            <span className="text-gray-500">{values[item.uri].unit}</span>
                          )}
                        </div>
                      ) : null}
                    </div>
                  )}
                </div>
              ))}
            </div>
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
