import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { LoadingState } from './interface';
import { EtaData } from '@/reader/functions/types-constants/EtaConstants';

export type EtaState = {
  data: EtaData,
  loadingState: LoadingState
}

const initialState: EtaState = { 
  data: { },
  loadingState: {
    error: null,
    isLoading: false    
  } 
};

const etaSlice = createSlice({
  name: 'eta',
  initialState,
  reducers: {
    storeData: (state, action: PayloadAction<EtaData>) => {
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

export const { storeData, storeError, setIsLoading } = etaSlice.actions;
export default etaSlice.reducer;

