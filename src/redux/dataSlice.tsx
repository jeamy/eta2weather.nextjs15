import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { LoadingState } from './interface';

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
      state.loadingState.isLoading = false;
    },
    storeError: (state, action: PayloadAction<string>) => {
      state.loadingState.error = action.payload;
      state.loadingState.isLoading = false;
    },
    setIsLoading: (state, action: PayloadAction<boolean>) => {
      state.loadingState.isLoading = action.payload;
    },
  },
});

export const { storeData, storeError, setIsLoading } = dataSlice.actions;
export default dataSlice.reducer;

