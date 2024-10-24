import ConfigData from "../components/ConfigData";
import Data from "../components/Data";
import EtaData from "../components/EtaData";
import StoreProvider from "../components/StoreProvider";
import WifiAf83Data from "../components/WifiAf83Data";

export default function Home() {
  return (
    <StoreProvider>
      <div className="font-sans grid grid-rows-[20px_1fr_20px] items-center justify-items-center min-h-screen p-8 pb-20 gap-16 sm:p-20">
        <main className="flex flex-col gap-8 row-start-2 items-center sm:items-start">
          <Data />
          <ConfigData />
          <WifiAf83Data />
          <EtaData />
        </main>
        <footer className="row-start-3 flex gap-6 flex-wrap items-center justify-center">
          LINKS
        </footer>
      </div>
    </StoreProvider>
  );
}
