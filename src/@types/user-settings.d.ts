import { LANGUAGE_LABELS } from "@/constants/languages";
import type { ArtworkQuality } from "animu-api";
import type { CoverCacheCategory } from "@/core/services/cover-cache-registry.service";

export interface UserSettings {
  liveQualityCover: ArtworkQuality;
  lastRequestedCovers: boolean;
  lastPlayedCovers: boolean;
  coversInRequestSearch: boolean;
  selectedLanguage: keyof typeof LANGUAGE_LABELS;
  cacheEnabled: boolean;
  /**
   * Total FIFO byte ceiling for the cover cache (default 100 MB). `0` = uncapped —
   * expo-image/Glide keeps evicting at its own discretion. `> 0` = the
   * storage service splits this total into per-category PARTITIONS
   * (weighted: live 30% / requested 15% / played 25% / search 30%) and
   * each partition trims its own FIFO ring independently — a request
   * search flood can never evict a live cover.
   */
  coverCacheLimitBytes: number;
  /**
   * Advanced per-partition overrides, `undefined` in each slot = use the
   * weighted share of the total limit. Customized values take their
   * absolute bytes off the top; the rest share the remaining budget
   * proportionally, so the total the user defined never grows. Only
   * reachable behind the Storage screen's Advanced section.
   */
  coverCachePartitionBytes: Partial<
    Record<CoverCacheCategory, number>
  > | null;
  /**
   * Oscilloscope on/off — stored as `0` (off) or `> 0` (on). The emission
   * rate is uncapped (self-adapting at the display's vsync), so the stored
   * value no longer encodes a rate; it only encodes the toggle.
   */
  visualizerHz: number;
  /**
   * Tactile feedback on taps, toggles and outcomes. `true` (default). No-op
   * on devices/platforms without haptics support.
   */
  hapticsEnabled: boolean;
  /**
   * Label under each Japanese lyric line: romaji, hiragana (kanji resolved),
   * or none. Needs the offline Japanese dictionary; `romaji` by default.
   */
  lyricsPronunciation: "off" | "romaji" | "hiragana";
  /**
   * Shape of the stored settings: 1 (absent) = before the cover cache was
   * capped by default, 2 = current. Lets a stored `coverCacheLimitBytes: 0`
   * from the old default move to the new cap once, while an "Unlimited"
   * picked later (stored with version 2) is kept.
   */
  settingsVersion: number;
}
