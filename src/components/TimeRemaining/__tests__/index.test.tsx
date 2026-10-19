// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { TimeRemaining } from "@/components/TimeRemaining";

vi.mock("react-native", async () =>
  (await import("@/__tests__/react-native-mock")).createReactNativeMock(),
);

const mocks = vi.hoisted(() => ({
  player: {} as Record<string, unknown>,
  progress: {} as Record<string, unknown>,
  remainingArgs: [] as unknown[],
}));

vi.mock("@/contexts/player/PlayerProvider", () => ({
  usePlayer: () => mocks.player,
  useTrackProgress: () => mocks.progress,
}));
vi.mock("@/contexts/app-state/AppStateProvider", () => ({
  useIsBackgrounded: () => false,
}));
vi.mock("@/contexts/user/UserSettingsProvider", () => ({
  useUserSettings: () => ({ settings: { selectedLanguage: "EN" } }),
}));
vi.mock("@/hooks/useDict", () => ({
  useDict: () => ({ TIME_REMAINING: "Time remaining", SYNCHRONIZING: "Synchronizing" }),
}));
vi.mock("@/hooks/useBlink", () => ({ useBlink: () => 1 }));
vi.mock("@/hooks/useRemainingMs", () => ({
  useRemainingMs: (...args: unknown[]) => {
    mocks.remainingArgs = args;
    return 83_000;
  },
}));

const setState = (showProgress: boolean, syncing = false, track: unknown = { duration: 200_000 }) => {
  mocks.player = { syncing, currentTrack: track };
  mocks.progress = {
    progressMs: 0,
    progressAt: 0,
    progressRunning: true,
    showProgress,
    durationMs: 200_000,
  };
};

const remainingLines = () => screen.queryAllByText(/Time remaining:/);

describe("TimeRemaining", () => {
  beforeEach(() => setState(true));
  afterEach(cleanup);

  it("shows the countdown over the sizer line", () => {
    render(<TimeRemaining />);
    // The invisible sizer plus the visible countdown.
    expect(remainingLines()).toHaveLength(2);
    expect(screen.getByText("1:23")).toBeTruthy();
  });

  it("counts down the progress snapshot's duration, not the track's (a live song's estimate)", () => {
    setState(true, false, { duration: 0 });
    mocks.progress = { ...mocks.progress, durationMs: 150_000 };
    render(<TimeRemaining />);
    expect(mocks.remainingArgs[1]).toBe(150_000);
  });

  it("keeps the sizer when there is no progress (live show, jingle)", () => {
    setState(false);
    render(<TimeRemaining />);
    expect(remainingLines()).toHaveLength(1);
    expect(screen.queryByText("1:23")).toBeNull();
  });

  it("keeps the sizer before the first track", () => {
    setState(true, false, null);
    render(<TimeRemaining />);
    expect(remainingLines()).toHaveLength(1);
  });

  it("swaps the countdown for the syncing message in the same slot", () => {
    setState(true, true);
    render(<TimeRemaining />);
    expect(screen.getByText(/Synchronizing/)).toBeTruthy();
    expect(remainingLines()).toHaveLength(1);
  });
});
