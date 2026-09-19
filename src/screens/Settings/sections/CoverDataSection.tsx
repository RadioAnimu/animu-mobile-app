import { useMemo } from "react";
import { View } from "react-native";

import { SectionTitle } from "@/components/SectionTitle";
import { Select, type SelectOption } from "@/components/Select";
import {
  COVER_QUALITY_SAMPLES,
  DEFAULT_COVER_SOURCE,
  type CoverQualityKey,
} from "@/constants/artwork-quality";
import { useUserSettings } from "@/contexts/user/UserSettingsProvider";
import { useDict } from "@/hooks/useDict";
import { cleanLabel } from "@/screens/Settings/labels";
import { Divider, SettingsRow } from "@/screens/Settings/rows";
import { styles } from "@/screens/Settings/styles";
import { formatBytes } from "@/utils/format";

const QUALITY_LABEL_KEY = {
  high: "SETTINGS_QUALITY_LIVE_LABEL_HIGH",
  medium: "SETTINGS_QUALITY_LIVE_LABEL_MEDIUM",
  low: "SETTINGS_QUALITY_LIVE_LABEL_LOW",
} as const;

/** Cover quality plus the three per-surface cover toggles. */
export function CoverDataSection() {
  const { settings, updateSettings } = useUserSettings();
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

  return (
    <>
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
          onToggle={() =>
            updateSettings({
              lastRequestedCovers: !settings.lastRequestedCovers,
            })
          }
        />
        <Divider />
        <SettingsRow
          label={cleanLabel(dict.SETTINGS_COVER_LAST_PLAYED_SWITCH)}
          value={settings.lastPlayedCovers}
          onToggle={() =>
            updateSettings({ lastPlayedCovers: !settings.lastPlayedCovers })
          }
        />
        <Divider />
        <SettingsRow
          label={cleanLabel(dict.SETTINGS_COVER_REQUESTED_SWITCH)}
          value={settings.coversInRequestSearch}
          onToggle={() =>
            updateSettings({
              coversInRequestSearch: !settings.coversInRequestSearch,
            })
          }
        />
      </View>
    </>
  );
}
