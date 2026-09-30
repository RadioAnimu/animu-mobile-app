import type { Track } from "@/core/domain/track";
import type { AudioPlaybackStatus } from "@/core/player/ports";
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
