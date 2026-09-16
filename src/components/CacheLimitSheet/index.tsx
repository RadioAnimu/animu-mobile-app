import MaterialIcons from "@react-native-vector-icons/material-icons/static";
import { useCallback, useState } from "react";
import { FlatList, Text, TouchableOpacity, View } from "react-native";
import { DICT } from "../../i18n";
import { THEME } from "../../theme";
import { useUserSettings } from "../../contexts/user/UserSettingsProvider";
import type { CoverCacheCategory } from "../../core/services/cover-cache-registry.service";
import { styles } from "./styles";
import { Sheet } from "../Sheet";

interface Props {
  visible: boolean;
  onClose: () => void;
}

export type CacheLimitRow =
  | { bytes: 0; label: "SETTINGS_STORAGE_LIMIT_UNLIMITED" }
  | { bytes: number; label: null };

const MB = 1024 * 1024;

/** Uncapped first, then the fixed-byte tiers (user's example: 250 MB). */
const LIMIT_ROWS: CacheLimitRow[] = [
  { bytes: 0, label: "SETTINGS_STORAGE_LIMIT_UNLIMITED" },
  { bytes: 50 * MB, label: null },
  { bytes: 100 * MB, label: null },
  { bytes: 250 * MB, label: null },
  { bytes: 500 * MB, label: null },
  { bytes: 1024 * MB, label: null },
];

/** Per-partition picker tiers (advanced mode only). */
const PARTITION_ROWS: CacheLimitRow[] = [
  { bytes: 10 * MB, label: null },
  { bytes: 25 * MB, label: null },
  { bytes: 50 * MB, label: null },
  { bytes: 100 * MB, label: null },
  { bytes: 250 * MB, label: null },
  { bytes: 500 * MB, label: null },
];

type PartitionLabelKeys =
  | "SETTINGS_STORAGE_LIVE"
  | "SETTINGS_STORAGE_REQUESTED"
  | "SETTINGS_STORAGE_PLAYED"
  | "SETTINGS_STORAGE_SEARCH";

const PARTITIONS: { key: CoverCacheCategory; labelKey: PartitionLabelKeys }[] = [
  { key: "live", labelKey: "SETTINGS_STORAGE_LIVE" },
  { key: "requested", labelKey: "SETTINGS_STORAGE_REQUESTED" },
  { key: "played", labelKey: "SETTINGS_STORAGE_PLAYED" },
  { key: "search", labelKey: "SETTINGS_STORAGE_SEARCH" },
];

interface StorageDicts {
  SETTINGS_STORAGE_LIMIT_UNLIMITED: string;
  SETTINGS_STORAGE_LIMIT_AUTOMATIC: string;
  SETTINGS_STORAGE_LIMIT_ADVANCED: string;
}

function rowTitle(
  dict: StorageDicts,
  row: CacheLimitRow,
): string {
  return row.label ? dict[row.label] : `${Math.round(row.bytes / MB)} MB`;
}

/**
 * ONE number in, FOUR caps out (weighted, not equal — request surfaces
 * churn far faster than the live player). Every-day users only ever see
 * the single total list; the per-partition fine-tuning stays hidden
 * behind an advanced toggle at the bottom of the sheet.
 *
 * The wipe gate: applying a limit (or a partition) queues a trim in the
 * provider's chain, so this sheet blocks — no backdrop close, no
 * Android back, no row re-press — until that pass resolves. Same
 * contract as the quality sheet: settings leave the UI only after the
 * storage work behind them is done.
 */
