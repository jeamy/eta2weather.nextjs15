import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { Names2Id } from '../reader/Names2Id';
import { LoadingState } from './interface';
import { updateLoadingState } from './loadingStateUtils';

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
      updateLoadingState(state, false);
    },
    storeError: (state, action: PayloadAction<string>) => {
      updateLoadingState(state, false, action.payload);
    },
    setIsLoading: (state, action: PayloadAction<boolean>) => {
      updateLoadingState(state, action.payload);
    }
  },
});

export const { storeData, storeError, setIsLoading } = names2IdSlice.actions;
export default names2IdSlice.reducer;
