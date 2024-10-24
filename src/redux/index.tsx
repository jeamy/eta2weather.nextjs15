import { configureStore } from '@reduxjs/toolkit';
import dataReducer from './dataSlice';
import etaReducer from './etaSlice';
import configReducer from './configSlice';
import names2IdReducer from './names2IdSlice';
import wifiAf83Reducer from './wifiAf83Slice';

export const makeStore = () => {
  return configureStore({
    reducer: {
      data: dataReducer,
      config: configReducer,
      eta: etaReducer,
      names2Id: names2IdReducer,
      wifiAf83: wifiAf83Reducer
    },
  })
}

// Infer the type of makeStore
export type AppStore = ReturnType<typeof makeStore>
// Infer the `RootState` and `AppDispatch` types from the store itself
export type RootState = ReturnType<AppStore['getState']>
export type AppDispatch = AppStore['dispatch']

