import { EIN_AUS_TASTE, SCHALTZUSTAND, HEIZENTASTE, KOMMENTASTE, HEIZKURVE, SCHIEBERPOS, AUSSENTEMP, VORLAUFTEMP } from './Names2Id';
import { T_SOLL, T_DELTA, F_ETA, F_WIFIAF83 } from './Config';
import FetchWifiAf83 from './FetchWifiAf83';
import FetchEta from './FetchEta';
import ConfigReader from './Config';
import Diff from './Diff';
import Names2IdReader from './Names2Id';
import EtaApi from './EtaApi';

class SetEta {
    private config: { [key: string]: any } = {};

    constructor() { }
  
    public async setEta(): Promise<string> {
      const config: { [key: string]: any } = await new ConfigReader(F_ETA).readConfig();
      console.log("config:" + config);
      const names2id: { [key: string]: { [key: string]: string } } = await new Names2IdReader(config).readNames2Id();
      console.log("names2id:" + names2id);
      const fetchEta = new FetchEta(config, names2id);
      const etaData: { [key: string]: any } = fetchEta.fetchEtaData();
      console.log("fetchEta:" + etaData);
      const wifiAf83Data: { [key: string]: any } = new FetchWifiAf83(config);
      console.log("fetchWifiAf83:" + wifiAf83Data);
      
      console.log("\nsetting slider  ... \n");
  
      const einaus: string = this.getEtaNameData(EIN_AUS_TASTE, names2id, etaData);
      const schalt: string = this.getEtaNameData(SCHALTZUSTAND, names2id, etaData);
      const heizentaste: string = this.getEtaNameData(HEIZENTASTE, names2id, etaData);
      const kommenttaste: string = this.getEtaNameData(KOMMENTASTE, names2id, etaData);
  
      const tes: number = Number(this.getEtaNameData(SCHIEBERPOS, names2id, etaData));
      const tea: number = Number(this.getEtaNameData(AUSSENTEMP, names2id, etaData));
  
      if (wifiAf83Data == null) {
        console.log("Fetching WifiAF83 failed.\n");
        return '0';
      }
  
      const twi: number = wifiAf83Data['data']['indoor']['temperature']['value'];
      const twa: number = wifiAf83Data['data']['outdoor']['temperature']['value'];
  
      const tsoll: number = this.config[T_SOLL];
      const tdelta: number = this.config[T_DELTA];
  
      console.log("Heizkurve: " + this.getEtaNameData(HEIZKURVE, names2id, etaData) + "\n");
      console.log("Vorlauftemperatur: " + this.getEtaNameData(VORLAUFTEMP, names2id, etaData) + "\n");
      console.log("Außentemperatur ETA: " + tea + "\n");
      console.log("Außentemperatur: " + twa + "\n");
      console.log("Innentemperatur: " + twi + "\n");
      console.log("Solltemperatur: " + tsoll + "\n");
      console.log("Deltatemperatur: " + tdelta + "\n");
  
      let diff: number = Number(Math.round(tsoll + tdelta - twi).toFixed(1));
      if (diff > 5.0) {
        diff = 5.0;
      }
  
      const diffApi = new Diff();
      const schieber: number = diffApi.getDiff(diff, 1.25, 5.0, 0.0, 100.0);
  
      console.log("Differenz: " + diff + "\n");
      wifiAf83Data['diff'] = Number(Math.round(diff).toFixed(1));
      this.writeData(this.config[F_WIFIAF83], JSON.stringify(wifiAf83Data));
  
      etaData['schieber'] = schieber;
  
      console.log("Ein/Aus: " + einaus + "\nSchaltzustand: " + schalt + "\nHeizentaste: " + heizentaste + "\nKommentaste: " + kommenttaste + "\n");
      if (einaus == "Aus" || (schalt == "Aus" && kommenttaste == "Aus")) {
        console.log("ETA off ... setting slider to 0%!\n");
        etaData['schieber'] = 0.0;
      }
  
      this.writeData(this.config[F_ETA], JSON.stringify(etaData));
  
      console.log("Schieber Position: " + tes + "\n");
      console.log("Schieber Position neu: " + etaData['schieber'] + "\n");
  
      if (etaData['schieber'] != tes) {
        const etaApi = new EtaApi();
        etaApi.fSetUserVar(names2id[SCHIEBERPOS]['id'], String(etaData['schieber'] * 10), "0", "0");
        fetchEta.prepareAndFetchGetUserVar(SCHIEBERPOS, etaData);
  
        const newtes: number = Number(this.getEtaNameData(SCHIEBERPOS, names2id, etaData));
        if (etaData['schieber'] == newtes) {
          console.log("Setting slider OK! Position: " + newtes + "\n");
        } else {
          console.log("Setting slider ERROR! Position: " + newtes + "\n");
        }
        console.log("Setting slider done!" + "\n");
      } else {
        console.log("Setting slider skipped!" + "\n");
      }
  
      return '1';
    }
  
  
    private getEtaNameData(name: string, names2id: { [key: string]: { [key: string]: string } }, etaData: { [key: string]: any }): string {
        const key = names2id[name]["id"];
        if (etaData && etaData[key] && etaData[key]["strValue"]) {
          return etaData[key]["strValue"];
        } else {
          return "Keine Daten!";
        }
      }
  
    private writeData(path: string, data: any): void {
        const fs = require('fs');
        fs.writeFileSync(path, data);
    }
 
  }