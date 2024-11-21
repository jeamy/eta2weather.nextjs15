"use client";

import { useEffect } from 'react';
import Link from 'next/link';
import { MenuNode } from '../types/menu';

interface MenuPopupProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  menuItems: MenuNode[];
}

export default function MenuPopup({ isOpen, onClose, title, menuItems }: MenuPopupProps) {
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-xl font-semibold font-sans">{title}</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 focus:outline-none"
          >
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="p-4 max-h-[70vh] overflow-y-auto">
          {menuItems.length > 0 ? (
            <div className="space-y-2">
              {menuItems.map((item) => (
                <Link
                  key={item.uri}
                  href={`/eta${item.uri}`}
                  className="block px-4 py-3 text-gray-700 hover:bg-gray-100 rounded-md font-sans transition-colors duration-150"
                  onClick={onClose}
                >
                  {item.name}
                </Link>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 text-center py-4">No items available</p>
          )}
        </div>
      </div>
    </div>
  );
}
