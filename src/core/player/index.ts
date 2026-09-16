/**
 * Player core — a set of small, focused units composed by a thin
 * orchestrator (`PlayerService`). See `player-service.ts` for the map.
 */
export { playerService, createPlayerService } from "./player-service";
export type { PlayerServiceDependencies } from "./player-service";
export type { TransportState } from "./transport-state";
export type {
  VisualizerSampler,
  VisualizerWindow,
  WaveformFrame,
} from "./visualizer.types";

export {
  playerStore,
  progressStore,
  stationStore,
  type PlayerSnapshot,
  type ProgressSnapshot,
  type StationSnapshot,
} from "./store";
