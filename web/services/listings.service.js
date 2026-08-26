import { apiClient } from "@/lib/api-client";

export const listingsService = {
  myListings: () => apiClient.get("/listings/mine"),
  received: () => apiClient.get("/listings/received"),
  get: (id) => apiClient.get(`/listings/${id}`),
  /** payload: { condition, conditionDescription, pickupInstructions, photoUrls: string[],
   *   book: { title, author, genre, languageCode, isbn13, publicationYear, ... } } */
  create: (payload) => apiClient.post("/listings", payload),
  update: (listingId, payload) => apiClient.patch(`/listings/${listingId}`, payload),
  remove: (listingId) => apiClient.delete(`/listings/${listingId}`),
  setPaused: (listingId, paused) => apiClient.patch(`/listings/${listingId}/pause`, { paused }),
};
