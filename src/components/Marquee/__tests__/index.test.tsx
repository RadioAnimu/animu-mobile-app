// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { Animated } from "react-native";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { fireLayout } from "@/__tests__/react-native-mock";
import { Marquee, MarqueeGroup } from "@/components/Marquee";

vi.mock("react-native", async () =>
  (await import("@/__tests__/react-native-mock")).createReactNativeMock(),
);

const app = vi.hoisted(() => ({ backgrounded: false }));
vi.mock("@/contexts/app-state/AppStateProvider", () => ({
  useIsBackgrounded: () => app.backgrounded,
}));

interface Pass {
  /** The Animated.Value the timing drives (the clock). */
  value: Animated.Value;
  config: {
    toValue: number;
    duration: number;
    easing: unknown;
    useNativeDriver: boolean;
  };
  stop: ReturnType<typeof vi.fn>;
  /** Completes the pass the way the native driver would. */
  finish: (finished?: boolean) => void;
}
let passes: Pass[] = [];

/** Captured `clock.interpolate(config)` calls, in call order. */
interface Interp {
  inputRange: number[];
  outputRange: (number | string)[];
  extrapolate: string;
}
let interpolations: Interp[] = [];

// speed 100 px/s, spacer 20 px -> a 300 px text takes (300 + 20) / 100 = 3.2 s.
const SPEED = 100;
const SPACER = 20;
const HOLD = 2500;
const GROUP_DELAY = 1000;

function recordTimings() {
  passes = [];
  vi.mocked(Animated.timing).mockImplementation(((_value: unknown, config: Pass["config"]) => {
    const pass = { value: _value, config, stop: vi.fn() } as unknown as Pass;
    return {
      start: (done: (result: { finished: boolean }) => void) => {
        pass.finish = (finished = true) => done({ finished });
        passes.push(pass);
      },
      stop: pass.stop,
    };
  }) as never);
}

/** Records every interpolate() config instead of building an interpolator. */
function recordInterpolations() {
  interpolations = [];
  vi.spyOn(Animated.Value.prototype, "interpolate").mockImplementation(
    function (this: unknown, config: Parameters<Animated.Value["interpolate"]>[0]) {
      interpolations.push(config as unknown as Interp);
      // The mock's interpolate() returns `this` (usable as a transform style).
      return this as never;
    },
  );
}

/** The text copies (in-flow, copy A, copy B). */
function copiesOf(text: string) {
  return screen.getAllByText(text);
}

function measure(text: string, containerWidth: number, textWidth: number) {
  const copies = copiesOf(text);
  act(() => {
    // Container = the element wrapping both the in-flow copy and the scroller.
    fireLayout(copies[0].parentElement!, containerWidth);
    fireLayout(copies[1], textWidth);
  });
}

const isGhost = (el: Element) => el.getAttribute("data-style")!.includes('"opacity":0');

/** Latest interpolate() config reported for a line that scrolls `output`. */
const lastInterp = (output: number) =>
  interpolations.filter((c) => c.outputRange[2] === output).at(-1);

