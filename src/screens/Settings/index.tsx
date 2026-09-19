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
import { SafeAreaView } from "react-native-safe-area-context";
import { Background } from "@/components/Background";
import { SectionTitle } from "@/components/SectionTitle";
import { Select, type SelectOption } from "@/components/Select";
import { ScreenHeader } from "@/components/ScreenHeader";
import { useCoverStorageSnapshot } from "@/hooks/useCoverStorage";
import { formatBytes } from "@/utils/format";
import { LANGS_KEY_VALUE_PAIRS } from "@/i18n";
import { useDict } from "@/hooks/useDict";
import { RootStackParamList } from "@/routes/app.routes";
import { THEME } from "@/theme";
import { styles } from "@/screens/Settings/styles";
import { useUserSettings } from "@/contexts/user/UserSettingsProvider";
import { coverDiskStorage } from "@/core/services/cover-disk-storage.service";
import { useAuth } from "@/contexts/auth/AuthProvider";
import { useOta } from "@/contexts/ota/OtaProvider";
import { useAlert } from "@/contexts/alert/AlertProvider";
import { isOtaSupported } from "@/core/ota";
import {
  AccountRow,
  cleanLabel,
  Divider,
  InfoRow,
  SettingsRow,
  ValueRow,
} from "@/screens/Settings/rows";
import {
  COVER_QUALITY_SAMPLES,
  DEFAULT_COVER_SOURCE,
  type CoverQualityKey,
} from "@/constants/artwork-quality";
import { author } from "@app/package.json";
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
  const { settings, updateSettings, resetSettings } = useUserSettings();
  const { user, profile } = useAuth();
  const { status: otaStatus, checkNow, applyNow } = useOta();
  const { toast } = useAlert();
  const otaSupported = isOtaSupported();
  const [resetting, setResetting] = useState(false);
  // Wipe-in-progress from the storage service — disables the cache toggle
  // (both tap paths: the clean button and the automatic cache-off wipe).
  const cacheWiping = useSyncExternalStore(
    (listener) => coverDiskStorage.subscribe(listener),
    () => coverDiskStorage.isClearing,
  );
  const { snapshot, measuring } = useCoverStorageSnapshot();

  const dict = useDict();

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

  const otaValue = () => {
    switch (otaStatus) {
      case "checking":
        return dict.SETTINGS_UPDATES_CHECKING;
      case "downloading":
        return dict.SETTINGS_UPDATES_DOWNLOADING;
      case "ready":
        return dict.SETTINGS_UPDATES_READY;
      case "available":
        return dict.SETTINGS_UPDATES_ROW;
      case "up-to-date":
        return dict.SETTINGS_UPDATES_UP_TO_DATE;
      case "error":
        return dict.SETTINGS_UPDATES_ERROR;
      default:
        return dict.SETTINGS_UPDATES_ROW;
    }
  };

  const confirmOtaRestart = () => {
    Alert.alert(
      dict.SETTINGS_UPDATES_RESTART_TITLE,
      dict.SETTINGS_UPDATES_RESTART_MSG,
      [
        { text: dict.ACCOUNT_CANCEL, style: "cancel" },
        {
          text: dict.SETTINGS_UPDATES_RESTART_CONFIRM,
          onPress: () => {
            applyNow();
          },
        },
      ],
    );
  };

  const checkUpdates = async () => {
    const outcome = await checkNow();
    if (outcome === "up-to-date") {
      toast(dict.SETTINGS_UPDATES_UP_TO_DATE);
    } else if (outcome === "downloaded") {
      toast(dict.SETTINGS_UPDATES_DOWNLOADED);
    } else if (outcome === "ready") {
      confirmOtaRestart();
    } else if (outcome === "error") {
      toast(dict.SETTINGS_UPDATES_ERROR);
    }
  };

  return (
    <Background>
      <SafeAreaView style={styles.container} edges={["left", "right", "bottom"]}>
        <ScreenHeader
          title={dict.SETTINGS_TITLE}
          onBack={() => navigation.goBack()}
        />
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

          <View style={styles.group}>
            <InfoRow
              label={dict.SETTINGS_ASSISTANT_TITLE}
              description={dict.SETTINGS_ASSISTANT_HINT}
              icon="mic"
            />
          </View>

          {otaSupported && (
            <>
              <SectionTitle
                title={dict.SETTINGS_UPDATES_TITLE}
                icon="system-update"
              />
              <View style={styles.group}>
                <ValueRow
                  label={dict.SETTINGS_UPDATES_ROW}
                  description={dict.SETTINGS_UPDATES_DESC}
                  value={otaValue()}
                  onPress={() => {
                    void checkUpdates();
                  }}
                />
              </View>
            </>
          )}

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
