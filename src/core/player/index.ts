/**
 * Player core — Rádio Animu on react-native-anything-player.
 *
 * Playback, recovery, audio focus, interruptions and the lock screen are
 * native (Airwave). This module adds what only the app knows:
 *
 * - `player-service.ts` — commands, stream choice, store writes, lock-screen
 *   metadata (the single writer of the React stores);
 * - `stream-playback/heard-track.ts` — the track being *heard* (the audible
 *   ICY title matched to the station API) and its position;
 * - `stream-playback/now-playing.repository.ts` — on-air data (SSE + HTTP);
 * - `visualizer/` — oscilloscope windows from the player's decoded audio;
 * - `storage/`, `media-session/` — covers and the lock-screen mapping.
 *
 * See docs/ARCHITECTURE.md#player-core.
 */
export { playerService } from "@/core/player/player-factory";
export type { VisualizerWindow } from "@/core/player/visualizer/types";

export {
  playerStore,
  progressStore,
  stationStore,
  type PlayerSnapshot,
  type ProgressSnapshot,
  type StationSnapshot,
} from "@/core/player/store";
