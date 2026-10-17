// @vitest-environment jsdom
import { act, cleanup, render, screen } from "@testing-library/react";
import { forwardRef, useEffect, useImperativeHandle, useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Oscilloscope } from "@/components/Oscilloscope/Oscilloscope";
import { loadPage, play } from "@/components/Oscilloscope/__tests__/page-harness";
import { THEME } from "@/theme";

vi.mock("react-native", async () =>
  (await import("@/__tests__/react-native-mock")).createReactNativeMock(),
);

const webview = vi.hoisted(() => ({
  postMessage: vi.fn(),
  onMessage: null as null | ((event: { nativeEvent: { data: string } }) => void),
  onRenderProcessGone: null as null | (() => void),
  html: "",
  layerType: "",
  mounts: 0,
}));

vi.mock("react-native-webview", () => ({
  WebView: forwardRef(function WebView(
    props: {
      onMessage: typeof webview.onMessage;
      onRenderProcessGone: () => void;
      source: { html: string };
      androidLayerType: string;
    },
    ref,
  ) {
    webview.onMessage = props.onMessage;
    webview.onRenderProcessGone = props.onRenderProcessGone;
    useEffect(() => {
      webview.mounts += 1;
    }, []);
    webview.html = props.source.html;
    webview.layerType = props.androidLayerType;
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
    it("encodes every byte with the lookup table and preserves non-finite legacy output", () => {
      render(<Oscilloscope />);
      const points = Array.from({ length: 256 }, (_, byte) => byte / 127.5 - 1);
      act(() => mocks.listener!({ targetWave: points, nativeIntervalMs: 25, outputLatencyMs: 0 }));
      expect(sent()[0].wave).toBe(
        Array.from({ length: 256 }, (_, byte) => byte.toString(16).padStart(2, "0")).join(""),
      );
      act(() => mocks.listener!({
        targetWave: [Number.NEGATIVE_INFINITY, Number.POSITIVE_INFINITY, NaN],
        nativeIntervalMs: 25,
        outputLatencyMs: 0,
      }));
      expect(sent()[1].wave).toBe("00ffNaN");
    });

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

    it("forwards each window's PCM duration for the page's read clock", () => {
      render(<Oscilloscope />);
      act(() =>
        mocks.listener!({ targetWave: [0], nativeIntervalMs: 24, windowMs: 26.12, outputLatencyMs: 90 }),
      );
      expect(sent()[0]).toMatchObject({ interval: 24, duration: 26.12 });
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

    it("forgets the page once the WebView is gone, so a new page must announce itself", () => {
      render(<Oscilloscope />);
      message({ type: "ready" });
      setPlayer({ isPlaying: false });
      act(() => mocks.forceRender());
      setPlayer();
      act(() => mocks.forceRender());
      // Replacing the subscription again must not stop the new, silent page.
      setPlayer();
      act(() => mocks.forceRender());
      expect(sent()).toEqual([]);
    });

    it("remounts a fresh page when the WebView's renderer process dies", () => {
      render(<Oscilloscope />);
      message({ type: "ready" });
      const mounts = webview.mounts;
      act(() => webview.onRenderProcessGone!());
      expect(webview.mounts).toBe(mounts + 1);
      setPlayer();
      act(() => mocks.forceRender());
      expect(sent()).toEqual([]);
    });

    it("ignores page messages other than its readiness, including junk", () => {
      render(<Oscilloscope />);
      message({ type: "applied", delay: 140 });
      message({ type: "other", delay: 5 });
      message(null);
      act(() => webview.onMessage!({ nativeEvent: { data: "not json" } }));
      expect(reportVisualizerDelay).not.toHaveBeenCalled();
      expect(sent()).toEqual([]);
    });
  });

  describe("embedded page", () => {
    const page = (width?: number) => {
      render(<Oscilloscope />);
      return loadPage(webview.html, width);
    };
    // Window serial s is produced at (s - 1) * 25 ms; read `delay` later it
    // should be on screen, so this is where the read position belongs.
    const due = (at: number, delay: number) => (at - delay) / 25 + 1;
    const steady = (from: number, to: number, period = 25) =>
      Array.from({ length: Math.floor((to - from) / period) }, (_, k) => from + k * period);

    it("paints the idle flat line once and caches canvas, context and stroke state", () => {
      const p = page(320.8);
      expect(p.pageDocument.getElementById).toHaveBeenCalledTimes(1);
      expect(p.canvas.getContext).toHaveBeenCalledTimes(1);
      expect(p.widthAssignments).toEqual([320]);
      expect(p.heightAssignments).toEqual([75]);
      expect(p.commands.at(-1)).toEqual(["stroke", THEME.COLORS.VISUALIZER, 3, "round", "round"]);
      expect(new Set(p.vertices().map(([, y]) => y))).toEqual(new Set([37.5]));

      p.commands.length = 0;
      p.frame(16);
      expect(p.commands).toEqual([]); // nothing new to show: no stroke

      p.pageWindow.innerWidth = 321.2;
      p.frame(32);
      expect(p.widthAssignments).toEqual([320, 321]);
      expect(p.heightAssignments).toEqual([75]);
      // The resize reset the context: its stroke state is re-applied once.
      expect(p.commands.filter(([name]) =>
        ["strokeStyle", "lineWidth", "lineJoin", "lineCap"].includes(name))).toHaveLength(4);
      expect(p.commands.at(-1)).toEqual(["stroke", THEME.COLORS.VISUALIZER, 3, "round", "round"]);
      expect(p.pageDocument.getElementById).toHaveBeenCalledTimes(1);
      expect(p.canvas.getContext).toHaveBeenCalledTimes(1);
    });

    it("strokes one window of points from the read position, decimated with the final vertex pinned", () => {
      const p = page(320.8);
      play(p, steady(0, 1000), 100, 1010);
      p.commands.length = 0;
      p.frame(1019);
      const { cursor } = p.peek();
      const base = Math.floor(cursor);
      const offset = Math.floor((cursor - base) * 1024);
      expect(offset).toBeGreaterThan(0);
      // 320 CSS px → stride round(1024 / 480) = 2: 512 sampled points + the pinned last one.
      const sampled = [...Array.from({ length: 512 }, (_, k) => k * 2), 1023];
      const byteOf = (serial: number) => (serial % 200) + 1;
      const level = (byte: number) => (0.5 + (Math.fround(byte / 127.5 - 1)) / 2) * 75;
      expect(p.commands).toHaveLength(2 + sampled.length + 1);
      expect(p.vertices()).toEqual(sampled.map((i) => [
        i * (320 / 1000),
        // The tail of window `base`, then the head of the next window.
        level(byteOf(offset + i < 1024 ? base : base + 1)),
      ]));
    });

    it("follows the requested delay on its own clock and never stalls, skips or steps back on bursty delivery", () => {
      const p = page();
      // Windows are produced every 25 ms but delivered in pairs: the first
      // of each pair arrives 25 ms late, together with the second.
      const arrivals = steady(0, 4000).map((at, k) => (k % 2 === 0 ? at + 25 : at));
      const frames = play(p, arrivals, 150, 4000).filter(({ at }) => at > 1000);
      const step = (1000 / 60) / 25;
      for (let k = 1; k < frames.length; k++) {
        const advance = frames[k].cursor - frames[k - 1].cursor;
        expect(advance).toBeGreaterThan(step * 0.75);
        expect(advance).toBeLessThan(step * 1.25);
      }
      for (const { at, cursor } of frames) expect(Math.abs(cursor - due(at, 150))).toBeLessThan(1);
    });

    it("keeps its schedule through a delivery stall flushed in one burst", () => {
      const p = page();
      // A 400 ms hold-up between 2 s and 2.4 s: everything due in it arrives at 2.4 s.
      const arrivals = steady(0, 5000).map((at) => (at > 2000 && at < 2400 ? 2400 : at));
      const frames = play(p, arrivals, 300, 5000).filter(({ at }) => at > 1000);
      for (let k = 1; k < frames.length; k++) {
        expect(frames[k].cursor).toBeGreaterThanOrEqual(frames[k - 1].cursor);
      }
      // The 300 ms of queued audio carried the trace through most of the
      // stall; it resumes on the original schedule without a jump back.
      for (const { at, cursor } of frames.filter(({ at }) => at < 2000 || at > 2500)) {
        expect(Math.abs(cursor - due(at, 300))).toBeLessThan(1);
      }
    });

    it("restarts its schedule when the stream itself pauses, holding instead of replaying", () => {
      const p = page();
      // Production stops for a second, then resumes a second later than
      // the old schedule: the page re-locks onto the new one.
      const arrivals = [...steady(0, 2000), ...steady(3000, 6000)];
      const frames = play(p, arrivals, 200, 6000);
      for (let k = 1; k < frames.length; k++) {
        expect(frames[k].cursor).toBeGreaterThanOrEqual(frames[k - 1].cursor);
      }
      // The resumed audio is heard 200 ms after production resumes (3.2 s):
      // until it eases in (within two windows of that), the trace keeps the
      // last window from before the pause (serial 80) instead of showing
      // audio nobody hears yet.
      for (const { cursor } of frames.filter(({ at }) => at >= 2300 && at < 3100)) {
        expect(cursor).toBe(80);
      }
      const resumed = frames.filter(({ at }) => at > 3400);
      // After the pause, window s is produced at (s - 1) * 25 + 1000.
      for (const { at, cursor } of resumed) expect(Math.abs(cursor - due(at - 1000, 200))).toBeLessThan(1);
    });

    it("holds rather than steps back when the delay grows, then follows the new delay", () => {
      const p = page();
      const arrivals = steady(0, 4000);
      play(p, arrivals.filter((at) => at < 2000), 100, 2000);
      // The output latency estimate jumps from 100 to 300 ms (e.g. a
      // Bluetooth route): the trace waits ~200 ms instead of replaying it.
      p.clock.now = 2000;
      const later = play(p, arrivals.filter((at) => at >= 2000), 300, 4000);
      const frames = later.slice(1);
      for (let k = 1; k < frames.length; k++) {
        expect(frames[k].cursor).toBeGreaterThanOrEqual(frames[k - 1].cursor);
      }
      for (const { at, cursor } of frames.filter(({ at }) => at > 2600)) {
        expect(Math.abs(cursor - due(at, 300))).toBeLessThan(1);
      }
    });

    it("paces on the measured cadence when a platform reports no window duration", () => {
      const p = page();
      const frames = play(p, steady(0, 3000), 200, 3000, { duration: undefined, interval: 25 })
        .filter(({ at }) => at > 1000);
      for (const { at, cursor } of frames) expect(Math.abs(cursor - due(at, 200))).toBeLessThan(1);
    });

    it("grows the queue to hold delays longer than its default size", () => {
      const p = page();
      // 10 ms windows read 1 s late need ~100 queued windows (default 80).
      const arrivals = steady(0, 4000, 10);
      const frames = play(p, arrivals, 1000, 4000, { duration: 10, interval: 10 })
        .filter(({ at }) => at > 2000);
      for (const { at, cursor, filling } of frames) {
        expect(filling).toBe(false);
        expect(Math.abs(cursor - ((at - 1000) / 10 + 1))).toBeLessThan(1);
      }
    });

    it("applies the requested delay as is, with nothing to report back for calibration", () => {
      const p = page();
      const frames = play(p, steady(0, 3000), 200, 3000).filter(({ at }) => at > 1000);
      for (const { at, cursor } of frames) expect(Math.abs(cursor - due(at, 200))).toBeLessThan(1);
      expect(p.nativeMessages.map(({ type }) => type)).toEqual(["ready"]);
    });

    it("keeps a two-window margin behind the newest window when little latency is reported", () => {
      const p = page();
      const frames = play(p, steady(0, 3000), 0, 3000).filter(({ at }) => at > 1000);
      for (const { at, cursor } of frames) expect(Math.abs(cursor - due(at, 50))).toBeLessThan(1);
    });

    it("decodes uppercase and malformed hex exactly like parseInt", () => {
      const p = page();
      const firstY = (hex: string) => {
        p.send({ type: "stop" });
        p.wave(hex);
        p.commands.length = 0;
        p.frame();
        return p.vertices()[0][1];
      };
      expect(firstY("FF".repeat(1024))).toBe(75);
      expect(firstY("0g".repeat(1024))).toBe(0); // parseInt("0g", 16) === 0
      expect(firstY(`GG${"00".repeat(1023)}`)).toBeNaN();
      expect(firstY("80".repeat(1024))).toBe((0.5 + Math.fround(128 / 127.5 - 1) / 2) * 75);
    });

    it("repaints after a stop or a lifecycle event and skips frames with nothing new", () => {
      const p = page();
      p.wave("ff".repeat(1024));
      p.frame(10);
      p.commands.length = 0;
      p.frame(20); // the only window is already on screen
      expect(p.commands).toEqual([]);

      p.send({ type: "stop" });
      p.frame(30);
      expect(p.strokes()).toBe(1);
      expect(new Set(p.vertices().map(([, y]) => y))).toEqual(new Set([37.5]));
      p.commands.length = 0;
      p.frame(40);
      expect(p.commands).toEqual([]);

      // After a surface/layer teardown the JS state looks unchanged while
      // the canvas pixels are gone: each lifecycle event forces one repaint.
      for (const event of ["visibilitychange", "pageshow", "resize"]) {
        p.commands.length = 0;
        p.listeners[event]!({ data: "" });
        p.frame();
        expect(p.strokes()).toBe(1);
        p.commands.length = 0;
        p.frame();
        expect(p.commands).toEqual([]);
      }
    });
  });
});
