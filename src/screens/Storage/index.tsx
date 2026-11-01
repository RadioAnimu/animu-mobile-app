import { Fragment, useEffect, useRef, useMemo } from "react";
import type { ComponentProps } from "react";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { SectionTitle } from "@/components/SectionTitle";
import { Select } from "@/components/Select";
import { ScreenHeader } from "@/components/ScreenHeader";
import { CoverStorageCard } from "@/components/CoverStorageCard";
import { useUserSettings } from "@/contexts/user/UserSettingsProvider";
import { useDeviceStorage } from "@/hooks/useDeviceStorage";
import { useCoverStorageSnapshot } from "@/hooks/useCoverStorage";
import { useCoverDiskClearing, useFreedCoverToast } from "@/hooks/useCoverDisk";
import { useDict } from "@/hooks/useDict";
import { useSaveSettings } from "@/hooks/useSaveSettings";
import { useScrollEndPadding } from "@/hooks/useScrollEndPadding";
import { maxSelectableLimitBytes } from "@/core/services/disk-capacity";
import type { CoverCacheCategory } from "@/core/services/cover-cache-registry.service";
import {
  CATEGORY_ORDER,
  defaultPartitions,
  resolvePartitionCaps,
  type CoverCachePartitions,
} from "@/core/services/cover-cache-partitions";
import type { RootStackParamList } from "@/routes/app.routes";
import { coverCategoryLabel } from "@/constants/covers";
import { formatBytes, interpolate, MB, percentOf } from "@/utils/format";
import { RowDivider } from "@/components/ListRow";
import { SettingsRow } from "@/screens/Settings/rows";
import { styles } from "@/screens/Storage/styles";

type Props = NativeStackScreenProps<RootStackParamList, "Storage">;
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

/**
 * Storage: the plain-language cache summary (what is cached, why, one
 * confirm-gated "free up space" action), the cache ceiling, and the
 * Advanced area that splits the ceiling between the four partitions —
 * the split the trim engine already enforces, now visible and editable.
 */
