/**
 * Player core — a set of small, focused units composed by a thin
 * orchestrator (`player-service.ts`), grouped by concern:
 *
 * - `ports.ts` — the lib-agnostic vocabulary: `AudioEnginePort` and
 *   `MediaSessionPort` plus the shared value types. Nothing here imports a
 *   native media library;
 * - `adapters/` — the ONLY modules that import `expo-audio` /
 *   `react-native-playback-controls` (`ExpoAudioAdapter`,
 *   `PlaybackControlsAdapter`). Swapping an engine, or adopting one library
 *   that provides both, is a new adapter + a factory line;
 * - `stream-playback/` — stream lifecycle (state machine, live buffer,
 *   reconnect/backoff, network monitor, stream preferences, heartbeat,
 *   progress ticker, on-air repository);
 * - `visualizer/` — platform-split PCM sampling + DSP;
 * - `media-session/` — now-playing metadata mapping for the OS session;
 * - `storage/` — cover artwork resolution + file/image caches.
 *
 * `player-service.ts`, `store.ts` and `timer.ts` stay at the root: the
 * orchestrator composes the ports and units, the stores are its React
 * surface, and the timer is the shared scheduling port.
 */
export { playerService } from "@/core/player/player-service";
export type { VisualizerWindow } from "@/core/player/visualizer/types";

export {
  playerStore,
  progressStore,
  stationStore,
  type PlayerSnapshot,
  type ProgressSnapshot,
  type StationSnapshot,
} from "@/core/player/store";
