// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { Animated } from "react-native";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { HeaderBar } from "@/components/HeaderBar";

vi.mock("react-native", async () =>
  (await import("@/__tests__/react-native-mock")).createReactNativeMock(),
);
vi.mock("expo-image", () => ({
  Image: ({ style }: { style?: unknown }) => (
    <span data-testid="image" data-style={JSON.stringify(style)} />
  ),
}));
vi.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

const mocks = vi.hoisted(() => ({
  navigation: { openDrawer: vi.fn(), navigate: vi.fn() },
  player: {} as Record<string, unknown>,
  progress: {} as Record<string, unknown>,
  backgrounded: false,
  haptics: { tap: vi.fn() },
  layout: { usableWidth: 393, tv: false, windowControlsInset: 0 },
}));
vi.mock("@/hooks/useResponsiveLayout", () => ({
  useResponsiveLayout: () => mocks.layout,
}));

vi.mock("@react-navigation/native", () => ({
  useNavigation: () => mocks.navigation,
}));
vi.mock("@/i18n", () => ({
  IMGS: {
    PT: {
      LIVE_REQUEST_ENABLED: () => <span data-testid="badge-enabled" />,
      LIVE_REQUEST_DISABLED: () => <span data-testid="badge-disabled" />,
    },
  },
}));
vi.mock("@/contexts/user/UserSettingsProvider", () => ({
  useUserSettings: () => ({ settings: { selectedLanguage: "PT" } }),
}));
vi.mock("@/contexts/player/PlayerProvider", () => ({
  usePlayer: () => mocks.player,
  useTrackProgress: () => mocks.progress,
}));
vi.mock("@/contexts/app-state/AppStateProvider", () => ({
  useIsBackgrounded: () => mocks.backgrounded,
}));
vi.mock("@/hooks/useDict", () => ({
  useDict: () => ({
    A11Y_OPEN_MENU: "Open menu",
    A11Y_PLAY: "Play",
    A11Y_PAUSE: "Pause",
    A11Y_MAKE_REQUEST: "Make request",
  }),
}));
vi.mock("@/utils/haptics", () => ({ haptics: mocks.haptics }));
vi.mock("@/components/BitrateSelect", () => ({
  BitrateSelect: () => <i data-testid="bitrate-select" />,
}));
vi.mock("@/components/LyricsButton", () => ({
  // Labeled like the real button (A11Y_OPEN_LYRICS) so placement tests can
  // count the mics by their accessibility label.
  LyricsButton: () => <i data-testid="lyrics-button" aria-label="Show lyrics" />,
}));

