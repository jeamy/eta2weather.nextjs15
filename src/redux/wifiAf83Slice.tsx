import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { LoadingState } from './interface';
import { WifiAF83Data } from '@/reader/functions/types-constants/WifiAf83';

export interface WifiAF83State {
    data: WifiAF83Data;
    loadingState: LoadingState;
}

const initialState: WifiAF83State = {
    data: {
        time: 0,
        datestring: '',
        temperature: 0,
        indoorTemperature: 0,
        allData: null,
        stale: true
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
        storeData(state, action: PayloadAction<WifiAF83State['data']>) {
            // Ensure numeric values with fallback to previous values or 0
            const temperature = Number(action.payload.temperature);
            const indoorTemperature = Number(action.payload.indoorTemperature);
            
            // Handle invalid values gracefully instead of throwing errors
            const validTemperature = isNaN(temperature) ? (state.data.temperature || 0) : temperature;
            const validIndoorTemperature = isNaN(indoorTemperature) ? (state.data.indoorTemperature || 0) : indoorTemperature;
            
            // Log warning if invalid values were received
            if (isNaN(temperature) || isNaN(indoorTemperature)) {
                console.warn('Invalid temperature values received, using fallback values:', {
                    receivedTemperature: action.payload.temperature,
                    receivedIndoorTemperature: action.payload.indoorTemperature,
                    fallbackTemperature: validTemperature,
                    fallbackIndoorTemperature: validIndoorTemperature
                });
            }
            
            state.data = {
                ...action.payload,
                temperature: validTemperature,
                indoorTemperature: validIndoorTemperature
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
        },
        setStale(state, action: PayloadAction<boolean>) {
            state.data.stale = action.payload;
        }
    }
});

export const { storeData, storeError, setLoading, setStale } = wifiAf83Slice.actions;
export default wifiAf83Slice.reducer;
