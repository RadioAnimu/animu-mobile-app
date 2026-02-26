import { Ionicons } from "@expo/vector-icons";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Platform,
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
import { PopUpRecado } from "../../components/PopUpRecado";
import { RequestTrack } from "../../components/RequestTrack";

// Core
import { useAlert } from "../../contexts/alert/AlertProvider";
import { useAuth } from "../../contexts/auth/AuthProvider";
import { useUserSettings } from "../../contexts/user/UserSettingsProvider";
import {
  MusicRequest,
  MusicRequestPagination,
} from "../../core/domain/music-request";
import { musicRequestService } from "../../core/services/music-request.service";

// Styles and Config
import { MusicRequestSubmissionDTO } from "../../data/http/dto/music-request.dto";
import { DICT, IMGS } from "../../languages";
import { RootStackParamList } from "../../routes/app.routes";
import { THEME } from "../../theme";
import { styles } from "./styles";
import { MusicRequestMapper } from "../../data/mappers/music-request.mapper";

type Props = NativeStackScreenProps<RootStackParamList, "FazerPedido">;

export function FazerPedido({ navigation }: Props) {
  const { error, success } = useAlert();
  const { user } = useAuth();
  const { settings } = useUserSettings();

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

  const [requestState, setRequestState] = useState<{
    selected?: MusicRequest;
    message: string;
  }>({ message: "" });

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
      error("Something went wrong");
      setSearchState((prev) => ({ ...prev, status: "idle" }));
    }
  }, [searchState.query, settings.selectedLanguage]);

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
      error("Something went wrong");
      setSearchState((prev) => ({ ...prev, status: "idle" }));
    }
  }, [searchState.pagination, searchState.query]);

  const [isSubmitting, setIsSubmitting] = useState(false);

  const onSuccess = useCallback((message: string) => {
    setTimeout(() => {
      success(message);
    }, 500);
  }, []);

  const onError = useCallback((message: string) => {
    setTimeout(() => {
      error(message);
    }, 500);
  }, []);

  const handleSubmitRequest = useCallback(async () => {
    if (isSubmitting) return;

    // Validation checks
    if (!user?.sessionId) {
      onError(DICT[settings.selectedLanguage].LOGIN_ERROR);
      setRequestState({ message: "", selected: undefined });
      return;
    }

    if (!requestState.selected) {
      onError(DICT[settings.selectedLanguage].SELECT_ERROR);
      setRequestState({ message: "", selected: undefined });
      return;
    }

    setIsSubmitting(true);

    try {
      // Store values before clearing state to avoid closure issues
      const submissionDTO: MusicRequestSubmissionDTO = {
        allmusic: requestState.selected.id,
        message: requestState.message,
        PHPSESSID: user.sessionId,
      };

      console.log({ submissionDTO });

      // Clear request state early to prevent UI lockup
      setRequestState({ message: "", selected: undefined });

      const result = await musicRequestService.submitRequest(submissionDTO);

      if (!result.success) {
        const errorMessage = MusicRequestMapper.getErrorMessage(
          result.error,
          result.detail,
          settings.selectedLanguage,
        );
        onError(errorMessage);
        return;
      }

      // Update search results to mark track as non-requestable
      setSearchState((prev) => ({
        ...prev,
        results: prev.results.map((item) =>
          item.id === submissionDTO.allmusic
            ? { ...item, requestable: false }
            : item,
        ),
      }));

      onSuccess(DICT[settings.selectedLanguage].REQUEST_SUCCESS);
    } catch (err) {
      console.error("Request submission error:", err);
      onError(DICT[settings.selectedLanguage].REQUEST_ERROR);
      setRequestState({ message: "", selected: undefined });
    } finally {
      setIsSubmitting(false);
    }
  }, [requestState, user?.sessionId, settings.selectedLanguage, isSubmitting]);

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
                        setRequestState({ selected: item, message: "" });
                      } else {
                        error("This song has already been requested");
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

        <PopUpRecado
          visible={!!requestState.selected}
          handleClose={() => {
            setRequestState({ message: "", selected: undefined });
          }}
          handleOk={handleSubmitRequest}
          handleChangeText={(message) =>
            setRequestState((prev) => ({ ...prev, message }))
          }
        />
      </SafeAreaView>
    </Background>
  );
}
