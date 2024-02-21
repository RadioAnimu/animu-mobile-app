import React, { useContext, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

import { API, MusicRequestProps } from "../../api";
import { Background } from "../../components/Background";
import { styles } from "./styles";

import { SafeAreaView } from "react-native-safe-area-context";
import { HeaderBar } from "../../components/HeaderBar";
import { Logo } from "../../components/Logo";

import { Ionicons } from "@expo/vector-icons";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Text } from "react-native";
import { PopUpRecado } from "../../components/PopUpRecado";
import { PopUpStatus } from "../../components/PopUpStatus";
import { RequestTrack } from "../../components/RequestTrack";
import { ErrorContext } from "../../contexts/error.context";
import { PlayerContext } from "../../contexts/player.context";
import { SuccessContext } from "../../contexts/success.context";
import { UserContext } from "../../contexts/user.context";
import { RootStackParamList } from "../../routes/app.routes";
import { THEME } from "../../theme";
import { CONFIG } from "../../utils/player.config";
import { DICT, IMGS, selectedLanguage } from "../../languages";
import { UserSettingsContext } from "../../contexts/user.settings.context";

type Props = NativeStackScreenProps<RootStackParamList, "FazerPedido">;
type Status = "idle" | "loading";

export function FazerPedido({ route, navigation }: Props) {
  const playerProvider = useContext(PlayerContext);
  const userContext = useContext(UserContext);
  const { setErrorMessage } = useContext(ErrorContext);
  const { setSuccessMessage } = useContext(SuccessContext);
  const [recado, setRecado] = useState("");

  if (playerProvider?.player) {
    const player = playerProvider.player;

    const [searchText, setSearchText] = useState("");
    const [results, setResults] = useState<MusicRequestProps[]>([]);
    const [meta, setMeta] = useState(
      {} as {
        limit: number;
        next: string;
        offset: number;
        previous: string;
        total_count: number;
        total_pages: number;
      }
    );
    const [status, setStatus] = useState<Status>("idle");

    const handleSearch = async () => {
      setResults([]);
      if (searchText) {
        setStatus("loading");
        const queryURL: string = `${API.FAZER_PEDIDO_URL}${searchText}`;
        const res = await fetch(queryURL);
        const { meta, objects }: any = await res.json();
        let cover: string = "";
        const aux: MusicRequestProps[] = objects.map((obj: any) => {
          cover = obj.image_large || obj.image_medium || obj.image_tiny || "";
          return {
            track: {
              rawtitle: obj.title,
              song: obj.title.split("|")[0],
              anime: obj.title.split("|")[1],
              artist: obj.author,
              artworks: {
                cover:
                  cover === ""
                    ? CONFIG.DEFAULT_COVER
                    : `${API.WEB_URL}${cover}`,
              },
              id: obj.id,
            },
            requestable: obj.timestrike === undefined,
          };
        });
        setResults(aux);
        meta.total_pages = Math.ceil(meta.total_count / meta.limit);
        setMeta(meta);
        setStatus("idle");
      }
    };

    const handleLoadMore = async (next: string) => {
      setStatus("loading");
      const queryURL: string = `${API.FAZER_PEDIDO_URL.split("?")[0]}?${
        next.split("?")[1]
      }`;
      const res = await fetch(queryURL);
      const { meta, objects }: any = await res.json();
      let cover: string = "";
      const aux: MusicRequestProps[] = objects.map((obj: any) => {
        cover = obj.image_large || obj.image_medium || obj.image_tiny || "";
        return {
          track: {
            rawtitle: obj.title,
            song: obj.title.split("|")[0],
            anime: obj.title.split("|")[1],
            artist: obj.author,
            artworks: {
              cover:
                cover === "" ? CONFIG.DEFAULT_COVER : `${API.WEB_URL}${cover}`,
            },
            id: obj.id,
          },
          requestable: obj.timestrike === undefined,
        };
      });
      setResults([...results, ...aux]);
      meta.total_pages = Math.ceil(meta.total_count / meta.limit);
      setMeta(meta);
      setStatus("idle");
    };

    const handleOk = async () => {
      const formData = new FormData();
      if (!userContext?.user) {
        setErrorMessage(DICT[userSettings.selectedLanguage].LOGIN_ERROR);
        return;
      }
      if (selected === null) {
        setErrorMessage(DICT[userSettings.selectedLanguage].SELECT_ERROR);
        return;
      }
      const allmusic: string = selected.track.id.toString();
      const message: string = recado;
      const { PHPSESSID } = userContext.user;
      formData.append("allmusic", allmusic);
      formData.append("message", message);
      formData.append("PHPSESSID", PHPSESSID);

      const url = "https://www.animu.com.br/teste/pedirquatroMobile.php";
      const response = await fetch(url, {
        method: "POST",
        credentials: "same-origin",
        body: formData,
      });
      const data = await response.text();
      if (data !== "") {
        setErrorMessage(
          `${DICT[userSettings.selectedLanguage].REQUEST_ERROR}${data}`
        );
        return;
      }
      setSelected(null);
      setSuccessMessage(DICT[userSettings.selectedLanguage].REQUEST_SUCCESS);
      setRecado("");
      setResults((old) =>
        old.map((item) => {
          if (item.track.id === selected.track.id) {
            return {
              ...item,
              requestable: false,
            };
          }
          return item;
        })
      );
    };

    const [selected, setSelected] = useState<MusicRequestProps | null>(null);

    const { userSettings } = useContext(UserSettingsContext);

    return (
      <Background>
        <SafeAreaView style={styles.container}>
          <HeaderBar player={player} navigation={navigation} />
          <View style={styles.appContainer}>
            <View
              style={{
                marginVertical: 15,
              }}
            >
              <Logo
                img={IMGS[userSettings.selectedLanguage].MAKE_REQUEST}
                size={127}
              />
            </View>
            <View style={styles.inputContainer}>
              <TextInput
                style={styles.input}
                placeholder={
                  DICT[userSettings.selectedLanguage].REQUEST_SEARCH_PLACEHOLDER
                }
                placeholderTextColor="#fff"
                onChangeText={(text) => setSearchText(text)}
                onSubmitEditing={handleSearch}
              />
              <TouchableOpacity
                onPress={handleSearch}
                style={styles.searchIcon}
              >
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
              {status === "loading" && results.length === 0 && (
                <ActivityIndicator color={THEME.COLORS.WHITE_TEXT} />
              )}
              <FlatList
                data={results}
                keyExtractor={(item) => item.track.id.toString()}
                initialNumToRender={results.length}
                extraData={results}
                contentContainerStyle={{
                  gap: 10,
                }}
                renderItem={({ item }) => {
                  return (
                    <>
                      {item.track.id === results[results.length - 1].track.id &&
                      meta.next !== null ? (
                        status === "loading" ? (
                          <ActivityIndicator color={THEME.COLORS.WHITE_TEXT} />
                        ) : (
                          <TouchableOpacity
                            onPress={() => {
                              handleLoadMore(meta.next);
                            }}
                            style={styles.loadMoreBtn}
                          >
                            <Text style={styles.loadMoreText}>
                              Carregar mais
                            </Text>
                          </TouchableOpacity>
                        )
                      ) : (
                        <RequestTrack
                          onTrackRequest={() => {
                            if (item.requestable) {
                              setSelected(item);
                            } else {
                              setErrorMessage(
                                "Música já foi pedida anteriormente"
                              );
                            }
                          }}
                          musicToBeRequested={item}
                        />
                      )}
                    </>
                  );
                }}
              />
            </View>
          </View>
          <PopUpStatus />
          <PopUpRecado
            visible={selected !== null}
            handleClose={() => setSelected(null)}
            handleOk={handleOk}
            handleChangeText={(text) => setRecado(text)}
          />
        </SafeAreaView>
      </Background>
    );
  }
}
