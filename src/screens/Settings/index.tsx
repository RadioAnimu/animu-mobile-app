import { useEffect, useMemo, useRef, useState } from "react";
import MaterialIcons from "@react-native-vector-icons/material-icons/static";
import { NativeStackScreenProps } from "@react-navigation/native-stack";

import {
  Animated,
  Platform,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Background } from "../../components/Background";
import { Avatar } from "../../components/Avatar";
import { BackArrow } from "../../components/BackArrow";
import { HzSlider } from "../../components/HzSlider";
import { ProviderIcon } from "../../components/ProviderIcon";
import { SectionTitle } from "../../components/SectionTitle";
import { CoverQualitySheet } from "../../components/CoverQualitySheet";
import { LanguageSelectSheet } from "../../components/LanguageSelectSheet";
import { DICT, LANGS_KEY_VALUE_PAIRS } from "../../i18n";
import { RootStackParamList } from "../../routes/app.routes";
import { THEME } from "../../theme";
import {
  buildHzStops,
  nearestHzStop,
  useDisplayRefreshRate,
} from "../../hooks/useDisplayRefreshRate";
import { HEADER_HEIGHT, styles, SWITCH } from "./styles";
import { useUserSettings } from "../../contexts/user/UserSettingsProvider";
import { useAuth } from "../../contexts/auth/AuthProvider";
import { getUserName } from "../../core/domain/user";
import { providerLabel } from "../../constants/auth";
import { author } from "../../../package.json";
import * as Linking from "expo-linking";

/** Dev portfolio — the credits hyperlink target. */
const PORTFOLIO_URL = "https://rmotafreitas.dev";

/** Labels carry a trailing colon for back-compat — row UI renders clean. */
const cleanLabel = (label: string) => label.replace(/[:：]\s*$/, "");

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
  const { user, profile } = useAuth();
  const [languageSheetVisible, setLanguageSheetVisible] = useState(false);
  const [coverQualitySheetVisible, setCoverQualitySheetVisible] =
    useState(false);

  const dict = DICT[settings.selectedLanguage];
  const refreshRate = useDisplayRefreshRate();
  const hzStops = useMemo(() => buildHzStops(refreshRate), [refreshRate]);
  const hzValue = useMemo(
    () => nearestHzStop(settings.visualizerHz, hzStops),
    [settings.visualizerHz, hzStops],
  );
  const formatHz = (value: number): string => {
    if (value === 0) return `0 (${dict.SETTINGS_VISUALIZER_OFF})`;
    if (value === refreshRate) return `${value} (${dict.SETTINGS_VISUALIZER_VSYNC})`;
    return `${value}`;
  };

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
          <SectionTitle title={dict.SETTINGS_ACCOUNT_TITLE} icon="person" />
          <View style={styles.group}>
            <TouchableOpacity
              accessibilityRole="button"
              activeOpacity={0.7}
              onPress={() => {
                if (user) {
                  navigation.navigate("Account");
                } else {
                  navigation.navigate("Login");
                }
              }}
              style={[styles.row, styles.accountRow]}
            >
              {user ? (
                <>
                  <Avatar uri={user.avatarUrl} style={styles.accountAvatar} />
                  <View style={styles.accountInfo}>
                    <View style={styles.accountNameRow}>
                      <Text style={styles.accountName} numberOfLines={1}>
                        {getUserName(user)}
                      </Text>
                      {profile?.user.verified && (
                        <MaterialIcons
                          name="verified"
                          size={THEME.ICON.MD}
                          color={THEME.COLORS.BRAND}
                        />
                      )}
                    </View>
                    <View style={styles.accountService}>
                      <ProviderIcon
                        provider={profile?.session.loginProvider ?? "animu"}
                        size={14}
                        color={THEME.COLORS.TEXT_DIM}
                      />
                      <Text style={styles.accountCaption}>
                        {profile?.session.loginProvider
                          ? `${dict.ACCOUNT_CONNECTED_VIA} ${providerLabel(
                              profile.session.loginProvider,
                            )}`
                          : dict.ACCOUNT_TITLE}
                      </Text>
                    </View>
                  </View>
                  <MaterialIcons
                    name="chevron-right"
                    size={THEME.ICON.MD}
                    color={THEME.COLORS.TEXT_DIM}
                  />
                </>
              ) : (
                <>
                  <View style={styles.accountServiceIcon}>
                    <MaterialIcons
                      name="login"
                      size={THEME.ICON.MD}
                      color={THEME.COLORS.TEXT}
                    />
                  </View>
                  <Text style={styles.rowLabel}>
                    {dict.SETTINGS_ACCOUNT_SIGN_IN}
                  </Text>
                  <MaterialIcons
                    name="chevron-right"
                    size={THEME.ICON.MD}
                    color={THEME.COLORS.TEXT_DIM}
                  />
                </>
              )}
            </TouchableOpacity>
          </View>

          <SectionTitle title={dict.SETTINGS_SAVE_DATA_TITLE} icon="cloud-off" />
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

          <SectionTitle title={dict.SETTINGS_OSCILLOSCOPE_TITLE} icon="graphic-eq" />
          <View style={styles.group}>
            {Platform.OS === "ios" ? (
              <View style={styles.row}>
                <Text style={styles.rowLabel}>
                  {cleanLabel(dict.SETTINGS_VISUALIZER_SWITCH)}
                </Text>
                <Text style={styles.visualizerValue}>
                  {dict.SETTINGS_VISUALIZER_COMING_SOON}
                </Text>
              </View>
            ) : (
              <>
                <View style={styles.row}>
                  <Text style={styles.rowLabel}>
                    {cleanLabel(dict.SETTINGS_VISUALIZER_HZ_LABEL)}
                  </Text>
                  <Text style={styles.visualizerValue}>
                    {formatHz(hzValue)}
                  </Text>
                </View>
                <HzSlider
                  stops={hzStops}
                  value={hzValue}
                  formatLabel={formatHz}
                  onChange={(visualizerHz) => {
                    updateSettings({ visualizerHz });
                  }}
                />
              </>
            )}
          </View>

          <SectionTitle title={dict.SETTINGS_GENERAL_TITLE} icon="language" />
          <View style={styles.group}>
            <ValueRow
              label={cleanLabel(dict.SETTINGS_LANGUAGE_SELECT_TITLE)}
              value={LANGS_KEY_VALUE_PAIRS[settings.selectedLanguage]}
              onPress={() => {
                setLanguageSheetVisible(true);
              }}
            />
          </View>

          <SectionTitle title={dict.SETTINGS_MEMORY_TITLE} icon="memory" />
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
                void Linking.openURL(PORTFOLIO_URL).catch((error) =>
                  console.warn("[Links] openURL failed:", error),
                );
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
