import { Data } from "../redux/dataSlice";

export class DataReader {
    private readonly fdata: string;
    constructor(fdata: string) {
        this.fdata = fdata;
    }
    public async readData(): Promise<Data> {
        // ... //
        const dataf = this.fdata;
        return  {"key": "value"};
    }
      
}