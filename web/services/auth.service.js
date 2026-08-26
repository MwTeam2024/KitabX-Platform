import { apiClient } from "@/lib/api-client";

export const authService = {
  requestOtp: (phone) => apiClient.post("/auth/otp/request", { phone }),
  /** `profile` carries the signup fields (firstName, lastName, societyId, blockId,
   * flatUnit, acceptedTerms) — ignored by the backend for an existing phone. */
  verifyOtp: (phone, code, profile = {}) => apiClient.post("/auth/otp/verify", { phone, code, ...profile }),
  /** Email-OTP login — an alternate to phone. */
  requestEmailOtp: (email) => apiClient.post("/auth/otp/request-email", { email }),
  verifyEmailOtp: (email, code) => apiClient.post("/auth/otp/verify-email", { email, code }),
  /** Email-first signup (Task 33/38) — verifies the email, but the account
   * itself is only created once a phone is verified too, via `verifyOtp`
   * with the returned `emailVerificationToken`. */
  requestSignupEmailOtp: (email) => apiClient.post("/auth/otp/request-email", { email, intent: "signup" }),
  verifySignupEmailOtp: (email, code) => apiClient.post("/auth/otp/verify-email-signup", { email, code }),
  /** Google/Apple sign-in — login-only, same rule as email-OTP above. */
  googleLogin: (idToken) => apiClient.post("/auth/oauth/google", { idToken }),
  appleLogin: (idToken) => apiClient.post("/auth/oauth/apple", { idToken }),
  me: () => apiClient.get("/auth/me"),
  /** Profile Settings phone-number edit — OTP-gated separately from login. */
  requestPhoneChangeOtp: (newPhone) => apiClient.post("/auth/phone-change/request", { newPhone }),
  confirmPhoneChange: (newPhone, code) => apiClient.post("/auth/phone-change/verify", { newPhone, code }),
  /** Profile Settings add/change email — OTP-gated the same way. */
  requestEmailChangeOtp: (newEmail) => apiClient.post("/auth/email-change/request", { newEmail }),
  confirmEmailChange: (newEmail, code) => apiClient.post("/auth/email-change/verify", { newEmail, code }),
  logout: () => apiClient.post("/auth/logout"),
  requestAccountDeletion: () => apiClient.post("/auth/account/deletion-request"),
};
