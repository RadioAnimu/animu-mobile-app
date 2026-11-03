// @vitest-environment jsdom
import {
  act,
  cleanup,
  render,
  renderHook,
  screen,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  LyricRow,
  useRowOffset,
  type FollowTarget,
  type ListMotion,
} from "@/screens/Lyrics/LyricRow";
import { SungColumns } from "@/screens/Lyrics/Segments";
import { fireLayout } from "@/__tests__/react-native-mock";
import type { LyricLine } from "@/core/lyrics/types";
import type { SharedValue } from "react-native-reanimated";

vi.mock("react-native", async () =>
  (await import("@/__tests__/react-native-mock")).createReactNativeMock(),
);
vi.mock("react-native-reanimated", async () =>
  (await import("@/__tests__/reanimated-mock")).createReanimatedMock(),
);
const animated =
  (await import("react-native-reanimated")) as unknown as ReturnType<
    typeof import("@/__tests__/reanimated-mock").createReanimatedMock
  >;
const shared = <T,>(value: T) =>
  animated.shared(value) as unknown as SharedValue<T>;
const motion = (): ListMotion => ({
  follow: shared<FollowTarget>({ y: 10, active: 0, seq: 0, instant: true }),
  browsing: shared(false),
  manual: shared(0),
  activeIndex: shared(0),
  companionIndex: shared(-1),
  viewport: shared(600),
  anchor: shared(64),
  edgeFade: shared(72),
  reduceMotion: false,
});
const line: LyricLine = {
  kind: "line",
  startMs: 1000,
  endMs: 3000,
  text: "君の名は",
  words: null,
};
const words = [
  { text: "君", startMs: 1000, endMs: 2000, spaceAfter: false },
  { text: "の名は", startMs: 2000, endMs: 3000, spaceAfter: false },
];
const segments = [
  { text: "君", label: "kimi", spaceAfter: false },
  { text: "の名は", label: "no na wa", spaceAfter: false },
];
const row = (props: Partial<Parameters<typeof LyricRow>[0]> = {}) => {
  const onRowLayout = vi.fn();
  const rendered = render(
    <LyricRow
      entry={line}
      index={0}
      label={null}
      depth={0}
      companion={false}
      browsing={false}
      position={shared(1500)}
      motion={motion()}
      onRowLayout={onRowLayout}
      {...props}
    />,
  );
  return { ...rendered, onRowLayout };
};
afterEach(cleanup);

describe("lyrics row behavior", () => {
  it("marks the sung line for accessibility and reports its native layout", () => {
    const { onRowLayout } = row();
    const element = screen.getByLabelText("君の名は");
    expect(element.getAttribute("aria-selected")).toBe("true");
    act(() => fireLayout(element, 300, 60));
    expect(onRowLayout).toHaveBeenCalledWith(0, 0, 60);
  });

  it.each([-5, -1, 1, 3, 5])(
    "retains readable text and labels away from the song at depth %s",
    (depth) => {
      row({ depth, label: { kind: "line", text: "kimi no na wa" } });
      expect(screen.getByText("kimi no na wa")).toBeTruthy();
      expect(
        screen.getByLabelText("君の名は").getAttribute("aria-selected"),
      ).toBe("false");
    },
  );

  it.each([false, true])(
    "renders word readings with and without measured timing (%s)",
    (timed) => {
      row({
        entry: { ...line, words: timed ? words : null },
        label: { kind: "words", segments },
      });
      expect(screen.getByText("kimi")).toBeTruthy();
      expect(screen.getByText("no na wa")).toBeTruthy();
      if (timed) act(() => fireLayout(screen.getAllByText("君")[0], 80));
    },
  );

  it("renders sung words without a pronunciation and keeps interludes decorative", () => {
    const { unmount } = row({ entry: { ...line, words } });
    expect(screen.getAllByText("君")).toHaveLength(2);
    unmount();
    const { container } = row({
      entry: { kind: "interlude", startMs: 0, endMs: 1000 },
    });
    expect(container.querySelector('[aria-label="君の名は"]')).toBeNull();
    expect(container.querySelectorAll("span")).toHaveLength(0);
  });

  it("falls back to ordinary columns when a timing upload and readings disagree", () => {
    render(
      <SungColumns
        segments={segments}
        words={[{ ...words[0], text: "unrelated" }]}
        position={shared(1500)}
      />,
    );
    expect(screen.getAllByText("君")).toHaveLength(1);
    expect(screen.getByText("kimi")).toBeTruthy();
  });
});

describe("following and browsing", () => {
  it("jumps on layout, follows a drag exactly, and resumes with the row cascade", () => {
    const state = motion();
    const { result, unmount } = renderHook(() => useRowOffset(state, 3));
    expect(result.current.get()).toBe(10);
    act(() => {
      state.browsing.set(true);
      state.manual.set(75);
      animated.tick();
    });
    expect(result.current.get()).toBe(75);
    act(() => {
      state.browsing.set(false);
      state.follow.set({ y: 100, active: 1, seq: 1, instant: false });
      animated.tick();
    });
    expect(result.current.get()).toBe(100);
    expect(animated.withDelay).toHaveBeenLastCalledWith(52, 100);
    act(() => {
      state.follow.set({ y: 50, active: 4, seq: 2, instant: false });
      animated.tick();
    });
    expect(result.current.get()).toBe(50);
    expect(animated.withDelay).toHaveBeenLastCalledWith(0, 50);
    unmount();
  });

  it("honors reduced motion and avoids animating an unchanged follow target", () => {
    const state = { ...motion(), reduceMotion: true };
    const { result, unmount } = renderHook(() => useRowOffset(state, 0));
    animated.withDelay.mockClear();
    act(() => {
      state.follow.set({ y: 90, active: 2, seq: 1, instant: false });
      animated.tick();
      animated.tick();
    });
    expect(result.current.get()).toBe(90);
    expect(animated.withDelay).not.toHaveBeenCalled();
    unmount();
  });
});
