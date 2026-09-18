import { useMemo } from "react";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { ScrollView, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

import { Background } from "../../components/Background";
import { BackArrow } from "../../components/BackArrow";
import { SectionTitle } from "../../components/SectionTitle";
import { Select } from "../../components/Select";
import { CoverStorageCard } from "../../components/CoverStorageCard";
import { useUserSettings } from "../../contexts/user/UserSettingsProvider";
import { useDeviceStorage } from "../../hooks/useDeviceStorage";
import { maxSelectableLimitBytes } from "../../core/services/device-storage.service";
import { DICT } from "../../i18n";
import { RootStackParamList } from "../../routes/app.routes";
import { formatBytes, interpolate } from "../../utils/format";
import { HEADER_HEIGHT, styles } from "./styles";

type Props = NativeStackScreenProps<RootStackParamList, "Storage">;

const MB = 1024 * 1024;

/** Fixed-byte tiers, uncapped first (the default). */
const LIMIT_TIERS = [0, 50 * MB, 100 * MB, 250 * MB, 500 * MB, 1024 * MB];

/**
 * Storage: the plain-language cache summary (what is cached, why, one
 * confirm-gated "free up space" action) plus a single inline dropdown for
 * the ceiling. The per-section fine-tuning is gone — one number is all a
 * listener should have to reason about.
 */
export function Storage({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const { settings, updateSettings } = useUserSettings();
  const { capacity } = useDeviceStorage();

  const dict = DICT[settings.selectedLanguage];

  const limitOptions = useMemo(() => {
    const maxSelectable = maxSelectableLimitBytes(capacity.availableBytes);
    return LIMIT_TIERS.filter(
      (bytes) =>
        bytes === 0 ||
        bytes <= maxSelectable ||
        bytes === settings.coverCacheLimitBytes,
    ).map((bytes) => ({
      key: String(bytes),
      label:
        bytes === 0
          ? dict.SETTINGS_STORAGE_LIMIT_UNLIMITED
          : formatBytes(bytes),
    }));
  }, [
    capacity.availableBytes,
    dict.SETTINGS_STORAGE_LIMIT_UNLIMITED,
    settings.coverCacheLimitBytes,
  ]);

  return (
    <Background>
      <SafeAreaView style={styles.container} edges={["left", "right", "bottom"]}>
        <View
          style={[
            styles.header,
            { height: HEADER_HEIGHT + insets.top, paddingTop: insets.top },
          ]}
        >
          <TouchableOpacity
            accessibilityRole="button"
            onPress={() => navigation.goBack()}
            style={styles.headerButton}
          >
            <BackArrow />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{dict.STORAGE_TITLE}</Text>
          <View style={styles.headerButton} />
        </View>

        <ScrollView contentContainerStyle={styles.appContainer}>
          <CoverStorageCard />

          <SectionTitle
            title={dict.SETTINGS_STORAGE_LIMIT_TITLE}
            icon="sd-storage"
          />
          <View style={styles.group}>
            <Select
              label={dict.STORAGE_LIMIT_ROW}
              options={limitOptions}
              value={String(settings.coverCacheLimitBytes)}
              disabled={!settings.cacheEnabled}
              onChange={(key) =>
                updateSettings({ coverCacheLimitBytes: Number(key) })
              }
            />
          </View>
          <Text style={styles.deviceCaption}>
            {interpolate(dict.STORAGE_DEVICE_FREE, {
              free: formatBytes(capacity.availableBytes),
              total: formatBytes(capacity.totalBytes),
            })}
          </Text>
        </ScrollView>
      </SafeAreaView>
    </Background>
  );
}
