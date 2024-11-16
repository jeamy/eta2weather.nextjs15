import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { LoadingState } from './interface';
import { updateLoadingState } from './loadingStateUtils';
import { WifiAF83Data } from '@/reader/functions/types-constants/WifiAf83';

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
            updateLoadingState(state, false);
        },
        storeError: (state, action: PayloadAction<string>) => {
            updateLoadingState(state, false, action.payload);
        },
        setIsLoading: (state, action: PayloadAction<boolean>) => {
            updateLoadingState(state, action.payload);
        }
    },
});

export const { storeData, storeError, setIsLoading } = wifiAf83Slice.actions;
export default wifiAf83Slice.reducer;
