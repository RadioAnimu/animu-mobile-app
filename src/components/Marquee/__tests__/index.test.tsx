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
  config: { toValue: number; duration: number };
  stop: ReturnType<typeof vi.fn>;
  /** Completes the pass the way the native driver would. */
  finish: (finished?: boolean) => void;
}
let passes: Pass[] = [];

// speed 100 px/s, spacer 20 px -> a 300 px text takes (300 + 20) / 100 = 3.2 s.
const SPEED = 100;
const SPACER = 20;
const HOLD = 2500;

function recordTimings() {
  passes = [];
  vi.mocked(Animated.timing).mockImplementation(((_value: unknown, config: Pass["config"]) => {
    const pass = { config, stop: vi.fn() } as Pass;
    return {
      start: (done: (result: { finished: boolean }) => void) => {
        pass.finish = (finished = true) => done({ finished });
        passes.push(pass);
      },
      stop: pass.stop,
    };
  }) as never);
}

/** The wrapper element and the text copies (in-flow, copy A, copy B). */
function parts(text: string) {
  const copies = screen.getAllByText(text);
  return { line: copies[0].parentElement!.parentElement!.parentElement!, copies };
}

function measure(text: string, containerWidth: number, textWidth: number) {
  const { copies } = parts(text);
  // Container = the element wrapping both the in-flow copy and the scroller.
  const container = copies[0].parentElement!;
  act(() => {
    fireLayout(container, containerWidth);
    fireLayout(copies[1], textWidth);
  });
}

const isGhost = (el: Element) => el.getAttribute("data-style")!.includes('"opacity":0');

describe("Marquee", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    app.backgrounded = false;
    recordTimings();
  });
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  const renderMarquee = (props: Partial<React.ComponentProps<typeof Marquee>> = {}) =>
    render(<Marquee text="Now playing" speed={SPEED} spacer={SPACER} {...props} />);

  it("keeps text that fits still, showing the in-flow copy", () => {
    renderMarquee();
    measure("Now playing", 300, 280);
    const copies = screen.getAllByText("Now playing");
    expect(isGhost(copies[0])).toBe(false);
    expect(isGhost(copies[1])).toBe(true);
    act(() => void vi.advanceTimersByTime(60_000));
    expect(passes).toHaveLength(0);
  });

  it("ignores overflow within the sub-pixel threshold", () => {
    renderMarquee();
    measure("Now playing", 300, 300.5);
    act(() => void vi.advanceTimersByTime(60_000));
    expect(passes).toHaveLength(0);
  });

  it("waits, then scrolls exactly one copy plus spacer at constant speed", () => {
    renderMarquee();
    measure("Now playing", 100, 300);
    const copies = screen.getAllByText("Now playing");
    // Overflowing: the in-flow copy is hidden, the scrolling one shown.
    expect(isGhost(copies[0])).toBe(true);
    expect(isGhost(copies[1])).toBe(false);

    act(() => void vi.advanceTimersByTime(HOLD - 1));
    expect(passes).toHaveLength(0);
    act(() => void vi.advanceTimersByTime(1));
    expect(passes).toHaveLength(1);
    expect(passes[0].config).toMatchObject({
      toValue: -(300 + SPACER),
      duration: 3200,
      useNativeDriver: true,
    });
  });

  it("snaps back and schedules the next pass on the absolute cycle", () => {
    renderMarquee();
    measure("Now playing", 100, 300);
    act(() => void vi.advanceTimersByTime(HOLD));
    // Pass 1 ends after 3.2 s; the next one is due HOLD + 3.2 s after the
    // first start, i.e. 2.5 s after this pass finished.
    act(() => void vi.advanceTimersByTime(3200));
    act(() => passes[0].finish());
    expect(passes).toHaveLength(1);
    act(() => void vi.advanceTimersByTime(HOLD - 1));
    expect(passes).toHaveLength(1);
    act(() => void vi.advanceTimersByTime(1));
    expect(passes).toHaveLength(2);
  });

  it("does not chain another pass when an animation was interrupted", () => {
    renderMarquee();
    measure("Now playing", 100, 300);
    act(() => void vi.advanceTimersByTime(HOLD));
    act(() => passes[0].finish(false));
    act(() => void vi.advanceTimersByTime(60_000));
    expect(passes).toHaveLength(1);
  });

  it("stops scrolling when the text stops overflowing or it unmounts", () => {
    const { unmount } = renderMarquee();
    measure("Now playing", 100, 300);
    act(() => void vi.advanceTimersByTime(HOLD));
    unmount();
    expect(passes[0].stop).toHaveBeenCalled();
    act(() => void vi.advanceTimersByTime(60_000));
    expect(passes).toHaveLength(1);
  });

  it("does not scroll while the app is backgrounded", () => {
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
    const copies = screen.getAllByText("Now playing");
    act(() => {
      fireLayout(copies[0].parentElement!, 100);
      fireLayout(copies[1], 300);
    });
    act(() => void vi.advanceTimersByTime(HOLD));
    expect(passes).toHaveLength(1);
  });

  describe("MarqueeGroup", () => {
    const GROUP_DELAY = 1000;
    const renderGroup = () =>
      render(
        <MarqueeGroup delay={GROUP_DELAY}>
          <Marquee text="Short one" speed={SPEED} spacer={SPACER} />
          <Marquee text="A much longer line" speed={SPEED} spacer={SPACER} />
        </MarqueeGroup>,
      );

    it("starts every overflowing line together once all have measured", () => {
      renderGroup();
      measure("Short one", 100, 300); // pass 3.2 s
      measure("A much longer line", 100, 500); // pass 5.2 s
      act(() => void vi.advanceTimersByTime(GROUP_DELAY));
      expect(passes.map((p) => p.config.duration).sort()).toEqual([3200, 5200]);
    });

    it("repeats both lines on the same, longest-member cycle", () => {
      renderGroup();
      measure("Short one", 100, 300);
      measure("A much longer line", 100, 500);
      act(() => void vi.advanceTimersByTime(GROUP_DELAY));
      const [short, long] = [...passes].sort(
        (a, b) => a.config.duration - b.config.duration,
      );

      // Cycle = 5200 + 1000 = 6200 ms from the first start for BOTH lines.
      act(() => void vi.advanceTimersByTime(3200));
      act(() => short.finish());
      act(() => void vi.advanceTimersByTime(2000));
      act(() => long.finish());
      expect(passes).toHaveLength(2);
      act(() => void vi.advanceTimersByTime(999));
      expect(passes).toHaveLength(2);
      act(() => void vi.advanceTimersByTime(1));
      expect(passes).toHaveLength(4);
    });

    it("lets a line that fits sit out without blocking the group", () => {
      renderGroup();
      measure("Short one", 300, 100); // fits -> reports 0
      measure("A much longer line", 100, 500);
      act(() => void vi.advanceTimersByTime(GROUP_DELAY));
      expect(passes).toHaveLength(1);
      expect(passes[0].config.duration).toBe(5200);
    });

    it("drops an unmounted line from the cycle", () => {
      const { rerender } = renderGroup();
      measure("Short one", 100, 300);
      measure("A much longer line", 100, 500);
      rerender(
        <MarqueeGroup delay={GROUP_DELAY}>
          <Marquee text="Short one" speed={SPEED} spacer={SPACER} />
        </MarqueeGroup>,
      );
      const before = passes.length;
      act(() => void vi.advanceTimersByTime(GROUP_DELAY));
      // Remaining line keeps scrolling on its own (shorter) cycle.
      expect(passes.length).toBeGreaterThan(before);
      expect(passes.at(-1)!.config.duration).toBe(3200);
    });
  });
});
