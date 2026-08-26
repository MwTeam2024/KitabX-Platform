import { apiClient } from "@/lib/api-client";

export const wishlistService = {
  list: () => apiClient.get("/wishlist"),
  add: (bookId) => apiClient.post("/wishlist", { bookId }),
  remove: (bookId) => apiClient.delete(`/wishlist/${bookId}`),
};
