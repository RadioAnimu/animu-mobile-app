import { Icon } from "@/components/Icon";
import type { DrawerNavigationProp } from "@react-navigation/drawer";
import { useNavigation } from "@react-navigation/native";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentProps,
} from "react";
import {
  ActivityIndicator,
  FlatList,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

// Components
import { HeaderBar } from "@/components/HeaderBar";
import { Logo } from "@/components/Logo";
import { RequestBottomSheet } from "@/components/RequestBottomSheet";
import { RequestTrack } from "@/components/RequestTrack";
import { TrackRequestContext } from "@/components/RequestTrack/context";

// Core
import { useAlert } from "@/contexts/alert/AlertProvider";
import { useAuth } from "@/contexts/auth/AuthProvider";
import { usePlayer } from "@/contexts/player/PlayerProvider";
import { useUserSettings } from "@/contexts/user/UserSettingsProvider";
import { useDict } from "@/hooks/useDict";
import { useRecentSearches } from "@/hooks/useRecentSearches";
import {
  byFrecency,
  type RecentSearch,
} from "@/core/services/recent-searches.service";
import { useRouteReselect } from "@/hooks/useRouteReselect";
import { useScrollEndPadding } from "@/hooks/useScrollEndPadding";
import {
  MusicRequest,
  MusicRequestSubmission,
} from "@/core/domain/music-request";
import {
  getSubmissionErrorMessage,
  musicRequestService,
} from "@/core/services/music-request.service";
import { IMGS } from "@/i18n";
import type { DetailParamList, DrawerParamList } from "@/routes/app.routes";
import type { Dict } from "@/i18n";
import { THEME } from "@/theme";
import { scale } from "@/theme/responsive";
import { formatResultCount, interpolate } from "@/utils/format";
import { haptics } from "@/utils/haptics";
import { dismissKeyboard } from "@/utils/keyboard";
import { layoutEase } from "@/utils/layout-animation";
import { filterByQuery, foldForSearch } from "@/utils/search-match";
import { styles } from "@/screens/MakeRequest/styles";
import { NoticeBanner } from "@/screens/MakeRequest/NoticeBanner";
import { RecentSearches } from "@/screens/MakeRequest/RecentSearches";
import { ResultsList } from "@/screens/MakeRequest/ResultsList";
import {
  MIN_SEARCH_LENGTH,
  useTrackSearch,
} from "@/screens/MakeRequest/useTrackSearch";

const LOGO_HEIGHT = scale(150);

/**
 * Search field. One in-field icon slot: a decorative magnifier while the
 * field is empty (tap just focuses), swapping to a clear button once there
 * is text. Searching itself happens on the keyboard's search key only —
 * `onSubmitEditing`.
 */
function SearchBar({
  inputRef,
  dict,
  query,
  onChangeText,
  onSubmit,
  onClear,
  onFocusChange,
}: Readonly<{
  inputRef: React.RefObject<TextInput | null>;
  dict: Dict;
  query: string;
  onChangeText: (query: string) => void;
  onSubmit: () => void;
  onClear: () => void;
  onFocusChange: (focused: boolean) => void;
}>) {
  const [focused, setFocused] = useState(false);
  const hasQuery = query !== "";

  return (
    <View style={styles.inputContainer}>
      <View style={styles.searchField}>
        <TextInput
          ref={inputRef}
          style={[styles.input, focused && styles.inputFocused]}
          placeholder={dict.REQUEST_SEARCH_PLACEHOLDER}
          // Dimmer than typed text, like every other field's placeholder.
          placeholderTextColor={THEME.COLORS.TEXT_DIM}
          accessibilityLabel={dict.REQUEST_SEARCH_PLACEHOLDER}
          value={query}
          onChangeText={onChangeText}
          onSubmitEditing={onSubmit}
          onFocus={() => {
            setFocused(true);
            onFocusChange(true);
          }}
          onBlur={() => {
            setFocused(false);
            onFocusChange(false);
          }}
          // Titles are proper nouns/romaji — spellcheck mangles them.
          autoCorrect={false}
          autoCapitalize="none"
          returnKeyType="search"
          // Grays the Enter key out while the field is empty (iOS).
          enablesReturnKeyAutomatically
          // Enter runs the search and drops the keyboard out of the way so
          // the results are visible immediately.
          submitBehavior="blurAndSubmit"
        />
        {hasQuery ? (
          <TouchableOpacity
            activeOpacity={THEME.OPACITY.PRESSED}
            accessibilityRole="button"
            accessibilityLabel={dict.A11Y_CLEAR_SEARCH}
            hitSlop={THEME.HIT_SLOP.SM}
            onPress={onClear}
            style={styles.fieldIcon}
          >
            <Icon
              name="cancel"
              size={THEME.ICON.MD}
              color={THEME.COLORS.TEXT_DIM}
            />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            activeOpacity={THEME.OPACITY.PRESSED}
            accessibilityRole="none"
            accessible={false}
            hitSlop={THEME.HIT_SLOP.SM}
            onPress={() => inputRef.current?.focus()}
            style={styles.fieldIcon}
          >
            <Icon
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

/**
 * What fills the list area: recent searches, a spinner, the results, or —
 * mid-edit with nothing to suggest — nothing, so results for another query
 * never pass for this one.
 */
function SearchBody({
  showRecent,
  editing,
  loading,
  onRequestTrack,
  recentProps,
  resultsProps,
}: Readonly<{
  showRecent: boolean;
  editing: boolean;
  loading: boolean;
  onRequestTrack: (track: MusicRequest) => void;
  recentProps: ComponentProps<typeof RecentSearches>;
  resultsProps: ComponentProps<typeof ResultsList>;
}>) {
  if (showRecent) {
    // Its own instance per mode: "Show all" starts collapsed again after a
    // round trip through the type-ahead.
    return (
      <RecentSearches
        key={recentProps.typed ? "matches" : "recent"}
        {...recentProps}
      />
    );
  }
  if (loading) return <ActivityIndicator color={THEME.COLORS.SPINNER} />;
  if (editing) return null;
  return (
    <TrackRequestContext.Provider value={onRequestTrack}>
      <ResultsList {...resultsProps} />
    </TrackRequestContext.Provider>
  );
}

export function MakeRequest() {
  const { user, profile } = useAuth();
  const { settings } = useUserSettings();
  const { toast } = useAlert();
  const dict = useDict();
  // Login/Account are stack routes above the drawer; `navigate` bubbles up to
  // the stack, so the drawer prop only needs to know their names.
  const navigation =
    useNavigation<DrawerNavigationProp<DrawerParamList & DetailParamList>>();
  const isLive = Boolean(usePlayer().currentProgram?.isLive);

  // A live show starting while this screen is open: music requests close, so
  // hand the listener back to the player (where the live sheet lives). The
  // screen stays mounted when unfocused, hence the focus check.
  useEffect(() => {
    if (isLive && navigation.isFocused()) {
      toast(dict.REQUEST_ERROR_ONAIR, "error");
      navigation.navigate("Home");
    }
  }, [isLive, navigation, toast, dict]);

  const [selectedTrack, setSelectedTrack] = useState<MusicRequest | undefined>(
    undefined,
  );
  /** Whether the field is focused — collapses the banner to make room. */
  const [searchFocused, setSearchFocused] = useState(false);

  /** Scroll position of the results list — reset when a fresh search lands. */
  const listRef = useRef<FlatList<MusicRequest> | null>(null);

  const { recent, addRecent, removeRecent, clearRecent, restoreRecent } =
    useRecentSearches();

  const inputRef = useRef<TextInput | null>(null);

  // The lists run under the home indicator / nav bar and pad past it; the
  // keyboard-aware lists add the keyboard's room themselves.
  const bottomPadding = useScrollEndPadding(THEME.SPACE.LG);

  // Re-tapping the drawer's active item jumps the results back to the top.
  useRouteReselect("MakeRequest", () =>
    listRef.current?.scrollToOffset({ offset: 0, animated: true }),
  );

  const {
    query,
    searchedQuery,
    totalResults,
    results,
    loading,
    loadingMore,
    idle,
    searchFailed,
    refreshing,
    setQuery,
    search,
    submit,
    loadMore,
    refresh,
    clear,
    markRequested,
  } = useTrackSearch({ listRef, onSearched: addRecent });

  // Song requests need a verified account (Discord linked + 2FA), which Google,
  // Apple and Animu Connect sign-ins never are. Say so up front instead of
  // letting someone pick a song and write a message the server will refuse.
  // `profile` is null while loading: unknown counts as allowed and the server
  // decides.
  const hasSession = Boolean(user?.sessionToken);
  const unverified = hasSession && profile?.user.verified === false;
  const notice = useMemo(() => {
    if (!hasSession) {
      return {
        message: dict.REQUEST_NEEDS_SIGN_IN,
        actionLabel: dict.REQUEST_SIGN_IN_ACTION,
        route: "Login",
      } as const;
    }
    if (unverified) {
      return {
        message: dict.REQUEST_NEEDS_VERIFIED,
        actionLabel: dict.REQUEST_VERIFY_ACTION,
        route: "Account",
      } as const;
    }
    return null;
  }, [hasSession, unverified, dict]);
  const blockedMessage = notice?.message;

  /** The ↖ on a recent search: into the field to refine, keyboard up. */
  const handleEditRecent = useCallback(
    (picked: string) => {
      haptics.select();
      setQuery(picked);
      inputRef.current?.focus();
    },
    [setQuery],
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

  const handleSubmitRequest = useCallback(
    async (message: string): Promise<{ success: boolean; message: string }> => {
      if (blockedMessage || !user?.sessionToken) {
        return {
          success: false,
          message: blockedMessage ?? dict.REQUEST_NEEDS_SIGN_IN,
        };
      }

      if (!selectedTrack) {
        return { success: false, message: dict.SELECT_ERROR };
      }

      const submission: MusicRequestSubmission = {
        trackId: selectedTrack.id,
        message,
        sessionId: user.sessionToken,
      };

      const result = await musicRequestService.submitRequest(submission, {
        title: selectedTrack.song,
        artist: selectedTrack.artist,
        anime: selectedTrack.anime,
        artwork: selectedTrack.artwork,
      });

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

      return { success: true, message: dict.REQUEST_SUCCESS };
    },
    [selectedTrack, user, dict, blockedMessage, settings.selectedLanguage],
  );

  /** Stable row-action handler, handed to rows via `TrackRequestContext`. */
  const handleRequestTrack = useCallback(
    (track: MusicRequest) => {
      if (!track.requestable) return;
      if (blockedMessage) {
        haptics.error();
        toast(blockedMessage, "error");
        return;
      }
      setSelectedTrack(track);
    },
    [blockedMessage, toast],
  );

  const renderRequestTrack = useCallback(
    ({ item }: { item: MusicRequest & { requestable: boolean } }) => (
      <RequestTrack track={item} />
    ),
    [],
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
  // "No songs" only for the query that actually ran — not an edit of it.
  // (`searchedQuery` is only set by a search that landed.)
  const showingSearched = typed !== "" && !editing;
  const showEmpty = showingSearched && idle && !searchFailed;
  const countLabel =
    totalResults === undefined || searchedQuery === undefined
      ? undefined
      : interpolate(dict.REQUEST_SEARCH_COUNT_FOR, {
          count: formatResultCount(totalResults, dict),
          query: searchedQuery,
        });
  // The banner steps aside while searching so the list gets the room above
  // the keyboard.
  const showLogo = !searchFocused && query === "";

  return (
    <SafeAreaView style={styles.container} edges={["left", "right"]}>
      <HeaderBar />
      <View style={styles.appContainer}>
        {showLogo && (
          <View style={styles.logoWrapper}>
            <Logo
              img={IMGS[settings.selectedLanguage].MAKE_REQUEST}
              size={LOGO_HEIGHT}
            />
          </View>
        )}

        <SearchBar
          inputRef={inputRef}
          dict={dict}
          query={query}
          onChangeText={setQuery}
          onSubmit={submit}
          onClear={clear}
          onFocusChange={(focused) => {
            layoutEase();
            setSearchFocused(focused);
          }}
        />

        {trimmedLength > 0 && trimmedLength < MIN_SEARCH_LENGTH && (
          <Text style={styles.minHint}>{dict.REQUEST_SEARCH_MIN}</Text>
        )}

        {/* Right under the field rather than in the Haruka banner's slot:
            that banner collapses when the field focuses, and this must stay
            visible (and above the fold) while the user types or scrolls. */}
        {notice && (
          <NoticeBanner
            message={notice.message}
            actionLabel={notice.actionLabel}
            onAction={() => navigation.navigate(notice.route)}
          />
        )}

        {searchFailed && (
          <NoticeBanner
            message={dict.REQUEST_SEARCH_ERROR}
            actionLabel={dict.ERROR_RETRY}
            onAction={submit}
          />
        )}

        <View style={styles.listWrapper}>
          <SearchBody
            showRecent={showRecent}
            editing={editing}
            loading={loading}
            onRequestTrack={handleRequestTrack}
            recentProps={{
              dict,
              items: recentShown,
              typed: editing ? typed : undefined,
              onPick: handlePickRecent,
              onEdit: handleEditRecent,
              onRunTyped: canRunTyped ? handleRunTyped : undefined,
              onRemove: handleRemoveRecent,
              onClear: handleClearRecent,
              bottomPadding,
            }}
            resultsProps={{
              listRef,
              data: results,
              renderItem: renderRequestTrack,
              showEmpty,
              emptyLabel: dict.REQUEST_SEARCH_EMPTY,
              countLabel,
              refreshing,
              onRefresh: refresh,
              loadingMore,
              onEndReached: loadMore,
              bottomPadding,
            }}
          />
        </View>
      </View>

      <RequestBottomSheet
        visible={!!selectedTrack}
        track={selectedTrack}
        user={user}
        onClose={() => setSelectedTrack(undefined)}
        onSubmit={handleSubmitRequest}
        onRequestSuccess={markRequested}
      />
    </SafeAreaView>
  );
}
