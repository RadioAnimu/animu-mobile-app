import { useCallback, useState, type RefObject } from "react";
import type { FlatList } from "react-native";

import { useAlert } from "@/contexts/alert/AlertProvider";
import type {
  MusicRequest,
  MusicRequestPagination,
} from "@/core/domain/music-request";
import { musicRequestService } from "@/core/services/music-request.service";
import { useDict } from "@/hooks/useDict";
import { useLatestRequest } from "@/hooks/useLatestRequest";
import { haptics } from "@/utils/haptics";

/** Below this many characters a title search matches too much to be useful. */
export const MIN_SEARCH_LENGTH = 3;

interface SearchState {
  query: string;
  /** The query `results` belong to — `query` drifts from it while typing. */
  searched?: string;
  results: MusicRequest[];
  pagination?: MusicRequestPagination;
  status: "idle" | "loading" | "loadingMore";
}

const INITIAL_STATE: SearchState = { query: "", results: [], status: "idle" };

/**
 * Search state machine for the request screen: the query, the paginated
 * results and every in-flight/failed flag. Only the newest search, load-more
 * or refresh may write results — a slower, older response is dropped.
 */
export function useTrackSearch({
  listRef,
  onSearched,
}: {
  listRef: RefObject<FlatList<MusicRequest> | null>;
  /** Called with the trimmed query and its total match count after a search lands. */
  onSearched: (query: string, total: number) => void;
}) {
  const { toast } = useAlert();
  const dict = useDict();
  const { begin, isCurrent } = useLatestRequest();

  const [state, setState] = useState<SearchState>(INITIAL_STATE);
  /** Last search failed — suppress the empty state so it can't contradict the toast. */
  const [searchFailed, setSearchFailed] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const setQuery = useCallback(
    (query: string) => setState((prev) => ({ ...prev, query })),
    [],
  );

  const scrollToTop = useCallback(
    () => listRef.current?.scrollToOffset({ offset: 0, animated: false }),
    [listRef],
  );

  const search = useCallback(
    async (rawQuery: string) => {
      const query = rawQuery.trim();
      // Searching on one or two letters returns a useless wall of matches.
      if (query.length < MIN_SEARCH_LENGTH) return;
      const requestId = begin();
      setSearchFailed(false);
      setState((prev) => ({ ...prev, query, status: "loading" }));
      try {
        const response = await musicRequestService.searchTracksByTitle(query);
        if (!isCurrent(requestId)) return;
        setState((prev) => ({
          // Text typed while the search was in flight stays in the field.
          query: prev.query,
          searched: query,
          results: response.results,
          pagination: response,
          status: "idle",
        }));
        // A fresh search starts reading from the top.
        scrollToTop();
        onSearched(query, response.totalResults);
      } catch (err) {
        console.error("[MakeRequest] search failed:", err);
        if (!isCurrent(requestId)) return;
        setSearchFailed(true);
        setState((prev) => ({ ...prev, status: "idle" }));
        haptics.error();
        toast(dict.REQUEST_SEARCH_ERROR, "error");
      }
    },
    [begin, isCurrent, scrollToTop, onSearched, toast, dict],
  );

  const submit = useCallback(
    () => void search(state.query),
    [search, state.query],
  );

  const loadMore = useCallback(async () => {
    if (state.status !== "idle") return;
    const nextPageParams = state.pagination?.nextPageParams;
    if (!nextPageParams) return;
    const requestId = begin();
    setState((prev) => ({ ...prev, status: "loadingMore" }));
    try {
      const response =
        await musicRequestService.searchTracksByQuery(nextPageParams);
      if (!isCurrent(requestId)) return;
      setState((prev) => ({
        ...prev,
        results: [...prev.results, ...response.results],
        pagination: response,
        status: "idle",
      }));
    } catch (err) {
      console.error("[MakeRequest] search failed:", err);
      if (!isCurrent(requestId)) return;
      setState((prev) => ({ ...prev, status: "idle" }));
      toast(dict.REQUEST_SEARCH_ERROR, "error");
    }
  }, [begin, isCurrent, state.pagination, state.status, toast, dict]);

  const refresh = useCallback(async () => {
    // Pull-to-refresh re-runs what the list shows, not a half-typed edit.
    const query = (state.searched ?? state.query).trim();
    if (query.length < MIN_SEARCH_LENGTH) return;
    const requestId = begin();
    setRefreshing(true);
    try {
      const response = await musicRequestService.searchTracksByTitle(query);
      if (!isCurrent(requestId)) return;
      setState((prev) => ({
        // Keeps whatever was typed meanwhile.
        query: prev.query,
        searched: query,
        results: response.results,
        pagination: response,
        status: "idle",
      }));
      scrollToTop();
    } catch (err) {
      console.error("[MakeRequest] search failed:", err);
      // Same staleness rules as `search`: a slow refresh landing after a
      // newer search must not toast over the newer state, and the error
      // banner rides the same failure flag so the UI stays consistent.
      if (!isCurrent(requestId)) return;
      setSearchFailed(true);
      setState((prev) => ({ ...prev, status: "idle" }));
      toast(dict.REQUEST_SEARCH_ERROR, "error");
    } finally {
      setRefreshing(false);
    }
  }, [begin, isCurrent, scrollToTop, state.searched, state.query, toast, dict]);

  /** One tap empties the field, the old results and every error state. */
  const clear = useCallback(() => {
    haptics.select();
    // A search still in flight must not land on the emptied field.
    begin();
    setState(INITIAL_STATE);
    setSearchFailed(false);
  }, [begin]);

  const markRequested = useCallback((trackId: string) => {
    setState((prev) => ({
      ...prev,
      // Only the submitted row's object identity changes — every memoized
      // `RequestTrack` row survives `results` re-renders untouched, so one
      // submission repaints one row of a 200-row list, not all of them.
      results: prev.results.map((item) =>
        item.id === trackId ? { ...item, requestable: false } : item,
      ),
    }));
  }, []);

  return {
    query: state.query,
    searchedQuery: state.searched,
    totalResults: state.pagination?.totalResults,
    results: state.results,
    loading: state.status === "loading",
    loadingMore: state.status === "loadingMore",
    idle: state.status === "idle",
    searchFailed,
    refreshing,
    setQuery,
    search,
    submit,
    loadMore,
    refresh,
    clear,
    markRequested,
  };
}
