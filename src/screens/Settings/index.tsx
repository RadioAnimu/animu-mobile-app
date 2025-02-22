import { FontAwesome5 } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useContext } from "react";
import { Image, ScrollView, Text, TouchableOpacity, View } from "react-native";
import { SelectList } from "react-native-dropdown-select-list";
import { SafeAreaView } from "react-native-safe-area-context";
import Svg, { Path, Rect, SvgProps } from "react-native-svg";
import Toggle, { ToggleProps } from "react-native-toggle-input";
import { Background } from "../../components/Background";
import { LoginComponent } from "../../components/CustomDrawer";
import { DICT, LANGS_KEY_VALUE_PAIRS } from "../../languages";
import { RootStackParamList } from "../../routes/app.routes";
import { THEME } from "../../theme";
import { styles } from "./styles";
import { DiscordProfile } from "../../components/DiscordProfile";
import { useUserSettings } from "../../contexts/user/UserSettingsProvider";
import { useAuth } from "../../contexts/auth/AuthProvider";

export const BackArrow = (props: SvgProps) => (
  <Svg width="21" height="19" viewBox="0 0 21 19" fill="none">
    <Rect x="6" y="6" width="15" height="7" rx="2" fill="#ffffff" />
    <Path
      d="M-4.15258e-07 9.5L11.25 17.7272L11.25 1.27276L-4.15258e-07 9.5Z"
      fill="#ffffff"
    />
  </Svg>
);

interface TitleSectionProps {
  title: string;
}

export function TitleSection({ title }: TitleSectionProps) {
  return (
    <View style={styles.titleSection}>
      <Text style={styles.titleText}>{title}</Text>
    </View>
  );
}

interface LabelProps {
  label: string;
}

export function Label({ label }: LabelProps) {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        width: "100%",
        marginTop: 10,
      }}
    >
      <Text
        style={{
          color: THEME.COLORS.WHITE_TEXT,
          fontFamily: THEME.FONT_FAMILY.REGULAR,
          fontSize: THEME.FONT_SIZE.MD,
        }}
      >
        {label}
      </Text>
    </View>
  );
}

interface QualityButtonProps {
  quality: string;
  selected: boolean;
  onPress: () => void;
  position: "left" | "center" | "right";
}

export function QualityButton({
  quality,
  selected,
  onPress,
  position,
}: QualityButtonProps) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={{
        backgroundColor: selected
          ? THEME.COLORS.PRIMARY
          : THEME.COLORS.BACKGROUND_800,
        padding: 10,
        flex: 1,
        marginTop: 10,
        borderTopRightRadius: position === "right" ? 10 : 0,
        borderBottomRightRadius: position === "right" ? 10 : 0,
        borderTopLeftRadius: position === "left" ? 10 : 0,
        borderBottomLeftRadius: position === "left" ? 10 : 0,
      }}
    >
      <Text
        style={{
          color: selected ? THEME.COLORS.WHITE_TEXT : THEME.COLORS.WHITE_TEXT,
          fontFamily: THEME.FONT_FAMILY.REGULAR,
          fontSize: THEME.FONT_SIZE.MENU_ITEM,
          textAlign: "center",
        }}
      >
        {quality}
      </Text>
    </TouchableOpacity>
  );
}

type Props = NativeStackScreenProps<RootStackParamList, "Settings">;

function Splitter() {
  return (
    <View
      style={{
        width: "100%",
        height: 2,
        backgroundColor: THEME.COLORS.WHITE_TEXT,
        marginTop: 20,
      }}
    ></View>
  );
}

interface ToggleSectionProps extends ToggleProps {
  label: string;
}

function ToggleSection({ label, ...props }: ToggleSectionProps) {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        width: "100%",
        marginTop: 20,
      }}
    >
      <Text
        style={{
          color: THEME.COLORS.WHITE_TEXT,
          fontFamily: THEME.FONT_FAMILY.REGULAR,
          fontSize: THEME.FONT_SIZE.MD,
          flex: 1,
        }}
      >
        {label}{" "}
      </Text>
      {/* @ts-ignore => bcs the lib is kinda cringe*/}
      <Toggle
        size={THEME.FONT_SIZE.MD}
        color="#fff"
        toggle={props.toggle}
        setToggle={props.setToggle}
      />
    </View>
  );
}

