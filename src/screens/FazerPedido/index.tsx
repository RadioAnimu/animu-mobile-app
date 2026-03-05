import { Ionicons } from "@expo/vector-icons";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import React, { useCallback, useMemo, useState } from "react";
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
import { Background } from "../../components/Background";
import { HeaderBar } from "../../components/HeaderBar";
import { Logo } from "../../components/Logo";
import { RequestBottomSheet } from "../../components/RequestBottomSheet";
import { RequestTrack } from "../../components/RequestTrack";

// Core
import { useAuth } from "../../contexts/auth/AuthProvider";
import { usePlayer } from "../../contexts/player/PlayerProvider";
import { useUserSettings } from "../../contexts/user/UserSettingsProvider";
import {
  MusicRequest,
  MusicRequestPagination,
} from "../../core/domain/music-request";
import { musicRequestService } from "../../core/services/music-request.service";

// Styles and Config
import { MusicRequestSubmissionDTO } from "../../data/http/dto/music-request.dto";
import { MusicRequestMapper } from "../../data/mappers/music-request.mapper";
import { DICT, IMGS } from "../../i18n";
import { RootStackParamList } from "../../routes/app.routes";
import { THEME } from "../../theme";
import { styles } from "./styles";

type Props = NativeStackScreenProps<RootStackParamList, "FazerPedido">;

