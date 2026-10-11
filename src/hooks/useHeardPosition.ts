import { useEffect, useRef, useState } from "react";
import {
  useFrameCallback,
  useSharedValue,
  type SharedValue,
} from "react-native-reanimated";
import { usePlayer } from "@/contexts/player/PlayerProvider";

/** How often the player's position is read (ms); frames extrapolate between. */
const SAMPLE_MS = 250;
/** A sample this far from the extrapolation re-anchors it (ms); less is noise. */
const DRIFT_MS = 60;
/**
 * Lines light up this much before their timestamp (ms): LRC stamps sit on the
 * vocal onset, and a line is read a beat before it is sung (Apple Music
 * leads the same way).
 */
export const LYRICS_LEAD_MS = 150;

interface Anchor {
  /** Elapsed ms at `at`, `NaN` while unknown. */
  elapsedMs: number;
  at: number;
  advancing: boolean;
}

export interface HeardPositionClock {
  /** ms into the heard song on the UI thread, every frame (`NaN` while unknown). */
  position: SharedValue<number>;
  /** The position is known (a title heard / the audible clock settled). */
  known: boolean;
}

/**
 * The heard song's position as a frame-accurate shared value, for `raw`
 * (the track the UI shows). The player's audible clock (ICY titles, the
 * measured stream lag) is sampled on the JS thread; the UI thread advances
 * it with the wall clock every frame. Idle when `active` is false.
 */
export function useHeardPosition(raw: string | undefined, active: boolean): HeardPositionClock {
  const { readHeardPosition } = usePlayer();
  const anchor = useSharedValue<Anchor>({ elapsedMs: Number.NaN, at: 0, advancing: false });
  const position = useSharedValue(Number.NaN);
  const last = useRef<Anchor>({ elapsedMs: Number.NaN, at: 0, advancing: false });
  const [known, setKnown] = useState(false);
  const [advancing, setAdvancing] = useState(false);

  const frames = useFrameCallback(() => {
    const current = anchor.get();
    const moved = current.advancing ? Date.now() - current.at : 0;
    position.set(current.elapsedMs + moved + LYRICS_LEAD_MS);
  }, false);

  useEffect(() => {
    if (!active) return undefined;
    const sample = () => {
      const heard = readHeardPosition();
      const now = Date.now();
      const next: Anchor =
        heard && heard.raw === raw
          ? { elapsedMs: heard.elapsedMs, at: now, advancing: heard.advancing }
          : { elapsedMs: Number.NaN, at: now, advancing: false };
      const previous = last.current;
      const predicted = previous.advancing
        ? previous.elapsedMs + (now - previous.at)
        : previous.elapsedMs;
      const changed =
        Number.isNaN(next.elapsedMs) !== Number.isNaN(predicted) ||
        next.advancing !== previous.advancing ||
        Math.abs(predicted - next.elapsedMs) > DRIFT_MS;
      if (changed) {
        last.current = next;
        anchor.set(next);
        // A held (paused / unknown) position is written once, not per frame.
        if (!next.advancing) position.set(next.elapsedMs + LYRICS_LEAD_MS);
      }
      setKnown(!Number.isNaN(next.elapsedMs));
      setAdvancing(next.advancing);
    };
    sample();
    const id = setInterval(sample, SAMPLE_MS);
    return () => clearInterval(id);
  }, [active, raw, readHeardPosition, anchor, position]);

  // Frames run only while the position moves on screen.
  useEffect(() => {
    frames.setActive(active && advancing);
  }, [frames, active, advancing]);

  return { position, known: active && known };
}
