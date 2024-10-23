import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { EtaData } from '../functions/FetchEta';

const initialState: EtaData = { data: { } };

const etaSlice = createSlice({
  name: 'eta',
  initialState,
  reducers: {
    setEtaData: (state, action: PayloadAction<EtaData>) => {
      state
      return action.payload;
    },
  },
});

export const { setEtaData } = etaSlice.actions;
export default etaSlice.reducer;

