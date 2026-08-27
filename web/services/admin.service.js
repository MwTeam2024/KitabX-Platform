import { apiClient } from "@/lib/api-client";

/**
 * Admin session is a separate httpOnly cookie from the member session (§21).
 * Login is phone+OTP only — same mechanism as member login, different cookie.
 */
export const adminService = {
  requestOtp: (phone) => apiClient.post("/admin/auth/otp/request", { phone }),
  verifyOtp: (phone, code) => apiClient.post("/admin/auth/otp/verify", { phone, code }),
  /** Email-OTP login — alternate to phone, for an admin with an email on file. */
  requestEmailOtp: (email) => apiClient.post("/admin/auth/otp/request-email", { email }),
  verifyEmailOtp: (email, code) => apiClient.post("/admin/auth/otp/verify-email", { email, code }),
  /** Google/Apple sign-in — login-only, same rule as email-OTP above. */
  googleLogin: (idToken) => apiClient.post("/admin/auth/oauth/google", { idToken }),
  appleLogin: (idToken) => apiClient.post("/admin/auth/oauth/apple", { idToken }),
  me: () => apiClient.get("/admin/auth/me"),
  logout: () => apiClient.post("/admin/auth/logout"),
  /** Task 36 — admin self-service phone/email editing, OTP-gated the same
   * way as the member Profile Settings equivalents. */
  requestPhoneChangeOtp: (newPhone) => apiClient.post("/admin/auth/phone-change/request", { newPhone }),
  confirmPhoneChange: (newPhone, code) => apiClient.post("/admin/auth/phone-change/verify", { newPhone, code }),
  requestEmailChangeOtp: (newEmail) => apiClient.post("/admin/auth/email-change/request", { newEmail }),
  confirmEmailChange: (newEmail, code) => apiClient.post("/admin/auth/email-change/verify", { newEmail, code }),
  dashboard: () => apiClient.get("/admin/dashboard"),
  notificationCounts: ({ usersSince, reportsSince, moderationSince, deletionRequestsSince, locationRequestsSince }) => {
    const params = new URLSearchParams();
    if (usersSince) params.set("usersSince", usersSince);
    if (reportsSince) params.set("reportsSince", reportsSince);
    if (moderationSince) params.set("moderationSince", moderationSince);
    if (deletionRequestsSince) params.set("deletionRequestsSince", deletionRequestsSince);
    if (locationRequestsSince) params.set("locationRequestsSince", locationRequestsSince);
    return apiClient.get(`/admin/notification-counts?${params.toString()}`);
  },

  listUsers: (q) => apiClient.get(`/admin/users${q ? `?q=${encodeURIComponent(q)}` : ""}`),
  setVerification: (userId, verified) => apiClient.patch(`/admin/users/${userId}/verification`, { verified }),
  setSuspended: (userId, suspended) => apiClient.patch(`/admin/users/${userId}/suspension`, { suspended }),
  approveUser: (userId) => apiClient.post(`/admin/users/${userId}/approve`),
  rejectUser: (userId) => apiClient.post(`/admin/users/${userId}/reject`),

  listDeletionRequests: () => apiClient.get("/admin/deletion-requests"),
  actionDeletionRequest: (userId) => apiClient.post(`/admin/deletion-requests/${userId}/action`),
  rejectDeletionRequest: (userId) => apiClient.post(`/admin/deletion-requests/${userId}/reject`),

  listSocieties: () => apiClient.get("/admin/societies"),
  createSociety: (payload) => apiClient.post("/admin/societies", payload),
  updateSociety: (id, payload) => apiClient.patch(`/admin/societies/${id}`, payload),
  removeSociety: (id) => apiClient.delete(`/admin/societies/${id}`),

  listLocationRequests: () => apiClient.get("/admin/location-requests"),
  approveLocationRequest: (id) => apiClient.post(`/admin/location-requests/${id}/approve`),
  rejectLocationRequest: (id, reason) => apiClient.post(`/admin/location-requests/${id}/reject`, { reason }),

  listFlaggedListings: () => apiClient.get("/admin/listings/flagged"),
  removeListing: (id) => apiClient.delete(`/admin/listings/${id}`),
  listFlaggedUsers: () => apiClient.get("/admin/users/flagged"),

  listExchanges: () => apiClient.get("/admin/exchanges"),

  creditsLedger: () => apiClient.get("/admin/credits/ledger"),
  correctCredit: (userId, amount, reason) => apiClient.post("/admin/credits/correction", { userId, amount, reason }),

  listReports: (status) => apiClient.get(`/admin/reports${status ? `?status=${status}` : ""}`),
  resolveReport: (id, notes) => apiClient.post(`/admin/reports/${id}/resolve`, { notes }),
  resolveSupportRequest: (id) => apiClient.post(`/admin/support-requests/${id}/resolve`),

  getSettings: () => apiClient.get("/admin/settings"),
  updateSettings: (payload) => apiClient.patch("/admin/settings", payload),
};
