"use client";

import { useState, useEffect, useRef, useCallback } from 'react';
import { usePathname } from 'next/navigation';
import { MenuNode } from '../types/menu';
import Link from 'next/link';

interface HeaderProps {
  menuData?: MenuNode[];
}

export default function Header({ menuData = [] }: HeaderProps) {
  const [isOpen, setIsOpen] = useState(false);
  const pathname = usePathname();
  const [showEtaMenu, setShowEtaMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);
  const [popupData, setPopupData] = useState<{
    isOpen: boolean;
    title: string;
    menuItems: MenuNode[];
  }>({
    isOpen: false,
    title: '',
    menuItems: [],
  });

  const clearHideTimeout = useCallback((): void => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = undefined;
    }
  }, []);

  const handleMenuEnter = useCallback((): void => {
    clearHideTimeout();
    setShowEtaMenu(true);
  }, [clearHideTimeout]);

  const handleMenuLeave = useCallback((): void => {
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
      <nav className="header">
        <div className="container">
          <div className="header__inner">
            <div className="flex items-center gap-3">
              <Link href="/" className="header__brand">ETA Control</Link>

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

            <div className="header__links">
              <Link href="/" className="btn btn--ghost" aria-current={pathname === '/' ? 'page' : undefined}>Home</Link>
              <Link href="/raw-eta" className="btn btn--ghost" aria-current={pathname === '/raw-eta' ? 'page' : undefined}>Raw Eta Data</Link>
              <Link href="/logs" className="btn btn--ghost" aria-current={pathname === '/logs' ? 'page' : undefined}>System Logs</Link>
              <Link href="/weather" className="btn btn--ghost" aria-current={pathname === '/weather' ? 'page' : undefined}>Weather</Link>
            </div>

            <div className="header__mobileToggle md:hidden">
              <button
                onClick={() => setIsOpen(!isOpen)}
                className="btn btn--ghost"
                title="Open main menu"
              >
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

          {isOpen && (
            <div className="header__drawer md:hidden">
              <div className="space-y-2">
                <Link href="/" className="btn btn--ghost w-full text-left" aria-current={pathname === '/' ? 'page' : undefined} onClick={() => setIsOpen(false)}>
                  Home
                </Link>
                <Link href="/raw-eta" className="btn btn--ghost w-full text-left" aria-current={pathname === '/raw-eta' ? 'page' : undefined} onClick={() => setIsOpen(false)}>
                  Raw Eta Data
                </Link>
                <Link href="/logs" className="btn btn--ghost w-full text-left" aria-current={pathname === '/logs' ? 'page' : undefined} onClick={() => setIsOpen(false)}>
                  System Logs
                </Link>
                <Link href="/weather" className="btn btn--ghost w-full text-left" aria-current={pathname === '/weather' ? 'page' : undefined} onClick={() => setIsOpen(false)}>
                  Weather
                </Link>
                <div className="mt-2 border-t border-[rgba(255,255,255,.06)] pt-2">
                  {menuData.map((item) => (
                    <button
                      key={item.uri}
                      onClick={() => { handleMenuItemClick(item); setIsOpen(false); }}
                      className="btn btn--ghost w-full text-left"
                    >
                      {item.name}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </nav>
    </>
  );
}