export function FazerPedido({ navigation }: Props) {
  const { user } = useAuth();
  const { settings } = useUserSettings();
  const player = usePlayer();

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

  const queueCount = useMemo(() => {
    const requested = player.lastRequestedTracks;
    const current = player.currentTrack;

    if (!requested?.length) return undefined;

    const now = Date.now();

    // Sort all requests chronologically so we can reason about position
    const sorted = [...requested].sort(
      (a, b) => a.startTime.getTime() - b.startTime.getTime(),
    );

    // Case 1: A request is currently on air.
    // Walk the sorted list from the end to find the last entry whose startTime
    // has already passed — that is the track currently playing.
    // Everything after it is genuinely still in the queue.
    if (current?.isRequest) {
      let playingIdx = -1;
      for (let i = sorted.length - 1; i >= 0; i--) {
        if (sorted[i].startTime.getTime() <= now) {
          playingIdx = i;
          break;
        }
      }
      if (playingIdx !== -1) {
        return sorted.length - 1 - playingIdx;
      }
    }

    // Case 2: Free-play / DJ / non-request track is on air.
    // Use the precise moment the current track ends as the cutoff —
    // requests scheduled after that point haven't been consumed yet.
    const pivot =
      current?.startTime && current.duration > 0
        ? Math.max(now, current.startTime.getTime() + current.duration)
        : now;

    return sorted.filter((t) => t.startTime.getTime() > pivot).length;
  }, [player.lastRequestedTracks, player.currentTrack]);

  const handleSearch = useCallback(async () => {
    if (!searchState.query) return;
    setSearchState((prev) => ({ ...prev, status: "loading" }));
    try {
      const response = await musicRequestService.searchTracksByTitle(
        searchState.query,
      );
      setSearchState({
        query: searchState.query,
        results: response.results,
        pagination: response,
        status: "idle",
      });
    } catch (err) {
      console.error(err);
      setSearchState((prev) => ({ ...prev, status: "idle" }));
    }
  }, [searchState.query]);

  const handleLoadMore = useCallback(async () => {
    if (!searchState.pagination?.nextPageQueryObject) return;
    setSearchState((prev) => ({ ...prev, status: "loadingMore" }));
    try {
      const response = await musicRequestService.searchTracksByQuery(
        searchState.pagination.nextPageQueryObject,
      );
      setSearchState((prev) => ({
        ...prev,
        results: [...prev.results, ...response.results],
        pagination: response,
        status: "idle",
      }));
    } catch (err) {
      console.error(err);
      setSearchState((prev) => ({ ...prev, status: "idle" }));
    }
  }, [searchState.pagination, searchState.query]);

  const handleSubmitRequest = useCallback(
    async (message: string): Promise<{ success: boolean; message: string }> => {
      if (!user?.sessionId) {
        return {
          success: false,
          message: DICT[settings.selectedLanguage].LOGIN_ERROR,
        };
      }

      if (!selectedTrack) {
        return {
          success: false,
          message: DICT[settings.selectedLanguage].SELECT_ERROR,
        };
      }

      const submissionDTO: MusicRequestSubmissionDTO = {
        allmusic: selectedTrack.id,
        message,
        PHPSESSID: user.sessionId,
      };

      const result = await musicRequestService.submitRequest(submissionDTO);

      if (!result.success) {
        return {
          success: false,
          message: MusicRequestMapper.getErrorMessage(
            result.error,
            result.detail,
            settings.selectedLanguage,
          ),
        };
      }

      return {
        success: true,
        message: DICT[settings.selectedLanguage].REQUEST_SUCCESS,
      };
    },
    [selectedTrack, user?.sessionId, settings.selectedLanguage],
  );

  const handleRequestSuccess = useCallback((trackId: string) => {
    setSearchState((prev) => ({
      ...prev,
      results: prev.results.map((item) =>
        item.id === trackId ? { ...item, requestable: false } : item,
      ),
    }));
  }, []);

  return (
    <Background>
      <SafeAreaView style={styles.container}>
        <HeaderBar navigation={navigation} />
        <View style={styles.appContainer}>
          <View style={{ marginVertical: 15 }}>
            <Logo
              img={IMGS[settings.selectedLanguage].MAKE_REQUEST}
              size={150}
            />
          </View>

          <View style={styles.inputContainer}>
            <TextInput
              style={styles.input}
              placeholder={
                DICT[settings.selectedLanguage].REQUEST_SEARCH_PLACEHOLDER
              }
              placeholderTextColor="#fff"
              value={searchState.query}
              onChangeText={(query) =>
                setSearchState((prev) => ({ ...prev, query }))
              }
              onSubmitEditing={handleSearch}
            />
            <TouchableOpacity onPress={handleSearch} style={styles.searchIcon}>
              <Ionicons
                name="search-sharp"
                size={24}
                color={THEME.COLORS.WHITE_TEXT}
              />
            </TouchableOpacity>
          </View>

          <View
            style={{
              width: "100%",
              flex: 1,
            }}
          >
            {searchState.status === "loading" ? (
              <ActivityIndicator color={THEME.COLORS.WHITE_TEXT} />
            ) : (
              <FlatList
                data={searchState.results}
                keyExtractor={(item) => item.id}
                contentContainerStyle={{ flexGrow: 1, gap: 10 }}
                renderItem={({ item }) => (
                  <RequestTrack
                    track={item}
                    onTrackRequest={() => {
                      if (item.requestable) {
                        setSelectedTrack(item);
                      }
                    }}
                  />
                )}
                ListFooterComponent={
                  searchState.pagination?.nextPageQueryObject ? (
                    <TouchableOpacity
                      style={styles.loadMoreBtn}
                      onPress={handleLoadMore}
                      disabled={searchState.status === "loadingMore"}
                    >
                      {searchState.status === "loadingMore" ? (
                        <ActivityIndicator color={THEME.COLORS.WHITE_TEXT} />
                      ) : (
                        <Text style={styles.loadMoreText}>
                          Load more results
                        </Text>
                      )}
                    </TouchableOpacity>
                  ) : null
                }
              />
            )}
          </View>
        </View>

        <RequestBottomSheet
          visible={!!selectedTrack}
          track={selectedTrack}
          user={user}
          queueCount={queueCount}
          onClose={() => setSelectedTrack(undefined)}
          onSubmit={handleSubmitRequest}
          onRequestSuccess={handleRequestSuccess}
        />
      </SafeAreaView>
    </Background>
  );
}
