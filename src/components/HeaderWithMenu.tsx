"use client";

import { useCallback, useEffect, useState } from 'react';
import Header from './Header';
import { MenuNode } from '../types/menu';

interface ApiResponse {
  success: boolean;
  data: MenuNode[];
  stats?: {
    totalNodes: number;
    topLevelNodes: number;
  };
}

export default function HeaderWithMenu() {
  const [menuData, setMenuData] = useState<MenuNode[]>([]);

  const fetchMenuData = useCallback(async () => {
    try {
      const response = await fetch('/api/eta/menu');
      const result: ApiResponse = await response.json();

      console.log('Menu data received:', result);
      
      if (result.success && Array.isArray(result.data)) {
        console.log('Menu data received:', result.data);
        setMenuData(result.data);
      } else {
        console.error('Invalid menu data format:', result);
        setMenuData([]);
      }
    } catch (error) {
      console.error('Error fetching menu data:', error);
      setMenuData([]);
    }
  }, []);

  useEffect(() => {
    fetchMenuData();
  }, [fetchMenuData]);

  return <Header menuData={menuData} />;
}
