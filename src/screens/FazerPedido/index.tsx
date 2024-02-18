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
import Harukinha from "../../assets/pedidos-harukinha-two.png";
import { HeaderBar } from "../../components/HeaderBar";
import { Logo } from "../../components/Logo";

import { Ionicons } from "@expo/vector-icons";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Text } from "react-native";
import { PopUpRecado } from "../../components/PopUpRecado";
import { RequestTrack } from "../../components/RequestTrack";
import { PlayerContext } from "../../contexts/player.context";
import { RootStackParamList } from "../../routes/app.routes";
import { THEME } from "../../theme";
import { CONFIG } from "../../utils/player.config";

type Props = NativeStackScreenProps<RootStackParamList, "FazerPedido">;
type Status = "idle" | "loading";

export function FazerPedido({ route, navigation }: Props) {
  const playerProvider = useContext(PlayerContext);

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

    const [selected, setSelected] = useState<MusicRequestProps | null>(null);

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
              <Logo img={Harukinha} size={127} />
            </View>
            <View style={styles.inputContainer}>
              <TextInput
                style={styles.input}
                placeholder="Digite aqui para pesquisar"
                placeholderTextColor="#fff"
                onChangeText={(text) => setSearchText(text)}
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
          <PopUpRecado
            visible={selected !== null}
            handleClose={() => setSelected(null)}
            handleOk={() => {}}
          />
        </SafeAreaView>
      </Background>
    );
  }
}
