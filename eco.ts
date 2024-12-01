class EcoCon {
    private static instance: EcoCon;
  
    private readonly config = {
      applicationKey: "A9590EC6E7799AF300C32C73C3107AF0",
      apiKey: "2fb5518a-4245-4937-84ae-f1a26be65572",
      mac: "F0:08:D1:07:AF:83",
      server: "api.ecowitt.net"
    };
  
    private constructor() {}
  
    public static getInstance(): EcoCon {
      if (!EcoCon.instance) {
        EcoCon.instance = new EcoCon();
      }
      return EcoCon.instance;
    }
  
    public setServer(server: string): void {
      this.config.server = server;
    }
  
    public getConfig(): Readonly<typeof this.config> {
      return this.config;
    }
  }
  export default EcoCon;