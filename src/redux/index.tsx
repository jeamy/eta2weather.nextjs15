import { configureStore, Store, combineReducers } from '@reduxjs/toolkit';
import etaReducer from './etaSlice';
import configReducer from './configSlice';
import names2IdReducer from './names2IdSlice';
import wifiAf83Reducer from './wifiAf83Slice';

const rootReducer = combineReducers({
  config: configReducer,
  eta: etaReducer,
  names2Id: names2IdReducer,
  wifiAf83: wifiAf83Reducer
});

export type RootState = ReturnType<typeof rootReducer>;

export const makeStore = (preloadedState?: Partial<RootState>) => {
  return configureStore({
    reducer: rootReducer,
    preloadedState,
  })
}

export type AppStore = ReturnType<typeof makeStore>;
export type AppDispatch = AppStore['dispatch'];
