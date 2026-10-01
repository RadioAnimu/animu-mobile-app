import type { Track } from "@/core/domain/track";
import type {
  AudioInterruption,
  AudioPlaybackStatus,
} from "@/core/player/ports";
import type { TransportState } from "@/core/player/stream-playback/transport-state";
import type { StreamSyncEngine } from "@/core/player/stream-playback/stream-sync";

let beats = 0;

/**
 * Dev-only sampled trace of the sync math: native inputs (live offset,
 * forward buffer, playhead) alongside the engine's outputs (lag, clock
 * skew, audible station clock) and the resulting track progress. One line
 * per ~5 native frames, so a real session can be checked against the
 * station without flooding the console.
 */
export const logSyncDebug = (
  status: AudioPlaybackStatus,
  sync: StreamSyncEngine,
  track: Track | null | undefined,
): void => {
  beats += 1;
  if (beats % 5 !== 0) return;
  const start = track?.startTime?.getTime();
  const now = sync.now();
  console.log(
    `[SyncDebug] isLive=${status.isLive ?? "?"} offLive=${
      status.currentOffsetFromLive ?? "null"
    } bufAhead=${status.bufferedAheadSeconds ?? "null"} curTime=${
      status.currentTime?.toFixed?.(1) ?? status.currentTime ?? "?"
    } | delay=${Math.round(sync.delay)}ms skew=${Math.round(
      sync.clockSkew,
    )}ms measured=${sync.hasMeasurement} | audibleNow=${Math.round(
      now,
    )} elapsed=${start != null ? Math.round(now - start) : "?"}ms dur=${
      track?.duration ?? "?"
    } track="${track?.title ?? "?"}"`,
  );
};

/** Everything needed to replay a transport decision after the fact. */
export interface TransportTransition {
  from: TransportState;
  to: TransportState;
  /** What triggered it ("user pause", "stall: native buffering", …). */
  cause: string;
  /** Last native frame, `playbackState/timeControlStatus`. */
  native: string;
  online: boolean;
  /** The link changed recently, so the stall detectors are eager. */
  suspect: boolean;
  interruption: AudioInterruption | null;
  userPaused: boolean;
  /** Audible-clock lag behind the live edge (ms). */
  lagMs: number;
  reconnectAttempt: number;
}

/**
 * Dev-only trace of one transport transition — a single structured line per
 * change, so a failure in the field can be reconstructed from the log.
 */
export const logTransportTransition = (t: TransportTransition): void => {
  console.log(
    `[Transport] ${t.from} → ${t.to} cause="${t.cause}" native=${t.native} ` +
      `online=${t.online} suspect=${t.suspect} interruption=${t.interruption ?? "none"} ` +
      `userPaused=${t.userPaused} lag=${Math.round(t.lagMs)}ms reconnectAttempt=${t.reconnectAttempt}`,
  );
};
