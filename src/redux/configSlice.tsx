import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { Config, defaultConfig } from '../reader/functions/types-constants/ConfigConstants';
import { LoadingState } from './interface';
import { updateLoadingState } from './loadingStateUtils';

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
            updateLoadingState(state, false);
        },
        storeError: (state, action: PayloadAction<string>) => {
            updateLoadingState(state, false, action.payload);
        },
        setIsLoading: (state, action: PayloadAction<boolean>) => {
            updateLoadingState(state, action.payload);
        },
    },
});

export const { storeData, storeError, setIsLoading } = configSlice.actions;
export default configSlice.reducer;
