// @vitest-environment jsdom
import { act, cleanup, render, screen } from "@testing-library/react";
import { forwardRef, useImperativeHandle, useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Oscilloscope } from "@/components/Oscilloscope/index.android";

vi.mock("react-native", async () =>
  (await import("@/__tests__/react-native-mock")).createReactNativeMock(),
);

const webview = vi.hoisted(() => ({
  postMessage: vi.fn(),
  onMessage: null as null | ((event: { nativeEvent: { data: string } }) => void),
}));

vi.mock("react-native-webview", () => ({
  WebView: forwardRef(function WebView(
    props: { onMessage: typeof webview.onMessage },
    ref,
  ) {
    webview.onMessage = props.onMessage;
    useImperativeHandle(ref, () => ({ postMessage: webview.postMessage }));
    return <div data-testid="webview" />;
  }),
}));

const mocks = vi.hoisted(() => ({
  player: {} as Record<string, unknown>,
  hz: 30,
  backgrounded: false,
  listener: null as null | ((window: object) => void),
  unsubscribe: vi.fn(),
  /** Re-renders the (memoized, prop-less) component after a mock change. */
  forceRender: () => undefined as void,
}));

vi.mock("@/contexts/app-state/AppStateProvider", () => ({
  useIsBackgrounded: () => mocks.backgrounded,
}));
vi.mock("@/contexts/player/PlayerProvider", () => ({
  usePlayer: () => {
    const [, bump] = useState(0);
    mocks.forceRender = () => bump((n) => n + 1);
    return mocks.player;
  },
}));
vi.mock("@/contexts/user/UserSettingsProvider", () => ({
  useUserSettings: () => ({ settings: { visualizerHz: mocks.hz } }),
}));

const reportVisualizerDelay = vi.fn();

const setPlayer = (overrides: Record<string, unknown> = {}) => {
  mocks.player = {
    isPlaying: true,
    visualizerSupported: true,
    reportVisualizerDelay,
    subscribeVisualizerWindows: (listener: (window: object) => void) => {
      mocks.listener = listener;
      return mocks.unsubscribe;
    },
    ...overrides,
  };
};

const sent = () => webview.postMessage.mock.calls.map(([json]) => JSON.parse(json));
const message = (payload: unknown) =>
  act(() => webview.onMessage!({ nativeEvent: { data: JSON.stringify(payload) } }));

describe("Oscilloscope (Android)", () => {
  beforeEach(() => {
    mocks.hz = 30;
    mocks.backgrounded = false;
    mocks.listener = null;
    setPlayer();
  });
  afterEach(cleanup);

  describe("visibility", () => {
    it("renders the WebView while playing with a supported sampler", () => {
      render(<Oscilloscope />);
      expect(screen.getByTestId("webview")).toBeTruthy();
      expect(mocks.listener).not.toBeNull();
    });

    it.each([
      ["paused", { isPlaying: false }, {}],
      ["sampling unsupported", { visualizerSupported: false }, {}],
      ["visualizer turned off", {}, { hz: 0 }],
      ["app backgrounded", {}, { backgrounded: true }],
    ])("renders nothing and never subscribes when %s", (_label, player, flags) => {
      setPlayer(player);
      Object.assign(mocks, flags);
      const { container } = render(<Oscilloscope />);
      expect(container.firstChild).toBeNull();
      expect(mocks.listener).toBeNull();
    });
  });

  describe("bridge", () => {
    it("forwards each decoded window as an 8-bit hex payload with a rising seq", () => {
      render(<Oscilloscope />);
      act(() =>
        mocks.listener!({
          // -1 -> 00, 0 -> 80 (127.5 rounds up), 1 -> ff, out of range clamps.
          targetWave: [-1, 0, 1, 5, -5],
          nativeIntervalMs: 23,
          outputLatencyMs: 120,
        }),
      );
      act(() =>
        mocks.listener!({ targetWave: [1], nativeIntervalMs: 25, outputLatencyMs: 90 }),
      );
      expect(sent()).toEqual([
        { type: "wave", wave: "0080ffff00", interval: 23, delay: 120, seq: 1 },
        { type: "wave", wave: "ff", interval: 25, delay: 90, seq: 2 },
      ]);
    });

    it("unsubscribes on unmount without a stop message if the page never announced itself", () => {
      const { unmount } = render(<Oscilloscope />);
      unmount();
      expect(mocks.unsubscribe).toHaveBeenCalledTimes(1);
      expect(sent()).toEqual([]);
    });

    it("tells a ready page to stop when the subscription is replaced", () => {
      render(<Oscilloscope />);
      message({ type: "ready" });
      // A new subscribe function (e.g. the player re-created) re-subscribes
      // while the WebView is still mounted, so the stop can be delivered.
      setPlayer();
      act(() => mocks.forceRender());
      expect(mocks.unsubscribe).toHaveBeenCalledTimes(1);
      expect(sent()).toEqual([{ type: "stop", seq: 1 }]);
    });

    it("does not tell an unannounced page to stop when the subscription is replaced", () => {
      render(<Oscilloscope />);
      setPlayer();
      act(() => mocks.forceRender());
      expect(mocks.unsubscribe).toHaveBeenCalledTimes(1);
      expect(sent()).toEqual([]);
    });

    it("reports the page's applied delay to the player", () => {
      render(<Oscilloscope />);
      message({ type: "applied", delay: 140 });
      expect(reportVisualizerDelay).toHaveBeenCalledExactlyOnceWith(140);
    });

    it("ignores applied messages without a numeric delay, unknown types and junk", () => {
      render(<Oscilloscope />);
      message({ type: "applied", delay: "140" });
      message({ type: "applied" });
      message({ type: "other", delay: 5 });
      message(null);
      act(() => webview.onMessage!({ nativeEvent: { data: "not json" } }));
      expect(reportVisualizerDelay).not.toHaveBeenCalled();
    });
  });
});
