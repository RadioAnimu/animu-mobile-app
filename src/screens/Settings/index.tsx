import { useMemo, useState, useSyncExternalStore } from "react";
import { NativeStackScreenProps } from "@react-navigation/native-stack";

import {
  ActivityIndicator,
  Alert,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Background } from "../../components/Background";
import { BackArrow } from "../../components/BackArrow";
import { SectionTitle } from "../../components/SectionTitle";
import { Select, type SelectOption } from "../../components/Select";
import { useCoverStorageSnapshot } from "../../hooks/useCoverStorage";
import { formatBytes } from "../../utils/format";
import { DICT, LANGS_KEY_VALUE_PAIRS } from "../../i18n";
import { RootStackParamList } from "../../routes/app.routes";
import { THEME } from "../../theme";
import { HEADER_HEIGHT, styles } from "./styles";
import { useUserSettings } from "../../contexts/user/UserSettingsProvider";
import { coverDiskStorage } from "../../core/services/cover-disk-storage.service";
import { useAuth } from "../../contexts/auth/AuthProvider";
import {
  AccountRow,
  cleanLabel,
  Divider,
  SettingsRow,
  ValueRow,
} from "./rows";
import {
  COVER_QUALITY_SAMPLES,
  DEFAULT_COVER_SOURCE,
  type CoverQualityKey,
} from "../../constants/artwork-quality";
import { author } from "../../../package.json";
import * as Linking from "expo-linking";

/** Dev portfolio — the credits hyperlink target. */
const PORTFOLIO_URL = "https://rmotafreitas.dev";

type Props = NativeStackScreenProps<RootStackParamList, "Settings">;

const QUALITY_LABEL_KEY = {
  high: "SETTINGS_QUALITY_LIVE_LABEL_HIGH",
  medium: "SETTINGS_QUALITY_LIVE_LABEL_MEDIUM",
  low: "SETTINGS_QUALITY_LIVE_LABEL_LOW",
} as const;

