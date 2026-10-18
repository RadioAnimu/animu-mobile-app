import { useMemo } from "react";

import { RowDivider } from "@/components/ListRow";
import { Select, type SelectOption } from "@/components/Select";
import {
  COVER_QUALITY_SAMPLES,
  DEFAULT_COVER_SOURCE,
  type CoverQualityKey,
} from "@/constants/artwork-quality";
import { useUserSettings } from "@/contexts/user/UserSettingsProvider";
import { useDict } from "@/hooks/useDict";
import { useSaveSettings } from "@/hooks/useSaveSettings";
import { SettingsRow } from "@/screens/Settings/rows";
import { formatBytes } from "@/utils/format";
import { DESTINATION_ICON } from "@/constants/destination-icons";

const QUALITY_LABEL_KEY = {
  high: "SETTINGS_QUALITY_LIVE_LABEL_HIGH",
  medium: "SETTINGS_QUALITY_LIVE_LABEL_MEDIUM",
  low: "SETTINGS_QUALITY_LIVE_LABEL_LOW",
} as const;

/** Rows for cover quality plus the three per-surface cover toggles. */
export function CoverDataSection() {
  const { settings } = useUserSettings();
  const save = useSaveSettings();
  const dict = useDict();
  // The per-surface toggles have nothing to act on without a quality; they
  // stay on screen, dimmed, with the choice the user made kept.
  const coversOff = settings.liveQualityCover === "off";

  const qualityOptions = useMemo<SelectOption<CoverQualityKey | "off">[]>(
    () => [
      ...COVER_QUALITY_SAMPLES.map((sample) => ({
        key: sample.key,
        label: dict[QUALITY_LABEL_KEY[sample.key as CoverQualityKey]],
        meta: `~${formatBytes(sample.sizeBytes, dict.NUMBER_DECIMAL_SEPARATOR)}`,
        badge:
          sample.key === "medium"
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
      <Select
        label={dict.SETTINGS_QUALITY_ROW}
        icon="high-quality"
        description={
          coversOff
            ? dict.SETTINGS_COVERS_OFF_HINT
            : dict.SETTINGS_QUALITY_ROW_DESC
        }
        options={qualityOptions}
        value={settings.liveQualityCover}
        onChange={(key) => save({ liveQualityCover: key })}
      />
      <RowDivider />
      <SettingsRow
        icon={DESTINATION_ICON.LastRequested}
        label={dict.SETTINGS_COVER_LAST_REQUESTED_SWITCH}
        value={settings.lastRequestedCovers}
        disabled={coversOff}
        onToggle={() =>
          void save({ lastRequestedCovers: !settings.lastRequestedCovers })
        }
      />
      <RowDivider />
      <SettingsRow
        icon={DESTINATION_ICON.LastPlayed}
        label={dict.SETTINGS_COVER_LAST_PLAYED_SWITCH}
        value={settings.lastPlayedCovers}
        disabled={coversOff}
        onToggle={() =>
          void save({ lastPlayedCovers: !settings.lastPlayedCovers })
        }
      />
      <RowDivider />
      <SettingsRow
        icon={DESTINATION_ICON.MakeRequest}
        label={dict.SETTINGS_COVER_REQUESTED_SWITCH}
        value={settings.coversInRequestSearch}
        disabled={coversOff}
        onToggle={() =>
          void save({ coversInRequestSearch: !settings.coversInRequestSearch })
        }
      />
    </>
  );
}
