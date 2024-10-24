import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { Names2Id } from '../serverfunctions/Names2IdServer';
import { LoadingState } from './interface';

export type Names2IdState = {
  data: Names2Id;
  loadingState: LoadingState;
}

const initialState: Names2IdState = {
  data: {},
  loadingState: {
    error: null,
    isLoading: false
  }
};

const names2IdSlice = createSlice({
  name: 'names2Id',
  initialState,
  reducers: {
    storeData: (state, action: PayloadAction<Names2Id>) => {
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

export const { storeData, storeError, setIsLoading } = names2IdSlice.actions;
export default names2IdSlice.reducer;

