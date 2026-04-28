import { makeStore, RootState as RootStateFromReducer } from './index';

export const store = makeStore();

export type RootState = RootStateFromReducer;
export type AppDispatch = typeof store.dispatch;