export function Settings({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const { settings, updateSettings, resetSettings } = useUserSettings();
  const { user, profile } = useAuth();
  const [resetting, setResetting] = useState(false);
  // Wipe-in-progress from the storage service — disables the cache toggle
  // (both tap paths: the clean button and the automatic cache-off wipe).
  const cacheWiping = useSyncExternalStore(
    (listener) => coverDiskStorage.subscribe(listener),
    () => coverDiskStorage.isClearing,
  );
  const { snapshot, measuring } = useCoverStorageSnapshot();

  const dict = DICT[settings.selectedLanguage];

  const qualityOptions = useMemo<SelectOption<CoverQualityKey | "off">[]>(
    () => [
      ...COVER_QUALITY_SAMPLES.map((sample) => ({
        key: sample.key,
        label: dict[QUALITY_LABEL_KEY[sample.key as CoverQualityKey]],
        meta: `~${formatBytes(sample.sizeBytes)}`,
        badge:
          sample.key === "high"
            ? dict.SETTINGS_QUALITY_RECOMMENDED
            : undefined,
        thumb: sample.source,
      })),
      {
        key: "off" as const,
        label: dict.SETTINGS_QUALITY_LIVE_LABEL_OFF,
        meta: dict.SETTINGS_QUALITY_LIVE_OFF_HINT,
        thumb: DEFAULT_COVER_SOURCE,
      },
    ],
    [dict],
  );

  const languageOptions = useMemo<
    SelectOption<keyof typeof LANGS_KEY_VALUE_PAIRS>[]
  >(
    () =>
      (
        Object.keys(LANGS_KEY_VALUE_PAIRS) as (keyof typeof LANGS_KEY_VALUE_PAIRS)[]
      ).map((key) => ({ key, label: LANGS_KEY_VALUE_PAIRS[key] })),
    [],
  );

  const runReset = async () => {
    setResetting(true);
    try {
      await resetSettings();
    } finally {
      setResetting(false);
    }
  };

  const confirmReset = () => {
    Alert.alert(
      dict.SETTINGS_RESET_CONFIRM_TITLE,
      dict.SETTINGS_RESET_CONFIRM_MSG,
      [
        { text: dict.ACCOUNT_CANCEL, style: "cancel" },
        {
          text: dict.SETTINGS_RESET_CONFIRM,
          style: "destructive",
          onPress: () => {
            void runReset();
          },
        },
      ],
    );
  };

  return (
    <Background>
      <SafeAreaView style={styles.container} edges={["left", "right", "bottom"]}>
        {/* Header matches Account exactly: back arrow on the left, title
            centered between the two 44px slots, no hairline, no absolute
            positioning. */}
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
          <Text style={styles.headerTitle}>{dict.SETTINGS_TITLE}</Text>
          <View style={styles.headerButton} />
        </View>
        <ScrollView contentContainerStyle={styles.appContainer}>
          {/* Account first — the one thing tied to *who* is listening. */}
          <SectionTitle title={dict.SETTINGS_ACCOUNT_TITLE} icon="person" />
          <View style={styles.group}>
            <AccountRow
              user={user}
              profile={profile}
              dict={dict}
              onPress={() => {
                if (user) {
                  navigation.navigate("Account");
                } else {
                  navigation.navigate("Login");
                }
              }}
            />
          </View>

          <SectionTitle title={dict.SETTINGS_SAVE_DATA_TITLE} icon="image" />
          <View style={styles.group}>
            <Select
              label={dict.SETTINGS_QUALITY_ROW}
              description={dict.SETTINGS_QUALITY_ROW_DESC}
              options={qualityOptions}
              value={settings.liveQualityCover}
              onChange={(key) => updateSettings({ liveQualityCover: key })}
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

          <SectionTitle
            title={dict.SETTINGS_OSCILLOSCOPE_TITLE}
            icon="graphic-eq"
          />
          <View style={styles.group}>
            <SettingsRow
              label={cleanLabel(dict.SETTINGS_VISUALIZER_SWITCH)}
              description={dict.SETTINGS_VISUALIZER_DESC}
              value={settings.visualizerHz > 0}
              onToggle={() => {
                updateSettings({
                  visualizerHz: settings.visualizerHz > 0 ? 0 : 1,
                });
              }}
            />
          </View>

          <SectionTitle title={dict.SETTINGS_BATTERY_TITLE} icon="wifi" />
          <View style={styles.group}>
            <SettingsRow
              label={cleanLabel(dict.SETTINGS_LIVE_UPDATES_SWITCH)}
              description={dict.SETTINGS_LIVE_UPDATES_DESC}
              value={settings.liveUpdatesInBackground}
              onToggle={() => {
                updateSettings({
                  liveUpdatesInBackground: !settings.liveUpdatesInBackground,
                });
              }}
            />
          </View>

          <SectionTitle title={dict.SETTINGS_GENERAL_TITLE} icon="language" />
          <View style={styles.group}>
            <Select
              label={cleanLabel(dict.SETTINGS_LANGUAGE_SELECT_TITLE)}
              options={languageOptions}
              value={settings.selectedLanguage}
              onChange={(key) => updateSettings({ selectedLanguage: key })}
            />
          </View>

          <SectionTitle title={dict.SETTINGS_MEMORY_TITLE} icon="sd-storage" />
          <View style={styles.group}>
            <SettingsRow
              label={cleanLabel(dict.SETTINGS_MEMORY_CLEAR_CACHE_SWITCH)}
              description={dict.SETTINGS_MEMORY_CLEAR_CACHE_DESC}
              value={settings.cacheEnabled}
              disabled={cacheWiping}
              onToggle={() => {
                updateSettings({
                  cacheEnabled: !settings.cacheEnabled,
                });
              }}
            />
            <Divider />
            {/* Plain-language promise ("Free up space") with the live total as
                proof — the technical breakdown lives one tap into Storage. */}
            <ValueRow
              label={dict.SETTINGS_STORAGE_FREE_UP}
              value={
                measuring ? "· · ·" : formatBytes(snapshot?.totalBytes ?? 0)
              }
              onPress={() => {
                navigation.navigate("Storage");
              }}
            />
          </View>

          {/* Reset is its own quiet action at the very bottom — not a fake
              "About" section (there's nothing else About-ish to group it
              with). The version footer follows. */}
          <View style={styles.group}>
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityState={{ disabled: resetting || undefined }}
              activeOpacity={0.7}
              onPress={confirmReset}
              disabled={resetting}
              style={[styles.resetRow, resetting && styles.resetRowDisabled]}
            >
              <Text style={styles.resetLabel}>{dict.SETTINGS_RESET_ROW}</Text>
              {resetting && (
                <ActivityIndicator size="small" color={THEME.COLORS.ERROR} />
              )}
            </TouchableOpacity>
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
                {dict.VERSION_TEXT}{" "}
                <Text style={styles.footerAuthor}>@{author}</Text>
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </SafeAreaView>
    </Background>
  );
}
