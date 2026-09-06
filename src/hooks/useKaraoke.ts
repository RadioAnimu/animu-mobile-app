import { useEffect, useState } from "react";
import { elapsedFromStart } from "../core/lyrics/clock";
import { findLineIndex, findWordIndex } from "../core/lyrics/lrc-parser";
import type { LyricLine, LyricWord } from "../core/lyrics/types";

// ─── Karaoke clocks ───
//
// rAF-driven indexes derived from the server-stamped start time. Both
// hooks re-render only on INDEX CHANGE (a word/line boundary) — the
// 60fps clock lives in the loop, never in the React tree, so the lyrics
// list itself stays static while a word is being sung. Inputs are
// primitives (`startTimeMs`), so identity changes never re-arm a clock
// that describes the same song.

export interface ClockInput {
  startTimeMs: number | null;
  isPlaying: boolean;
}

/**
 * Index of the line currently being sung (-1 during the intro).
 * Freezes on the last computed index while paused.
 */
export function useActiveLineIndex(
  lines: LyricLine[],
  { startTimeMs, isPlaying }: ClockInput,
  enabled: boolean,
): number {
  const [index, setIndex] = useState(-1);

  useEffect(() => {
    if (!enabled || startTimeMs == null || lines.length === 0) {
      setIndex(-1);
      return;
    }

    const compute = () => {
      const elapsed = elapsedFromStart(startTimeMs);
      if (elapsed == null) return -1;
      return findLineIndex(lines, elapsed);
    };

    if (!isPlaying) {
      setIndex(compute());
      return;
    }

    let cancelled = false;
    let frame = 0;
    const loop = () => {
      if (cancelled) return;
      const next = compute();
      setIndex((previous) => (previous === next ? previous : next));
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);

    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
    };
  }, [lines, startTimeMs, isPlaying, enabled]);

  return index;
}

/**
 * Index of the word currently being sung within its line (-1 before the
 * first word). Word times may be measured (enhanced LRC) or estimated —
 * the clock treats both the same.
 */
export function useSungWordIndex(
  words: LyricWord[],
  { startTimeMs, isPlaying }: ClockInput,
  enabled: boolean,
): number {
  const [index, setIndex] = useState(-1);

  useEffect(() => {
    setIndex(-1);
    if (!enabled || startTimeMs == null || words.length <= 1) return;

    const compute = () => {
      const elapsed = elapsedFromStart(startTimeMs);
      if (elapsed == null) return -1;
      return findWordIndex(words, elapsed);
    };

    if (!isPlaying) {
      setIndex(compute());
      return;
    }

    let cancelled = false;
    let frame = 0;
    const loop = () => {
      if (cancelled) return;
      const next = compute();
      setIndex((previous) => (previous === next ? previous : next));
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);

    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
    };
  }, [words, startTimeMs, isPlaying, enabled]);

  return index;
}
