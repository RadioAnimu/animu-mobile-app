import { useSyncExternalStore } from "react";
import MaterialIcons from "@react-native-vector-icons/material-icons/static";
import { Text, TouchableOpacity, View } from "react-native";

import { DICT } from "../../i18n";
import { useUserSettings } from "../../contexts/user/UserSettingsProvider";
import {
  coverDiskStorage,
  type CoverStorageKey,
  type CoverStorageSnapshot,
  type CoverStorageSlice,
} from "../../core/services/cover-disk-storage.service";
import { formatBytes } from "../CoverQualitySheet/qualities";
import { THEME } from "../../theme";
import { useCoverStorageSnapshot } from "./use-cover-storage";
import { styles } from "./styles";

/**
 * One color per cached-cover category — visually distinct on the deep
 * purple surface while staying inside the app's palette family.
 */
const CATEGORY_COLORS: Record<CoverStorageKey, string> = {
  live: THEME.COLORS.BRAND,
  requested: "#C77DFF",
  played: "#4FC3F7",
  search: "#FFCF56",
};

function LegendRow({ slice }: { slice: CoverStorageSlice }) {
  const { settings } = useUserSettings();
  const dict = DICT[settings.selectedLanguage];
  return (
    <View style={styles.legendRow} accessibilityRole="text">
      <View
        style={[styles.dot, { backgroundColor: CATEGORY_COLORS[slice.key] }]}
      />
      <Text style={styles.legendLabel}>{legendLabel(dict, slice.key)}</Text>
      <Text style={styles.legendMeta}>
        {slice.count > 0
          ? `${formatBytes(slice.bytes)} · ${slice.count}`
          : formatBytes(slice.bytes)}
      </Text>
    </View>
  );
}

/** Only the metadata labels this card reads — structural, so any language dict fits. */
interface StorageDicts {
  SETTINGS_STORAGE_LIVE: string;
  SETTINGS_STORAGE_REQUESTED: string;
  SETTINGS_STORAGE_PLAYED: string;
  SETTINGS_STORAGE_SEARCH: string;
}

function legendLabel(dict: StorageDicts, key: CoverStorageKey): string {
  switch (key) {
    case "live":
      return dict.SETTINGS_STORAGE_LIVE;
    case "requested":
      return dict.SETTINGS_STORAGE_REQUESTED;
    case "played":
      return dict.SETTINGS_STORAGE_PLAYED;
    case "search":
      return dict.SETTINGS_STORAGE_SEARCH;
  }
}

/**
 * Disk-usage visualisation for the cached cover files: a proportional
 * segmented bar (player live / last requests / recently played / request
 * search) plus a full-size legend and a clean button that wipes the
 * image caches. Measured live from the actual cached files.
 */
export function CoverStorageCard() {
  const { settings } = useUserSettings();
  const { snapshot, measuring, measure } = useCoverStorageSnapshot();
  const dict = DICT[settings.selectedLanguage];
  const visible = snapshot?.slices.filter((slice) => slice.bytes > 0);

  return (
    <View style={styles.card}>
      <TotalRow snapshot={snapshot} measuring={measuring} />
      <Segments snapshot={snapshot} />
      {snapshot && !measuring && visible?.length === 0 && (
        <Text style={styles.empty}>{dict.SETTINGS_STORAGE_EMPTY}</Text>
      )}
      {!settings.cacheEnabled && (
        <Text style={styles.hint}>{dict.SETTINGS_STORAGE_HINT_OFF}</Text>
      )}
      {snapshot?.slices.map((slice) => (
        <LegendRow key={slice.key} slice={slice} />
      ))}
      <CleanButton measure={measure} />
    </View>
  );
}

function TotalRow({
  snapshot,
  measuring,
}: {
  snapshot: CoverStorageSnapshot | null;
  measuring: boolean;
}) {
  const { settings } = useUserSettings();
  const dict = DICT[settings.selectedLanguage];
  return (
    <View style={styles.totalRow}>
      <Text style={styles.totalLabel}>
        {dict.SETTINGS_STORAGE_TOTAL}
        {measuring
          ? ""
          : ` · ${formatBytes(snapshot?.totalBytes ?? 0)}`}
      </Text>
      <Text style={styles.totalMeta}>
        {measuring
          ? "· · ·"
          : `${snapshot?.totalCount ?? 0} ${dict.SETTINGS_STORAGE_FILES}`}
      </Text>
    </View>
  );
}

function Segments({ snapshot }: { snapshot: CoverStorageSnapshot | null }) {
  if (!snapshot || !snapshot.slices.some((slice) => slice.bytes > 0)) {
    return null;
  }
  return (
    <View style={styles.barRow} accessibilityRole="progressbar">
      {snapshot.slices
        .filter((slice) => slice.bytes > 0)
        .map((slice) => (
          <View
            key={slice.key}
            style={[
              styles.barSegment,
              {
                flex: Math.max(slice.bytes, 1),
                backgroundColor: CATEGORY_COLORS[slice.key],
              },
            ]}
          />
        ))}
    </View>
  );
}

function CleanButton({ measure }: { measure: () => Promise<void> }) {
  const { settings } = useUserSettings();
  const dict = DICT[settings.selectedLanguage];
  // One store-wide wipe flag — drives both the clean button and the
  // Settings toggle (the provider's automatic wipe is included).
  const clearing = useSyncExternalStore(
    (listener) => coverDiskStorage.subscribe(listener),
    () => coverDiskStorage.isClearing,
  );

  const onClean = async () => {
    // Button and toggle read the shared flag; overlapping wipes are
    // harmless here because both routes only clear.
    try {
      await coverDiskStorage.clearAll();
      await measure();
    } catch (error) {
      console.warn("[CoverStorageCard] clear failed:", error);
    }
  };

  return (
    <TouchableOpacity
      accessibilityRole="button"
      activeOpacity={0.7}
      onPress={onClean}
      disabled={clearing}
      style={[styles.cleanButton, clearing && styles.cleanDisabled]}
    >
      <MaterialIcons
        name={clearing ? "hourglass-top" : "delete-sweep"}
        size={20}
        color={THEME.COLORS.TEXT}
      />
      <Text style={styles.cleanLabel}>
        {clearing ? dict.SETTINGS_STORAGE_CLEANING : dict.SETTINGS_STORAGE_CLEAN}
      </Text>
    </TouchableOpacity>
  );
}
