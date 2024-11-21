'use client'

import ConfigData from "@/components/ConfigData";
import EtaData from "@/components/EtaData";
import WifiAf83Data from "@/components/WifiAf83Data";
import MenuTabs from '@/components/MenuTabs';
import { useEffect, useState } from "react";
import { MenuNode } from "@/types/menu";

export default function Home() {
  const [menuItems, setMenuItems] = useState<MenuNode[]>([]);

  useEffect(() => {
    const fetchMenuItems = async () => {
      try {
        const response = await fetch('/api/eta/menu');
        const result = await response.json();
        console.log('API response:', result);
        if (result.success && Array.isArray(result.data)) {
          setMenuItems(result.data);
        } else {
          console.error('Invalid menu data format:', result);
        }
      } catch (error) {
        console.error('Error fetching menu items:', error);
      }
    };
    fetchMenuItems();
  }, []);

  return (
    <div className="font-sans min-h-screen p-4 pb-20 gap-8 sm:p-8 md:p-16 lg:p-20">
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-center">eta2weather.nextjs15</h1>
      </header>
      <main className="space-y-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          <div className="col-span-1">
            <ConfigData />
          </div>
          <div className="col-span-1">
            <EtaData />
          </div>
          <div className="col-span-1 md:col-span-2 lg:col-span-1">
            <WifiAf83Data />
          </div>
        </div>
        <div className="flex justify-center">
          <MenuTabs menuItems={menuItems} />
        </div>
      </main>
      <footer className="mt-8 flex gap-6 flex-wrap items-center justify-center">
        <p className="text-sm text-muted-foreground">
          created by{" "}
          <a
            href="https://github.com/jeamy"
            className="font-medium underline underline-offset-4"
          >
            jeamy
          </a>
        </p>
      </footer>
    </div>
  );
}
