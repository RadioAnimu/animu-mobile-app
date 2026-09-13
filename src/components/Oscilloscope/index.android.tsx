import React, { useEffect, useMemo, useRef, useState } from "react";
import { View, useWindowDimensions } from "react-native";
import Svg, { Polyline } from "react-native-svg";
import type { WaveformFrame } from "../../core/player";
import { useIsBackgrounded } from "../../contexts/app-state/AppStateProvider";
import { usePlayer } from "../../contexts/player/PlayerProvider";
import { useUserSettings } from "../../contexts/user/UserSettingsProvider";
import { THEME } from "../../theme";
import { styles } from "./styles";

const WAVE_HEIGHT = 75;
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
 * Home oscilloscope (Android).
 *
 * Draws the player's decoded PCM as a time-domain waveform with
 * `react-native-svg`. It subscribes imperatively to `PlayerService`'s sampler
 * rather than reading a store, because frames arrive up to 60 times a second
 * and must not re-render the rest of the app tree.
 *
 * Nothing is rendered while paused or when the frame rate is 0 (`0` = off).
 * The CRT power-on starts on the *first received frame* (so there is an
 * animation even when the stream takes a moment to buffer) and the power-off
 * runs when playback stops. `react-freeze` keeps it paused while backgrounded.
 */
export const Oscilloscope = React.memo(function Oscilloscope() {
  const { subscribeVisualizer, isPlaying, visualizerSupported } = usePlayer();
  const { settings } = useUserSettings();
  const isBackgrounded = useIsBackgrounded();
  const { width } = useWindowDimensions();

  const [frame, setFrame] = useState<WaveformFrame | null>(null);
  const [progress, setProgress] = useState(0);
  const [phase, setPhase] = useState<"idle" | "on" | "off">("idle");
  const [running, setRunning] = useState(false);

  const progressRef = useRef(0);
  const targetRef = useRef(0);

  const wantsOn =
    isPlaying &&
    visualizerSupported &&
    settings.visualizerFps > 0 &&
    !isBackgrounded;

  // Subscribe only while we want a signal.
  useEffect(() => {
    if (!wantsOn) return;
    return subscribeVisualizer(setFrame);
  }, [wantsOn, subscribeVisualizer]);

  // State machine: start power-on on the first frame, power-off when stopped.
  useEffect(() => {
    if (wantsOn && frame) {
      if (phase === "idle" || phase === "off") {
        // Starting from rest begins at zero; reversing mid power-off keeps the
        // current progress so the trace doesn't jump.
        if (phase === "idle") progressRef.current = 0;
        targetRef.current = 1;
        setPhase("on");
        setRunning(true);
      }
      return;
    }
    if (!wantsOn && phase === "on") {
      targetRef.current = 0;
      setPhase("off");
      setRunning(true);
    }
  }, [wantsOn, frame, phase]);

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
      setProgress(progressRef.current);

      if (progressRef.current === target) {
        setRunning(false);
        if (target === 0) {
          setPhase("idle");
          setFrame(null);
        }
        return;
      }
      raf = requestAnimationFrame(tick);
    });
    return () => cancelAnimationFrame(raf);
  }, [running]);

  const points = useMemo(() => {
    if (!frame || frame.wave.length < MIN_POINTS || progress <= 0) return null;
    const { reveal, amp } = geometry(progress, targetRef.current === 1);
    if (reveal <= 0) return null;
    const { wave } = frame;
    const last = wave.length - 1;
    const centre = last / 2;
    const half = centre * reveal;
    const from = Math.max(0, Math.floor(centre - half));
    const to = Math.min(last, Math.ceil(centre + half));
    const scaleX = width / last;
    const out: string[] = [];
    for (let i = from; i <= to; i++) {
      const x = i * scaleX;
      // Matches the original mapping, scaled by the CRT amplitude.
      const y = (0.5 + (wave[i] * amp) / 2) * WAVE_HEIGHT;
      out.push(`${x},${y}`);
    }
    return out.join(" ");
  }, [frame, progress, width]);

  if (phase === "idle" || !points) return null;

  return (
    <View style={styles.container} pointerEvents="none">
      <View style={styles.canvas}>
        <Svg width={width} height={WAVE_HEIGHT}>
          <Polyline
            points={points}
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
