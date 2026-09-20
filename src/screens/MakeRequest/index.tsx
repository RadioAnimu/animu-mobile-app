import Ionicons from "@react-native-vector-icons/ionicons/static";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
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
import { useAuth } from "@/contexts/auth/AuthProvider";
import { useUserSettings } from "@/contexts/user/UserSettingsProvider";
import { useDict } from "@/hooks/useDict";
import { useLatestRequest } from "@/hooks/useLatestRequest";
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
import { THEME } from "@/theme";
import { scale } from "@/theme/responsive";
import { styles } from "@/screens/MakeRequest/styles";

const LOGO_HEIGHT = scale(150);

export function MakeRequest() {
  const { user } = useAuth();
  const { settings } = useUserSettings();
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

  const [selectedTrack, setSelectedTrack] = useState<MusicRequest | undefined>(
    undefined,
  );

  // Only the newest search/load-more may write results.
  const { begin, isCurrent } = useLatestRequest();

  const handleSearch = useCallback(async () => {
    const query = searchState.query;
    if (!query) return;
    const requestId = begin();
    setSearchState((prev) => ({ ...prev, status: "loading" }));
    try {
      const response = await musicRequestService.searchTracksByTitle(query);
      if (!isCurrent(requestId)) return;
      setSearchState({
        query,
        results: response.results,
        pagination: response,
        status: "idle",
      });
    } catch (err) {
      console.error(err);
      if (!isCurrent(requestId)) return;
      setSearchState((prev) => ({ ...prev, status: "idle" }));
    }
  }, [begin, isCurrent, searchState.query]);

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
    }
  }, [begin, isCurrent, searchState.pagination, searchState.status]);

  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = useCallback(async () => {
    const query = searchState.query;
    if (!query) return;
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
    } catch (err) {
      console.error(err);
    } finally {
      setRefreshing(false);
    }
  }, [begin, isCurrent, searchState.query]);

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

      const result = await musicRequestService.submitRequest(submission);

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

          <View style={styles.inputContainer}>
            <TextInput
              style={styles.input}
              placeholder={
                dict.REQUEST_SEARCH_PLACEHOLDER
              }
              placeholderTextColor={THEME.COLORS.TEXT}
              value={searchState.query}
              onChangeText={(query) =>
                setSearchState((prev) => ({ ...prev, query }))
              }
              onSubmitEditing={handleSearch}
            />
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel={dict.A11Y_SEARCH}
              onPress={handleSearch}
              style={styles.searchIcon}
            >
              <Ionicons
                name="search-sharp"
                size={THEME.ICON.LG}
                color={THEME.COLORS.TEXT}
              />
            </TouchableOpacity>
          </View>

          <View style={styles.listWrapper}>
            {searchState.status === "loading" ? (
              <ActivityIndicator color={THEME.COLORS.TEXT} />
            ) : (
              <TrackRequestContext.Provider value={handleRequestTrack}>
                <FlatList
                  data={searchState.results}
                  keyExtractor={(item) => item.id}
                  contentContainerStyle={styles.list}
                  renderItem={renderRequestTrack}
                  // Rows wrap to show the full title, so they vary in height
                  // and cannot be described by `getItemLayout`.
                  // Virtualization tuning for long searches: render only
                  // what is on screen plus a short lead in/out.
                  initialNumToRender={10}
                  maxToRenderPerBatch={10}
                  windowSize={7}
                  refreshControl={
                    <RefreshControl
                      refreshing={refreshing}
                      onRefresh={handleRefresh}
                      tintColor={THEME.COLORS.TEXT}
                      colors={[THEME.COLORS.BRAND]}
                      progressBackgroundColor={THEME.COLORS.SURFACE}
                    />
                  }
                  ListFooterComponent={
                    searchState.pagination?.nextPageParams ? (
                      <TouchableOpacity
                        accessibilityRole="button"
                        accessibilityState={{
                          disabled: searchState.status === "loadingMore",
                          busy: searchState.status === "loadingMore",
                        }}
                        style={styles.loadMoreBtn}
                        onPress={handleLoadMore}
                        disabled={searchState.status === "loadingMore"}
                      >
                        {searchState.status === "loadingMore" ? (
                          <ActivityIndicator color={THEME.COLORS.TEXT} />
                        ) : (
                          <Text style={styles.loadMoreText}>
                            {dict.LOAD_MORE_RESULTS}
                          </Text>
                        )}
                      </TouchableOpacity>
                    ) : null
                  }
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