export function Settings({ route, navigation }: Props) {
  const data = Object.keys(LANGS_KEY_VALUE_PAIRS).map((key: string) => ({
    key,
    value: LANGS_KEY_VALUE_PAIRS[
      key as keyof typeof LANGS_KEY_VALUE_PAIRS
    ] as string,
  }));

  const { settings, updateSettings } = useUserSettings();

  const key = settings.selectedLanguage || "PT";

  const keyAndValue = {
    key,
    value: LANGS_KEY_VALUE_PAIRS[key],
  };

  const { user, logout } = useAuth();

  return (
    <Background>
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => {
              navigation.goBack();
            }}
          >
            <BackArrow />
          </TouchableOpacity>
          <Text style={styles.settingsText}>
            {DICT[settings.selectedLanguage].SETTINGS_TITLE}
          </Text>
          <View
            style={{
              width: 21,
              height: 19,
            }}
          ></View>
        </View>
        <ScrollView contentContainerStyle={styles.appContainer}>
          <View>
            <TitleSection
              title={DICT[settings.selectedLanguage].SETTINGS_ACCOUNT_TITLE}
            />
            {user?.sessionId ? (
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <DiscordProfile user={user} />
                <TouchableOpacity
                  onPress={async () => {
                    await logout();
                  }}
                  style={{
                    marginLeft: "auto",
                  }}
                >
                  <FontAwesome5
                    name="sign-out-alt"
                    size={THEME.FONT_SIZE.MENU_ITEM}
                    color={THEME.COLORS.WHITE_TEXT}
                  />
                </TouchableOpacity>
              </View>
            ) : (
              <LoginComponent />
            )}
          </View>
          <Splitter />
          <TitleSection
            title={DICT[settings.selectedLanguage].SETTINGS_SAVE_DATA_TITLE}
          />
          <Label
            label={DICT[settings.selectedLanguage].SETTINGS_QUALITY_LIVE_LABEL}
          />
          <View style={styles.qualitySectionButtons}>
            <QualityButton
              quality={
                DICT[settings.selectedLanguage].SETTINGS_QUALITY_LIVE_LABEL_HIGH
              }
              selected={settings.liveQualityCover === "high"}
              onPress={() => {
                updateSettings({
                  liveQualityCover: "high",
                });
              }}
              position="left"
            />
            <QualityButton
              quality={
                DICT[settings.selectedLanguage]
                  .SETTINGS_QUALITY_LIVE_LABEL_MEDIUM
              }
              selected={settings.liveQualityCover === "medium"}
              onPress={() => {
                updateSettings({
                  liveQualityCover: "medium",
                });
              }}
              position="center"
            />
            <QualityButton
              quality={
                DICT[settings.selectedLanguage].SETTINGS_QUALITY_LIVE_LABEL_LOW
              }
              selected={settings.liveQualityCover === "low"}
              onPress={() => {
                updateSettings({
                  liveQualityCover: "low",
                });
                updateSettings({
                  liveQualityCover: "low",
                });
              }}
              position="right"
            />
          </View>
          <ToggleSection
            label={
              DICT[settings.selectedLanguage].SETTINGS_COVER_LIVE_LABEL_SWITCH
            }
            toggle={settings.liveQualityCover !== "off"}
            setToggle={() => {
              updateSettings({
                liveQualityCover:
                  settings.liveQualityCover === "off" ? "low" : "off",
              });
            }}
          />
          <ToggleSection
            size={THEME.FONT_SIZE.MD}
            color="#fff"
            label={
              DICT[settings.selectedLanguage]
                .SETTINGS_COVER_LAST_REQUESTED_SWITCH
            }
            toggle={settings.lastRequestedCovers}
            setToggle={() => {
              updateSettings({
                lastRequestedCovers: !settings.lastRequestedCovers,
              });
            }}
          />
          <ToggleSection
            label={
              DICT[settings.selectedLanguage].SETTINGS_COVER_LAST_PLAYED_SWITCH
            }
            size={THEME.FONT_SIZE.MD}
            color="#fff"
            toggle={settings.lastPlayedCovers}
            setToggle={() => {
              updateSettings({
                lastPlayedCovers: !settings.lastPlayedCovers,
              });
            }}
          />
          <ToggleSection
            label={
              DICT[settings.selectedLanguage].SETTINGS_COVER_REQUESTED_SWITCH
            }
            size={THEME.FONT_SIZE.MD}
            color="#fff"
            toggle={settings.coversInRequestSearch}
            setToggle={() => {
              updateSettings({
                coversInRequestSearch: !settings.coversInRequestSearch,
              });
            }}
          />
          <Splitter />
          <TitleSection
            title={
              DICT[settings.selectedLanguage].SETTINGS_LANGUAGE_SELECT_TITLE
            }
          />
          <SelectList
            setSelected={(val: string) => {
              const key = Object.keys(LANGS_KEY_VALUE_PAIRS).find(
                (key) =>
                  LANGS_KEY_VALUE_PAIRS[
                    key as keyof typeof LANGS_KEY_VALUE_PAIRS
                  ] === val
              );
              if (key) {
                updateSettings({
                  selectedLanguage: key as keyof typeof LANGS_KEY_VALUE_PAIRS,
                });
                //! NEED TO REFRESH PLAYER
              }
            }}
            data={data}
            save="value"
            boxStyles={{
              backgroundColor: "transparent",
              borderColor: THEME.COLORS.WHITE_TEXT,
              borderRadius: 10,
              marginTop: 10,
            }}
            inputStyles={{
              color: THEME.COLORS.WHITE_TEXT,
              fontFamily: THEME.FONT_FAMILY.REGULAR,
              fontSize: THEME.FONT_SIZE.MD,
            }}
            dropdownTextStyles={{
              color: THEME.COLORS.WHITE_TEXT,
              fontFamily: THEME.FONT_FAMILY.REGULAR,
              fontSize: THEME.FONT_SIZE.MD,
            }}
            dropdownStyles={{
              borderColor: THEME.COLORS.WHITE_TEXT,
            }}
            arrowicon={
              <FontAwesome5
                name="angle-down"
                size={20}
                color={THEME.COLORS.WHITE_TEXT}
              />
            }
            search={false}
            placeholder={
              DICT[settings.selectedLanguage]
                .SETTINGS_LANGUAGE_SELECT_PLACEHOLDER
            }
            defaultOption={keyAndValue}
          />
          <Splitter />
          <TitleSection
            title={DICT[settings.selectedLanguage].SETTINGS_MEMORY_TITLE}
          />
          <ToggleSection
            label={
              DICT[settings.selectedLanguage].SETTINGS_MEMORY_CLEAR_CACHE_SWITCH
            }
            size={THEME.FONT_SIZE.MD}
            color="#fff"
            toggle={settings.cacheEnabled}
            setToggle={() => {
              updateSettings({
                cacheEnabled: !settings.cacheEnabled,
              });
            }}
          />
        </ScrollView>
      </SafeAreaView>
    </Background>
  );
}
