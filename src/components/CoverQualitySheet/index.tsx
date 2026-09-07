import { MaterialIcons } from "@expo/vector-icons";
import { FlatList, Image, Text, TouchableOpacity, View } from "react-native";
import { DICT } from "../../i18n";
import { THEME } from "../../theme";
import { useUserSettings } from "../../contexts/user/UserSettingsProvider";
import { styles } from "./styles";
import { Sheet } from "../Sheet";
import {
  COVER_QUALITY_SAMPLES,
  SAMPLE_TRACK_LABEL,
  formatBytes,
} from "./qualities";

interface Props {
  visible: boolean;
  onClose: () => void;
}

const QUALITY_LABEL_KEY = {
  off: "SETTINGS_QUALITY_LIVE_LABEL_OFF",
  high: "SETTINGS_QUALITY_LIVE_LABEL_HIGH",
  medium: "SETTINGS_QUALITY_LIVE_LABEL_MEDIUM",
  low: "SETTINGS_QUALITY_LIVE_LABEL_LOW",
} as const;

export function CoverQualitySheet({ visible, onClose }: Props) {
  const { settings, updateSettings } = useUserSettings();

  return (
    <Sheet visible={visible} onClose={onClose} maxHeight="75%">
      <Text style={styles.title}>
        {DICT[settings.selectedLanguage].SETTINGS_QUALITY_LIVE_LABEL}
      </Text>
      <Text style={styles.caption}>{SAMPLE_TRACK_LABEL}</Text>

      <FlatList
        style={styles.list}
        data={[
          { key: "off" as const, pixelWidth: 0, pixelHeight: 0, sizeBytes: 0 },
          ...COVER_QUALITY_SAMPLES,
        ]}
        keyExtractor={(item) => item.key}
        renderItem={({ item }) => {
          const selected = settings.liveQualityCover === item.key;
          return (
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityState={{ selected }}
              activeOpacity={0.7}
              onPress={() => {
                updateSettings({ liveQualityCover: item.key });
                onClose();
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
                <Text style={styles.qualityName}>
                  {DICT[settings.selectedLanguage][QUALITY_LABEL_KEY[item.key]]}
                </Text>
                {item.key === "off" ? (
                  <Text style={styles.qualityMeta}>
                    {DICT[settings.selectedLanguage].SETTINGS_QUALITY_LIVE_OFF_HINT}
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
            </TouchableOpacity>
          );
        }}
      />
    </Sheet>
  );
}
