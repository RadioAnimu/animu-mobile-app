import { LANGS_KEY_VALUE_PAIRS } from "@/i18n";
import { ArtworkQuality } from "@/@types/artwork-quality";
import type { CoverCacheCategory } from "@/core/services/cover-cache-registry.service";

export interface UserSettings {
  liveQualityCover: ArtworkQuality;
  lastRequestedCovers: boolean;
  lastPlayedCovers: boolean;
  coversInRequestSearch: boolean;
  selectedLanguage: keyof typeof LANGS_KEY_VALUE_PAIRS;
  cacheEnabled: boolean;
  /**
   * Total FIFO byte ceiling for the cover cache. `0` (default) = uncapped —
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
   * Realtime station surface (SSE) battery policy. `true` (default) keeps
   * the live connection open whenever the player runs — instant song-change
   * lock-screen updates even in the background. `false` drops the live
   * connection whenever the app is paused AND backgrounded (the HTTP poll
   * plus the staleness fallback still cover freshness on return).
   */
  liveUpdatesInBackground: boolean;
  /**
   * Tactile feedback on taps, toggles and outcomes. `true` (default). No-op
   * on devices/platforms without haptics support.
   */
  hapticsEnabled: boolean;
}
