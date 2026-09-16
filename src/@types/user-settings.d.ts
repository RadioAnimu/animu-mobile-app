import { LANGS_KEY_VALUE_PAIRS } from "../i18n";
import { ArtworkQuality } from "./artwork-quality";

export interface UserSettings {
  liveQualityCover: ArtworkQuality;
  lastRequestedCovers: boolean;
  lastPlayedCovers: boolean;
  coversInRequestSearch: boolean;
  selectedLanguage: keyof typeof LANGS_KEY_VALUE_PAIRS;
  cacheEnabled: boolean;
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
}
