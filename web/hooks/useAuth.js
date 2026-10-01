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

/**
 * One-shot session check against the httpOnly cookie — see SessionGate.js.
 *
 * A 401 means there's genuinely no valid session — no point retrying that.
 * Anything else (network error, timeout, 5xx) is likely transient, and far
 * more likely right after a mobile reload before the connection's fully
 * back up than on a stable desktop connection — confirmed this was treated
 * identically to a real 401 before, so a single dropped request on reload
 * logged the user out exactly like an expired session would have, even
 * though their cookie was still perfectly valid. Retrying a couple of times
 * first means a flaky network blip doesn't masquerade as being logged out.
 */
export async function hydrateSession(dispatch) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const { user } = await authService.me();
      dispatch(sessionEstablished(user));
      return;
    } catch (err) {
      if (err.status === 401) break;
      if (attempt < 2) await new Promise((resolve) => setTimeout(resolve, 400 * (attempt + 1)));
    }
  }
  dispatch(sessionCleared());
}
