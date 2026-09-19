/**
 * Player core — a set of small, focused units composed by a thin
 * orchestrator (`player-service.ts`), grouped by concern:
 *
 * - `stream-playback/` — audio transport + stream lifecycle (state machine,
 *   live buffer, reconnect/backoff, network monitor, stream preferences,
 *   heartbeat, progress ticker, on-air repository);
 * - `visualizer/` — platform-split PCM sampling + DSP;
 * - `media-session/` — OS media-session publisher + metadata;
 * - `storage/` — cover artwork resolution + file/image caches.
 *
 * `player-service.ts`, `store.ts` and `timer.ts` stay at the root: the
 * orchestrator spans all four groups, the stores are its React surface, and
 * the timer is the shared scheduling port.
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