export function Storage({ navigation }: Readonly<Props>) {
  const { settings } = useUserSettings();
  const save = useSaveSettings();
  const { capacity, refresh } = useDeviceStorage();
  const dict = useDict();
  const endPadding = useScrollEndPadding();

  // Wipe-in-progress flag — also the signal that device space just moved
  // (the clean button's wipe and the cache-off wipe both pass through it).
  const cacheWiping = useCoverDiskClearing();

  // The device bar and the selectable limit tiers must reflect free space
  // as soon as storage work settles — a wipe, or the trim the provider
  // runs behind a limit/partition change — not wait for the next
  // navigation. Both settle BEFORE the settings render with new values,
  // so re-reading on those transitions is enough. The initial values are
  // the mount state — the focus read already owns them.
  const wipedOnce = useRef(false);
  useEffect(() => {
    // First run is the mount state; a Wipe completing flips the flag and
    // every later "no wipe running" transition re-reads the device numbers.
    if (!cacheWiping) {
      if (wipedOnce.current) refresh();
      wipedOnce.current = true;
    }
  }, [cacheWiping, refresh]);

  const lastSettingsKey = useRef<string | null>(null);
  useEffect(() => {
    const key = `${settings.coverCacheLimitBytes}|${
      settings.coverCachePartitionBytes
        ? JSON.stringify(settings.coverCachePartitionBytes)
        : ""
    }|${settings.cacheEnabled}`;
    if (lastSettingsKey.current === key) return;
    const isFirst = lastSettingsKey.current === null;
    lastSettingsKey.current = key;
    if (isFirst) return;
    refresh();
  }, [
    refresh,
    settings.coverCacheLimitBytes,
    settings.coverCachePartitionBytes,
    settings.cacheEnabled,
  ]);

  const showFreedToast = useFreedCoverToast();

  // One measurement pass feeds the card above AND the device bar below —
  // the card's cached-covers share rides the same snapshot.
  const { snapshot, measuring, measure } = useCoverStorageSnapshot({
    onFreed: showFreedToast,
  });
  const cachedBytes = snapshot?.totalBytes ?? 0;
  const cachedPct = percentOf(cachedBytes, capacity.totalBytes);

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
          : formatBytes(bytes, dict.NUMBER_DECIMAL_SEPARATOR),
    }));
  }, [
    capacity.availableBytes,
    dict.NUMBER_DECIMAL_SEPARATOR,
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
            (bytes) => ({ key: String(bytes), label: formatBytes(bytes, dict.NUMBER_DECIMAL_SEPARATOR) }),
          ),
          ...(customBytes != null && !PARTITION_TIERS.includes(customBytes)
            ? [{ key: String(customBytes), label: formatBytes(customBytes, dict.NUMBER_DECIMAL_SEPARATOR) }]
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
    const next: CoverCachePartitions = { ...partitions };
    if (value === "auto") delete next[key];
    else next[key] = Number(value);
    // Nothing customized anymore = the weighted split — drop the overrides.
    void save({
      coverCachePartitionBytes: Object.keys(next).length > 0 ? next : null,
    });
  };

  return (
    <SafeAreaView style={styles.container} edges={[]}>
      <ScreenHeader
        title={dict.STORAGE_TITLE}
        onBack={() => navigation.goBack()}
      />

      <ScrollView
        contentContainerStyle={[
          styles.appContainer,
          { paddingBottom: endPadding },
        ]}
      >
        <CoverStorageCard
          snapshot={snapshot}
          measuring={measuring}
          measure={measure}
        />

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
              save({ coverCacheLimitBytes: Number(key) })
            }
          />
        </View>

        <SectionTitle title={dict.STORAGE_ADVANCED_TITLE} icon="tune" />
        <View style={styles.group}>
          <SettingsRow
            icon="tune"
            label={dict.STORAGE_PARTITION_CUSTOM_LABEL}
            description={dict.STORAGE_PARTITION_CUSTOM_DESC}
            value={customOn}
            disabled={advancedDisabled}
            onToggle={() =>
              void save({
                coverCachePartitionBytes: customOn
                  ? null
                  : defaultPartitions(limitBytes),
              })
            }
          />
          {customOn &&
            partitionRows.map(({ key, options, value }) => (
              <Fragment key={key}>
                <RowDivider />
                <Select
                  label={coverCategoryLabel(dict, key)}
                  icon={PARTITION_ICONS[key]}
                  description={
                    caps
                      ? interpolate(dict.STORAGE_PARTITION_CAP_DESC, {
                          cap: formatBytes(caps[key], dict.NUMBER_DECIMAL_SEPARATOR),
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
          <View
            style={styles.deviceBarTrack}
            accessibilityRole="progressbar"
            accessibilityValue={{
              min: 0,
              max: capacity.totalBytes,
              now: capacity.usedBytes,
            }}
          >
            {/* Used space, split: everything else in the dim fill, the
                  cached-covers share highlighted in the app's purple at the
                  end of the used span. */}
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
            >
              <View
                style={[
                  styles.deviceBarOther,
                  { flex: Math.max(capacity.usedBytes - cachedBytes, 0) },
                ]}
              />
              {cachedBytes > 0 && (
                <View style={[styles.deviceBarCached, { flex: cachedBytes }]} />
              )}
            </View>
          </View>
        )}
        <Text style={styles.deviceCaption}>
          {interpolate(dict.STORAGE_DEVICE_FREE, {
            free: formatBytes(capacity.availableBytes, dict.NUMBER_DECIMAL_SEPARATOR),
            total: formatBytes(capacity.totalBytes, dict.NUMBER_DECIMAL_SEPARATOR),
          })}
        </Text>
        {capacity.totalBytes > 0 && (
          <Text style={[styles.deviceCaption, styles.deviceCachedCaption]}>
            {measuring && !snapshot
              ? "· · ·"
              : interpolate(dict.STORAGE_DEVICE_CACHED, {
                  cached: formatBytes(cachedBytes, dict.NUMBER_DECIMAL_SEPARATOR),
                  pct: cachedPct,
                })}
          </Text>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
