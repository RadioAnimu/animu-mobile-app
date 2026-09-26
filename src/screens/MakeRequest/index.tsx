import MaterialIcons from "@react-native-vector-icons/material-icons/static";
import { useCallback, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Keyboard,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

// Components
import { Background } from "@/components/Background";
import { HeaderBar } from "@/components/HeaderBar";
import { Logo } from "@/components/Logo";
import { RequestBottomSheet } from "@/components/RequestBottomSheet";
import { RequestTrack } from "@/components/RequestTrack";
import { TrackRequestContext } from "@/components/RequestTrack/context";

// Core
import { useAlert } from "@/contexts/alert/AlertProvider";
import { useAuth } from "@/contexts/auth/AuthProvider";
import { useUserSettings } from "@/contexts/user/UserSettingsProvider";
import { useDict } from "@/hooks/useDict";
import { useLatestRequest } from "@/hooks/useLatestRequest";
import { useRecentSearches } from "@/hooks/useRecentSearches";
import { useRouteReselect } from "@/hooks/useRouteReselect";
import {
  MusicRequest,
  MusicRequestPagination,
  MusicRequestSubmission,
} from "@/core/domain/music-request";
import {
  getSubmissionErrorMessage,
  musicRequestService,
} from "@/core/services/music-request.service";
import { IMGS } from "@/i18n";
import type { Dict } from "@/i18n";
import { THEME } from "@/theme";
import { scale } from "@/theme/responsive";
import { haptics } from "@/utils/haptics";
import { styles } from "@/screens/MakeRequest/styles";
import { RecentSearches } from "@/screens/MakeRequest/RecentSearches";
import { ResultsList } from "@/screens/MakeRequest/ResultsList";

const LOGO_HEIGHT = scale(150);

/** Below this many characters a title search matches too much to be useful. */
const MIN_SEARCH_LENGTH = 3;

/**
 * Search field. One in-field icon slot: a decorative magnifier while the
 * field is empty (tap just focuses), swapping to a clear button once there
 * is text. Searching itself happens on the keyboard's search key only —
 * `onSubmitEditing`.
 */
function SearchBar({
  dict,
  query,
  onChangeText,
  onSubmit,
  onClear,
  onFocusChange,
}: {
  dict: Dict;
  query: string;
  onChangeText: (query: string) => void;
  onSubmit: () => void;
  onClear: () => void;
  onFocusChange: (focused: boolean) => void;
}) {
  const inputRef = useRef<TextInput | null>(null);
  const hasQuery = query !== "";

  return (
    <View style={styles.inputContainer}>
      <View style={styles.searchField}>
        <TextInput
          ref={inputRef}
          style={styles.input}
          placeholder={dict.REQUEST_SEARCH_PLACEHOLDER}
          placeholderTextColor={THEME.COLORS.TEXT}
          accessibilityLabel={dict.REQUEST_SEARCH_PLACEHOLDER}
          value={query}
          onChangeText={onChangeText}
          onSubmitEditing={onSubmit}
          onFocus={() => onFocusChange(true)}
          onBlur={() => onFocusChange(false)}
          // Titles are proper nouns/romaji — spellcheck mangles them.
          autoCorrect={false}
          autoCapitalize="none"
          returnKeyType="search"
          // Grays the Enter key out while the field is empty (iOS).
          enablesReturnKeyAutomatically
          // Enter runs the search and drops the keyboard out of the way so
          // the results are visible immediately.
          blurOnSubmit
        />
        {hasQuery ? (
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={dict.A11Y_CLEAR_SEARCH}
            hitSlop={8}
            onPress={onClear}
            style={styles.fieldIcon}
          >
            <MaterialIcons
              name="cancel"
              size={THEME.ICON.MD}
              color={THEME.COLORS.TEXT_DIM}
            />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            accessibilityRole="none"
            accessible={false}
            hitSlop={8}
            onPress={() => inputRef.current?.focus()}
            style={styles.fieldIcon}
          >
            <MaterialIcons
              name="search"
              size={THEME.ICON.MD}
              color={THEME.COLORS.TEXT}
            />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

/** Failed-search banner with the retry shortcut. */
function SearchErrorBanner({
  dict,
  onRetry,
}: {
  dict: Dict;
  onRetry: () => void;
}) {
  return (
    <View style={styles.errorBanner}>
      <Text style={styles.errorText}>{dict.REQUEST_SEARCH_ERROR}</Text>
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel={dict.ERROR_RETRY}
        hitSlop={8}
        onPress={onRetry}
        style={styles.retryButton}
      >
        <Text style={styles.retryText}>{dict.ERROR_RETRY}</Text>
      </TouchableOpacity>
    </View>
  );
}

export function MakeRequest() {
  const { user } = useAuth();
  const { settings } = useUserSettings();
  const { error: showError } = useAlert();
  const dict = useDict();

  const [searchState, setSearchState] = useState<{
    query: string;
    results: MusicRequest[];
    pagination?: MusicRequestPagination;
    status: "idle" | "loading" | "loadingMore";
  }>({
    query: "",
    results: [],
    status: "idle",
  });

  /** Whether a search has ever run, so "no results" only shows afterwards. */
  const [hasSearched, setHasSearched] = useState(false);
  /** Last search failed — suppress the empty state so it can't contradict the toast. */
  const [searchFailed, setSearchFailed] = useState(false);

  const [selectedTrack, setSelectedTrack] = useState<MusicRequest | undefined>(
    undefined,
  );
  /** Whether the field is focused — reveals the recent-searches list. */
  const [searchFocused, setSearchFocused] = useState(false);

  /** Scroll position of the results list — reset when a fresh search lands. */
  const listRef = useRef<FlatList<MusicRequest> | null>(null);

  const { recent, addRecent, clearRecent } = useRecentSearches();

  // Re-tapping the drawer's active item jumps the results back to the top.
  useRouteReselect("MakeRequest", () =>
    listRef.current?.scrollToOffset({ offset: 0, animated: true }),
  );

  // Only the newest search/load-more may write results.
  const { begin, isCurrent } = useLatestRequest();

  const runSearch = useCallback(
    async (rawQuery: string) => {
      const query = rawQuery.trim();
      // Searching on one or two letters returns a useless wall of matches.
      if (query.length < MIN_SEARCH_LENGTH) return;
      const requestId = begin();
      setHasSearched(true);
      setSearchFailed(false);
      setSearchState((prev) => ({ ...prev, query, status: "loading" }));
      try {
        const response = await musicRequestService.searchTracksByTitle(query);
        if (!isCurrent(requestId)) return;
        setSearchState({
          query,
          results: response.results,
          pagination: response,
          status: "idle",
        });
        // A fresh search starts reading from the top.
        listRef.current?.scrollToOffset({ offset: 0, animated: false });
        addRecent(query);
      } catch (err) {
        console.error(err);
        if (!isCurrent(requestId)) return;
        setSearchFailed(true);
        setSearchState((prev) => ({ ...prev, status: "idle" }));
        haptics.error();
        showError(dict.REQUEST_SEARCH_ERROR);
      }
    },
    [addRecent, begin, isCurrent, showError, dict],
  );

  const handleSearch = useCallback(
    () => void runSearch(searchState.query),
    [runSearch, searchState.query],
  );

  /** Tapping a recent search re-runs it (keyboard down, field filled). */
  const handlePickRecent = useCallback(
    (query: string) => {
      Keyboard.dismiss();
      haptics.select();
      setSearchState((prev) => ({ ...prev, query }));
      void runSearch(query);
    },
    [runSearch],
  );

  const handleLoadMore = useCallback(async () => {
    if (searchState.status !== "idle") return;
    const nextPageParams = searchState.pagination?.nextPageParams;
    if (!nextPageParams) return;
    const requestId = begin();
    setSearchState((prev) => ({ ...prev, status: "loadingMore" }));
    try {
      const response = await musicRequestService.searchTracksByQuery(
        nextPageParams,
      );
      if (!isCurrent(requestId)) return;
      setSearchState((prev) => ({
        ...prev,
        results: [...prev.results, ...response.results],
        pagination: response,
        status: "idle",
      }));
    } catch (err) {
      console.error(err);
      if (!isCurrent(requestId)) return;
      setSearchState((prev) => ({ ...prev, status: "idle" }));
      showError(dict.REQUEST_SEARCH_ERROR);
    }
  }, [begin, isCurrent, searchState.pagination, searchState.status, showError, dict]);

  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = useCallback(async () => {
    const query = searchState.query.trim();
    if (query.length < MIN_SEARCH_LENGTH) return;
    const requestId = begin();
    setRefreshing(true);
    try {
      const response = await musicRequestService.searchTracksByTitle(query);
      if (!isCurrent(requestId)) return;
      setSearchState({
        query,
        results: response.results,
        pagination: response,
        status: "idle",
      });
      listRef.current?.scrollToOffset({ offset: 0, animated: false });
    } catch (err) {
      console.error(err);
      showError(dict.REQUEST_SEARCH_ERROR);
    } finally {
      setRefreshing(false);
    }
  }, [begin, isCurrent, searchState.query, showError, dict]);

  /** One tap empties the field, the old results and every error state. */
  const handleClearSearch = useCallback(() => {
    haptics.select();
    setSearchState({ query: "", results: [], status: "idle" });
    setHasSearched(false);
    setSearchFailed(false);
  }, []);

  const handleSubmitRequest = useCallback(
    async (message: string): Promise<{ success: boolean; message: string }> => {
      if (!user?.sessionToken) {
        return {
          success: false,
          message: dict.LOGIN_ERROR,
        };
      }

      if (!selectedTrack) {
        return {
          success: false,
          message: dict.SELECT_ERROR,
        };
      }

      const submission: MusicRequestSubmission = {
        trackId: selectedTrack.id,
        message,
        sessionId: user.sessionToken,
      };

      const result = await musicRequestService.submitRequest(
        submission,
        selectedTrack.artwork,
      );

      if (!result.success) {
        return {
          success: false,
          message: getSubmissionErrorMessage(
            result.error,
            result.detail,
            settings.selectedLanguage,
          ),
        };
      }

      return {
        success: true,
        message: dict.REQUEST_SUCCESS,
      };
    },
    [selectedTrack, user, dict, settings.selectedLanguage],
  );

  const handleRequestSuccess = useCallback((trackId: string) => {
    setSearchState((prev) => ({
      ...prev,
      // Only the submitted row's object identity changes — every memoized
      // `RequestTrack` row survives `results` re-renders untouched, so one
      // submission repaints one row of a 200-row list, not all of them.
      results: prev.results.map((item) =>
        item.id === trackId ? { ...item, requestable: false } : item,
      ),
    }));
  }, []);

  /** Stable row-action handler, handed to rows via `TrackRequestContext`. */
  const handleRequestTrack = useCallback((track: MusicRequest) => {
    if (track.requestable) setSelectedTrack(track);
  }, []);

  const renderRequestTrack = useCallback(
    ({ item }: { item: MusicRequest & { requestable: boolean } }) => (
      <RequestTrack track={item} />
    ),
    [],
  );

  return (
    <Background>
      <SafeAreaView style={styles.container} edges={["left", "right", "bottom"]}>
        <HeaderBar />
        <View style={styles.appContainer}>
          <View style={styles.logoWrapper}>
            <Logo
              img={IMGS[settings.selectedLanguage].MAKE_REQUEST}
              size={LOGO_HEIGHT}
            />
          </View>

          <SearchBar
            dict={dict}
            query={searchState.query}
            onChangeText={(query) =>
              setSearchState((prev) => ({ ...prev, query }))
            }
            onSubmit={handleSearch}
            onClear={handleClearSearch}
            onFocusChange={setSearchFocused}
          />

          {searchState.query.trim().length > 0 &&
            searchState.query.trim().length < MIN_SEARCH_LENGTH && (
              <Text style={styles.minHint}>{dict.REQUEST_SEARCH_MIN}</Text>
            )}

          {searchFailed && (
            <SearchErrorBanner dict={dict} onRetry={handleSearch} />
          )}

          <View style={styles.listWrapper}>
            {searchFocused && searchState.query === "" && recent.length > 0 ? (
              <RecentSearches
                dict={dict}
                items={recent}
                onPick={handlePickRecent}
                onClear={clearRecent}
              />
            ) : searchState.status === "loading" ? (
              <ActivityIndicator color={THEME.COLORS.TEXT} />
            ) : (
              <TrackRequestContext.Provider value={handleRequestTrack}>
                <ResultsList
                  listRef={listRef}
                  data={searchState.results}
                  renderItem={renderRequestTrack}
                  showEmpty={
                    hasSearched &&
                    !searchFailed &&
                    searchState.status === "idle" &&
                    searchState.query.trim().length >= MIN_SEARCH_LENGTH
                  }
                  emptyLabel={dict.REQUEST_SEARCH_EMPTY}
                  refreshing={refreshing}
                  onRefresh={handleRefresh}
                  loadingMore={searchState.status === "loadingMore"}
                  onEndReached={handleLoadMore}
                />
              </TrackRequestContext.Provider>
            )}
          </View>
        </View>

        <RequestBottomSheet
          visible={!!selectedTrack}
          track={selectedTrack}
          user={user}
          onClose={() => setSelectedTrack(undefined)}
          onSubmit={handleSubmitRequest}
          onRequestSuccess={handleRequestSuccess}
        />
      </SafeAreaView>
    </Background>
  );
}
