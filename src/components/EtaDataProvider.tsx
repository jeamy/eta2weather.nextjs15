'use client';

import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { API } from '@/constants/apiPaths';
import { MenuNode } from '@/types/menu';

const EtaMenuContext = createContext<MenuNode[] | null>(null);

export const EtaDataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [menuItems, setMenuItems] = useState<MenuNode[]>([]);

    useEffect(() => {
        const controller = new AbortController();
        const loadMenu = async () => {
            try {
                const response = await fetch(API.ETA_MENU, { signal: controller.signal });
                if (!response.ok) throw new Error(`ETA menu request failed: ${response.status}`);
                const result = await response.json();
                if (!result.success || !Array.isArray(result.data)) {
                    throw new Error(result.error || 'Invalid ETA menu response');
                }
                setMenuItems(result.data);
            } catch (error) {
                if ((error as Error).name !== 'AbortError') {
                    console.error('Error loading ETA menu:', error);
                }
            }
        };

        void loadMenu();
        return () => controller.abort();
    }, []);

    const value = useMemo(() => menuItems, [menuItems]);
    return <EtaMenuContext.Provider value={value}>{children}</EtaMenuContext.Provider>;
};

export function useEtaMenu(): MenuNode[] {
    const value = useContext(EtaMenuContext);
    if (value === null) throw new Error('useEtaMenu must be used within EtaDataProvider');
    return value;
}
