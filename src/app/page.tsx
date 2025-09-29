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
import HomeHero from "@/components/HomeHero";

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
    <div className="home">
      <div className="container">
        <main className="home__main">
          <HomeHero />
          {/* First row: Config, Eta, and Wifi data */}
          <div className="home__row home__row--three">
            <ConfigData />
            <EtaData />
            <WifiAf83Data />
          </div>

          {/* Second row: EtaTab, wifiTab stack with Zeitfenster */}
          <div className="home__row home__row--two">
            <div className="card">
              <EtaTab menuItems={menuItems} />
            </div>
            <div className="home__colStack">
              <div className="card">
                <WifiTab data={wifiData} />
              </div>
              <div className="card">
                <ZeitfensterTab menuItems={menuItems} />
              </div>
            </div>
          </div>
       
        </main>

        <footer className="home__footer">
          <a href="/weather" className="btn btn--ghost">Weather</a>
          <p className="text-sm">
            created by <a href="https://github.com/jeamy" className="header__brand">jeamy</a>
          </p>
        </footer>
      </div>
    </div>
  );
}
