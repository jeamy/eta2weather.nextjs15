import { configureStore } from '@reduxjs/toolkit';
import configReducer from './configSlice';
import etaReducer from './etaSlice';
import wifiAf83Reducer from './wifiAf83Slice';
import names2IdReducer from './names2IdSlice';

export const store = configureStore({
  reducer: {
    config: configReducer,
    eta: etaReducer,
    wifiAf83: wifiAf83Reducer,
    names2Id: names2IdReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
