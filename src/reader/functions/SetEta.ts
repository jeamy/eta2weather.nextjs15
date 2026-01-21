import Diff from './Diff';
import { EtaApi } from './EtaApi';
import * as fs from 'fs';
import { Config, ConfigKeys } from './types-constants/ConfigConstants';
import { EtaConstants, Names2Id } from './types-constants/Names2IDconstants';
import { fetchEtaData } from './EtaData';
import { fetchWifiAf83Data } from './WifiAf83Data';
import { prepareAndFetchGetUserVar } from './EtaData';
import { AppDispatch } from '../../redux/index';
import { DEFAULT_UPDATE_TIMER } from './types-constants/TimerConstants';

type EtaValues = {
  einaus: string;
  schaltzustand: string;
  kommentaste: string;
  heizentaste: string;
  tes: number;
  tea: number;
  vorlauftemp?: number;
};

type TempDiff = {
  diff: number | null;
  twa: number;
  twi: number;
};

export class SetEta {
  private config: Config = {} as Config;
  private names2id: Names2Id = {} as Names2Id;
  private etaApi: EtaApi;
  private updateInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.etaApi = new EtaApi();
  }

  public async setEta(dispatch: AppDispatch): Promise<string> {
    try {
      const [etaData, wifiAf83Data] = await this.fetchData(dispatch);

      if (!wifiAf83Data) throw new Error("Fetching WifiAF83 failed.");

      const etaValues = this.getEtaValues(etaData);
      const tempDiff = this.calculateTemperatureDiff(wifiAf83Data);

      if (tempDiff.diff === null) return '0';

      const newSliderPosition = this.calculateNewSliderPosition(etaValues, tempDiff.diff);
      await this.updateData(etaData, wifiAf83Data, newSliderPosition, tempDiff.diff);

      this.logData(etaValues, tempDiff, newSliderPosition);

      if (this.shouldUpdateSlider(etaValues.tes, newSliderPosition)) {
        await this.updateSliderPosition(etaData, newSliderPosition);
      } else {
        console.log("Setting slider skipped!\n");
      }

      return '1';
    } catch (error) {
      return this.handleError(error);
    }
  }

  private async fetchData(dispatch: AppDispatch): Promise<[Record<string, any>, any]> {
    return Promise.all([
      fetchEtaData(this.config, this.names2id),
      fetchWifiAf83Data()
    ]);
  }

  private getEtaValues(etaData: Record<string, any>): EtaValues {
    const getValue = (name: string) => this.getEtaNameData(name, etaData);
    return {
      einaus: getValue(EtaConstants.EIN_AUS_TASTE),
      schaltzustand: getValue(EtaConstants.SCHALTZUSTAND),
      kommentaste: getValue(EtaConstants.KOMMENTASTE),
      heizentaste: getValue(EtaConstants.HEIZENTASTE),
      tes: Number(getValue(EtaConstants.SCHIEBERPOS)),
      tea: Number(getValue(EtaConstants.AUSSENTEMP)),
      vorlauftemp: Number(getValue(EtaConstants.VORLAUFTEMP)),
    };
  }

  private calculateTemperatureDiff(wifiAf83Data: any): TempDiff {
    if (!('data' in wifiAf83Data)) {
      console.log("Keine Temperaturdaten verfügbar.");
      return { diff: null, twa: 0, twi: 0 };
    }

    const { indoor, outdoor } = wifiAf83Data.data;
    const twi = indoor.temperature.value;
    const twa = outdoor.temperature.value;
    const { t_soll, t_delta } = this.config;
    const diff = Math.min(Number(t_soll) + Number(t_delta) - twi, 5.0);
    return { diff: Number(diff.toFixed(1)), twa, twi };
  }

  private calculateNewSliderPosition({ einaus, schaltzustand, kommentaste, heizentaste, vorlauftemp }: EtaValues, diff: number): string {
    const overridesActive = heizentaste === "Ein" || kommentaste === "Ein";
    const heatingDisabled = einaus === "Aus" || (schaltzustand === "Aus" && !overridesActive);

    if (heatingDisabled) {
      return "0.0";
    }

    const basePosition = new Diff().getDiff(diff, 1.25, 5.0, 0.0, 100.0);

    // Negative Sliderpositionen dürfen nicht durch vorlaufFactor verändert werden
    if (basePosition < 0) {
      return basePosition.toFixed(1);
    }

    const vorlaufFactor = (() => {
      if (vorlauftemp === undefined || vorlauftemp === null || isNaN(vorlauftemp)) {
        return 1;
      }
      if (vorlauftemp <= 38) {
        return 1;
      }
      if (vorlauftemp >= 50) {
        return 0;
      }
      return (50 - vorlauftemp) / (50 - 38);
    })();

    const scaledPosition = Math.max(0, Math.min(100, basePosition * vorlaufFactor));
    return scaledPosition.toFixed(1);
  }

  private async updateData(etaData: Record<string, any>, wifiAf83Data: any, newPosition: string, diff: number): Promise<void> {
    etaData[EtaConstants.SCHIEBERPOS] = { strValue: newPosition };
    wifiAf83Data['diff'] = Number(Math.round(diff).toFixed(1));

    await Promise.all([
      this.writeData(this.config[ConfigKeys.F_ETA], JSON.stringify(etaData)),
      this.writeData(this.config[ConfigKeys.F_WIFIAF83], JSON.stringify(wifiAf83Data))
    ]);
  }

  private async updateSliderPosition(etaData: Record<string, any>, newPosition: string): Promise<void> {
    const scaledPosition = String(Number(newPosition) * 10);
    const id = this.names2id[EtaConstants.SCHIEBERPOS]['id'];

    await this.etaApi.setUserVar(id, scaledPosition, "0", "0");
    await prepareAndFetchGetUserVar(EtaConstants.SCHIEBERPOS, etaData, this.names2id, this.etaApi);

    const updatedPosition = Number(this.getEtaNameData(EtaConstants.SCHIEBERPOS, etaData));
    const status = Number(newPosition) === updatedPosition ? 'OK' : 'ERROR';
    console.log(`Setting slider ${status}! Position: ${updatedPosition}\nSetting slider done!\n`);
  }

  private shouldUpdateSlider(oldPosition: number, newPosition: string): boolean {
    return Number(newPosition) !== oldPosition;
  }

  private getEtaNameData(name: string, etaData: Record<string, any>): string {
    const key = this.names2id[name]?.["id"];
    return etaData?.[key]?.["strValue"] ?? "Keine Daten!";
  }

  private async writeData(path: string, data: string): Promise<void> {
    await fs.promises.writeFile(path, data);
  }

  private handleError(error: unknown): string {
    console.error('Ein Fehler ist aufgetreten:', error instanceof Error ? error.message : String(error));
    return '0';
  }

  private logData(etaValues: EtaValues, tempDiff: TempDiff, newPosition: string): void {
    const { tea, tes } = etaValues;
    const { twa, twi } = tempDiff;
    const { t_soll, t_delta } = this.config;

    console.log(`
      Außentemperatur ETA: ${tea}
      Außentemperatur: ${twa}
      Innentemperatur: ${twi}
      Solltemperatur: ${t_soll}
      Deltatemperatur: ${t_delta}
      Schieber Position: ${tes}
      Schieber Position neu: ${newPosition}
    `);
  }

  private startPolling(dispatch: AppDispatch): void {
    // Initial fetch
    this.fetchData(dispatch);

    // Set up interval for periodic updates with default fallback
    const updateTimer = parseInt(this.config.t_update_timer) || DEFAULT_UPDATE_TIMER;
    if (updateTimer > 0) {
      // Store interval reference for cleanup
      this.updateInterval = setInterval(() => this.fetchData(dispatch), updateTimer);
    }
  }

  // Add cleanup method
  public cleanup(): void {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
  }
}
