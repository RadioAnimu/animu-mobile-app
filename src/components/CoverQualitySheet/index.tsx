import MaterialIcons from "@react-native-vector-icons/material-icons/static";
import { useCallback, useState } from "react";
import {
  FlatList,
  Image,
  Text,
  TouchableOpacity,
  View,
  type ListRenderItem,
} from "react-native";
import { DICT } from "../../i18n";
import { THEME } from "../../theme";
import { useUserSettings } from "../../contexts/user/UserSettingsProvider";
import { styles } from "./styles";
import { Sheet } from "../Sheet";
import {
  COVER_QUALITY_SAMPLES,
  SAMPLE_TRACK_LABEL,
  formatBytes,
  type CoverQualitySample,
} from "./qualities";

interface Props {
  visible: boolean;
  onClose: () => void;
}

type QualityRow = CoverQualitySample | { key: "off"; pixelWidth: number; pixelHeight: number; sizeBytes: number };

const QUALITY_LABEL_KEY = {
  off: "SETTINGS_QUALITY_LIVE_LABEL_OFF",
  high: "SETTINGS_QUALITY_LIVE_LABEL_HIGH",
  medium: "SETTINGS_QUALITY_LIVE_LABEL_MEDIUM",
  low: "SETTINGS_QUALITY_LIVE_LABEL_LOW",
} as const;

/** Rendered once per mount — the list never rebuilds data on re-render. */
const QUALITY_ROWS: QualityRow[] = [
  { key: "off", pixelWidth: 0, pixelHeight: 0, sizeBytes: 0 },
  ...COVER_QUALITY_SAMPLES,
];

export function CoverQualitySheet({ visible, onClose }: Props) {
  const { settings, updateSettings } = useUserSettings();
  const dict = DICT[settings.selectedLanguage];
  // The wipe gate: a quality change clears the whole cover cache, and
  // this sheet must stay open (blocking: no backdrop close, no re-press)
  // until the provider's chained wipe resolves — closing early would let
  // the user see stale-tier covers with no feedback for the clear.
  const [applyingKey, setApplyingKey] = useState<QualityRow["key"] | null>(
    null,
  );

  const renderItem: ListRenderItem<QualityRow> = useCallback(
    ({ item }) => {
      const selected = settings.liveQualityCover === item.key;
      const applying = applyingKey === item.key;
      return (
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityState={{ selected, disabled: (applyingKey != null) || undefined }}
          activeOpacity={0.7}
          disabled={applyingKey != null}
          onPress={async () => {
            if (applyingKey != null) return;
            // Re-pressing the already-selected tier mutates nothing —
            // close without a wipe round-trip.
            if (selected) {
              onClose();
              return;
            }
            setApplyingKey(item.key);
            try {
              // Resolves ONLY after the provider's chain has wiped the
              // caches (quality change) and persisted the setting.
              await updateSettings({ liveQualityCover: item.key });
              onClose();
            } catch (error) {
              console.warn("[CoverQualitySheet] apply failed:", error);
            } finally {
              setApplyingKey(null);
            }
          }}
          style={styles.row}
        >
          {item.key === "off" ? (
            <Image
              source={require("../../../assets/default-cover.png")}
              style={styles.preview}
            />
          ) : (
            <Image source={item.source} style={styles.preview} />
          )}
          <View style={styles.info}>
            <Text style={styles.qualityName}>{dict[QUALITY_LABEL_KEY[item.key]]}</Text>
            {item.key === "off" ? (
              <Text style={styles.qualityMeta}>
                {dict.SETTINGS_QUALITY_LIVE_OFF_HINT}
              </Text>
            ) : (
              <Text style={styles.qualityMeta}>
                {item.pixelWidth}×{item.pixelHeight} ·{" "}
                {formatBytes(item.sizeBytes)}
              </Text>
            )}
          </View>
          {selected && (
            <MaterialIcons
              name="check"
              size={THEME.ICON.MD}
              color={THEME.COLORS.BRAND}
            />
          )}
          {applying && !selected && (
            <MaterialIcons
              name="hourglass-top"
              size={THEME.ICON.MD}
              color={THEME.COLORS.TEXT_DIM}
            />
          )}
        </TouchableOpacity>
      );
    },
    [applyingKey, dict, onClose, settings.liveQualityCover, updateSettings],
  );

  return (
    <Sheet
      visible={visible}
      closable={applyingKey == null}
      onClose={onClose}
      maxHeight="75%"
    >
      <Text style={styles.title}>{dict.SETTINGS_QUALITY_LIVE_LABEL}</Text>
      <Text style={styles.caption}>{SAMPLE_TRACK_LABEL}</Text>

      <FlatList
        style={styles.list}
        data={QUALITY_ROWS}
        keyExtractor={(item) => item.key}
        renderItem={renderItem}
      />
    </Sheet>
  );
}
