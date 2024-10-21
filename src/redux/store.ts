import { configureStore } from '@reduxjs/toolkit';
import etaReducer from './etaSlice';
import configReducer from './configSlice';
export const store = configureStore({
  reducer: {
    config: configReducer,
    eta: etaReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
