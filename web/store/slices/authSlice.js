import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  user: null,
  isAuthenticated: false,
  // Flips true once the initial /auth/me check resolves (success or fail) —
  // lets the UI avoid flashing "logged out" before the cookie's been checked.
  hydrated: false,
  signupDraft: {
    firstName: '',
    lastName: '',
    mobile: '',
    societyId: '',
    societyLabel: '',
    blockId: '',
    flatUnit: '',
    acceptedTerms: false,
  },
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    updateSignupDraft(state, action) {
      Object.assign(state.signupDraft, action.payload);
    },
    /** Set after a real /auth/otp/verify or /auth/me response — `user` is the
     * backend's toSelfUser() shape, never fabricated client-side. */
    sessionEstablished(state, action) {
      state.user = action.payload;
      state.isAuthenticated = true;
      state.hydrated = true;
    },
    sessionCleared(state) {
      return { ...initialState, hydrated: true };
    },
    logout(state) {
      return { ...initialState, hydrated: true };
    },
  },
});

export const { updateSignupDraft, sessionEstablished, sessionCleared, logout } = authSlice.actions;
export default authSlice.reducer;
