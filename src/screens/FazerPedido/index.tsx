import { Ionicons } from "@expo/vector-icons";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import React, { useCallback, useEffect, useMemo, useState } from "react";
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
import { QueueStatusStrip } from "../../components/QueueStatusStrip";
import { RequestBottomSheet } from "../../components/RequestBottomSheet";
import { RequestTrack } from "../../components/RequestTrack";

// Core
import { useAuth } from "../../contexts/auth/AuthProvider";
import { usePlayer, useStation } from "../../contexts/player/PlayerProvider";
import { useUserSettings } from "../../contexts/user/UserSettingsProvider";
import {
  MusicRequest,
  MusicRequestPagination,
  MusicRequestSubmission,
} from "../../core/domain/music-request";
import {
  getSubmissionErrorMessage,
  musicRequestService,
} from "../../core/services/music-request.service";
import {
  QueueTracker,
  type QueueStatus,
} from "../../core/player/queue-tracker";
import { DICT, IMGS } from "../../i18n";
import { RootStackParamList } from "../../routes/app.routes";
import { THEME } from "../../theme";
import { styles } from "./styles";

type Props = NativeStackScreenProps<RootStackParamList, "FazerPedido">;

export function FazerPedido({ navigation }: Props) {
  const { user } = useAuth();
  const { settings } = useUserSettings();
  const { currentTrack } = usePlayer();
  const { lastRequestedTracks } = useStation();

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

  // Own-request queue tracker — see queue-tracker.ts for the business
  // rules. Persists across sessions; observes every station poll.
  const queueTracker = useMemo(() => new QueueTracker(), []);
  const [queueStatus, setQueueStatus] = useState<QueueStatus>(() =>
    queueTracker.status,
  );

  useEffect(() => {
    let cancelled = false;
    queueTracker.load().then(() => {
      if (!cancelled) setQueueStatus(queueTracker.status);
    });
    return () => {
      cancelled = true;
    };
  }, [queueTracker]);

  // Advance the queue on every station poll merge — the effect only runs
  // when the poll data actually changed (store emits on real changes)
  useEffect(() => {
    setQueueStatus(
      queueTracker.observe({
        now: Date.now(),
        onAirTrack: currentTrack ?? null,
        playedRequests: lastRequestedTracks ?? [],
      }),
    );
  }, [queueTracker, currentTrack, lastRequestedTracks]);

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
    if (!searchState.pagination?.nextPageParams) return;
    setSearchState((prev) => ({ ...prev, status: "loadingMore" }));
    try {
      const response = await musicRequestService.searchTracksByQuery(
        searchState.pagination.nextPageParams,
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
  }, [searchState.pagination]);

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

      const submission: MusicRequestSubmission = {
        trackId: selectedTrack.id,
        message,
        sessionId: user.sessionId,
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

      // Record for the queue tracker — "played ahead" counting starts here
      await queueTracker.add(selectedTrack.id, selectedTrack.song);

      return {
        success: true,
        message: DICT[settings.selectedLanguage].REQUEST_SUCCESS,
      };
    },
    [selectedTrack, user, settings.selectedLanguage, queueTracker],
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

          {/* Own-request queue status — persists across the session */}
          <QueueStatusStrip status={queueStatus} />

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
                  searchState.pagination?.nextPageParams ? (
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
          queueStatus={queueStatus}
          onClose={() => setSelectedTrack(undefined)}
          onSubmit={handleSubmitRequest}
          onRequestSuccess={handleRequestSuccess}
        />
      </SafeAreaView>
    </Background>
  );
}
