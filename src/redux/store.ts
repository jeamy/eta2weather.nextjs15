import { configureStore } from '@reduxjs/toolkit';
import configReducer from './configSlice';
import etaReducer from './etaSlice';

export const store = configureStore({
  reducer: {
    config: configReducer,
    eta: etaReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
