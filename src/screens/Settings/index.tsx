import { useEffect, useRef, useState } from "react";import { MaterialIcons } from "@expo/vector-icons";
import { NativeStackScreenProps } from "@react-navigation/native-stack";

import {
  Animated,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Path, Rect, SvgProps } from "react-native-svg";
import { Background } from "../../components/Background";
import { LoginComponent } from "../../components/CustomDrawer";
import { CoverQualitySheet } from "../../components/CoverQualitySheet";
import { LanguageSelectSheet } from "../../components/LanguageSelectSheet";
import { DICT, LANGS_KEY_VALUE_PAIRS } from "../../i18n";
import { RootStackParamList } from "../../routes/app.routes";
import { THEME } from "../../theme";
import { HEADER_HEIGHT, styles, SWITCH } from "./styles";
import { DiscordProfile } from "../../components/DiscordProfile";
import { useUserSettings } from "../../contexts/user/UserSettingsProvider";
import { useAuth } from "../../contexts/auth/AuthProvider";

export const BackArrow = (props: SvgProps) => (
  <Svg width="21" height="19" viewBox="0 0 21 19" fill="none">
    <Rect x="6" y="6" width="15" height="7" rx="2" fill={THEME.COLORS.TEXT} />
    <Path
      d="M-4.15258e-07 9.5L11.25 17.7272L11.25 1.27276L-4.15258e-07 9.5Z"
      fill={THEME.COLORS.TEXT}
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

function Splitter() {
  return <View style={styles.splitter} />;
}

interface SwitchProps {
  value: boolean;
}

function Switch({ value }: SwitchProps) {
  const position = useRef(new Animated.Value(value ? 1 : 0)).current;

  useEffect(() => {
    Animated.spring(position, {
      toValue: value ? 1 : 0,
      speed: 30,
      bounciness: 4,
      useNativeDriver: true,
    }).start();
  }, [value, position]);

  const translateX = position.interpolate({
    inputRange: [0, 1],
    outputRange: [
      0,
      SWITCH.TRACK_WIDTH - SWITCH.THUMB - SWITCH.PADDING * 2,
    ],
  });

  return (
    <View
      style={[
        styles.switchTrack,
        {
          backgroundColor: value
            ? THEME.COLORS.BRAND
            : THEME.COLORS.SWITCH_OFF,
        },
      ]}
    >
      <Animated.View
        style={[styles.switchThumb, { transform: [{ translateX }] }]}
      />
    </View>
  );
}

interface SettingsRowProps {
  label: string;
  value: boolean;
  onToggle: () => void;
  isLast?: boolean;
}

function SettingsRow({ label, value, onToggle, isLast }: SettingsRowProps) {
  return (
    <TouchableOpacity
      accessibilityRole="switch"
      accessibilityState={{ checked: value }}
      activeOpacity={0.7}
      onPress={onToggle}
      style={[styles.row, isLast && styles.rowLast]}
    >
      <Text style={styles.rowLabel}>{label}</Text>
      <Switch value={value} />
    </TouchableOpacity>
  );
}

type Props = NativeStackScreenProps<RootStackParamList, "Settings">;

const COVER_QUALITY_LABEL_KEY = {
  high: "SETTINGS_QUALITY_LIVE_LABEL_HIGH",
  medium: "SETTINGS_QUALITY_LIVE_LABEL_MEDIUM",
  low: "SETTINGS_QUALITY_LIVE_LABEL_LOW",
} as const;

export function Settings({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const { settings, updateSettings } = useUserSettings();
  const { user, logout } = useAuth();
  const [languageSheetVisible, setLanguageSheetVisible] = useState(false);
  const [coverQualitySheetVisible, setCoverQualitySheetVisible] =
    useState(false);

  const toggleLiveCovers = () => {
    updateSettings({
      liveQualityCover:
        settings.liveQualityCover === "off" ? "low" : "off",
    });
  };

  return (
    <Background>
      <SafeAreaView style={styles.container} edges={["left", "right", "bottom"]}>
        <View
          style={[
            styles.header,
            {
              height: HEADER_HEIGHT + insets.top,
              paddingTop: insets.top,
            },
          ]}
        >
          <TouchableOpacity
            accessibilityRole="button"
            onPress={() => {
              navigation.goBack();
            }}
            style={styles.headerButton}
          >
            <BackArrow />
          </TouchableOpacity>
          <Text style={styles.settingsText}>
            {DICT[settings.selectedLanguage].SETTINGS_TITLE}
          </Text>
          <View style={styles.headerButton} />
        </View>
        <ScrollView contentContainerStyle={styles.appContainer}>
          <TitleSection
            title={DICT[settings.selectedLanguage].SETTINGS_ACCOUNT_TITLE}
          />
          <View style={styles.card}>
            {user?.sessionId ? (
              <View style={styles.cardRow}>
                <View style={styles.profile}>
                  <DiscordProfile user={user} />
                </View>
                <TouchableOpacity
                  accessibilityRole="button"
                  accessibilityLabel="logout"
                  onPress={async () => {
                    await logout();
                  }}
                  style={styles.iconButton}
                >
                  <MaterialIcons
                    name="logout"
                    size={THEME.ICON.MD}
                    color={THEME.COLORS.TEXT}
                  />
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.cardRow}>
                <LoginComponent />
              </View>
            )}
          </View>

          <Splitter />
          <TitleSection
            title={DICT[settings.selectedLanguage].SETTINGS_SAVE_DATA_TITLE}
          />
          <TouchableOpacity
            accessibilityRole="button"
            activeOpacity={0.7}
            onPress={() => {
              setCoverQualitySheetVisible(true);
            }}
            style={styles.row}
          >
            <Text style={styles.rowLabel}>
              {DICT[settings.selectedLanguage].SETTINGS_QUALITY_LIVE_LABEL}
            </Text>
            <View style={styles.rowValue}>
              <Text style={styles.rowValueText}>
                {settings.liveQualityCover === "off"
                  ? "—"
                  : DICT[settings.selectedLanguage][
                      COVER_QUALITY_LABEL_KEY[settings.liveQualityCover]
                    ]}
              </Text>
              <MaterialIcons
                name="chevron-right"
                size={THEME.ICON.MD}
                color={THEME.COLORS.TEXT_DIM}
              />
            </View>
          </TouchableOpacity>
          <View style={styles.rowsGroup}>
            <SettingsRow
              label={
                DICT[settings.selectedLanguage]
                  .SETTINGS_COVER_LIVE_LABEL_SWITCH
              }
              value={settings.liveQualityCover !== "off"}
              onToggle={toggleLiveCovers}
            />
            <SettingsRow
              label={
                DICT[settings.selectedLanguage]
                  .SETTINGS_COVER_LAST_REQUESTED_SWITCH
              }
              value={settings.lastRequestedCovers}
              onToggle={() => {
                updateSettings({
                  lastRequestedCovers: !settings.lastRequestedCovers,
                });
              }}
            />
            <SettingsRow
              label={
                DICT[settings.selectedLanguage]
                  .SETTINGS_COVER_LAST_PLAYED_SWITCH
              }
              value={settings.lastPlayedCovers}
              onToggle={() => {
                updateSettings({
                  lastPlayedCovers: !settings.lastPlayedCovers,
                });
              }}
            />
            <SettingsRow
              isLast
              label={
                DICT[settings.selectedLanguage]
                  .SETTINGS_COVER_REQUESTED_SWITCH
              }
              value={settings.coversInRequestSearch}
              onToggle={() => {
                updateSettings({
                  coversInRequestSearch: !settings.coversInRequestSearch,
                });
              }}
            />
          </View>

          <Splitter />
          <TouchableOpacity
            accessibilityRole="button"
            activeOpacity={0.7}
            onPress={() => {
              setLanguageSheetVisible(true);
            }}
            style={[styles.row, styles.rowLast]}
          >
            <Text style={styles.rowLabel}>
              {DICT[settings.selectedLanguage].SETTINGS_LANGUAGE_SELECT_TITLE}
            </Text>
            <View style={styles.rowValue}>
              <Text style={styles.rowValueText}>
                {LANGS_KEY_VALUE_PAIRS[settings.selectedLanguage]}
              </Text>
              <MaterialIcons
                name="chevron-right"
                size={THEME.ICON.MD}
                color={THEME.COLORS.TEXT_DIM}
              />
            </View>
          </TouchableOpacity>
          <LanguageSelectSheet
            visible={languageSheetVisible}
            onClose={() => {
              setLanguageSheetVisible(false);
            }}
          />
          <CoverQualitySheet
            visible={coverQualitySheetVisible}
            onClose={() => {
              setCoverQualitySheetVisible(false);
            }}
          />

          <Splitter />
          <TitleSection
            title={DICT[settings.selectedLanguage].SETTINGS_MEMORY_TITLE}
          />
          <View style={styles.rowsGroup}>
            <SettingsRow
              isLast
              label={
                DICT[settings.selectedLanguage]
                  .SETTINGS_MEMORY_CLEAR_CACHE_SWITCH
              }
              value={settings.cacheEnabled}
              onToggle={() => {
                updateSettings({
                  cacheEnabled: !settings.cacheEnabled,
                });
              }}
            />
          </View>
        </ScrollView>
      </SafeAreaView>
    </Background>
  );
}