describe("Marquee", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    app.backgrounded = false;
    recordTimings();
    recordInterpolations();
  });
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  const renderMarquee = (props: Partial<React.ComponentProps<typeof Marquee>> = {}) =>
    render(<Marquee text="Now playing" speed={SPEED} spacer={SPACER} {...props} />);

  it("keeps text that fits still, showing the in-flow copy", () => {
    renderMarquee();
    measure("Now playing", 300, 280);
    const copies = copiesOf("Now playing");
    expect(isGhost(copies[0])).toBe(false);
    expect(isGhost(copies[1])).toBe(true);
    // The transform stays attached but interpolates to 0 everywhere.
    expect(lastInterp(0)).toMatchObject({
      inputRange: [0, HOLD, HOLD + 3000],
      outputRange: [0, 0, 0],
      extrapolate: "clamp",
    });
    act(() => void vi.advanceTimersByTime(60_000));
    expect(passes).toHaveLength(0);
  });

  it("ignores overflow within the sub-pixel threshold", () => {
    renderMarquee();
    measure("Now playing", 300, 300.5);
    expect(lastInterp(0)).toBeDefined();
    act(() => void vi.advanceTimersByTime(60_000));
    expect(passes).toHaveLength(0);
  });

  it("starts one full-cycle timing immediately when a standalone line overflows", () => {
    renderMarquee();
    expect(passes).toHaveLength(0);
    measure("Now playing", 100, 300);
    const copies = copiesOf("Now playing");
    // Overflowing: the in-flow copy is hidden, the scrolling one shown.
    expect(isGhost(copies[0])).toBe(true);
    expect(isGhost(copies[1])).toBe(false);

    // One clock, one timing, started right away: cycle = pass + hold.
    expect(passes).toHaveLength(1);
    expect(passes[0].config).toMatchObject({
      toValue: HOLD + 3200,
      duration: HOLD + 3200,
      easing: "linear",
      useNativeDriver: true,
    });
    // The hold lives in the interpolation, not in the timing schedule.
    expect(lastInterp(-(300 + SPACER))).toMatchObject({
      inputRange: [0, HOLD, HOLD + 3200],
      outputRange: [0, 0, -(300 + SPACER)],
      extrapolate: "clamp",
    });
  });

  it("re-arms a fresh identical timing when a cycle finishes", () => {
    renderMarquee();
    measure("Now playing", 100, 300);
    act(() => passes[0].finish());
    expect(passes).toHaveLength(2);
    expect(passes[1].config).toMatchObject(passes[0].config);
  });

  it("does not re-arm after an interrupted animation", () => {
    renderMarquee();
    measure("Now playing", 100, 300);
    act(() => passes[0].finish(false));
    act(() => void vi.advanceTimersByTime(60_000));
    expect(passes).toHaveLength(1);
  });

  it("stops the running animation on unmount", () => {
    const { unmount } = renderMarquee();
    measure("Now playing", 100, 300);
    unmount();
    expect(passes[0].stop).toHaveBeenCalled();
    act(() => void vi.advanceTimersByTime(60_000));
    expect(passes).toHaveLength(1);
  });

  it("does not scroll when the app is backgrounded from the start", () => {
    app.backgrounded = true;
    renderMarquee();
    measure("Now playing", 100, 300);
    act(() => void vi.advanceTimersByTime(60_000));
    expect(passes).toHaveLength(0);
  });

  it("is a plain view without onPress and a labelled button with it", () => {
    const { unmount } = renderMarquee();
    expect(screen.queryByRole("button")).toBeNull();
    unmount();

    const onPress = vi.fn();
    renderMarquee({ onPress });
    fireEvent.click(screen.getByRole("button", { name: "Now playing" }));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it("lays out the same way when pressable", () => {
    renderMarquee({ onPress: vi.fn() });
    const copies = copiesOf("Now playing");
    act(() => {
      fireLayout(copies[0].parentElement!, 100);
      fireLayout(copies[1], 300);
    });
    act(() => void vi.advanceTimersByTime(HOLD));
    expect(passes).toHaveLength(1);
  });

  describe("MarqueeGroup", () => {
    const groupTree = (texts: string[]) => (
      <MarqueeGroup delay={GROUP_DELAY}>
        {texts.map((text) => (
          <Marquee key={text} text={text} speed={SPEED} spacer={SPACER} />
        ))}
      </MarqueeGroup>
    );
    const SHORT = "Short one"; // 300 px copy -> 3.2 s pass
    const LONG = "A much longer line"; // 500 px copy -> 5.2 s pass

    it("runs exactly one shared clock sized to the longest member cycle", () => {
      render(groupTree([SHORT, LONG]));
      measure(SHORT, 100, 300);
      measure(LONG, 100, 500);

      // ONE timing for the whole group: longest pass (5.2 s) + delay.
      expect(passes).toHaveLength(1);
      expect(passes[0].config).toMatchObject({
        toValue: 5200 + GROUP_DELAY,
        duration: 5200 + GROUP_DELAY,
        easing: "linear",
        useNativeDriver: true,
      });

      // Each line maps the shared clock onto its own pass.
      expect(lastInterp(-(300 + SPACER))).toMatchObject({
        inputRange: [0, GROUP_DELAY, GROUP_DELAY + 3200],
        outputRange: [0, 0, -(300 + SPACER)],
        extrapolate: "clamp",
      });
      expect(lastInterp(-(500 + SPACER))).toMatchObject({
        inputRange: [0, GROUP_DELAY, GROUP_DELAY + 5200],
        outputRange: [0, 0, -(500 + SPACER)],
        extrapolate: "clamp",
      });
    });

    it("starts no timing until every member has measured", () => {
      render(groupTree([SHORT, LONG]));
      act(() => void vi.advanceTimersByTime(60_000));
      expect(passes).toHaveLength(0);

      // Shortest first: the group must still wait for the longer line, so
      // the first cycle is already the right length and never restarts.
      measure(SHORT, 100, 300);
      act(() => void vi.advanceTimersByTime(60_000));
      expect(passes).toHaveLength(0);

      measure(LONG, 100, 500);
      expect(passes).toHaveLength(1);
      expect(passes[0].config.duration).toBe(5200 + GROUP_DELAY);
    });

    it("lets a line that fits sit out without blocking the group", () => {
      render(groupTree([SHORT, LONG]));
      measure(SHORT, 300, 100); // fits -> reports 0
      measure(LONG, 100, 500);
      expect(passes).toHaveLength(1);
      expect(passes[0].config.duration).toBe(5200 + GROUP_DELAY); // from LONG only
      // The fitting line still interpolates, but stays parked at 0.
      expect(lastInterp(0)).toMatchObject({
        inputRange: [0, GROUP_DELAY, GROUP_DELAY + 1200],
        outputRange: [0, 0, 0],
      });
    });

    it("starts no clock when nothing overflows", () => {
      render(groupTree([SHORT, LONG]));
      measure(SHORT, 300, 100);
      measure(LONG, 500, 100);
      act(() => void vi.advanceTimersByTime(60_000));
      expect(passes).toHaveLength(0);
    });

    it("resumes from a brand-new cycle after the app comes back from the background", () => {
      // Marquee is memoized, so a group rerender is what flushes the
      // backgrounded state into the clocks.
      const { rerender } = render(groupTree([SHORT, LONG]));
      measure(LONG, 100, 500);
      measure(SHORT, 100, 300);
      expect(passes).toHaveLength(1);

      app.backgrounded = true;
      rerender(groupTree([SHORT, LONG]));
      // The running clock is stopped and nothing replaces it while hidden.
      expect(passes[0].stop).toHaveBeenCalled();
      act(() => void vi.advanceTimersByTime(60_000));
      expect(passes).toHaveLength(1);

      app.backgrounded = false;
      rerender(groupTree([SHORT, LONG]));
      // A brand-new timing starts, from 0, with the same full cycle.
      expect(passes).toHaveLength(2);
      expect(passes[1].config).toMatchObject({
        toValue: 5200 + GROUP_DELAY,
        duration: 5200 + GROUP_DELAY,
        useNativeDriver: true,
      });
      expect(passes[1].value).toBe(passes[0].value); // same shared clock
    });

    it("re-arms a shorter cycle when a member unmounts", () => {
      const { rerender } = render(groupTree([SHORT, LONG]));
      measure(LONG, 100, 500);
      measure(SHORT, 100, 300);
      expect(passes).toHaveLength(1);
      expect(passes[0].config.duration).toBe(5200 + GROUP_DELAY);

      rerender(groupTree([SHORT]));
      // LONG unmounts; the cycle shrinks to SHORT's pass + delay: the old
      // timing is stopped and a brand-new one takes over.
      expect(passes[0].stop).toHaveBeenCalled();
      expect(passes).toHaveLength(2);
      expect(passes[1].config).toMatchObject({
        toValue: 3200 + GROUP_DELAY,
        duration: 3200 + GROUP_DELAY,
      });
      // The surviving line keeps its own interpolation.
      expect(lastInterp(-(300 + SPACER))).toMatchObject({
        inputRange: [0, GROUP_DELAY, GROUP_DELAY + 3200],
      });
    });
  });
});
