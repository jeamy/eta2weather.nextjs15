import { useDispatch } from 'react-redux';
import { store } from '../redux';
import { storeData } from '../redux/dataSlice';

export function storeDataFunction(value: number): void {
  store.dispatch(storeData(value));
}

export class DataReader {
    private readonly fdata: string;

    constructor(fdata: string) {
        this.fdata = fdata;
    }

    public async readDataFunction(fdata: string): Promise<number> {
        // ... //
        return  1;
    }
      
}

export function useDataReader(fdata: string) {
    const dispatch = useDispatch();
    
    const loadData = async () => {
        const dataReader = new DataReader(fdata);
        const data = await dataReader.readDataFunction(fdata);
        dispatch(storeData(data));
    };

    return { loadData };
}
