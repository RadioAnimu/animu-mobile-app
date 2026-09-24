import MaterialIcons from "@react-native-vector-icons/material-icons/static";
import { Alert, Text, TouchableOpacity, View } from "react-native";

import { useUserSettings } from "@/contexts/user/UserSettingsProvider";
import {
  coverDiskStorage,
  type CoverStorageSlice,
  type CoverStorageSnapshot,
} from "@/core/services/cover-disk-storage.service";
import {
  COVER_CATEGORY_COLORS,
  coverCategoryLabel,
} from "@/constants/covers";
import { formatBytes, percentOf } from "@/utils/format";
import { THEME } from "@/theme";
import {
  useCoverDiskClearing,
  useFreedCoverToast,
} from "@/hooks/useCoverDisk";
import { useDict } from "@/hooks/useDict";
import { haptics } from "@/utils/haptics";
import { styles } from "@/components/CoverStorageCard/styles";

function LegendRow({
  slice,
  totalBytes,
}: {
  slice: CoverStorageSlice;
  totalBytes: number;
}) {
  const dict = useDict();
  return (
    <View style={styles.legendRow} accessibilityRole="text">
      <View
        style={[
          styles.dot,
          { backgroundColor: COVER_CATEGORY_COLORS[slice.key] },
        ]}
      />
      <Text style={styles.legendLabel} numberOfLines={1}>
        {coverCategoryLabel(dict, slice.key)}
      </Text>
      <Text style={styles.legendValue}>
        {slice.bytes > 0
          ? `${formatBytes(slice.bytes)} · ${percentOf(slice.bytes, totalBytes)}%`
          : formatBytes(0)}
      </Text>
    </View>
  );
}

/**
 * The friendly face of the cover cache: a big plain-language total, one
 * proportional bar showing what is taking space, a colour-keyed legend, and
 * a single "free up space" action that confirms before it wipes anything.
 * The raw byte limit + per-section controls live behind the Storage screen's
 * Advanced area. The screen owns the measurement (the device bar below it
 * renders the same snapshot) — this card is a pure view of it.
 */
export function CoverStorageCard({
  snapshot,
  measuring,
  measure,
}: {
  snapshot: CoverStorageSnapshot | null;
  measuring: boolean;
  measure: () => Promise<CoverStorageSnapshot | null>;
}) {
  const { settings } = useUserSettings();
  const dict = useDict();
  const totalBytes = snapshot?.totalBytes ?? 0;
  const hasData = totalBytes > 0;

  return (
    <View style={styles.card}>
      <View style={styles.summary}>
        <View style={styles.summaryText}>
          <Text style={styles.totalValue}>
            {measuring ? "· · ·" : formatBytes(totalBytes)}
          </Text>
          <Text style={styles.totalLabel}>{dict.SETTINGS_STORAGE_TOTAL}</Text>
        </View>
        {!measuring && hasData && (
          <Text style={styles.totalCount}>
            {snapshot?.totalCount ?? 0} {dict.SETTINGS_STORAGE_FILES}
          </Text>
        )}
      </View>

      <Text style={styles.explain}>{dict.STORAGE_EXPLAIN}</Text>

      <View style={styles.barTrack} accessibilityRole="progressbar">
        {!measuring &&
          hasData &&
          snapshot?.slices
            .filter((slice) => slice.bytes > 0)
            .map((slice) => (
              <View
                key={slice.key}
                style={[
                  styles.barSegment,
                  {
                    flex: Math.max(slice.bytes, 1),
                    backgroundColor: COVER_CATEGORY_COLORS[slice.key],
                  },
                ]}
              />
            ))}
      </View>

      {!measuring && !hasData && (
        <Text style={styles.empty}>{dict.SETTINGS_STORAGE_EMPTY}</Text>
      )}
      {!settings.cacheEnabled && (
        <Text style={styles.hint}>{dict.SETTINGS_STORAGE_HINT_OFF}</Text>
      )}

      {snapshot?.slices.map((slice) => (
        <LegendRow key={slice.key} slice={slice} totalBytes={totalBytes} />
      ))}

      <CleanButton totalBytes={totalBytes} hasData={hasData} measure={measure} />
    </View>
  );
}

function CleanButton({
  totalBytes,
  hasData,
  measure,
}: {
  totalBytes: number;
  hasData: boolean;
  measure: () => Promise<CoverStorageSnapshot | null>;
}) {
  const dict = useDict();
  const notifyFreed = useFreedCoverToast();
  // One store-wide wipe flag — drives both the clean button and the
  // Settings toggle (the provider's automatic wipe is included).
  const clearing = useCoverDiskClearing();

  const onClean = async () => {
    // Button and toggle read the shared flag; overlapping wipes are
    // harmless here because both routes only clear.
    const before = totalBytes;
    try {
      await coverDiskStorage.clearAll();
      const after = await measure();
      haptics.success();
      // A skipped/failed measure returns no snapshot — never a freed claim.
      const freed = after ? before - after.totalBytes : 0;
      if (freed > 0) notifyFreed(freed);
    } catch (error) {
      console.warn("[CoverStorageCard] clear failed:", error);
    }
  };

  const confirm = () => {
    haptics.warning();
    Alert.alert(
      dict.STORAGE_CLEAR_CONFIRM_TITLE,
      dict.STORAGE_CLEAR_CONFIRM_MSG,
      [
        { text: dict.ACCOUNT_CANCEL, style: "cancel" },
        {
          text: dict.STORAGE_CLEAR_CONFIRM,
          style: "destructive",
          onPress: () => {
            void onClean();
          },
        },
      ],
    );
  };

  const disabled = clearing || !hasData;

  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      activeOpacity={0.7}
      onPress={confirm}
      disabled={disabled}
      style={[
        styles.cleanButton,
        clearing && styles.cleanBusy,
        disabled && !clearing && styles.cleanDisabled,
      ]}
    >
      <MaterialIcons
        name={clearing ? "hourglass-top" : "delete-sweep"}
        size={20}
        color={THEME.COLORS.SURFACE}
      />
      <Text style={styles.cleanLabel}>
        {clearing ? dict.SETTINGS_STORAGE_CLEANING : dict.STORAGE_FREE_UP}
      </Text>
    </TouchableOpacity>
  );
}
