import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { Names2IdType } from '../functions/Names2Id';

const initialState: Names2IdType = { data: {
  id: '',
  name: ''
} };

const names2IdSlice = createSlice({
  name: 'names2Id',
  initialState,
  reducers: {
    setNames2IdData: (state, action: PayloadAction<Names2IdType>) => {
      state = action.payload;
      return action.payload;
    },
  },
});

export const { setNames2IdData } = names2IdSlice.actions;
export default names2IdSlice.reducer;

