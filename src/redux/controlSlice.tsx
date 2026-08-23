import { createSlice, PayloadAction } from '@reduxjs/toolkit';

export interface ControlState {
  manualOverride: boolean;
  manualOverrideTime: number | null;
}

const initialState: ControlState = {
  manualOverride: false,
  manualOverrideTime: null,
};

const controlSlice = createSlice({
  name: 'control',
  initialState,
  reducers: {
    storeData: (_state, action: PayloadAction<ControlState>) => action.payload,
  },
});

export const { storeData } = controlSlice.actions;
export default controlSlice.reducer;
