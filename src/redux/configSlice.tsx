import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { Config, defaultConfig } from '../reader/functions/types-constants/ConfigConstants';
import { LoadingState } from './interface';
import { updateLoadingState } from './loadingStateUtils';

export type ConfigState = {
    data: Config;
    loadingState: LoadingState;
    isInitialized: boolean;
}

const initialState: ConfigState = {
    data: {} as Config,  // Start with empty config
    loadingState: {
        error: null,
        isLoading: true  // Start in loading state
    },
    isInitialized: false
};

const configSlice = createSlice({
    name: 'config',
    initialState,
    reducers: {
        storeData: (state, action: PayloadAction<Config>) => {
            state.data = action.payload;
            state.isInitialized = true;
            updateLoadingState(state, false);
        },
        storeError: (state, action: PayloadAction<string>) => {
            if (!state.isInitialized) {
                state.data = defaultConfig;  // Only use default if not initialized
                state.isInitialized = true;
            }
            updateLoadingState(state, false, action.payload);
        },
        setIsLoading: (state, action: PayloadAction<boolean>) => {
            updateLoadingState(state, action.payload);
        },
    },
});

export const { storeData, storeError, setIsLoading } = configSlice.actions;
export default configSlice.reducer;
