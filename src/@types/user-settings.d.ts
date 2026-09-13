import { LANGS_KEY_VALUE_PAIRS } from "../i18n";
import type { VisualizerFps } from "../core/player/visualizer.types";
import { ArtworkQuality } from "./artwork-quality";

export interface UserSettings {
  liveQualityCover: ArtworkQuality;
  lastRequestedCovers: boolean;
  lastPlayedCovers: boolean;
  coversInRequestSearch: boolean;
  selectedLanguage: keyof typeof LANGS_KEY_VALUE_PAIRS;
  cacheEnabled: boolean;
  /** Oscilloscope frame rate. `0` disables the visualizer. */
  visualizerFps: VisualizerFps;
}
