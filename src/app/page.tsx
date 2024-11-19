'use client'

import ConfigData from "@/components/ConfigData";
import EtaData from "@/components/EtaData";
import WifiAf83Data from "@/components/WifiAf83Data";

export default function Home() {

  return (
    <div className="font-sans grid grid-rows-[auto_1fr_auto] items-center justify-items-center min-h-screen p-4 pb-20 gap-8 sm:p-8 md:p-16 lg:p-20">
      <main className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 lg:gap-8 row-start-2 w-full">
        <div className="col-span-1">
          <ConfigData />
        </div>
        <div className="col-span-1">
          <EtaData />
        </div>
        <div className="col-span-1 md:col-span-2 lg:col-span-1">
          <WifiAf83Data />
        </div>
      </main>
      <footer className="row-start-3 flex gap-6 flex-wrap items-center justify-center">
        <p className="text-sm text-muted-foreground">
          created by{" "}
          <a
            href="https://github.com/jeamy"
          >jeamy</a>
        </p>
      </footer>
    </div>
  );
}