const setPlayer = (overrides: Record<string, unknown> = {}) => {
  mocks.player = {
    isPlaying: false,
    syncing: false,
    currentTrack: { duration: 200, raw: null },
    currentProgram: undefined,
    play: vi.fn().mockResolvedValue(undefined),
    pause: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
};

const pressRequest = () =>
  fireEvent.click(screen.getByRole("button", { name: "Make request" }));

describe("HeaderBar", () => {
  beforeEach(() => {
    mocks.backgrounded = false;
    mocks.layout = { usableWidth: 393, tv: false, windowControlsInset: 0 };
    mocks.progress = { progressMs: 0, progressAt: 0, progressRunning: false, showProgress: true, durationMs: 200_000 };
    setPlayer();
  });
  afterEach(cleanup);

  it("carries the lyrics microphone beside the request note", () => {
    render(<HeaderBar openLiveRequestModal={() => {}} />);
    expect(screen.getByTestId("lyrics-button")).toBeTruthy();
  });

  describe("row width", () => {
    const rowWidth = () =>
      JSON.parse(
        screen.getByTestId("menu-slot").parentElement!.getAttribute("data-style")!,
      ).width;
    /** Side margin of the play button (the last style entry wins, as in RN). */
    const playMargin = () =>
      JSON.parse(
        within(screen.getByRole("button", { name: "Play" }))
          .getByTestId("image")
          .getAttribute("data-style")!,
      )
        .flat()
        .reverse()
        .find((entry: { marginHorizontal?: number }) => entry?.marginHorizontal !== undefined)
        .marginHorizontal;

    it("spans a phone in portrait with the designed play button margins", () => {
      render(<HeaderBar />);
      expect(rowWidth()).toBe(393);
      expect(playMargin()).toBe(47);
    });

    it("sits inside the side safe areas, capped to the page column", () => {
      mocks.layout = { usableWidth: 734, tv: false, windowControlsInset: 0 };
      render(<HeaderBar />);
      expect(rowWidth()).toBe(560);
      expect(playMargin()).toBe(47);
    });

    it("keeps a centered row centered when it already clears the window controls", () => {
      mocks.layout = { usableWidth: 1180, tv: false, windowControlsInset: 72 };
      render(<HeaderBar rowWidth={900} />);
      const container = screen.getByTestId("menu-slot").parentElement!.parentElement!;
      expect(JSON.parse(container.getAttribute("data-style")!).paddingLeft).toBe(0);
      expect(rowWidth()).toBe(900);
    });

    it("starts the row past the iPadOS window controls in a resizable window", () => {
      mocks.layout = { usableWidth: 375, tv: false, windowControlsInset: 72 };
      render(<HeaderBar />);
      const container = screen.getByTestId("menu-slot").parentElement!.parentElement!;
      expect(JSON.parse(container.getAttribute("data-style")!).paddingLeft).toBe(72);
      expect(JSON.parse(screen.getByTestId("menu-slot").parentElement!.getAttribute("data-style")!).width).toBe(303);
    });

    it("takes the width the split layout gives it", () => {
      // A landscape phone: 734pt between the island insets, panes 686pt wide.
      mocks.layout = { usableWidth: 734, tv: false, windowControlsInset: 0 };
      render(<HeaderBar rowWidth={686} />);
      expect(rowWidth()).toBe(686);
    });

    it("pulls the play button's margins in on a narrow window, down to a floor", () => {
      mocks.layout = { usableWidth: 300, tv: false, windowControlsInset: 0 };
      const { unmount } = render(<HeaderBar />);
      expect(rowWidth()).toBe(300);
      expect(playMargin()).toBeCloseTo((47 * 300) / 360);
      unmount();
      render(<HeaderBar rowWidth={150} />);
      expect(playMargin()).toBe(24);
    });
  });

  describe("landscape bar", () => {
    const labelsIn = (slot: string) =>
      [...screen.getByTestId(slot).querySelectorAll("[aria-label], [data-testid]")]
        .map((el) => el.getAttribute("aria-label") ?? el.getAttribute("data-testid"))
        .filter((label) => label !== "image");

    it("reads like the website player: menu and play left; stream, lyrics and requests right", () => {
      mocks.layout = { usableWidth: 734, tv: false, windowControlsInset: 0 };
      render(<HeaderBar rowWidth={686} bar openLiveRequestModal={vi.fn()} />);
      expect(labelsIn("menu-slot")).toEqual(["Open menu", "Play"]);
      expect(labelsIn("note-slot")).toEqual(["bitrate-select", "Show lyrics", "Make request"]);
    });

    it("keeps the mic beside the stream picker during a live show", () => {
      setPlayer({ currentProgram: { isLive: true, acceptingRequests: true } });
      render(<HeaderBar rowWidth={686} bar openLiveRequestModal={vi.fn()} />);
      expect(screen.getAllByLabelText("Show lyrics")).toHaveLength(1);
      expect(within(screen.getByTestId("note-slot")).getByTestId("badge-enabled")).toBeTruthy();
    });

    it("leaves the portrait row without the stream picker", () => {
      render(<HeaderBar />);
      expect(screen.queryByTestId("bitrate-select")).toBeNull();
    });
  });

  describe("microphone placement", () => {
    const live = { currentProgram: { isLive: true, acceptingRequests: true } };

    /** The mic sits in the given slot alone, and its neighbour order reads
        like the visual one (the DOM is the a11y reading order here). */
    const micSitsIn = (slot: "menu-slot" | "note-slot") => {
      const slotEl = screen.getByTestId(slot);
      const mic = within(slotEl).getAllByTestId("lyrics-button");
      expect(mic).toHaveLength(1);
      expect(screen.getAllByLabelText("Show lyrics")).toHaveLength(1);
      return [slotEl, mic[0]] as const;
    };

    it("parks the mic beside the menu while a live badge hangs over the note", () => {
      setPlayer(live);
      render(<HeaderBar openLiveRequestModal={vi.fn()} />);
      const [slotEl, mic] = micSitsIn("menu-slot");
      const menu = within(slotEl).getByRole("button", { name: "Open menu" });
      expect(menu.compareDocumentPosition(mic) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
      expect(within(screen.getByTestId("note-slot")).queryByTestId("lyrics-button")).toBeNull();
    });

    it("keeps the mic beside the note during a live show without the modal", () => {
      setPlayer(live);
      render(<HeaderBar />);
      const [slotEl, mic] = micSitsIn("note-slot");
      const note = within(slotEl).getByRole("button", { name: "Make request" });
      expect(note.compareDocumentPosition(mic) & Node.DOCUMENT_POSITION_PRECEDING).toBeTruthy();
    });

    it("keeps the mic beside the note off the live program", () => {
      render(<HeaderBar openLiveRequestModal={vi.fn()} />);
      const [slotEl, mic] = micSitsIn("note-slot");
      const note = within(slotEl).getByRole("button", { name: "Make request" });
      expect(note.compareDocumentPosition(mic) & Node.DOCUMENT_POSITION_PRECEDING).toBeTruthy();
    });
  });

  describe("make-request button", () => {
    it("opens the MakeRequest screen when the program is not live", () => {
      const openModal = vi.fn();
      render(<HeaderBar openLiveRequestModal={openModal} />);
      pressRequest();
      expect(mocks.navigation.navigate).toHaveBeenCalledExactlyOnceWith("MakeRequest");
      expect(openModal).not.toHaveBeenCalled();
    });

    it("opens the live-request modal during a live program taking requests", () => {
      setPlayer({ currentProgram: { isLive: true, acceptingRequests: true } });
      const openModal = vi.fn();
      render(<HeaderBar openLiveRequestModal={openModal} />);
      pressRequest();
      expect(openModal).toHaveBeenCalledTimes(1);
      expect(mocks.navigation.navigate).not.toHaveBeenCalled();
    });

    it("does nothing while live with requests closed", () => {
      setPlayer({ currentProgram: { isLive: true, acceptingRequests: false } });
      const openModal = vi.fn();
      render(<HeaderBar openLiveRequestModal={openModal} />);
      pressRequest();
      expect(openModal).not.toHaveBeenCalled();
      expect(mocks.navigation.navigate).not.toHaveBeenCalled();
      expect(screen.getByTestId("badge-disabled")).toBeTruthy();
    });

    it("never navigates away from a live program without a modal handler", () => {
      setPlayer({ currentProgram: { isLive: true, acceptingRequests: true } });
      render(<HeaderBar />);
      pressRequest();
      expect(mocks.navigation.navigate).not.toHaveBeenCalled();
      expect(screen.queryByTestId("badge-enabled")).toBeNull();
    });
  });

  describe("progress bar", () => {
    const NOW = new Date("2026-10-05T05:00:00Z").getTime();
    const runs = () =>
      vi.mocked(Animated.timing).mock.calls.filter(([, config]) => config.toValue === 1);

    beforeEach(() => {
      vi.useFakeTimers({ toFake: ["Date"] });
      vi.setSystemTime(NOW);
      setPlayer({ currentTrack: { duration: 200_000, raw: "Song A" } });
    });
    afterEach(() => {
      vi.useRealTimers();
    });

    it("runs one linear native animation from the heard position to the song's end", () => {
      // Anchored 10 s ago at 50 s: the audio is at 60 s now.
      mocks.progress = {
        progressMs: 50_000,
        progressAt: NOW - 10_000,
        progressRunning: true,
        showProgress: true,
        durationMs: 200_000,
      };
      render(<HeaderBar />);
      expect(runs()).toHaveLength(1);
      expect(runs()[0][1]).toEqual({
        toValue: 1,
        duration: 140_000,
        easing: "linear",
        useNativeDriver: true,
      });
      expect((runs()[0][0] as unknown as { value: number }).value).toBeCloseTo(0.3, 5);
    });

    it("holds still while the audio is stopped", () => {
      mocks.progress = {
        progressMs: 50_000,
        progressAt: NOW - 10_000,
        progressRunning: false,
        showProgress: true,
        durationMs: 200_000,
      };
      render(<HeaderBar />);
      expect(runs()).toHaveLength(0);
    });

    it("runs to the progress snapshot's duration, not the track's (a live song's estimate)", () => {
      // The station sent no length (0): the bar follows the estimated 100 s.
      setPlayer({ currentTrack: { duration: 0, raw: "Song A" } });
      mocks.progress = {
        progressMs: 50_000,
        progressAt: NOW,
        progressRunning: true,
        showProgress: true,
        durationMs: 100_000,
      };
      render(<HeaderBar />);
      expect(runs()).toHaveLength(1);
      expect(runs()[0][1].duration).toBe(50_000);
    });

    it("restarts only on a re-anchor, from where the audio is", () => {
      mocks.progress = { progressMs: 50_000, progressAt: NOW, progressRunning: true, showProgress: true, durationMs: 200_000 };
      const { rerender } = render(<HeaderBar />);
      rerender(<HeaderBar />);
      expect(runs()).toHaveLength(1);
      const first = vi.mocked(Animated.timing).mock.results[0].value;
      mocks.progress = { progressMs: 1_200, progressAt: NOW, progressRunning: true, showProgress: true, durationMs: 200_000 };
      rerender(<HeaderBar />);
      expect(first.stop).toHaveBeenCalledTimes(1);
      expect(runs()).toHaveLength(2);
      expect(runs()[1][1].duration).toBe(198_800);
    });
  });

  describe("live badge pulse", () => {
    const live = { currentProgram: { isLive: true, acceptingRequests: true } };

    it("pulses only while the badge is shown and the app is visible", () => {
      setPlayer(live);
      render(<HeaderBar openLiveRequestModal={vi.fn()} />);
      expect(screen.getByTestId("badge-enabled")).toBeTruthy();
      expect(Animated.loop).toHaveBeenCalledTimes(1);
    });

    it("stays still when there is no live badge", () => {
      render(<HeaderBar openLiveRequestModal={vi.fn()} />);
      expect(Animated.loop).not.toHaveBeenCalled();
    });

    it("stays still while the app is backgrounded", () => {
      mocks.backgrounded = true;
      setPlayer(live);
      render(<HeaderBar openLiveRequestModal={vi.fn()} />);
      expect(Animated.loop).not.toHaveBeenCalled();
    });

    it("stops the pulse on unmount", () => {
      setPlayer(live);
      const { unmount } = render(<HeaderBar openLiveRequestModal={vi.fn()} />);
      const loop = vi.mocked(Animated.loop).mock.results[0].value;
      unmount();
      expect(loop.stop).toHaveBeenCalledTimes(1);
    });
  });

  describe("other controls", () => {
    it("opens the drawer from the menu button", () => {
      render(<HeaderBar />);
      fireEvent.click(screen.getByRole("button", { name: "Open menu" }));
      expect(mocks.navigation.openDrawer).toHaveBeenCalledTimes(1);
    });

    it("plays when paused and labels the button for the action it offers", async () => {
      render(<HeaderBar />);
      fireEvent.click(screen.getByRole("button", { name: "Play" }));
      await waitFor(() => expect(mocks.player.play).toHaveBeenCalledTimes(1));
      expect(mocks.player.pause).not.toHaveBeenCalled();
      expect(mocks.haptics.tap).toHaveBeenCalledTimes(1);
    });

    it("marks a toggle in flight busy, never disabled (a disabled view drops D-pad focus)", async () => {
      let resolve!: () => void;
      setPlayer({ play: vi.fn(() => new Promise<void>((r) => (resolve = r))) });
      render(<HeaderBar />);
      const button = screen.getByRole("button", { name: "Play" });
      fireEvent.click(button);
      await waitFor(() => expect(button.getAttribute("aria-busy")).toBe("true"));
      expect(button.getAttribute("aria-disabled")).toBeNull();
      resolve();
      await waitFor(() => expect(button.getAttribute("aria-busy")).toBe("false"));
    });

    it("pauses when playing", async () => {
      setPlayer({ isPlaying: true });
      render(<HeaderBar />);
      fireEvent.click(screen.getByRole("button", { name: "Pause" }));
      await waitFor(() => expect(mocks.player.pause).toHaveBeenCalledTimes(1));
    });

    it("survives a failing toggle and allows a retry", async () => {
      const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
      const play = vi.fn().mockRejectedValueOnce(new Error("no audio")).mockResolvedValue(undefined);
      setPlayer({ play });
      render(<HeaderBar />);
      const button = () => screen.getByRole("button", { name: "Play" });
      fireEvent.click(button());
      await waitFor(() =>
        expect(warn).toHaveBeenCalledWith("[PlayPauseButton] play/pause failed:", expect.any(Error)),
      );
      fireEvent.click(button());
      await waitFor(() => expect(play).toHaveBeenCalledTimes(2));
      warn.mockRestore();
    });
  });
});
