// @vitest-environment jsdom
import type { ReactNode } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ResponsiveLayout } from "@/theme/layout";
import { Lyrics } from "@/screens/Lyrics";

const mocks = vi.hoisted(() => ({
  /** The window the screen sees; each test sets it before rendering. */
  layout: { current: {} as ResponsiveLayout },
  insets: { current: { top: 0, right: 0, bottom: 0, left: 0 } },
}));

vi.mock("react-native", async () => (await import("@/__tests__/react-native-mock")).createReactNativeMock());
vi.mock("react-native-reanimated", async () => {
  const { View } = (await import("@/__tests__/react-native-mock")).createReactNativeMock();
  return {
    default: { View },
    Extrapolation: { CLAMP: "clamp" },
    interpolate: () => 0,
    useAnimatedStyle: () => ({}),
    useSharedValue: () => ({ get: () => 0, set: () => {} }),
  };
});
vi.mock("react-native-gesture-handler", () => {
  const pan = { activeOffsetY: () => pan, onEnd: () => pan };
  return {
    GestureHandlerRootView: ({ children }: { children: ReactNode }) => <>{children}</>,
    Gesture: { Pan: () => pan },
    GestureDetector: ({ children }: { children: ReactNode }) => <>{children}</>,
  };
});
vi.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => mocks.insets.current,
}));
vi.mock("react-native-worklets", () => ({ scheduleOnRN: vi.fn() }));
vi.mock("@react-navigation/native", () => ({ useIsFocused: () => true }));
vi.mock("@/contexts/app-state/AppStateProvider", () => ({ useIsBackgrounded: () => false }));
vi.mock("@/contexts/player/PlayerProvider", () => ({
  usePlayer: () => ({
    currentTrack: { title: "Our Carol", artist: "Roselia", raw: "raw", artwork: "https://cover.jpg" },
    defaultArtwork: "file:///default.jpg",
    isPlaying: false,
  }),
}));
vi.mock("@/hooks/useDict", () => ({
  useDict: () => new Proxy({} as Record<string, string>, { get: (_target, key) => String(key) }),
}));
vi.mock("@/hooks/useLyrics", () => ({ useLyrics: () => ({ status: "ready", lyrics: null, retry: vi.fn() }) }));
vi.mock("@/hooks/useHeardPosition", () => ({
  useHeardPosition: () => ({ position: { get: () => 0, set: () => {} }, known: true }),
}));
vi.mock("@/hooks/useReducedMotion", () => ({ useReducedMotion: () => true }));
vi.mock("@/hooks/useResolvedArtwork", () => ({ useResolvedArtwork: () => "file:///cover.jpg" }));
vi.mock("@/hooks/useResponsiveLayout", () => ({ useResponsiveLayout: () => mocks.layout.current }));
vi.mock("@/core/japanese", () => ({ japaneseDictionary: { install: vi.fn(), cancel: vi.fn() } }));
vi.mock("@/screens/Lyrics/LyricsBackground", () => ({
  LyricsBackground: () => null,
  useBackgroundTurn: () => ({ get: () => 0, set: () => {} }),
}));
vi.mock("@/screens/Lyrics/LyricsBody", () => ({ LyricsBody: () => <div data-testid="lyrics-body" /> }));
vi.mock("@/screens/Lyrics/PronunciationMenu", () => ({ PronunciationMenu: () => null }));
vi.mock("@/screens/Lyrics/usePronunciation", () => ({
  usePronunciation: () => ({
    labels: [],
    mode: "off",
    modes: [],
    select: vi.fn(),
    preparing: false,
    failed: false,
    dictionary: { install: "none", progress: 0, reader: "idle", failure: null },
  }),
}));
vi.mock("@/components/PlayPauseButton", () => ({
  PlayPauseButton: () => (
    <button type="button">
      Play
    </button>
  ),
}));
vi.mock("@/components/Cover", () => ({ Cover: () => <i data-cover /> }));

