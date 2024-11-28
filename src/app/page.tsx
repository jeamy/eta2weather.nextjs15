'use client'

import ConfigData from "@/components/ConfigData";
import EtaData from "@/components/EtaData";
import WifiAf83Data from "@/components/WifiAf83Data";
import EtaTab from '@/components/EtaTab';
import WifiTab from '@/components/WifiTab';
import { useEffect, useState } from "react";
import { MenuNode } from "@/types/menu";

export default function Home() {
  const [menuItems, setMenuItems] = useState<MenuNode[]>([]);
  const [wifiData, setWifiData] = useState<any>(null);

  useEffect(() => {
    const fetchMenuItems = async () => {
      try {
        const response = await fetch('/api/eta/menu');
        const result = await response.json();
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

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch('/api/wifiaf83/all');
        const {success, data} = await response.json();
        console.log('API response:', success,  data);
        setWifiData(data);
      } catch (error) {
        console.error('Error fetching weather data:', error);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 30000); // Update every 30 seconds
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="font-sans min-h-screen p-4 pb-20 gap-8 sm:p-8 md:p-16 lg:p-20">
      <main className="space-y-8">
        {/* First row: Config, Eta, and Wifi data */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="bg-white rounded-lg shadow-sm p-4">
            <ConfigData />
          </div>
          <div className="bg-white rounded-lg shadow-sm p-4">
            <EtaData />
          </div>
          <div className="bg-white rounded-lg shadow-sm p-4">
            <WifiAf83Data />
          </div>
        </div>

        {/* Second row: EtaTab and WifiTab */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="bg-white rounded-lg shadow-sm p-4">
            <EtaTab menuItems={menuItems} />
          </div>
          <div className="bg-white rounded-lg shadow-sm p-4">
            <WifiTab data={wifiData} />
          </div>
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
