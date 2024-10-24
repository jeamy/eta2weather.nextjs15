import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { WifiAF83Data } from '../serverfunctions/FetchWifiAf83Server';
import { LoadingState } from './interface';

export type WifiAF83State = {
    data: WifiAF83Data,
    loadingState: LoadingState
}

const initialState: WifiAF83State = {
    data: {} as WifiAF83Data,
    loadingState: {
        error: null,
        isLoading: false
    }
};

const wifiAf83Slice = createSlice({
    name: 'wifiAf83',
    initialState,
    reducers: {
        storeData: (state, action: PayloadAction<WifiAF83Data>) => {
            state.data = action.payload;
            state.loadingState.isLoading = false;
        },
        storeError: (state, action: PayloadAction<string>) => {
            state.loadingState.error = action.payload;
            state.loadingState.isLoading = false;
        },
        setIsLoading: (state, action: PayloadAction<boolean>) => {
            state.loadingState.isLoading = action.payload;
        }
    },
});

export const { storeData, storeError, setIsLoading } = wifiAf83Slice.actions;
export default wifiAf83Slice.reducer;

