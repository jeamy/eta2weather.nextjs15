'use client'

import ConfigData from "@/components/ConfigData";
import EtaData from "@/components/EtaData";
import WifiAf83Data from "@/components/WifiAf83Data";
import EtaTab from '@/components/EtaTab';
import WifiTab from '@/components/WifiTab';
import { HeizkreisTab } from '@/components/HeizkreisTab';
import ZeitfensterTab from '@/components/ZeitfensterTab';
import { useEffect, useState, useRef } from "react";
import { API } from '@/constants/apiPaths';
import { MenuNode } from "@/types/menu";

async function isServerReady(url: string, retries = 5, delay = 1000): Promise<boolean> {
  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        return true;
      }
    } catch (error) {
      console.warn(`Server not ready, retrying... (${i + 1}/${retries})`);
    }
    await new Promise(resolve => setTimeout(resolve, delay));
  }
  return false;
}

export default function Home() {
  const [menuItems, setMenuItems] = useState<MenuNode[]>([]);
  const [wifiData, setWifiData] = useState<any>(null);
  const prevWifiJsonRef = useRef<string | null>(null);

  useEffect(() => {
    const fetchMenuItems = async () => {
      try {
        const response = await fetch(API.ETA_MENU);
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
        const response = await fetch(API.WIFI_AF83_ALL);
        const {success, data} = await response.json();
        if (!success) return;

        // Only update state if data actually changed (reduce re-renders)
        try {
          const json = JSON.stringify(data);
          if (prevWifiJsonRef.current === json) {
            return;
          }
          prevWifiJsonRef.current = json;
        } catch {
          // Fallback: if stringify fails, proceed to set state
        }

        setWifiData(data);
      } catch (error) {
        console.error('Error fetching weather data:', error);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 60000); // Update every 60 seconds
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="font-sans min-h-screen p-4 pb-20 gap-8 sm:p-8 md:p-16 lg:p-20">
      <main className="space-y-8">
        {/* First row: Config, Eta, and Wifi data */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
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

        {/* Second row: EtaTab, WifiTab, and Menu Data */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="bg-white rounded-lg shadow-sm p-4">
            <EtaTab menuItems={menuItems} />
          </div>
          <div className="flex flex-col gap-4">
            <div className="bg-white rounded-lg shadow-sm p-4">
              <WifiTab data={wifiData} />
            </div>
            <div className="bg-white rounded-lg shadow-sm p-4">
              <ZeitfensterTab menuItems={menuItems} />
            </div>
            {/*
            <div className="bg-white rounded-lg shadow-sm p-4 flex-grow">
              <h2 className="text-lg font-semibold mb-4">ETA Menu Data</h2>
              <pre className="text-sm overflow-auto max-h-[600px]">
                {JSON.stringify(menuItems, null, 2)}
              </pre>
            </div>
            */}
          </div>
        </div>

        {/* Third row: Heizkreis Data */}
        <div className="grid grid-cols-1 lg:grid-cols-1 gap-8">
          <HeizkreisTab data={menuItems} />
        </div>
      </main>

      <footer className="mt-8 flex gap-6 flex-wrap items-center justify-center">
        <a
          href="/weather"
          className="text-sm text-muted-foreground hover:text-blue-600 transition-colors"
        >
          Weather
        </a>
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
