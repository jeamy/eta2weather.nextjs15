'use client'

import ConfigData from "@/components/ConfigData";
import EtaData from "@/components/EtaData";
import WifiAf83Data from "@/components/WifiAf83Data";
import EtaTab from '@/components/EtaTab';
import WifiTab from '@/components/WifiTab';
import ZeitfensterTab from '@/components/ZeitfensterTab';
import HomeHero from "@/components/HomeHero";
import { useAppSelector } from '@/redux/hooks';
import { useEtaMenu } from '@/components/EtaDataProvider';

export default function Home() {
  const menuItems = useEtaMenu();
  const wifiData = useAppSelector(state => state.wifiAf83.data.allData);
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
                <WifiTab data={wifiData ?? undefined} />
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
