// @vitest-environment jsdom
import { act, render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { Cover } from "@/components/Cover";

// The mocked Image records which SOURCE it was rendered with, so the test
// can observe the fallback↔remote reload cycle without a real image decoder.
const LOADED = (width: number, height: number) => ({
  source: { width, height },
});
const renders: ("remote" | "bundled")[] = [];
// Latest props handed to the mocked Image (onError/onLoad drive the flow).
let lastProps: {
  source: { uri?: string } | number | object;
  onError?: () => void;
  onLoad?: (event: { source: { width: number; height: number } }) => void;
  style?: unknown;
  allowDownscaling?: boolean;
} | null = null;

vi.mock("expo-image", () => ({
  Image: (props: {
    source: { uri?: string } | number | object;
    onError?: () => void;
    onLoad?: (event: { source: { width: number; height: number } }) => void;
    style?: unknown;
    allowDownscaling?: boolean;
  }) => {
    lastProps = props;
    const isRemote = typeof props.source === "object" && "uri" in props.source;
    const kind = isRemote ? "remote" : "bundled";
    if (renders[renders.length - 1] !== kind) renders.push(kind);
    return null;
  },
}));

vi.mock("react-native", () => ({
  Dimensions: { get: () => ({ width: 390, height: 844 }) },
  Platform: {},
  StyleSheet: { create: (styles: object) => styles },
  View: ({ children }: { children?: unknown }) => children,
}));

vi.mock("@/contexts/user/UserSettingsProvider", () => ({
  useUserSettings: () => ({ settings: { cacheEnabled: true } }),
}));

vi.mock("@/core/services/cover-cache-registry.service", () => ({
  coverCacheRegistry: { tag: vi.fn() },
}));

const COVER = "https://cdn.animu.test/cover.jpg";
/** Every remote-source render = one load attempt of the real URL. */
const REMOTE_ATTEMPTS = () => renders.filter((kind) => kind === "remote").length;

describe("Cover bounded retry", () => {
  beforeEach(() => {
    renders.length = 0;
    lastProps = null;
    vi.useFakeTimers();
    // Metro defines this in every bundle; plain node/tests don't.
    vi.stubGlobal("__DEV__", false);
  });

  it("stops retrying a dead URL after two retries", () => {
    render(<Cover cover={COVER} />);
    expect(REMOTE_ATTEMPTS()).toBe(1);
    for (let retry = 1; retry <= 2; retry += 1) {
      act(() => lastProps?.onError?.());
      // The fallback (bundled asset) shows and loads — that must not reset the count.
      act(() => lastProps?.onLoad?.(LOADED(240, 240)));
      act(() => {
        vi.advanceTimersByTime(3000);
      });
      expect(REMOTE_ATTEMPTS()).toBe(1 + retry);
    }
    act(() => lastProps?.onError?.());
    // Let it run long: no further reloads, fallback stays.
    act(() => {
      vi.advanceTimersByTime(120_000);
    });
    expect(REMOTE_ATTEMPTS()).toBe(3);
    expect((lastProps?.source as { uri?: string } | undefined)?.uri).toBeUndefined();
  });

  it("still self-heals a single transient failure", () => {
    render(<Cover cover={COVER} />);

    act(() => lastProps?.onError?.());
    act(() => {
      vi.advanceTimersByTime(3000);
    });
    expect(REMOTE_ATTEMPTS()).toBe(2); // failure #1 → retry reloads

    // The retry succeeds: state is clean again for any future failure.
    act(() => lastProps?.onLoad?.(LOADED(240, 240)));
    expect(lastProps?.source).toHaveProperty("uri", COVER);
  });

  it("keeps the square frame unless asked to preserve the aspect ratio", () => {
    render(<Cover cover={COVER} />);

    act(() => lastProps?.onLoad?.(LOADED(300, 600)));
    expect(JSON.stringify(lastProps?.style)).not.toContain("aspectRatio");
  });

  it("keeps the full width and follows the image height", () => {
    const { rerender } = render(<Cover cover={COVER} preserveAspectRatio />);
    const SIZE = (lastProps?.style as { width?: number }[]).at(-1)?.width ?? 0;
    expect(lastProps?.style).toContainEqual({ width: SIZE, height: SIZE });
    let n = 0;
    const load = (width: number, height: number) => {
      rerender(<Cover cover={`https://cdn.test/${++n}.jpg`} preserveAspectRatio />);
      act(() => lastProps?.onLoad?.(LOADED(width, height)));
    };

    // Wide art gets shorter.
    load(400, 200);
    expect(lastProps?.style).toContainEqual({ width: SIZE, height: SIZE / 2 });

    // Tall art gets taller, with no cap.
    load(400, 500);
    expect(lastProps?.style).toContainEqual({ width: SIZE, height: SIZE * 1.25 });
    load(250, 1000);
    expect(lastProps?.style).toContainEqual({ width: SIZE, height: SIZE * 4 });

    // Extreme wide ratios are clamped, not turned into a strip.
    load(1000, 100);
    expect(lastProps?.style).toContainEqual({ width: SIZE, height: SIZE / 2 });

    // A new cover never renders with the previous artwork's proportions.
    rerender(<Cover cover="https://cdn.test/other.jpg" preserveAspectRatio />);
    expect(lastProps?.style).toContainEqual({ width: SIZE, height: SIZE });
  });

  it("contains the artwork in a bounded frame when given a size", () => {
    const { rerender } = render(<Cover cover={COVER} preserveAspectRatio size={200} />);
    expect(lastProps?.style).toContainEqual({ width: 200, height: 200 });
    let n = 0;
    const load = (width: number, height: number) => {
      rerender(<Cover cover={`https://cdn.test/${++n}.jpg`} preserveAspectRatio size={200} />);
      act(() => lastProps?.onLoad?.(LOADED(width, height)));
    };

    // Wide art keeps the width and gets shorter (clamped at 2:1).
    load(400, 200);
    expect(lastProps?.style).toContainEqual({ width: 200, height: 100 });
    load(1000, 100);
    expect(lastProps?.style).toContainEqual({ width: 200, height: 100 });

    // Tall art keeps the height and narrows: it never outgrows the frame.
    load(250, 1000);
    expect(lastProps?.style).toContainEqual({ width: 50, height: 200 });
    load(400, 500);
    expect(lastProps?.style).toContainEqual({ width: 160, height: 200 });
  });

  it("ignores a re-measure that is only rounding, in either frame", () => {
    const { rerender } = render(<Cover cover={COVER} preserveAspectRatio size={300} />);
    act(() => lastProps?.onLoad?.(LOADED(300, 299)));
    expect(lastProps?.style).toContainEqual({ width: 300, height: 299 });
    // A decode for the 299 px frame reports a square: rounding, the frame stays.
    act(() => lastProps?.onLoad?.(LOADED(299, 299)));
    expect(lastProps?.style).toContainEqual({ width: 300, height: 299 });

    // The same on Home's unbounded slot.
    rerender(<Cover cover="https://cdn.test/home.jpg" preserveAspectRatio />);
    const SIZE = (lastProps?.style as { width?: number }[]).at(-1)?.width ?? 0;
    act(() => lastProps?.onLoad?.(LOADED(300, 299)));
    const measured = { width: SIZE, height: (SIZE * 299) / 300 };
    expect(lastProps?.style).toContainEqual(measured);
    act(() => lastProps?.onLoad?.(LOADED(299, 299)));
    expect(lastProps?.style).toContainEqual(measured);
  });

  it("corrects a late load of the previous cover once the new one loads", () => {
    const { rerender } = render(<Cover cover={COVER} preserveAspectRatio size={200} />);
    rerender(<Cover cover="https://cdn.test/next.jpg" preserveAspectRatio size={200} />);
    act(() => lastProps?.onLoad?.(LOADED(400, 200))); // the old cover's late event
    expect(lastProps?.style).toContainEqual({ width: 200, height: 100 });
    act(() => lastProps?.onLoad?.(LOADED(250, 1000))); // the new, tall cover
    expect(lastProps?.style).toContainEqual({ width: 50, height: 200 });
    expect(lastProps?.style).not.toContainEqual({ width: 200, height: 100 });
  });

  it("decodes a measured cover at full size, so a resize never reloads it", () => {
    const { rerender } = render(<Cover cover={COVER} preserveAspectRatio />);
    expect(lastProps?.allowDownscaling).toBe(false);
    rerender(<Cover cover={COVER} />);
    expect(lastProps?.allowDownscaling).toBe(true);
  });

  it("sizes the plain square frame too", () => {
    render(<Cover cover={COVER} size={150} />);
    expect(lastProps?.style).toContainEqual({ width: 150, height: 150 });
  });
});
