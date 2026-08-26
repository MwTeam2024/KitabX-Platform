import { createSlice } from '@reduxjs/toolkit';
import { SOCIETIES } from '@/lib/mockData';

const initialState = {
  society: SOCIETIES[0],
  societies: SOCIETIES,
  radiusKm: 0.5,
  permission: 'prompt', // 'prompt' | 'granted' | 'denied'
  coords: null,
};

const locationSlice = createSlice({
  name: 'location',
  initialState,
  reducers: {
    setSociety(state, action) {
      state.society = action.payload;
    },
    addSociety(state, action) {
      state.societies.push(action.payload);
    },
    updateSociety(state, action) {
      const { oldName, newName } = action.payload;
      const idx = state.societies.indexOf(oldName);
      if (idx > -1) state.societies[idx] = newName;
      if (state.society === oldName) state.society = newName;
    },
    setRadiusKm(state, action) {
      state.radiusKm = Math.max(0.5, Math.min(5, action.payload));
    },
    adjustRadius(state, action) {
      state.radiusKm = Math.max(0.5, Math.min(5, state.radiusKm + action.payload * 0.5));
    },
    setPermission(state, action) {
      state.permission = action.payload;
    },
    setCoords(state, action) {
      state.coords = action.payload;
    },
  },
});

export const { setSociety, addSociety, updateSociety, setRadiusKm, adjustRadius, setPermission, setCoords } = locationSlice.actions;
export default locationSlice.reducer;
