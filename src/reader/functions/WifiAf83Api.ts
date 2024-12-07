import EcoCon from "../../../eco";

export class WifiAf83Api {
  private readonly ecoCon: EcoCon;
  private readonly baseUrl: string;
  private readonly params: URLSearchParams;
  private readonly all: URLSearchParams;

  constructor() {
    this.ecoCon = EcoCon.getInstance();
    const config = this.ecoCon.getConfig();
    
    this.baseUrl = `https://${config.server}/api/v3/device/real_time`;
    this.params = new URLSearchParams({
      mac: config.mac,
      api_key: config.apiKey,
      application_key: config.applicationKey,
      method: 'device/real_time',
      call_back: 'indoor.temperature,outdoor.temperature',
      temp_unitid: '1',
      pressure_unitid: '3',
      wind_speed_unitid: '7',
      rainfall_unitid: '12',
      solar_irradiance_unitid: '16'
    });

    this.all = new URLSearchParams({
      mac: config.mac,
      api_key: config.apiKey,
      application_key: config.applicationKey,
      method: 'device/real_time',
      call_back: 'all',
      temp_unitid: '1',
      pressure_unitid: '3',
      wind_speed_unitid: '7',
      rainfall_unitid: '12',
      solar_irradiance_unitid: '16'
    });
  }

  public async getAllRealtime(): Promise<any> {
    try {
      const response = await fetch(`${this.baseUrl}?${this.all}`);
      if (!response.ok) {
        throw new Error(`HTTP-Fehler! Status: ${response.status}`);
      }
      const data = await response.json();
      // console.log("WifiAf83 data: ", data);
      return data;
    } catch (error) {
      console.error('Fehler beim Abrufen der All-Daten:', error);
      throw error;
    }
  }

  public async getRealtime(): Promise<any> {
    try {
      const response = await fetch(`${this.baseUrl}?${this.params}`);
      if (!response.ok) {
        throw new Error(`HTTP-Fehler! Status: ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      console.error('Fehler beim Abrufen der Echtzeit-Daten:', error);
      throw error;
    }
  }
}

