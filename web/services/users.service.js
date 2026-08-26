import { apiClient } from "@/lib/api-client";

export const usersService = {
  getProfile: (userId) => apiClient.get(`/users/${userId}`),
  getRatings: (userId) => apiClient.get(`/users/${userId}/ratings`),
  /** Always the current session's own profile — the backend never takes an id for this. */
  updateProfile: (payload) => apiClient.patch("/users/me", payload),
  getNotificationPreferences: () => apiClient.get("/users/me/notification-preferences"),
  updateNotificationPreferences: (payload) => apiClient.patch("/users/me/notification-preferences", payload),
  listBlocked: () => apiClient.get("/users/me/blocked"),
};
