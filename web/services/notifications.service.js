import { apiClient } from "@/lib/api-client";

/** In-app notification records; FCM push token registration lives in lib/firebase.js (§15). */
export const notificationsService = {
  list: () => apiClient.get("/notifications"),
  unreadCount: () => apiClient.get("/notifications/unread-count"),
  markRead: (notificationId) => apiClient.patch(`/notifications/${notificationId}/read`),
  markAllRead: () => apiClient.patch("/notifications/read-all"),
  deleteOne: (notificationId) => apiClient.delete(`/notifications/${notificationId}`),
  deleteAll: () => apiClient.delete("/notifications"),
  registerDevice: (fcmToken, platform) => apiClient.post("/users/me/devices", { fcmToken, platform }),
};
