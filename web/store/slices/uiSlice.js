import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  isNotifOpen: false,
  isCreditOpen: false,
  isAdminSidebarOpen: false,
};

const uiSlice = createSlice({
  name: 'ui',
  initialState,
  reducers: {
    toggleNotifPanel(state) {
      state.isNotifOpen = !state.isNotifOpen;
      state.isCreditOpen = false;
    },
    toggleCreditPanel(state) {
      state.isCreditOpen = !state.isCreditOpen;
      state.isNotifOpen = false;
    },
    closePanels(state) {
      state.isNotifOpen = false;
      state.isCreditOpen = false;
    },
    toggleAdminSidebar(state) {
      state.isAdminSidebarOpen = !state.isAdminSidebarOpen;
    },
  },
});

export const { toggleNotifPanel, toggleCreditPanel, closePanels, toggleAdminSidebar } = uiSlice.actions;
export default uiSlice.reducer;
