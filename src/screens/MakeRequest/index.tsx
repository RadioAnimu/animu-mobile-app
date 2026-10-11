import { Icon } from "@/components/Icon";
import type { DrawerNavigationProp } from "@react-navigation/drawer";
import { useNavigation } from "@react-navigation/native";
import {
  useCallback,
  useEffect,
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
import type { DrawerParamList } from "@/routes/app.routes";
import type { Dict } from "@/i18n";
import { THEME } from "@/theme";
import { scale } from "@/theme/responsive";
import { haptics } from "@/utils/haptics";
import { dismissKeyboard } from "@/utils/keyboard";
import { layoutEase } from "@/utils/layout-animation";
import { styles } from "@/screens/MakeRequest/styles";
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
  dict,
  query,
  onChangeText,
  onSubmit,
  onClear,
  onFocusChange,
}: Readonly<{
  dict: Dict;
  query: string;
  onChangeText: (query: string) => void;
  onSubmit: () => void;
  onClear: () => void;
  onFocusChange: (focused: boolean) => void;
}>) {
  const inputRef = useRef<TextInput | null>(null);
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

/** Failed-search banner with the retry shortcut. */
function SearchErrorBanner({
  dict,
  onRetry,
}: Readonly<{
  dict: Dict;
  onRetry: () => void;
}>) {
  return (
    <View style={styles.errorBanner}>
      <Text style={styles.errorText}>{dict.REQUEST_SEARCH_ERROR}</Text>
      <TouchableOpacity
        activeOpacity={THEME.OPACITY.PRESSED}
        accessibilityRole="button"
        accessibilityLabel={dict.ERROR_RETRY}
        hitSlop={THEME.HIT_SLOP.SM}
        onPress={onRetry}
        style={styles.retryButton}
      >
        <Text style={styles.retryText}>{dict.ERROR_RETRY}</Text>
      </TouchableOpacity>
    </View>
  );
}

/** What fills the list area: recent searches, a spinner, or the results. */
function SearchBody({
  showRecent,
  loading,
  onRequestTrack,
  recentProps,
  resultsProps,
}: Readonly<{
  showRecent: boolean;
  loading: boolean;
  onRequestTrack: (track: MusicRequest) => void;
  recentProps: ComponentProps<typeof RecentSearches>;
  resultsProps: ComponentProps<typeof ResultsList>;
}>) {
  if (showRecent) return <RecentSearches {...recentProps} />;
  if (loading) return <ActivityIndicator color={THEME.COLORS.SPINNER} />;
  return (
    <TrackRequestContext.Provider value={onRequestTrack}>
      <ResultsList {...resultsProps} />
    </TrackRequestContext.Provider>
  );
}

export function MakeRequest() {
  const { user } = useAuth();
  const { settings } = useUserSettings();
  const { toast } = useAlert();
  const dict = useDict();
  const navigation =
    useNavigation<DrawerNavigationProp<DrawerParamList>>();
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

  const { recent, addRecent, removeRecent, clearRecent } = useRecentSearches();

  // The lists run under the home indicator / nav bar and pad past it; the
  // keyboard-aware lists add the keyboard's room themselves.
  const bottomPadding = useScrollEndPadding(THEME.SPACE.LG);

  // Re-tapping the drawer's active item jumps the results back to the top.
  useRouteReselect("MakeRequest", () =>
    listRef.current?.scrollToOffset({ offset: 0, animated: true }),
  );

  const {
    query,
    results,
    loading,
    loadingMore,
    idle,
    hasSearched,
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
      if (!user?.sessionToken) {
        return { success: false, message: dict.LOGIN_ERROR };
      }

      if (!selectedTrack) {
        return { success: false, message: dict.SELECT_ERROR };
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

      return { success: true, message: dict.REQUEST_SUCCESS };
    },
    [selectedTrack, user, dict, settings.selectedLanguage],
  );

  /** Stable row-action handler, handed to rows via `TrackRequestContext`. */
  const handleRequestTrack = useCallback(
    (track: MusicRequest) => {
      if (!track.requestable) return;
      if (!user?.sessionToken) {
        haptics.error();
        toast(dict.LOGIN_ERROR, "error");
        return;
      }
      setSelectedTrack(track);
    },
    [user?.sessionToken, toast, dict.LOGIN_ERROR],
  );

  const renderRequestTrack = useCallback(
    ({ item }: { item: MusicRequest & { requestable: boolean } }) => (
      <RequestTrack track={item} />
    ),
    [],
  );

  const trimmedLength = query.trim().length;
  // Recent searches fill the empty state, focused or not.
  const showRecent = query === "" && recent.length > 0;
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

        {searchFailed && <SearchErrorBanner dict={dict} onRetry={submit} />}

        <View style={styles.listWrapper}>
          <SearchBody
            showRecent={showRecent}
            loading={loading}
            onRequestTrack={handleRequestTrack}
            recentProps={{
              dict,
              items: recent,
              onPick: handlePickRecent,
              onRemove: removeRecent,
              onClear: clearRecent,
              bottomPadding,
            }}
            resultsProps={{
              listRef,
              data: results,
              renderItem: renderRequestTrack,
              showEmpty:
                hasSearched &&
                !searchFailed &&
                idle &&
                trimmedLength >= MIN_SEARCH_LENGTH,
              emptyLabel: dict.REQUEST_SEARCH_EMPTY,
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
