import { View } from "react-native";

import { RowDivider } from "@/components/ListRow";
import { SectionTitle } from "@/components/SectionTitle";
import { Select, type SelectOption } from "@/components/Select";
import { SettingsRow } from "@/components/SettingsRows";
import { usePlayer } from "@/contexts/player/PlayerProvider";
import { AUTO_QUALITY } from "@/core/domain/stream";
import type { SleepChoice } from "@/core/player";
import { useDict } from "@/hooks/useDict";
import { haptics } from "@/utils/haptics";
import { useSleepCountdown } from "@/hooks/useSleepCountdown";
import { styles } from "@/screens/Settings/styles";
import { formatCountdown, interpolate } from "@/utils/format";

/** `running`: a timer whose choice is not known (it outlived a JS reload). */
type SleepKey = "off" | `${Exclude<SleepChoice, "track">}` | "track" | "running";

const MINUTES = [15, 30, 45, 60] as const;

const choiceOf = (key: Exclude<SleepKey, "running">): SleepChoice | null => {
  if (key === "off") return null;
  if (key === "track") return "track";
  return Number(key) as SleepChoice;
};

/**
 * How the radio plays: automatic quality and the sleep timer. The timer runs
 * natively (it fires with the app in the background or the screen off); this
 * row sets it and counts it down.
 */
export function PlaybackSection() {
  const dict = useDict();
  const {
    autoQuality,
    currentStream,
    playingStream,
    changeStream,
    sleepAt,
    sleepChoice,
    sleepAtTrackEnd,
    setSleepTimer,
  } = usePlayer();
  const left = useSleepCountdown(sleepAt);
  const pausesIn = left == null ? null : interpolate(dict.SLEEP_TIMER_PAUSES_IN, { time: formatCountdown(left) });

  // A running timer the app cannot name is its own row, so "Off" cancels it.
  const running = sleepAt != null && sleepChoice == null;
  const options: SelectOption<SleepKey>[] = [
    ...(running && pausesIn ? [{ key: "running" as const, label: pausesIn }] : []),
    { key: "off", label: dict.SLEEP_TIMER_OFF },
    ...MINUTES.map((minutes) => ({
      key: `${minutes}` as SleepKey,
      label: interpolate(dict.SLEEP_TIMER_MINUTES, { n: minutes }),
    })),
    ...(sleepAtTrackEnd || sleepChoice === "track"
      ? [{ key: "track" as const, label: dict.SLEEP_TIMER_TRACK_END }]
      : []),
  ];
  let value: SleepKey = sleepChoice == null ? "off" : (`${sleepChoice}` as SleepKey);
  if (running) value = "running";

  return (
    <>
      <SectionTitle title={dict.SETTINGS_PLAYBACK_TITLE} icon="play-circle-outline" />
      <View style={styles.group}>
        <Select
          label={dict.SETTINGS_SLEEP_TIMER_ROW}
          icon="bedtime"
          // The running row's own label is the countdown: said once.
          description={(!running && pausesIn) || dict.SLEEP_TIMER_DESCRIPTION}
          options={options}
          value={value}
          onChange={(key) => {
            if (key === "running") return undefined;
            // Refused (the song ran past its end as it was picked): say so.
            return setSleepTimer(choiceOf(key)).then((set) => {
              if (!set) haptics.warning();
              return set;
            });
          }}
        />
        <RowDivider />
        <SettingsRow
          icon="network-check"
          label={dict.SETTINGS_AUTO_QUALITY_SWITCH}
          description={dict.SETTINGS_AUTO_QUALITY_DESCRIPTION}
          value={Boolean(autoQuality)}
          onToggle={() => {
            // Off: the stream heard until now stays, as a pick.
            if (!autoQuality) void changeStream(AUTO_QUALITY);
            else {
              const kept = playingStream ?? currentStream;
              if (kept) void changeStream(kept);
            }
          }}
        />
      </View>
    </>
  );
}
