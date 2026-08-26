"use client";

import { useMemo } from "react";
import { useAppData } from "@/contexts/AppDataContext";
import { useDebounce } from "./useDebounce";

/** Discovery-board reads. Radius/geo filtering is a backend concern (§8) — this hook
 * only searches/sorts the page of listings the API would have already returned. */
export function useBooks({ keys, query = "", genre = "All", sort = "newest" } = {}) {
  const { books } = useAppData();
  const debouncedQuery = useDebounce(query, 200);

  const list = useMemo(() => {
    const source = (keys || Object.keys(books)).map((k) => books[k]).filter(Boolean);
    const q = debouncedQuery.trim().toLowerCase();
    return source
      .filter((b) => !b.paused)
      .filter((b) => genre === "All" || b.genre === genre)
      .filter((b) => !q || `${b.title} ${b.author}`.toLowerCase().includes(q))
      .sort((a, b) => {
        if (sort === "nearest") return (a.distanceKm ?? 99) - (b.distanceKm ?? 99);
        if (sort === "recent") return (a.listedDaysAgo ?? 99) - (b.listedDaysAgo ?? 99);
        return 0; // "newest" mirrors the API's default ordering
      });
  }, [books, keys, debouncedQuery, genre, sort]);

  return { books: list, getBook: (key) => books[key] };
}
