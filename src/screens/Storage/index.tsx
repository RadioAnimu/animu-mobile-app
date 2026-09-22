import { useMemo } from "react";
import { DrawerScreenProps } from "@react-navigation/drawer";
import { ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Background } from "@/components/Background";
import { SectionTitle } from "@/components/SectionTitle";
import { Select } from "@/components/Select";
import { ScreenHeader } from "@/components/ScreenHeader";
import { CoverStorageCard } from "@/components/CoverStorageCard";
import { useUserSettings } from "@/contexts/user/UserSettingsProvider";
import { useDeviceStorage } from "@/hooks/useDeviceStorage";
import { useDict } from "@/hooks/useDict";
import { maxSelectableLimitBytes } from "@/core/services/device-storage.service";
import { RootStackParamList } from "@/routes/app.routes";
import { formatBytes, interpolate } from "@/utils/format";
import { styles } from "@/screens/Storage/styles";

type Props = DrawerScreenProps<RootStackParamList, "Storage">;

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
  const { settings, updateSettings } = useUserSettings();
  const { capacity } = useDeviceStorage();

  const dict = useDict();

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
        <ScreenHeader
          title={dict.STORAGE_TITLE}
          onBack={() => navigation.goBack()}
        />

        <ScrollView contentContainerStyle={styles.appContainer}>
          <CoverStorageCard />

          <SectionTitle
            title={dict.SETTINGS_STORAGE_LIMIT_TITLE}
            icon="sd-storage"
          />
          <View style={styles.group}>
            <Select
              label={dict.STORAGE_LIMIT_ROW}
              icon="sd-storage"
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