export function CacheLimitSheet({ visible, onClose }: Props) {
  const { settings, updateSettings } = useUserSettings();
  const dict = DICT[settings.selectedLanguage];
  const [applying, setApplying] = useState(false);
  const [partitionPickerKey, setPartitionPickerKey] =
    useState<CoverCacheCategory | null>(null);

  const custom = settings.coverCachePartitionBytes;
  const advanced =
    LIMIT_ROWS.some((row) => row.bytes === settings.coverCacheLimitBytes) &&
    Boolean(settings.coverCachePartitionBytes);

  const apply = useCallback(
    async (mutate: () => Promise<unknown>, onDone: () => void) => {
      if (applying) return;
      setApplying(true);
      try {
        // Resolves ONLY after the provider's chain has run the trim and
        // persisted the setting.
        await mutate();
        onDone();
      } catch (error) {
        console.warn("[CacheLimitSheet] apply failed:", error);
      } finally {
        setApplying(false);
      }
    },
    [applying],
  );

  const renderItem = useCallback(
    ({ item }: { item: CacheLimitRow }) => {
      const selected = settings.coverCacheLimitBytes === item.bytes;
      return (
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityState={{ selected, disabled: applying || undefined }}
          activeOpacity={0.7}
          disabled={applying}
          onPress={() => {
            // Re-pressing the current tier mutates nothing — close
            // without a trim round-trip (same contract as the quality
            // sheet's selected row).
            if (selected) {
              onClose();
              return;
            }
            void apply(
              () => updateSettings({ coverCacheLimitBytes: item.bytes }),
              onClose,
            );
          }}
          style={styles.row}
        >
          <View style={styles.info}>
            <Text style={styles.limitName}>{rowTitle(dict, item)}</Text>
          </View>
          {selected && (
            <MaterialIcons
              name="check"
              size={THEME.ICON.MD}
              color={THEME.COLORS.BRAND}
            />
          )}
        </TouchableOpacity>
      );
    },
    [apply, applying, dict, onClose, settings.coverCacheLimitBytes, updateSettings],
  );

  const pickerKey = partitionPickerKey;
  const partitions = PARTITIONS;
  const pickerVisible = pickerKey != null;

  return (
    <Sheet
      visible={visible}
      closable={!applying}
      onClose={onClose}
      maxHeight="75%"
    >
      <Text style={styles.title}>{dict.SETTINGS_STORAGE_LIMIT_TITLE}</Text>
      <Text style={styles.caption}>{dict.SETTINGS_STORAGE_LIMIT_CAPTION}</Text>

      <FlatList
        style={styles.list}
        data={LIMIT_ROWS}
        keyExtractor={(item) => String(item.bytes)}
        renderItem={renderItem}
        ListFooterComponent={
          <View>
            <TouchableOpacity
              accessibilityRole="switch"
              accessibilityState={{ checked: advanced, disabled: applying || undefined }}
              activeOpacity={0.7}
              style={styles.row}
              disabled={applying || settings.coverCacheLimitBytes === 0}
              onPress={() => {
                void apply(
                  () =>
                    updateSettings({
                      coverCachePartitionBytes: advanced
                        ? null
                        : custom ?? {},
                    }),
                  () => {},
                );
              }}
            >
              <View style={styles.info}>
                <Text style={styles.limitName}>
                  {dict.SETTINGS_STORAGE_LIMIT_ADVANCED}
                </Text>
              </View>
              {advanced && (
                <MaterialIcons
                  name="check"
                  size={THEME.ICON.MD}
                  color={THEME.COLORS.BRAND}
                />
              )}
            </TouchableOpacity>
            {advanced &&
              partitions.map((partition) => {
                const value = custom?.[partition.key];
                return (
                  <TouchableOpacity
                    key={partition.key}
                    accessibilityRole="button"
                    activeOpacity={0.7}
                    style={styles.partitionRow}
                    disabled={applying}
                    onPress={() => setPartitionPickerKey(partition.key)}
                  >
                    <View style={styles.info}>
                      <Text style={styles.limitMeta}>
                        {dict[partition.labelKey]}
                      </Text>
                      <Text style={styles.limitName}>
                        {value != null
                          ? formatCustomBytes(value)
                          : dict.SETTINGS_STORAGE_LIMIT_AUTOMATIC}
                      </Text>
                    </View>
                    <MaterialIcons
                      name="chevron-right"
                      size={THEME.ICON.MD}
                      color={THEME.COLORS.TEXT_DIM}
                    />
                  </TouchableOpacity>
                );
              })}
          </View>
        }
      />

      <Sheet
        visible={pickerVisible}
        closable={!applying}
        onClose={() => setPartitionPickerKey(null)}
        maxHeight="60%"
      >
        <Text style={styles.title}>
          {pickerKey != null
            ? dict[partitions.find((p) => p.key === pickerKey)!.labelKey]
            : ""}
        </Text>
        <TouchableOpacity
          accessibilityRole="button"
          activeOpacity={0.7}
          style={styles.row}
          disabled={applying}
              onPress={() => {
                if (pickerKey == null) return;
                if (custom?.[pickerKey] == null) {
                  // Already automatic — close without a chain pass.
                  setPartitionPickerKey(null);
                  return;
                }
                void apply(() => {
                  const rest = { ...(custom ?? {}) };
                  delete rest[pickerKey];
                  return updateSettings({ coverCachePartitionBytes: rest });
                }, () => setPartitionPickerKey(null));
              }}
        >
          <View style={styles.info}>
            <Text style={styles.limitMeta}>
              {dict.SETTINGS_STORAGE_LIMIT_AUTOMATIC}
            </Text>
          </View>
          {pickerKey != null && custom?.[pickerKey] == null && (
            <MaterialIcons
              name="check"
              size={THEME.ICON.MD}
              color={THEME.COLORS.BRAND}
            />
          )}
        </TouchableOpacity>
        <FlatList
          style={styles.list}
          data={PARTITION_ROWS}
          keyExtractor={(item) => String(item.bytes)}
          renderItem={({ item }) => (
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityState={{
                selected: pickerKey != null && custom?.[pickerKey] === item.bytes,
                disabled: applying || undefined,
              }}
              activeOpacity={0.7}
              style={styles.row}
              disabled={applying}
              onPress={() => {
                if (pickerKey == null) return;
                if (custom?.[pickerKey] === item.bytes) {
                  // Already that cap — close without a trim round-trip.
                  setPartitionPickerKey(null);
                  return;
                }
                void apply(
                  () =>
                    updateSettings({
                      coverCachePartitionBytes: {
                        ...(custom ?? {}),
                        [pickerKey]: item.bytes,
                      },
                    }),
                  () => setPartitionPickerKey(null),
                );
              }}
            >
              <View style={styles.info}>
                <Text style={styles.limitName}>{rowTitle(dict, item)}</Text>
              </View>
              {pickerKey != null && custom?.[pickerKey] === item.bytes && (
                <MaterialIcons
                  name="check"
                  size={THEME.ICON.MD}
                  color={THEME.COLORS.BRAND}
                />
              )}
            </TouchableOpacity>
          )}
        />
      </Sheet>
    </Sheet>
  );
}

function formatCustomBytes(bytes: number): string {
  return `${Math.max(0, Math.round(bytes / MB))} MB`;
}
