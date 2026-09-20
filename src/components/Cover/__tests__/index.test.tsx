// @vitest-environment jsdom
import { act, render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { Cover } from "@/components/Cover";

// The mocked Image records which SOURCE it was rendered with, so the test
// can observe the fallback↔remote reload cycle without a real image decoder.
const renders: ("remote" | "bundled")[] = [];
// Latest props handed to the mocked Image (onError/onLoad drive the flow).
let lastProps: {
  source: { uri?: string } | number | object;
  onError?: () => void;
  onLoad?: () => void;
} | null = null;

vi.mock("expo-image", () => ({
  Image: (props: {
    source: { uri?: string } | number | object;
    onError?: () => void;
    onLoad?: () => void;
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
    act(() => lastProps?.onLoad?.()); // fallback onLoad — must NOT reset the counter

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
    act(() => lastProps?.onLoad?.());
    expect(lastProps?.source).toHaveProperty("uri", COVER);
  });
});
