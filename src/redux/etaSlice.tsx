import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { LoadingState } from './interface';
import { EtaData } from '@/reader/functions/types-constants/EtaConstants';
import { updateLoadingState } from './loadingStateUtils';

export type EtaState = {
  data: EtaData,
  loadingState: LoadingState,
  isStale: boolean
}

const initialState: EtaState = { 
  data: { },
  isStale: true,
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
      updateLoadingState(state, false);
    },
    storeError: (state, action: PayloadAction<string>) => {
      updateLoadingState(state, false, action.payload);
    },
    setIsLoading: (state, action: PayloadAction<boolean>) => {
      updateLoadingState(state, action.payload);
    },
    setStale: (state, action: PayloadAction<boolean>) => {
      state.isStale = action.payload;
    }
  },
});

export const { storeData, storeError, setIsLoading, setStale } = etaSlice.actions;
export default etaSlice.reducer;
