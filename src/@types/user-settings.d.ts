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
}
