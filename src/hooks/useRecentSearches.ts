import { useCallback, useEffect, useRef, useState } from "react";

import {
  recentSearchesService,
  type RecentSearch,
} from "@/core/services/recent-searches.service";
import { foldForSearch } from "@/utils/search-match";

/**
 * Request-search history (query, result count, use count), newest first and
 * persisted across launches — up to `MAX_HISTORY` entries.
 */
export function useRecentSearches() {
  const [recent, setRecent] = useState<RecentSearch[]>([]);
  /** Set by the first mutation: a slow initial read must not undo it. */
  const mutated = useRef(false);

  useEffect(() => {
    let cancelled = false;
    void recentSearchesService.getAll().then((items) => {
      if (!cancelled && !mutated.current) setRecent(items);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const addRecent = useCallback((query: string, total: number) => {
    mutated.current = true;
    void recentSearchesService.add(query, total).then(setRecent);
  }, []);

  const removeRecent = useCallback((query: string) => {
    // Optimistic, and folded the same way the service matches: the row leaves
    // the list on the spot and storage catches up.
    mutated.current = true;
    const key = foldForSearch(query);
    setRecent((prev) =>
      prev.filter((item) => foldForSearch(item.query) !== key),
    );
    // Storage settles in call order, so its answer is the truth — it also
    // undoes an earlier add landing on top of the optimistic list.
    void recentSearchesService.remove(query).then(setRecent);
  }, []);

  const clearRecent = useCallback(() => {
    mutated.current = true;
    setRecent([]);
    // Settles after any add still in flight, whose answer would otherwise
    // bring the cleared rows back.
    void recentSearchesService.clear().then(() => setRecent([]));
  }, []);

  /** Undo: puts removed entries back (merged with anything searched since). */
  const restoreRecent = useCallback((items: readonly RecentSearch[]) => {
    mutated.current = true;
    void recentSearchesService.restore(items).then(setRecent);
  }, []);

  return { recent, addRecent, removeRecent, clearRecent, restoreRecent };
}
