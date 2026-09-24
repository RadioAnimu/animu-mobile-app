import { Fragment, useCallback, useMemo } from "react";
import type { ComponentProps } from "react";
import { DrawerScreenProps } from "@react-navigation/drawer";
import { ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Background } from "@/components/Background";
import { SectionTitle } from "@/components/SectionTitle";
import { Select } from "@/components/Select";
import { ScreenHeader } from "@/components/ScreenHeader";
import { CoverStorageCard } from "@/components/CoverStorageCard";
import { useAlert } from "@/contexts/alert/AlertProvider";
import { useUserSettings } from "@/contexts/user/UserSettingsProvider";
import { useDeviceStorage } from "@/hooks/useDeviceStorage";
import { useDict } from "@/hooks/useDict";
import { maxSelectableLimitBytes } from "@/core/services/device-storage.service";
import type { CoverCacheCategory } from "@/core/services/cover-cache-registry.service";
import {
  CATEGORY_ORDER,
  PARTITION_WEIGHTS,
  resolvePartitionCaps,
  type CoverCachePartitions,
} from "@/core/services/cover-cache-partitions";
import { RootStackParamList } from "@/routes/app.routes";
import { coverCategoryLabel } from "@/constants/covers";
import { formatBytes, interpolate, MB, percentOf } from "@/utils/format";
import { Divider, SettingsRow } from "@/screens/Settings/rows";
import { styles } from "@/screens/Storage/styles";

type Props = DrawerScreenProps<RootStackParamList, "Storage">;
type IconName = NonNullable<ComponentProps<typeof Select>["icon"]>;

/** Fixed-byte tiers, uncapped first (the default). */
const LIMIT_TIERS = [0, 50 * MB, 100 * MB, 250 * MB, 500 * MB, 1024 * MB];

/** Per-partition tiers for the Advanced editor. */
const PARTITION_TIERS = [10, 25, 50, 100, 200, 500].map((mb) => mb * MB);

const PARTITION_ICONS: Record<CoverCacheCategory, IconName> = {
  live: "graphic-eq",
  requested: "cloud-download",
  played: "history",
  search: "search",
};

/** Seeds the Advanced editor with the weighted automatic split, whole MB. */
function defaultPartitions(limitBytes: number): CoverCachePartitions {
  const seeded: CoverCachePartitions = {};
  for (const key of CATEGORY_ORDER) {
    seeded[key] = Math.max(
      MB,
      Math.round((limitBytes * PARTITION_WEIGHTS[key]) / MB) * MB,
    );
  }
  return seeded;
}

/**
 * Storage: the plain-language cache summary (what is cached, why, one
 * confirm-gated "free up space" action), the cache ceiling, and the
 * Advanced area that splits the ceiling between the four partitions —
 * the split the trim engine already enforces, now visible and editable.
 */
export function Storage({ navigation }: Props) {
  const { settings, updateSettings } = useUserSettings();
  const { capacity } = useDeviceStorage();
  const dict = useDict();
  const { toast } = useAlert();

  const showFreedToast = useCallback(
    (freedBytes: number) => {
      toast(
        interpolate(dict.STORAGE_FREED, { freed: formatBytes(freedBytes) }),
      );
    },
    [toast, dict],
  );

  const limitBytes = settings.coverCacheLimitBytes;
  const partitions = settings.coverCachePartitionBytes;
  const customOn = partitions != null;
  const limitUnlimited = limitBytes === 0;
  const advancedDisabled = !settings.cacheEnabled || limitUnlimited;

  const caps = useMemo(
    () => resolvePartitionCaps(limitBytes, partitions),
    [limitBytes, partitions],
  );

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

  const partitionRows = useMemo(
    () =>
      CATEGORY_ORDER.map((key) => {
        const customBytes = partitions?.[key];
        const options = [
          { key: "auto", label: dict.STORAGE_PARTITION_AUTO },
          ...PARTITION_TIERS.filter((bytes) => bytes <= limitBytes).map(
            (bytes) => ({ key: String(bytes), label: formatBytes(bytes) }),
          ),
          ...(customBytes != null && !PARTITION_TIERS.includes(customBytes)
            ? [{ key: String(customBytes), label: formatBytes(customBytes) }]
            : []),
        ];
        return {
          key,
          options,
          value: customBytes == null ? "auto" : String(customBytes),
        };
      }),
    [limitBytes, partitions, dict],
  );

  const setPartition = (key: CoverCacheCategory, value: string) => {
    const next: CoverCachePartitions = { ...(partitions ?? {}) };
    if (value === "auto") delete next[key];
    else next[key] = Number(value);
    // Nothing customized anymore = the weighted split — drop the overrides.
    updateSettings({
      coverCachePartitionBytes: Object.keys(next).length > 0 ? next : null,
    });
  };

  return (
    <Background>
      <SafeAreaView style={styles.container} edges={["left", "right", "bottom"]}>
        <ScreenHeader
          title={dict.STORAGE_TITLE}
          onBack={() => navigation.goBack()}
        />

        <ScrollView contentContainerStyle={styles.appContainer}>
          <CoverStorageCard onFreed={showFreedToast} />

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

          <SectionTitle
            title={dict.STORAGE_ADVANCED_TITLE}
            icon="tune"
          />
          <View style={styles.group}>
            <SettingsRow
              icon="tune"
              label={dict.STORAGE_PARTITION_CUSTOM_LABEL}
              description={dict.STORAGE_PARTITION_CUSTOM_DESC}
              value={customOn}
              disabled={advancedDisabled}
              onToggle={() =>
                updateSettings({
                  coverCachePartitionBytes: customOn
                    ? null
                    : defaultPartitions(limitBytes),
                })
              }
            />
            {customOn &&
              partitionRows.map(({ key, options, value }) => (
                <Fragment key={key}>
                  <Divider />
                  <Select
                    label={coverCategoryLabel(dict, key)}
                    icon={PARTITION_ICONS[key]}
                    description={
                      caps
                        ? interpolate(dict.STORAGE_PARTITION_CAP_DESC, {
                            cap: formatBytes(caps[key]),
                          })
                        : undefined
                    }
                    options={options}
                    value={value}
                    disabled={advancedDisabled}
                    onChange={(next) => setPartition(key, next)}
                  />
                </Fragment>
              ))}
          </View>
          {limitUnlimited && settings.cacheEnabled && (
            <Text style={styles.deviceCaption}>
              {dict.STORAGE_PARTITION_NEEDS_LIMIT}
            </Text>
          )}

          {capacity.totalBytes > 0 && (
            <View style={styles.deviceBarTrack}>
              <View
                style={[
                  styles.deviceBarFill,
                  {
                    width: `${percentOf(
                      capacity.usedBytes,
                      capacity.totalBytes,
                    )}%`,
                  },
                ]}
              />
            </View>
          )}
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
