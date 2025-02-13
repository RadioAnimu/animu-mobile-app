import React, { useState, useCallback } from "react";
import {
  ActivityIndicator,
  FlatList,
  TextInput,
  TouchableOpacity,
  View,
  Text,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { NativeStackScreenProps } from "@react-navigation/native-stack";

// Components
import { Background } from "../../components/Background";
import { HeaderBar } from "../../components/HeaderBar";
import { Logo } from "../../components/Logo";
import { PopUpRecado } from "../../components/PopUpRecado";
import { RequestTrack } from "../../components/RequestTrack";

// Core
import {
  MusicRequest,
  MusicRequestPagination,
} from "../../core/domain/music-request";
import { musicRequestService } from "../../core/services/music-request.service";
import { useAuth } from "../../contexts/auth/AuthProvider";
import { useAlert } from "../../contexts/alert/AlertProvider";
import { useUserSettings } from "../../contexts/user/UserSettingsProvider";

// Styles and Config
import { styles } from "./styles";
import { DICT, IMGS } from "../../languages";
import { THEME } from "../../theme";
import { RootStackParamList } from "../../routes/app.routes";

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
        searchState.query
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
        searchState.pagination.nextPageQueryObject
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

  const handleSubmitRequest = useCallback(async () => {
    if (!user?.sessionId) {
      error(DICT[settings.selectedLanguage].LOGIN_ERROR);
      setRequestState({ message: "", selected: undefined }); // Clear state
      return;
    }

    if (!requestState.selected) {
      error(DICT[settings.selectedLanguage].SELECT_ERROR);
      setRequestState({ message: "", selected: undefined }); // Clear state
      return;
    }

    // Store selected in variable to avoid closure issues
    const selectedTrack = requestState.selected;

    try {
      const formData = new FormData();
      formData.append("allmusic", selectedTrack.id);
      formData.append("message", requestState.message);
      formData.append("PHPSESSID", user.sessionId);

      const isIos = Platform.OS === "ios" ? 1 : 0;
      const url =
        "https://www.animu.com.br/teste/pedirquatroMobile.php?ios=" + isIos;

      const response = await fetch(url, {
        method: "POST",
        credentials: "same-origin",
        body: formData,
      });

      const data = await response.text();

      // Clear request state first to prevent UI lockup
      setRequestState({ message: "", selected: undefined });

      if (data !== "") {
        switch (data) {
          case "strike and out":
            error(DICT[settings.selectedLanguage].ERROR_STRIKE_AND_OUT);
            break;
          default:
            error(`${DICT[settings.selectedLanguage].REQUEST_ERROR}${data}`);
            break;
        }
        return;
      }

      // Update results state after clearing request state
      setSearchState((prev) => ({
        ...prev,
        results: prev.results.map((item) =>
          item.id === selectedTrack.id ? { ...item, requestable: false } : item
        ),
      }));

      success(DICT[settings.selectedLanguage].REQUEST_SUCCESS);
    } catch (err) {
      console.error(err);
      error(DICT[settings.selectedLanguage].REQUEST_ERROR);
      // Clear state even on error
      setRequestState({ message: "", selected: undefined });
    }
  }, [requestState, user?.sessionId, settings.selectedLanguage]);

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
