import { configureStore } from '@reduxjs/toolkit';
import authReducer from './slices/authSlice';
import locationReducer from './slices/locationSlice';
import notificationReducer from './slices/notificationSlice';
import uiReducer from './slices/uiSlice';

export function makeStore() {
  return configureStore({
    reducer: {
      auth: authReducer,
      location: locationReducer,
      notification: notificationReducer,
      ui: uiReducer,
    },
  });
}

export const store = makeStore();
