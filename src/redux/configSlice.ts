import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { Config, defaultConfig } from '../functions/Config';

const initialState: Config = defaultConfig;

const configSlice = createSlice({
    name: 'config',
    initialState,
    reducers: {
        setConfig: (state, action: PayloadAction<Config>) => {
            state = action.payload;
            return action.payload;
        },
    },
});

export const { setConfig } = configSlice.actions;
export default configSlice.reducer;

