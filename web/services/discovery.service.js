import { apiClient } from "@/lib/api-client";

/**
 * Radius search is authoritative server-side (PostGIS, §8/§9) — the viewer's
 * own society and coordinates are resolved from their session, not sent by
 * the client.
 */
export const discoveryService = {
  // genre / language / condition are lists (any of them matches) — sent as
  // repeated params rather than comma-joined, since a genre like "Fiction,
  // science fiction, general" has commas of its own.
  search: ({ radiusKm, genre, language, condition, q, sort } = {}) => {
    const params = new URLSearchParams();
    if (radiusKm != null) params.set("radiusKm", radiusKm);
    [["genre", genre], ["language", language], ["condition", condition]].forEach(([key, values]) => {
      [values].flat().filter((v) => v && v !== "All").forEach((v) => params.append(key, v));
    });
    if (q) params.set("q", q);
    if (sort) params.set("sort", sort);
    return apiClient.get(`/discovery?${params.toString()}`);
  },
  /** Every genre/language on any book — drives the filters and add-book dropdowns. */
  facets: () => apiClient.get("/discovery/facets"),
  /** Platform-wide totals for the home page stat tiles — never per-society. */
  stats: () => apiClient.get("/discovery/stats"),
};
