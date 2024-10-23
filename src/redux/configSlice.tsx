import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { Config, defaultConfig } from '../functions/Config';
import { LoadingState } from './interface';

export type ConfigState = {
    data: Config;
    loadingState: LoadingState;
}

const initialState: ConfigState = {
    data: defaultConfig,
    loadingState: {
        error: null,
        isLoading: false
    }
};

const configSlice = createSlice({
    name: 'config',
    initialState,
    reducers: {
        storeData: (state, action: PayloadAction<Config>) => {
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

export const { storeData, storeError, setIsLoading } = configSlice.actions;
export default configSlice.reducer;

