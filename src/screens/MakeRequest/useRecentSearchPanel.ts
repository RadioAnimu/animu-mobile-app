import {
  useCallback,
  useMemo,
  type ComponentProps,
  type RefObject,
} from "react";
import type { TextInput } from "react-native";

import { useAlert } from "@/contexts/alert/AlertProvider";
import {
  byFrecency,
  type RecentSearch,
} from "@/core/services/recent-searches.service";
import { useDict } from "@/hooks/useDict";
import { haptics } from "@/utils/haptics";
import { dismissKeyboard } from "@/utils/keyboard";
import { filterByQuery, foldForSearch } from "@/utils/search-match";
import { RecentSearches } from "@/screens/MakeRequest/RecentSearches";
import { MIN_SEARCH_LENGTH } from "@/screens/MakeRequest/useTrackSearch";

/**
 * Owns the recent-search panel of the request screen: its handlers (edit,
 * pick, remove with undo, clear with undo, run-the-typed-text) and the
 * editing/visibility state deciding when the panel stands in for the
 * results. Returns the props for `<RecentSearches>` plus the values the
 * screen itself still needs (`typed`, `trimmedLength`, `editing`,
 * `showRecent`).
 */
export function useRecentSearchPanel({
  recent,
  removeRecent,
  clearRecent,
  restoreRecent,
  setQuery,
  search,
  submit,
  query,
  searchedQuery,
  loading,
  inputRef,
  bottomPadding,
}: Readonly<{
  recent: RecentSearch[];
  removeRecent: (query: string) => void;
  clearRecent: () => void;
  restoreRecent: (entries: readonly RecentSearch[]) => void;
  setQuery: (query: string) => void;
  search: (query: string) => Promise<void>;
  submit: () => void;
  query: string;
  searchedQuery: string | undefined;
  loading: boolean;
  inputRef: RefObject<TextInput | null>;
  bottomPadding: number;
}>) {
  const dict = useDict();
  const { toast } = useAlert();

  /** The ↖ on a recent search: into the field to refine, keyboard up. */
  const handleEditRecent = useCallback(
    (picked: string) => {
      haptics.select();
      setQuery(picked);
      inputRef.current?.focus();
    },
    [setQuery, inputRef],
  );

  /** Each delete is one tap, so each gets an Undo instead of a confirm. */
  const offerUndo = useCallback(
    (message: string, removed: RecentSearch[]) =>
      toast(message, "info", {
        action: {
          label: dict.UNDO,
          onPress: () => restoreRecent(removed),
        },
      }),
    [toast, dict, restoreRecent],
  );

  const handleRemoveRecent = useCallback(
    (removed: string) => {
      // Everything the service's loose match will drop (legacy histories can
      // hold "Naruto" and "naruto"), so Undo brings all of it back.
      const key = foldForSearch(removed);
      const entries = recent.filter(
        (item) => foldForSearch(item.query) === key,
      );
      removeRecent(removed);
      offerUndo(dict.REQUEST_SEARCH_RECENT_REMOVED, entries);
    },
    [recent, removeRecent, offerUndo, dict],
  );

  const handleClearRecent = useCallback(() => {
    const entries = recent;
    clearRecent();
    offerUndo(dict.REQUEST_SEARCH_RECENT_CLEARED, entries);
  }, [recent, clearRecent, offerUndo, dict]);

  /** The "Search “…”" row: same as the keyboard's search key. */
  const handleRunTyped = useCallback(() => {
    dismissKeyboard();
    submit();
  }, [submit]);

  /** Tapping a recent search re-runs it (keyboard down, field filled). */
  const handlePickRecent = useCallback(
    (picked: string) => {
      dismissKeyboard();
      haptics.select();
      setQuery(picked);
      void search(picked);
    },
    [search, setQuery],
  );

  const typed = query.trim();
  const trimmedLength = typed.length;
  // Typed text that isn't what the shown results were searched for: the
  // matching recent searches stand in for those stale results until the
  // search key is pressed.
  const editing =
    typed !== "" && foldForSearch(typed) !== foldForSearch(searchedQuery ?? "");
  const recentShown = useMemo(
    () =>
      editing
        ? filterByQuery(byFrecency(recent), typed, (item) => item.query)
        : recent,
    [editing, recent, typed],
  );
  // While editing, a "Search “…”" row heads the matches once the text is
  // long enough — so the panel shows even when nothing in history matches.
  const canRunTyped = editing && trimmedLength >= MIN_SEARCH_LENGTH;
  // Recent searches fill the empty state, focused or not.
  const hasRecentContent = recentShown.length > 0 || canRunTyped;
  const showRecent = !loading && (query === "" || editing) && hasRecentContent;

  const recentProps: ComponentProps<typeof RecentSearches> = {
    dict,
    items: recentShown,
    typed: editing ? typed : undefined,
    onPick: handlePickRecent,
    onEdit: handleEditRecent,
    onRunTyped: canRunTyped ? handleRunTyped : undefined,
    onRemove: handleRemoveRecent,
    onClear: handleClearRecent,
    bottomPadding,
  };

  return { editing, showRecent, typed, trimmedLength, recentProps };
}
