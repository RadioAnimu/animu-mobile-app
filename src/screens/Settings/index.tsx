import { useEffect, useRef, useState } from "react";
import type { ComponentProps } from "react";
import { MaterialIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
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
import { CoverQualitySheet } from "../../components/CoverQualitySheet";
import { LanguageSelectSheet } from "../../components/LanguageSelectSheet";
import { DICT, LANGS_KEY_VALUE_PAIRS } from "../../i18n";
import { RootStackParamList } from "../../routes/app.routes";
import { THEME } from "../../theme";
import { HEADER_HEIGHT, SECTION_ICON_SIZE, styles, SWITCH } from "./styles";
import { useUserSettings } from "../../contexts/user/UserSettingsProvider";
import { useAuth } from "../../contexts/auth/AuthProvider";
import { author } from "../../../package.json";
import * as Linking from "expo-linking";

/** Dev portfolio — the credits hyperlink target. */
const PORTFOLIO_URL = "https://rmotafreitas.dev";

export const BackArrow = (props: SvgProps) => (
  <Svg width="21" height="19" viewBox="0 0 21 19" fill="none">
    <Rect x="6" y="6" width="15" height="7" rx="2" fill={THEME.COLORS.TEXT} />
    <Path
      d="M-4.15258e-07 9.5L11.25 17.7272L11.25 1.27276L-4.15258e-07 9.5Z"
      fill={THEME.COLORS.TEXT}
    />
  </Svg>
);

/** Labels carry a trailing colon for back-compat — row UI renders clean. */
const cleanLabel = (label: string) => label.replace(/[:：]\s*$/, "");

type MaterialIconName = ComponentProps<typeof MaterialIcons>["name"];

interface TitleSectionProps {
  title: string;
  icon: MaterialIconName;
}

function TitleSection({ title, icon }: TitleSectionProps) {
  return (
    <View style={styles.section}>
      <View style={styles.iconBox}>
        <MaterialIcons
          name={icon}
          size={SECTION_ICON_SIZE}
          color={THEME.COLORS.TEXT_SOFT}
        />
      </View>
      <Text style={styles.sectionText}>{title.toUpperCase()}</Text>
    </View>
  );
}

function Divider() {
  return <View style={styles.divider} />;
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
}

function SettingsRow({ label, value, onToggle }: SettingsRowProps) {
  return (
    <TouchableOpacity
      accessibilityRole="switch"
      accessibilityState={{ checked: value }}
      activeOpacity={0.7}
      onPress={onToggle}
      style={styles.row}
    >
      <Text style={styles.rowLabel}>{label}</Text>
      <Switch value={value} />
    </TouchableOpacity>
  );
}

interface ValueRowProps {
  label: string;
  value: string;
  onPress: () => void;
}

function ValueRow({ label, value, onPress }: ValueRowProps) {
  return (
    <TouchableOpacity
      accessibilityRole="button"
      activeOpacity={0.7}
      onPress={onPress}
      style={styles.row}
    >
      <Text style={styles.rowLabel}>{label}</Text>
      <View style={styles.rowValue}>
        <Text style={styles.rowValueText}>{value}</Text>
        <MaterialIcons
          name="chevron-right"
          size={THEME.ICON.MD}
          color={THEME.COLORS.TEXT_DIM}
        />
      </View>
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
  const { user, logout, login } = useAuth();
  const [languageSheetVisible, setLanguageSheetVisible] = useState(false);
  const [coverQualitySheetVisible, setCoverQualitySheetVisible] =
    useState(false);

  const dict = DICT[settings.selectedLanguage];

  const qualityLabel =
    settings.liveQualityCover === "off"
      ? dict.SETTINGS_QUALITY_LIVE_LABEL_OFF
      : dict[COVER_QUALITY_LABEL_KEY[settings.liveQualityCover]];

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
          <Text style={styles.settingsText}>{dict.SETTINGS_TITLE}</Text>
          <View style={styles.headerButton} />
        </View>
        <ScrollView contentContainerStyle={styles.appContainer}>
          <TitleSection title={dict.SETTINGS_ACCOUNT_TITLE} icon="person" />
          {user?.sessionId ? (
            <View style={styles.group}>
              <View style={[styles.row, styles.accountRow]}>
                <Image
                  source={{ uri: user.avatarUrl }}
                  style={styles.accountAvatar}
                />
                <View style={styles.accountInfo}>
                  <Text style={styles.accountName}>
                    {user.nickname || user.username}
                  </Text>
                  <View style={styles.accountService}>
                    <View style={styles.accountServiceIcon}>
                      <MaterialIcons
                        name="discord"
                        size={THEME.ICON.MD}
                        color={THEME.COLORS.TEXT_DIM}
                      />
                    </View>
                    <Text style={styles.accountCaption}>
                      {dict.SETTINGS_ACCOUNT_CONNECTED}
                    </Text>
                  </View>
                </View>
              </View>
              <Divider />
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel="logout"
                activeOpacity={0.7}
                onPress={async () => {
                  await logout();
                }}
                style={styles.row}
              >
                <Text style={[styles.rowLabel, styles.rowLabelDanger]}>
                  {dict.SETTINGS_ACCOUNT_LOGOUT}
                </Text>
                <MaterialIcons
                  name="logout"
                  size={THEME.ICON.MD}
                  color={THEME.COLORS.ERROR}
                />
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.group}>
              <TouchableOpacity
                accessibilityRole="button"
                activeOpacity={0.7}
                onPress={login}
                style={styles.row}
              >
                <View style={styles.accountServiceIcon}>
                  <MaterialIcons
                    name="discord"
                    size={THEME.ICON.MD}
                    color={THEME.COLORS.TEXT}
                  />
                </View>
                <Text style={styles.rowLabel}>
                  {dict.LOGIN_WORD} Discord
                </Text>
                <MaterialIcons
                  name="chevron-right"
                  size={THEME.ICON.MD}
                  color={THEME.COLORS.TEXT_DIM}
                />
              </TouchableOpacity>
            </View>
          )}

          <TitleSection title={dict.SETTINGS_SAVE_DATA_TITLE} icon="cloud-off" />
          <View style={styles.group}>
            <ValueRow
              label={cleanLabel(dict.SETTINGS_QUALITY_LIVE_LABEL)}
              value={qualityLabel}
              onPress={() => {
                setCoverQualitySheetVisible(true);
              }}
            />
            <Divider />
            <SettingsRow
              label={cleanLabel(dict.SETTINGS_COVER_LAST_REQUESTED_SWITCH)}
              value={settings.lastRequestedCovers}
              onToggle={() => {
                updateSettings({
                  lastRequestedCovers: !settings.lastRequestedCovers,
                });
              }}
            />
            <Divider />
            <SettingsRow
              label={cleanLabel(dict.SETTINGS_COVER_LAST_PLAYED_SWITCH)}
              value={settings.lastPlayedCovers}
              onToggle={() => {
                updateSettings({
                  lastPlayedCovers: !settings.lastPlayedCovers,
                });
              }}
            />
            <Divider />
            <SettingsRow
              label={cleanLabel(dict.SETTINGS_COVER_REQUESTED_SWITCH)}
              value={settings.coversInRequestSearch}
              onToggle={() => {
                updateSettings({
                  coversInRequestSearch: !settings.coversInRequestSearch,
                });
              }}
            />
          </View>

          <TitleSection title={dict.SETTINGS_GENERAL_TITLE} icon="language" />
          <View style={styles.group}>
            <ValueRow
              label={cleanLabel(dict.SETTINGS_LANGUAGE_SELECT_TITLE)}
              value={LANGS_KEY_VALUE_PAIRS[settings.selectedLanguage]}
              onPress={() => {
                setLanguageSheetVisible(true);
              }}
            />
          </View>

          <TitleSection title={dict.SETTINGS_MEMORY_TITLE} icon="memory" />
          <View style={styles.group}>
            <SettingsRow
              label={cleanLabel(dict.SETTINGS_MEMORY_CLEAR_CACHE_SWITCH)}
              value={settings.cacheEnabled}
              onToggle={() => {
                updateSettings({
                  cacheEnabled: !settings.cacheEnabled,
                });
              }}
            />
          </View>

          <View style={styles.footer}>
            <TouchableOpacity
              accessibilityRole="link"
              activeOpacity={0.7}
              onPress={() => {
                void Linking.openURL(PORTFOLIO_URL);
              }}
            >
              <Text style={styles.footerText}>
                {dict.VERSION_TEXT} <Text style={styles.footerAuthor}>@{author}</Text>
              </Text>
            </TouchableOpacity>
          </View>

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
        </ScrollView>
      </SafeAreaView>
    </Background>
  );
}
