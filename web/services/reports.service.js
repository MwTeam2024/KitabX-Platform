import { apiClient } from "@/lib/api-client";

export const reportsService = {
  reportUser: (reportedUserId, { reason, description, block, exchangeId, attachmentUrls }) =>
    apiClient.post("/reports", { reportedUserId, reason, description, block, exchangeId, attachmentUrls }),
  reportListing: (listingId, { reason, description, attachmentUrls }) =>
    apiClient.post("/reports", { listingId, reason, description, attachmentUrls }),
  reportBug: ({ description, screen }) =>
    apiClient.post("/support-requests", { type: "TECHNICAL_BUG", subject: screen, description }),
  submitSupportRequest: ({ description, subject, type }) =>
    apiClient.post("/support-requests", { type: type || "SUPPORT", subject, description }),
  blockUser: (userId) => apiClient.post(`/users/${userId}/block`),
  unblockUser: (userId) => apiClient.delete(`/users/${userId}/block`),
};
