import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { LoadingState } from './interface';
import { WifiAF83Data } from '@/reader/functions/types-constants/WifiAf83';

export type WifiAF83State = {
    data: WifiAF83Data;
    loadingState: LoadingState;
}

const initialState: WifiAF83State = {
    data: {
        time: 0,
        datestring: '',
        temperature: 0,
        indoorTemperature: 0
    },
    loadingState: {
        error: null,
        isLoading: false
    }
};

export const wifiAf83Slice = createSlice({
    name: 'wifiAf83',
    initialState,
    reducers: {
        storeData(state, action: PayloadAction<WifiAF83Data>) {
//            console.log('Storing WifiAf83 data:', action.payload);
            
            // Ensure numeric values
            const temperature = Number(action.payload.temperature);
            const indoorTemperature = Number(action.payload.indoorTemperature);
            
            if (isNaN(temperature) || isNaN(indoorTemperature)) {
                throw new Error('Invalid temperature values');
            }
            
            state.data = {
                ...action.payload,
                temperature,
                indoorTemperature
            };
            state.loadingState.isLoading = false;
            state.loadingState.error = null;
        },
        storeError(state, action: PayloadAction<string>) {
            state.loadingState.isLoading = false;
            state.loadingState.error = action.payload;
        },
        setLoading(state, action: PayloadAction<boolean>) {
            state.loadingState.isLoading = action.payload;
            if (action.payload) {
                state.loadingState.error = null;
            }
        }
    }
});

export const { storeData, storeError, setLoading } = wifiAf83Slice.actions;
export default wifiAf83Slice.reducer;