const PORTRAIT: ResponsiveLayout = {
  width: 393,
  height: 852,
  usableWidth: 393,
  windowClass: "compact",
  landscape: false,
  split: false,
  short: false,
  windowControlsInset: 0,
};
const TABLET_LANDSCAPE: ResponsiveLayout = {
  width: 1180,
  height: 820,
  usableWidth: 1180,
  windowClass: "expanded",
  landscape: true,
  split: true,
  short: false,
  windowControlsInset: 0,
};
/** 852×393 past the island's 59pt side insets: two panes, like every landscape window. */
const PHONE_LANDSCAPE: ResponsiveLayout = {
  ...TABLET_LANDSCAPE,
  width: 852,
  height: 393,
  usableWidth: 734,
  windowClass: "medium",
  short: true,
};

const props = { navigation: { goBack: vi.fn() } } as unknown as Parameters<typeof Lyrics>[0];

const renderAt = (layout: ResponsiveLayout) => {
  mocks.layout.current = layout;
  return render(<Lyrics {...props} />);
};

describe("Lyrics screen", () => {
  afterEach(() => {
    cleanup();
    mocks.insets.current = { top: 0, right: 0, bottom: 0, left: 0 };
  });

  it("keeps the phone's sheet head in portrait", () => {
    renderAt(PORTRAIT);
    // The song row is still the dismiss affordance, as on the phone today.
    expect(screen.getByRole("button", { name: "Our Carol, Roselia" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "A11Y_CLOSE_LYRICS" })).toBeTruthy();
    expect(screen.getByTestId("lyrics-body")).toBeTruthy();
    // No side panel, so no second play button.
    expect(screen.queryByRole("button", { name: "Play" })).toBeNull();
  });

  it("puts the artwork and song beside the lyrics on a wide window", () => {
    renderAt(TABLET_LANDSCAPE);
    expect(screen.getByTestId("lyrics-body")).toBeTruthy();
    // Playback stays on the player: the panel is artwork and song only.
    expect(screen.queryByRole("button", { name: "Play" })).toBeNull();
    expect(document.querySelector("[data-cover]")).not.toBeNull();
    // 38% of 1180 usable points.
    expect(document.querySelector('[data-style*=\'"width":448\']')).not.toBeNull();
    // The artwork and song close the lyrics, like the portrait head's song
    // row; so does the grabber over the window.
    fireEvent.click(screen.getByRole("button", { name: "Our Carol, Roselia" }));
    expect(props.navigation.goBack).toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "A11Y_CLOSE_LYRICS" })).toBeTruthy();
  });

  it("does not remount the lyrics when the window rotates into two panes", () => {
    const { rerender } = renderAt(PORTRAIT);
    const body = screen.getByTestId("lyrics-body");
    mocks.layout.current = TABLET_LANDSCAPE;
    rerender(<Lyrics {...props} />);
    // Same DOM node: the follow state survives the rearrangement.
    expect(screen.getByTestId("lyrics-body")).toBe(body);
  });

  it("puts the cover beside the lyrics on a landscape phone too", () => {
    renderAt(PHONE_LANDSCAPE);
    expect(document.querySelector("[data-cover]")).not.toBeNull();
    // 38% of 734 usable points.
    expect(document.querySelector('[data-style*=\'"width":279\']')).not.toBeNull();
    // The lyrics take the rest: 734 − 279, under the readable cap.
    expect(document.querySelector('[data-style*=\'"maxWidth":455\']')).not.toBeNull();
  });

  it("keeps the content inside the side safe areas in landscape", () => {
    mocks.insets.current = { top: 0, right: 59, bottom: 21, left: 59 };
    renderAt(PHONE_LANDSCAPE);
    const content = document.querySelector('[data-style*=\'"paddingLeft":59\']');
    expect(content).not.toBeNull();
    expect(content?.getAttribute("data-style")).toContain('"paddingRight":59');
  });
});
