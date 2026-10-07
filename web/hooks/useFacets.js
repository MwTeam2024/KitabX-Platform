"use client";

import { useEffect, useState } from "react";
import { discoveryService } from "@/services/discovery.service";
import { LANGUAGES } from "@/lib/mockData";

const FALLBACK = {
  genres: ["Others"], languages: [...LANGUAGES, "Others"],
  popularGenres: [], popularLanguages: LANGUAGES.slice(0, 6),
};
let cached = null;

/**
 * Every genre and language that exists on any book — fetched on each mount
 * (a scan since the last visit may have added one), with the previous result
 * shown meanwhile so the lists never flash empty.
 */
export function useFacets() {
  const [facets, setFacets] = useState(cached || FALLBACK);

  useEffect(() => {
    let alive = true;
    discoveryService.facets()
      .then((f) => {
        cached = f;
        if (alive) setFacets(f);
      })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  return facets;
}
