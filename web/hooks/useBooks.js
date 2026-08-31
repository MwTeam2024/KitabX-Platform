"use client";

import { useMemo } from "react";
import { useAppData } from "@/contexts/AppDataContext";

/**
 * Discovery-board reads. Radius/genre/text-search filtering is a backend
 * concern (§8, and — for text search — also matches on ISBN, which the
 * listing objects here don't even carry a field for) — this hook only
 * sorts the page of listings the API already returned for `keys`. It used
 * to also re-filter by `query` against title+author only, which silently
 * dropped every listing the server had correctly matched by ISBN instead
 * (Task 59) — removed rather than fixed, since re-filtering server-filtered
 * results was never this hook's job per its own original intent.
 */
export function useBooks({ keys, genre = "All", sort = "newest" } = {}) {
  const { books } = useAppData();

  const list = useMemo(() => {
    const source = (keys || Object.keys(books)).map((k) => books[k]).filter(Boolean);
    return source
      .filter((b) => !b.paused)
      .filter((b) => genre === "All" || b.genre === genre)
      .sort((a, b) => {
        if (sort === "nearest") return (a.distanceKm ?? 99) - (b.distanceKm ?? 99);
        if (sort === "recent") return (a.listedDaysAgo ?? 99) - (b.listedDaysAgo ?? 99);
        return 0; // "newest" mirrors the API's default ordering
      });
  }, [books, keys, genre, sort]);

  return { books: list, getBook: (key) => books[key] };
}
