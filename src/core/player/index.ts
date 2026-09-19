/**
 * Player core — a set of small, focused units composed by a thin
 * orchestrator (`PlayerService`). See `player-service.ts` for the map.
 */
export { playerService } from "@/core/player/player-service";
export type { VisualizerWindow } from "@/core/player/visualizer.types";

export {
  playerStore,
  progressStore,
  stationStore,
  type PlayerSnapshot,
  type ProgressSnapshot,
  type StationSnapshot,
} from "@/core/player/store";
