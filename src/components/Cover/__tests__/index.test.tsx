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
} | null = null;

vi.mock("expo-image", () => ({
  Image: (props: {
    source: { uri?: string } | number | object;
    onError?: () => void;
    onLoad?: (event: { source: { width: number; height: number } }) => void;
    style?: unknown;
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

  it("stops retrying a dead URL after MAX_FAILURES", () => {
    render(<Cover cover={COVER} />);

    // Failure #1 → fallback (the bundled asset) shows and LOADS.
    act(() => lastProps?.onError?.());
    act(() => lastProps?.onLoad?.(LOADED(240, 240))); // fallback onLoad — must NOT reset the counter

    // Retry after the 3s delay; failure #2 must exhaust the bound.
    act(() => vi.advanceTimersByTime(3000));
    expect(REMOTE_ATTEMPTS()).toBe(2);
    act(() => lastProps?.onError?.());
    expect((lastProps?.source as { uri?: string })?.uri).toBeUndefined();

    // Let it run long: no further reloads, fallback stays.
    act(() => vi.advanceTimersByTime(120_000));
    expect(REMOTE_ATTEMPTS()).toBe(2);
    expect((lastProps?.source as { uri?: string })?.uri).toBeUndefined();
  });

  it("still self-heals a single transient failure", () => {
    render(<Cover cover={COVER} />);

    act(() => lastProps?.onError?.());
    act(() => vi.advanceTimersByTime(3000));
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

    // Wide art gets shorter.
    act(() => lastProps?.onLoad?.(LOADED(400, 200)));
    expect(lastProps?.style).toContainEqual({ width: SIZE, height: SIZE / 2 });

    // Tall art gets taller, with no cap.
    act(() => lastProps?.onLoad?.(LOADED(400, 500)));
    expect(lastProps?.style).toContainEqual({ width: SIZE, height: SIZE * 1.25 });
    act(() => lastProps?.onLoad?.(LOADED(250, 1000)));
    expect(lastProps?.style).toContainEqual({ width: SIZE, height: SIZE * 4 });

    // Extreme wide ratios are clamped, not turned into a strip.
    act(() => lastProps?.onLoad?.(LOADED(1000, 100)));
    expect(lastProps?.style).toContainEqual({ width: SIZE, height: SIZE / 2 });

    // A new cover never renders with the previous artwork's proportions.
    rerender(<Cover cover="https://cdn.test/other.jpg" preserveAspectRatio />);
    expect(lastProps?.style).toContainEqual({ width: SIZE, height: SIZE });
  });
});
