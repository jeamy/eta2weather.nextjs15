import { useDispatch } from 'react-redux';
import { store } from '../redux';
import { Data, setIsLoading, storeData, storeError } from '../redux/dataSlice';

export function storeDataFunction(data: Data): void {
  store.dispatch(storeData(data));
}

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

// Funktion, um Daten abzurufen und im Store zu speichern
export const useDataReadAndStore = (fdata: string) => {
    const dispatch = useDispatch();
    
    const loadAndStoreData = async () => {
      dispatch(setIsLoading(true));
      try {
        const data = await new DataReader(fdata).readData();
        dispatch(storeData(data));
      } catch (error: Error | any) {
        dispatch(storeError(error.message));
      }

    };

    return loadAndStoreData;
  };