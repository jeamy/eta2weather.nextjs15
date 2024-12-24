"use client";

import { useState, useEffect, useRef, useCallback } from 'react';
import { MenuNode } from '../types/menu';
import Link from 'next/link';

interface HeaderProps {
  menuData?: MenuNode[];
}

export default function Header({ menuData = [] }: HeaderProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [showEtaMenu, setShowEtaMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<NodeJS.Timeout>();
  const [popupData, setPopupData] = useState<{
    isOpen: boolean;
    title: string;
    menuItems: MenuNode[];
  }>({
    isOpen: false,
    title: '',
    menuItems: [],
  });

  const clearHideTimeout = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = undefined;
    }
  }, []);

  const handleMenuEnter = useCallback(() => {
    clearHideTimeout();
    setShowEtaMenu(true);
  }, [clearHideTimeout]);

  const handleMenuLeave = useCallback(() => {
    clearHideTimeout();
    timeoutRef.current = setTimeout(() => {
      setShowEtaMenu(false);
    }, 300);
  }, [clearHideTimeout]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowEtaMenu(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleMenuItemClick = (item: MenuNode) => {
    if (item.children && item.children.length > 0) {
      setPopupData({
        isOpen: true,
        title: item.name,
        menuItems: item.children,
      });
    }
  };

  return (
    <>
      <nav className="bg-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <Link 
                  href="/" 
                  className="text-white hover:text-gray-300 font-medium"
                  style={{ fontFamily: 'var(--font-geist-sans)' }}
                >
                  ETA Control
                </Link>
                <span className="text-white text-xl" style={{ fontFamily: 'var(--font-geist-sans)' }}>
                </span>
              </div>
              
              {showEtaMenu && menuData && menuData.length > 0 && (
                <div 
                  className="absolute left-0 mt-1 w-64 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 z-50"
                  onMouseEnter={handleMenuEnter}
                  onMouseLeave={handleMenuLeave}
                >
                  <div className="py-1" role="menu">
                    {menuData.map((item) => (
                      <button
                        key={item.uri}
                        onClick={() => handleMenuItemClick(item)}
                        className="w-full text-left px-4 py-3 text-sm text-gray-700 hover:bg-gray-100 font-sans flex items-center justify-between"
                        role="menuitem"
                      >
                        <span className="truncate">{item.name}</span>
                        {item.children && item.children.length > 0 && (
                          <svg className="h-4 w-4 ml-2" fill="currentColor" viewBox="0 0 20 20">
                            <path
                              fillRule="evenodd"
                              d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
                              clipRule="evenodd"
                            />
                          </svg>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center space-x-6">
              <Link 
                href="/raw-eta" 
                className="text-white hover:text-gray-300 font-medium"
                style={{ fontFamily: 'var(--font-geist-sans)' }}
              >
                Raw Eta Data
              </Link>
              <Link 
                href="/logs" 
                className="text-white hover:text-gray-300 font-medium"
                style={{ fontFamily: 'var(--font-geist-sans)' }}
              >
                System Logs
              </Link>
              <Link 
                href="/weather" 
                className="text-white hover:text-gray-300 font-medium"
                style={{ fontFamily: 'var(--font-geist-sans)' }}
              >
                Weather
              </Link>
            </div>

            {/* Mobile menu button */}
            <div className="md:hidden">
              <button
                onClick={() => setIsOpen(!isOpen)}
                className="inline-flex items-center justify-center p-2 rounded-md text-gray-400 hover:text-white hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-white"
              >
                <span className="sr-only">Open main menu</span>
                {!isOpen ? (
                  <svg className="block h-6 w-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
                  </svg>
                ) : (
                  <svg className="block h-6 w-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile menu */}
        {isOpen && (
          <div className="md:hidden">
            <div className="px-2 pt-2 pb-3 space-y-1 sm:px-3">
              {menuData.map((item) => (
                <button
                  key={item.uri}
                  onClick={() => handleMenuItemClick(item)}
                  className="w-full text-left text-gray-300 hover:bg-gray-700 hover:text-white block px-3 py-3 rounded-md text-base font-sans"
                >
                  {item.name}
                </button>
              ))}
            </div>
          </div>
        )}
      </nav>
    </>
  );
}
