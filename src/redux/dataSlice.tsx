import { createSlice, PayloadAction } from '@reduxjs/toolkit';

export type DataState = {
  value: number;
}

const initialState: DataState = {
  value: 0,
};

const dataSlice = createSlice({
  name: 'data',
  initialState,
  reducers: {
    storeData: (state, action: PayloadAction<number>) => {
      state.value = action.payload;
    },
  },
});

export const { storeData } = dataSlice.actions;
export default dataSlice.reducer;
