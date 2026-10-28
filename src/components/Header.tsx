"use client";

import { useState, useEffect, useRef, useCallback } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import MenuPopup from './MenuPopup';
import { useEtaMenu } from './EtaDataProvider';
import { MenuNode } from '@/types/menu';
import ThemeControls from './ThemeControls';
import { useAppSelector } from '@/redux/hooks';

export default function Header() {
  const [isOpen, setIsOpen] = useState(false);
  const menuData = useEtaMenu();
  const pathname = usePathname();
  const wifiTime = useAppSelector(state => state.wifiAf83.data.time);
  const etaData = useAppSelector(state => state.eta.data);
  const sourcesReady = wifiTime > 0 && Object.keys(etaData || {}).length > 0;
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
      clearHideTimeout();
    };
  }, [clearHideTimeout]);

  const handleMenuItemClick = (item: MenuNode) => {
    setShowEtaMenu(false);
    setPopupData({
      isOpen: true,
      title: item.name,
      menuItems: item.children?.length ? item.children : [item],
    });
  };

  return (
    <>
      <nav className="header" aria-label="Hauptnavigation">
        <div className="container">
          <div className="header__inner">
            <div className="header__leading">
              <Link href="/" className="header__brand">
                <span className="header__brandMark" aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M13 2 4.5 13.2A5.5 5.5 0 0 0 9 22h6a5.5 5.5 0 0 0 4.5-8.8L13 2Z"/><path d="M9 16c1.8.4 3.7-.4 5-2.4"/></svg>
                </span>
                <span className="header__brandText">ETA Control</span>
              </Link>

              {menuData.length > 0 && (
                <div className="relative" onMouseEnter={handleMenuEnter} onMouseLeave={handleMenuLeave} ref={menuRef}>
                  <button type="button" className="header__navButton" onClick={() => setShowEtaMenu(open => !open)} aria-expanded={showEtaMenu}>
                    ETA Menü <span aria-hidden="true">⌄</span>
                  </button>
                  {showEtaMenu && (
                    <div className="header__etaMenu">
                      <div role="menu">
                        {menuData.map((item) => (
                          <button
                            key={item.uri || item.name}
                            onClick={() => handleMenuItemClick(item)}
                            className="header__etaMenuItem"
                            role="menuitem"
                          >
                            <span className="truncate">{item.name}</span>
                            {item.children?.length ? <span aria-hidden="true">›</span> : null}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="header__links">
              <Link href="/" className="header__navButton" aria-current={pathname === '/' ? 'page' : undefined}>Home</Link>
              <Link href="/raw-eta" className="header__navButton" aria-current={pathname === '/raw-eta' ? 'page' : undefined}>Raw Eta Data</Link>
              <Link href="/logs" className="header__navButton" aria-current={pathname === '/logs' ? 'page' : undefined}>System Logs</Link>
              <Link href="/weather" className="header__navButton" aria-current={pathname === '/weather' ? 'page' : undefined}>Weather</Link>
            </div>

            <div className={`header__source ${sourcesReady ? 'header__source--live' : ''}`} title={sourcesReady ? 'ETA- und WiFi-Daten verfügbar' : 'Warte auf ETA- oder WiFi-Daten'}>
              <span className="header__sourceDot" />
              <span>{sourcesReady ? 'ETA & WiFi aktuell' : 'Daten werden geladen'}</span>
            </div>

            <ThemeControls />

            <div className="header__mobileToggle md:hidden">
              <button
                onClick={() => setIsOpen(!isOpen)}
                className="header__mobileButton"
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
      <MenuPopup
        isOpen={popupData.isOpen}
        onClose={() => setPopupData(prev => ({ ...prev, isOpen: false }))}
        title={popupData.title}
        menuItems={popupData.menuItems}
      />
    </>
  );
}
