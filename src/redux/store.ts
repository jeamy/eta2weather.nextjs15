import { makeStore, RootState as RootStateFromReducer } from './index';

const GLOBAL_STORE_KEY = '__ETA2WEATHER_SERVER_STORE__';

const globalWithStore = globalThis as typeof globalThis & {
  [GLOBAL_STORE_KEY]?: ReturnType<typeof makeStore>;
};

export const store = globalWithStore[GLOBAL_STORE_KEY] ?? makeStore();
globalWithStore[GLOBAL_STORE_KEY] = store;

export type RootState = RootStateFromReducer;
export type AppDispatch = typeof store.dispatch;
