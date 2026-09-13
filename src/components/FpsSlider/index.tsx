import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  PanResponder,
  Text,
  View,
  type LayoutChangeEvent,
} from "react-native";
import type { VisualizerFps } from "../../core/player";
import { styles, THUMB } from "./styles";

/** Fixed frame-rate stops. `0` disables the visualizer. */
export const FPS_STOPS: readonly VisualizerFps[] = [0, 30, 48, 60];

interface Props {
  value: VisualizerFps;
  onChange: (value: VisualizerFps) => void;
}

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

/**
 * Step slider for the oscilloscope frame rate. Fixed stops only, so the thumb
 * always snaps to one of `FPS_STOPS`; drag anywhere on the track (or its
 * labels) to select. Implemented with `PanResponder` to avoid a native slider
 * dependency.
 */
export function FpsSlider({ value, onChange }: Props) {
  const trackRef = useRef<View>(null);
  const trackX = useRef(0);
  const trackWidth = useRef(0);
  const valueRef = useRef<VisualizerFps>(value);
  const [local, setLocal] = useState<VisualizerFps>(value);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    valueRef.current = value;
    setLocal(value);
  }, [value]);

  const indexFor = useCallback((absoluteX: number): VisualizerFps => {
    const usable = Math.max(1, trackWidth.current - THUMB);
    const ratio = clamp01(
      (absoluteX - trackX.current - THUMB / 2) / usable,
    );
    const index = Math.round(ratio * (FPS_STOPS.length - 1));
    return FPS_STOPS[index];
  }, []);

  const commit = useCallback(
    (next: VisualizerFps) => {
      if (valueRef.current === next) return;
      valueRef.current = next;
      setLocal(next);
      onChange(next);
    },
    [onChange],
  );

  const responder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: (event) => {
          commit(indexFor(event.nativeEvent.pageX));
        },
        onPanResponderMove: (event) => {
          commit(indexFor(event.nativeEvent.pageX));
        },
      }),
    [commit, indexFor],
  );

  const handleLayout = useCallback((_event: LayoutChangeEvent) => {
    trackRef.current?.measureInWindow((x, _y, measuredWidth) => {
      trackX.current = x;
      trackWidth.current = measuredWidth;
      setWidth(measuredWidth);
    });
  }, []);

  const activeIndex = FPS_STOPS.indexOf(local);
  const usable = Math.max(0, width - THUMB);
  const thumbLeft = usable * (activeIndex / (FPS_STOPS.length - 1));

  return (
    <View style={styles.container} {...responder.panHandlers}>
      <View ref={trackRef} style={styles.track} onLayout={handleLayout}>
        <View style={[styles.trackFill, { width: thumbLeft + THUMB / 2 }]} />
        <View
          style={[
            styles.thumb,
            { left: thumbLeft },
            local > 0 ? styles.thumbActive : styles.thumbInactive,
          ]}
        />
      </View>
      <View style={styles.labels}>
        {FPS_STOPS.map((stop) => (
          <Text
            key={stop}
            style={[styles.label, stop === local && styles.labelActive]}
          >
            {stop}
          </Text>
        ))}
      </View>
    </View>
  );
}
