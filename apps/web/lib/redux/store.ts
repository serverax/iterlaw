'use client';

import { configureStore } from '@reduxjs/toolkit';
import caseReducer from './slices/caseSlice';

export const store = configureStore({
  reducer: {
    case: caseReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
