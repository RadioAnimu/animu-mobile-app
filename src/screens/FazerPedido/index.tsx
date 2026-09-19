import Ionicons from "@react-native-vector-icons/ionicons/static";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useCallback, useRef, useState } from "react";
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
import { RootStackParamList } from "@/routes/app.routes";
import { THEME } from "@/theme";
import { styles } from "@/screens/FazerPedido/styles";

type Props = NativeStackScreenProps<RootStackParamList, "FazerPedido">;

const LOGO_HEIGHT = 150;

export function FazerPedido({ navigation }: Props) {
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

  // Monotonic token: only the newest search/load-more may write results, so
  // an out-of-order response (e.g. a slow first page landing after a fast
  // second) can never clobber the current list.
  const requestIdRef = useRef(0);

  const handleSearch = useCallback(async () => {
    const query = searchState.query;
    if (!query) return;
    const requestId = ++requestIdRef.current;
    setSearchState((prev) => ({ ...prev, status: "loading" }));
    try {
      const response = await musicRequestService.searchTracksByTitle(query);
      if (requestId !== requestIdRef.current) return;
      setSearchState({
        query,
        results: response.results,
        pagination: response,
        status: "idle",
      });
    } catch (err) {
      console.error(err);
      if (requestId !== requestIdRef.current) return;
      setSearchState((prev) => ({ ...prev, status: "idle" }));
    }
  }, [searchState.query]);

  const handleLoadMore = useCallback(async () => {
    if (searchState.status !== "idle") return;
    const nextPageParams = searchState.pagination?.nextPageParams;
    if (!nextPageParams) return;
    const requestId = ++requestIdRef.current;
    setSearchState((prev) => ({ ...prev, status: "loadingMore" }));
    try {
      const response = await musicRequestService.searchTracksByQuery(
        nextPageParams,
      );
      if (requestId !== requestIdRef.current) return;
      setSearchState((prev) => ({
        ...prev,
        results: [...prev.results, ...response.results],
        pagination: response,
        status: "idle",
      }));
    } catch (err) {
      console.error(err);
      if (requestId !== requestIdRef.current) return;
      setSearchState((prev) => ({ ...prev, status: "idle" }));
    }
  }, [searchState.pagination, searchState.status]);

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
        <HeaderBar navigation={navigation} />
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
            <TouchableOpacity onPress={handleSearch} style={styles.searchIcon}>
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
                  ListFooterComponent={
                    searchState.pagination?.nextPageParams ? (
                      <TouchableOpacity
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
