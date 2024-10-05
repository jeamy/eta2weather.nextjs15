import EcoCon from "../../eco";

const ecoCon = new EcoCon();

class Wifiaf83Api {
  private mac: string | null = null;
  private apiKey: string | null = null;
  private applicationKey: string | null = null;
  private server: string | null = null;

  constructor() {
    this.mac = ecoCon.getMac();
    this.apiKey = ecoCon.getApiKey();
    this.applicationKey = ecoCon.getApplicationKey();
    this.server = ecoCon.getServer();
  }

  async fGetEcowitApi(url: string): Promise<any> {
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error('Network response was not ok');
      }
      return await response.json();
    } catch (error) {
      console.error('Error:', (error as Error).message);
      return {
        result: false,
        error: (error as Error).message
      };
    }
  }

  /**
   * Gets the current state of the Ecowitt device.
   * @returns A promise that resolves to the current state of the Ecowitt device.
   * The state object contains the following properties:
   * - indoor.temperature
   * - outdoor.temperature
   * - pressure
   * - wind_speed
   * - rainfall
   * - solar_irradiance
   */
  public async fGetRealtime(): Promise<any> {
    const url = `https://${this.server}/api/v3/device/real_time?
    api_key=${this.apiKey}&
    application_key=${this.applicationKey}&
    mac=${this.mac}&
    call_back=indoor.temperature,outdoor.temperature&
    temp_unitid=1&
    pressure_unitid=3&
    wind_speed_unitid=7&
    rrainfall_unitid=12&
    solar_irradiance_unitid=16`;
    const response = await this.fGetEcowitApi(url);
    return response;
  }
}

export default Wifiaf83Api;