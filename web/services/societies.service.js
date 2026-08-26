import { apiClient } from "@/lib/api-client";

export const societiesService = {
  listCities: () => apiClient.get("/cities"),
  list: () => apiClient.get("/societies"),
  get: (societyId) => apiClient.get(`/societies/${societyId}`),
  listBlocks: (societyId) => apiClient.get(`/societies/${societyId}/blocks`),
  listPickupPoints: (societyId) => apiClient.get(`/societies/${societyId}/pickup-points`),
};
