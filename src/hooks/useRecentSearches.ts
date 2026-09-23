import { useCallback, useEffect, useState } from "react";

import { recentSearchesService } from "@/core/services/recent-searches.service";

/** Recent request-search queries, persisted across launches. */
export function useRecentSearches() {
  const [recent, setRecent] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;
    void recentSearchesService.getAll().then((items) => {
      if (!cancelled) setRecent(items);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const addRecent = useCallback((query: string) => {
    void recentSearchesService.add(query).then(setRecent);
  }, []);

  const clearRecent = useCallback(() => {
    setRecent([]);
    void recentSearchesService.clear();
  }, []);

  return { recent, addRecent, clearRecent };
}
