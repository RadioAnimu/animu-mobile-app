import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  PanResponder,
  Text,
  View,
  type LayoutChangeEvent,
} from "react-native";
import { styles, THUMB } from "./styles";

interface Props {
  /** Fixed selectable stops, ascending. */
  stops: number[];
  value: number;
  /** Formats a stop for both the thumb position and the tick labels. */
  formatLabel: (value: number) => string;
  onChange: (value: number) => void;
}

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

/**
 * Step slider with fixed stops (display refresh rates). The thumb always snaps
 * to a stop; drag anywhere on the track or its labels to select. Implemented
 * with `PanResponder` to avoid a native slider dependency.
 */
export function HzSlider({ stops, value, formatLabel, onChange }: Props) {
  const trackRef = useRef<View>(null);
  const trackX = useRef(0);
  const trackWidth = useRef(0);
  const valueRef = useRef(value);
  const [local, setLocal] = useState(value);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    valueRef.current = value;
    setLocal(value);
  }, [value]);

  const indexFor = useCallback(
    (absoluteX: number): number => {
      const usable = Math.max(1, trackWidth.current - THUMB);
      const ratio = clamp01((absoluteX - trackX.current - THUMB / 2) / usable);
      const index = Math.round(ratio * Math.max(1, stops.length - 1));
      return stops[Math.min(stops.length - 1, Math.max(0, index))];
    },
    [stops],
  );

  const commit = useCallback(
    (next: number) => {
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

  const activeIndex = Math.max(0, stops.indexOf(local));
  const usable = Math.max(0, width - THUMB);
  const thumbLeft =
    usable * (activeIndex / Math.max(1, stops.length - 1));

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
        {stops.map((stop) => (
          <Text
            key={stop}
            style={[styles.label, stop === local && styles.labelActive]}
          >
            {formatLabel(stop)}
          </Text>
        ))}
      </View>
    </View>
  );
}
