'use client'

import ConfigData from "@/components/ConfigData";
import EtaData from "@/components/EtaData";
import WifiAf83Data from "@/components/WifiAf83Data";

export default function Home() {

  return (
    <div className="font-sans grid grid-rows-[20px_1fr_20px] items-center justify-items-center min-h-screen p-8 pb-20 gap-16 sm:p-20">
      <main className="grid grid-cols-3 gap-8 row-start-2 w-full">
        <div className="col-span-1">
          <ConfigData />
        </div>
        <div className="col-span-1">
          <EtaData />
        </div>
        <div className="col-span-1">
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
