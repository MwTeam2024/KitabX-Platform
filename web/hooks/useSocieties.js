'use client';

import { useEffect, useState } from 'react';
import { societiesService } from '@/services/societies.service';

/** Read-mostly reference data — fetched once and cached in memory for the session. */
let cache = null;

export function useSocieties() {
  const [societies, setSocieties] = useState(cache || []);
  const [loading, setLoading] = useState(!cache);

  useEffect(() => {
    if (cache) return;
    societiesService
      .list()
      .then((list) => {
        cache = list;
        setSocieties(list);
      })
      .catch(() => setSocieties([]))
      .finally(() => setLoading(false));
  }, []);

  return { societies, loading };
}
