// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { Animated } from "react-native";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { HeaderBar } from "@/components/HeaderBar";

vi.mock("react-native", async () =>
  (await import("@/__tests__/react-native-mock")).createReactNativeMock(),
);
vi.mock("expo-image", () => ({ Image: () => <span data-testid="image" /> }));
vi.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

const mocks = vi.hoisted(() => ({
  navigation: { openDrawer: vi.fn(), navigate: vi.fn() },
  player: {} as Record<string, unknown>,
  progress: {} as Record<string, unknown>,
  backgrounded: false,
  haptics: { tap: vi.fn() },
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
vi.mock("@/components/LyricsButton", () => ({ LyricsButton: () => <i data-testid="lyrics-button" /> }));

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
    mocks.progress = { progressMs: 0, progressAt: 0, progressRunning: false, showProgress: true };
    setPlayer();
  });
  afterEach(cleanup);

  it("carries the lyrics microphone beside the request note", () => {
    render(<HeaderBar openLiveRequestModal={() => {}} />);
    expect(screen.getByTestId("lyrics-button")).toBeTruthy();
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
      };
      render(<HeaderBar />);
      expect(runs()).toHaveLength(0);
    });

    it("restarts only on a re-anchor, from where the audio is", () => {
      mocks.progress = { progressMs: 50_000, progressAt: NOW, progressRunning: true, showProgress: true };
      const { rerender } = render(<HeaderBar />);
      rerender(<HeaderBar />);
      expect(runs()).toHaveLength(1);
      const first = vi.mocked(Animated.timing).mock.results[0].value;
      mocks.progress = { progressMs: 1_200, progressAt: NOW, progressRunning: true, showProgress: true };
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
        expect(warn).toHaveBeenCalledWith("[HeaderBar] play/pause failed:", expect.any(Error)),
      );
      fireEvent.click(button());
      await waitFor(() => expect(play).toHaveBeenCalledTimes(2));
      warn.mockRestore();
    });
  });
});
