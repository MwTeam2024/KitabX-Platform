import { apiClient } from "@/lib/api-client";

export const requestsService = {
  incoming: () => apiClient.get("/requests/incoming"),
  mine: () => apiClient.get("/requests/mine"),
  get: (id) => apiClient.get(`/requests/${id}`),
  create: (listingId) => apiClient.post("/requests", { listingId }),
  accept: (requestId) => apiClient.post(`/requests/${requestId}/accept`),
  decline: (requestId) => apiClient.post(`/requests/${requestId}/decline`),
  cancel: (requestId, reason) => apiClient.post(`/requests/${requestId}/cancel`, { reason }),
};
