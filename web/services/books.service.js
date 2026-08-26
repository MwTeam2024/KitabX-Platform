import { apiClient } from "@/lib/api-client";

/** Google Books + Gemini lookups proxied through NestJS's book-identification module (§6, §18). */
export const booksService = {
  lookupByIsbn: (isbn) => apiClient.get(`/book-identification/isbn?isbn=${encodeURIComponent(isbn)}`),
  searchByTitleOrAuthor: (query) => apiClient.get(`/book-identification/search?q=${encodeURIComponent(query)}`),
  /** `imageFormData` must use field name "image" to match the backend's FileInterceptor. */
  extractFromImage: (imageFormData) =>
    apiClient.post("/book-identification/image", imageFormData, { headers: {} }),
};
