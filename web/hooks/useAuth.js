import { useDispatch, useSelector } from "react-redux";
import { sessionEstablished, sessionCleared, logout as logoutAction, updateSignupDraft } from "@/store/slices/authSlice";
import { authService } from "@/services/auth.service";

export function useAuth() {
  const dispatch = useDispatch();
  const { user, isAuthenticated, hydrated, signupDraft } = useSelector((s) => s.auth);

  return {
    user,
    isAuthenticated,
    hydrated,
    signupDraft,
    updateSignupDraft: (patch) => dispatch(updateSignupDraft(patch)),
    /** Called with the real `user` object from an OTP-verify or /auth/me response. */
    setSession: (sessionUser) => dispatch(sessionEstablished(sessionUser)),
    logout: async () => {
      await authService.logout().catch(() => null);
      dispatch(logoutAction());
    },
  };
}

/** One-shot session check against the httpOnly cookie — see SessionGate.js. */
export async function hydrateSession(dispatch) {
  try {
    const { user } = await authService.me();
    dispatch(sessionEstablished(user));
  } catch {
    dispatch(sessionCleared());
  }
}
