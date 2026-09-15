import React, { useCallback, useEffect, useRef, useState } from "react";
import { View, useWindowDimensions } from "react-native";
import Svg, { Polyline } from "react-native-svg";
import type { WaveformFrame } from "../../core/player";
import { useIsBackgrounded } from "../../contexts/app-state/AppStateProvider";
import { usePlayer } from "../../contexts/player/PlayerProvider";
import { useUserSettings } from "../../contexts/user/UserSettingsProvider";
import { THEME } from "../../theme";
import { styles } from "./styles";

const WAVE_HEIGHT = 75;
/**
 * Horizontal reference from the web player (`player.animu.moe`): its canvas
 * maps 1000 audio samples across the viewport width via
 * `x = i * (canvasWidth / 1000)`. Reproducing that fixed scale keeps the
 * trace's proportions identical to the website instead of stretching the
 * whole wave to the window width.
 */
const SCOPE_SAMPLE_SPAN = 1000;
/** CRT power-on / power-off transition durations (ms). */
const POWER_ON_MS = 420;
const POWER_OFF_MS = 200;
/** Single-sample minimum so the polyline never divides by zero. */
const MIN_POINTS = 2;

const now = () => Date.now();
const smoothstep = (t: number) => t * t * (3 - 2 * t);
const clamp01 = (t: number) => (t < 0 ? 0 : t > 1 ? 1 : t);

/**
 * CRT-style geometry for the current transition progress.
 *
 * Power-on: a flat full-width trace appears quickly, then opens vertically.
 * Power-off: the trace collapses vertically to a line, then squeezes to the
 * centre. `progress` runs 0→1 turning on and 1→0 turning off.
 */
function geometry(progress: number, turningOn: boolean) {
  if (turningOn) {
    // Horizontal reveal from the centre, then vertical amplitude growth.
    const reveal = clamp01(progress / 0.3);
    const amp = smoothstep(clamp01((progress - 0.08) / 0.72));
    return { reveal, amp };
  }
  const off = 1 - progress;
  const amp = smoothstep(clamp01(1 - off / 0.6));
  const reveal = off <= 0.6 ? 1 : clamp01(1 - (off - 0.6) / 0.4);
  return { reveal, amp };
}

/**
 * Serializes one frame to an SVG path `d`, or `""` when the trace should be
 * hidden (no frame yet, or fully collapsed). Mirrors the web player's
 * `(0.5 + value / 2) * height` mapping and its fixed horizontal span.
 */
function buildPath(
  frame: WaveformFrame | null,
  progress: number,
  turningOn: boolean,
  width: number,
): string {
  if (!frame || frame.wave.length < MIN_POINTS || progress <= 0) return "";
  const { reveal, amp } = geometry(progress, turningOn);
  if (reveal <= 0) return "";
  const { wave } = frame;
  const last = wave.length - 1;
  const centre = last / 2;
  const half = centre * reveal;
  const from = Math.max(0, Math.floor(centre - half));
  const to = Math.min(last, Math.ceil(centre + half));
  const scaleX = width / SCOPE_SAMPLE_SPAN;
  const out: string[] = [];
  for (let i = from; i <= to; i++) {
    const x = i * scaleX;
    // The web canvas draws a fixed span and clips anything past the edge;
    // stop there so the extra resampled points never overflow the view.
    if (x > width) break;
    // Matches the original mapping, scaled by the CRT amplitude.
    const y = (0.5 + (wave[i] * amp) / 2) * WAVE_HEIGHT;
    out.push(`${x} ${y}`);
  }
  return `M${out.join(" ")}`;
}

