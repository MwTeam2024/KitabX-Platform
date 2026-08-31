import { apiClient } from "@/lib/api-client";

/**
 * Radius search is authoritative server-side (PostGIS, §8/§9) — the viewer's
 * own society and coordinates are resolved from their session, not sent by
 * the client.
 */
export const discoveryService = {
  search: ({ radiusKm, genre, language, condition, q, sort, includeNearby } = {}) => {
    const params = new URLSearchParams();
    if (radiusKm != null) params.set("radiusKm", radiusKm);
    if (genre && genre !== "All") params.set("genre", genre);
    if (language) params.set("language", language);
    if (condition) params.set("condition", condition);
    if (q) params.set("q", q);
    if (sort) params.set("sort", sort);
    if (includeNearby === false) params.set("includeNearby", "false");
    return apiClient.get(`/discovery?${params.toString()}`);
  },
  /** Platform-wide totals for the home page stat tiles — never per-society. */
  stats: () => apiClient.get("/discovery/stats"),
};
