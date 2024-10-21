import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { Config, defaultConfig } from '../functions/Config';

const configSlice = createSlice({
    name: 'config',
    initialState: defaultConfig,
    reducers: {
        setConfig: (state, action: PayloadAction<Config>) => {
            return action.payload;
        },
    },
});

export const { setConfig } = configSlice.actions;
export default configSlice.reducer;

