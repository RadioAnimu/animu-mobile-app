import type { DrawerNavigationProp } from "@react-navigation/drawer";
import { useNavigation } from "@react-navigation/native";
import { useCallback, useEffect, useRef, useState } from "react";
import { FlatList, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

// Components
import { HeaderBar } from "@/components/HeaderBar";
import { Logo } from "@/components/Logo";
import { RequestBottomSheet } from "@/components/RequestBottomSheet";
import { RequestTrack } from "@/components/RequestTrack";

// Core
import { useAlert } from "@/contexts/alert/AlertProvider";
import { usePlayer } from "@/contexts/player/PlayerProvider";
import { useUserSettings } from "@/contexts/user/UserSettingsProvider";
import type { MusicRequest } from "@/core/domain/music-request";
import { useDict } from "@/hooks/useDict";
import { useRecentSearches } from "@/hooks/useRecentSearches";
import { useRouteReselect } from "@/hooks/useRouteReselect";
import { useScrollEndPadding } from "@/hooks/useScrollEndPadding";
import { IMGS } from "@/i18n";
import type { DetailParamList, DrawerParamList } from "@/routes/app.routes";
import { THEME } from "@/theme";
import { scale } from "@/theme/responsive";
import { formatResultCount, interpolate } from "@/utils/format";
import { haptics } from "@/utils/haptics";
import { layoutEase } from "@/utils/layout-animation";
import { NoticeBanner } from "@/screens/MakeRequest/NoticeBanner";
import { SearchBar } from "@/screens/MakeRequest/SearchBar";
import { SearchBody } from "@/screens/MakeRequest/SearchBody";
import { styles } from "@/screens/MakeRequest/styles";
import {
  MIN_SEARCH_LENGTH,
  useTrackSearch,
} from "@/screens/MakeRequest/useTrackSearch";
import { useRequestNotice } from "@/screens/MakeRequest/useRequestNotice";
import { useRecentSearchPanel } from "@/screens/MakeRequest/useRecentSearchPanel";
import { useSubmitRequest } from "@/screens/MakeRequest/useSubmitRequest";

const LOGO_HEIGHT = scale(150);

export function MakeRequest() {
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

  /** Whether the field is focused — collapses the banner to make room. */
  const [searchFocused, setSearchFocused] = useState(false);

  /** Scroll position of the results list — reset when a fresh search lands. */
  const listRef = useRef<FlatList<MusicRequest> | null>(null);
  const inputRef = useRef<TextInput | null>(null);

  // The lists run under the home indicator / nav bar and pad past it; the
  // keyboard-aware lists add the keyboard's room themselves.
  const bottomPadding = useScrollEndPadding(THEME.SPACE.LG);

  // Re-tapping the drawer's active item jumps the results back to the top.
  useRouteReselect("MakeRequest", () =>
    listRef.current?.scrollToOffset({ offset: 0, animated: true }),
  );

  const { recent, addRecent, removeRecent, clearRecent, restoreRecent } =
    useRecentSearches();

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

  const { notice, blockedMessage } = useRequestNotice();
  const { user, selectedTrack, setSelectedTrack, handleSubmitRequest } =
    useSubmitRequest({ blockedMessage });

  const { editing, showRecent, typed, trimmedLength, recentProps } =
    useRecentSearchPanel({
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
    });

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
    [blockedMessage, toast, setSelectedTrack],
  );

  const renderRequestTrack = useCallback(
    ({ item }: { item: MusicRequest & { requestable: boolean } }) => (
      <RequestTrack track={item} />
    ),
    [],
  );

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
            recentProps={recentProps}
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
