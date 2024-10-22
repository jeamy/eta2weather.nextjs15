import { configureStore } from '@reduxjs/toolkit';
import etaReducer from './etaSlice';
import configReducer from './configSlice';
import names2IdReducer from './names2IdSlice';
export const store = configureStore({
  reducer: {
    config: configReducer,
    eta: etaReducer,
    names2Id: names2IdReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
