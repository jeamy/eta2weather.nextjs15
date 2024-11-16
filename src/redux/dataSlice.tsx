import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { LoadingState } from './interface';
import { updateLoadingState } from './loadingStateUtils';

export type Data = {
  [key: string]: string;
}

export type DataState = {
  data: Data;
  loadingState: LoadingState
}

const initialState: DataState = {
  data: {},
  loadingState: {
    error: null,
    isLoading: false
  }
};

const dataSlice = createSlice({
  name: 'data',
  initialState,
  reducers: {
    storeData: (state, action: PayloadAction<Data>) => {
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

export const { storeData, storeError, setIsLoading } = dataSlice.actions;
export default dataSlice.reducer;