/**
 * Home oscilloscope (Android).
 *
 * Draws the player's decoded PCM as a time-domain waveform with
 * `react-native-svg`. It subscribes imperatively to `PlayerService`'s sampler
 * rather than reading a store, and pushes each frame **straight to the native
 * SVG node** with `setNativeProps` — no React render, no component-tree
 * re-serialization per frame. That is the hot path the web player's `<canvas>`
 * loop avoids, and the reason the SVG version used to stutter.
 *
 * `phase` only gates mount/unmount of the SVG. Nothing is rendered while
 * paused or when the frame rate is 0 (`0` = off). The CRT power-on starts on
 * the *first received frame* (so there is an animation even when the stream
 * takes a moment to buffer) and the power-off runs when playback stops.
 * `react-freeze` keeps it paused while backgrounded.
 */
export const Oscilloscope = React.memo(function Oscilloscope() {
  const { subscribeVisualizer, isPlaying, visualizerSupported } = usePlayer();
  const { settings } = useUserSettings();
  const isBackgrounded = useIsBackgrounded();
  const { width } = useWindowDimensions();

  const [phase, setPhase] = useState<"idle" | "on" | "off">("idle");
  const [running, setRunning] = useState(false);

  const polylineRef = useRef<Polyline | null>(null);
  const frameRef = useRef<WaveformFrame | null>(null);
  const progressRef = useRef(0);
  const targetRef = useRef(0);
  const phaseRef = useRef<"idle" | "on" | "off">("idle");
  const widthRef = useRef(width);
  widthRef.current = width;

  const wantsOn =
    isPlaying &&
    visualizerSupported &&
    settings.visualizerHz > 0 &&
    !isBackgrounded;

  /**
   * Pushes the current trace to the native node. `react-native-svg` converts
   * the `d` path on the native side, so this bypasses React reconciliation
   * entirely — the trace is recomputed from refs, not props.
   */
  const draw = useCallback(() => {
    polylineRef.current?.setNativeProps({
      d: buildPath(
        frameRef.current,
        progressRef.current,
        targetRef.current === 1,
        widthRef.current,
      ),
    });
  }, []);

  // Subscribe only while we want a signal; render each frame imperatively.
  useEffect(() => {
    if (!wantsOn) return;
    return subscribeVisualizer((next) => {
      frameRef.current = next;
      const current = phaseRef.current;
      if (current === "idle" || current === "off") {
        // Starting from rest begins at zero; reversing mid power-off keeps the
        // current progress so the trace doesn't jump.
        if (current === "idle") progressRef.current = 0;
        targetRef.current = 1;
        phaseRef.current = "on";
        setPhase("on");
        setRunning(true);
        return;
      }
      if (progressRef.current >= 1) draw();
    });
  }, [wantsOn, subscribeVisualizer, draw]);

  // Playback stopped → collapse the trace.
  useEffect(() => {
    if (!wantsOn && phaseRef.current === "on") {
      targetRef.current = 0;
      phaseRef.current = "off";
      setPhase("off");
      setRunning(true);
    }
  }, [wantsOn]);

  // Single rAF loop drives whichever transition is in flight.
  useEffect(() => {
    if (!running) return;
    let last = now();
    let raf = requestAnimationFrame(function tick() {
      const current = now();
      const dt = current - last;
      last = current;
      const target = targetRef.current;
      const value = progressRef.current;
      const step = dt / (target > value ? POWER_ON_MS : POWER_OFF_MS);
      progressRef.current =
        target > value
          ? Math.min(target, value + step)
          : Math.max(target, value - step);
      draw();

      if (progressRef.current === target) {
        setRunning(false);
        if (target === 0) {
          phaseRef.current = "idle";
          frameRef.current = null;
          setPhase("idle");
        }
        return;
      }
      raf = requestAnimationFrame(tick);
    });
    return () => cancelAnimationFrame(raf);
  }, [running, draw]);

  if (phase === "idle") return null;

  return (
    <View style={styles.container} pointerEvents="none">
      <View style={styles.canvas}>
        <Svg width={width} height={WAVE_HEIGHT}>
          <Polyline
            ref={polylineRef}
            fill="none"
            stroke={THEME.COLORS.VISUALIZER}
            strokeWidth={3}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        </Svg>
      </View>
    </View>
  );
});
