// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PlaybackSection } from "@/screens/Settings/sections/PlaybackSection";

const mocks = vi.hoisted(() => ({
  player: {} as Record<string, unknown>,
  changeStream: vi.fn(async () => {}),
  setSleepTimer: vi.fn(async (_choice: unknown) => true),
  warning: vi.fn(),
  select: null as null | {
    value: string;
    description?: string;
    options: { key: string; label: string }[];
    onChange: (key: string) => unknown;
  },
}));

vi.mock("@/components/Icon", () => ({ Icon: ({ name }: { name: string }) => <i data-icon={name} /> }));
vi.mock("@/components/SectionTitle", () => ({ SectionTitle: ({ title }: { title: string }) => <h2>{title}</h2> }));
vi.mock("@/hooks/useStackedRows", () => ({ useStackedRows: () => false }));
vi.mock("@/components/Avatar", () => ({ Avatar: () => null }));
vi.mock("@/utils/haptics", () => ({ haptics: { tap: vi.fn(), warning: mocks.warning, select: vi.fn(), error: vi.fn() } }));
vi.mock("@/hooks/useDict", () => ({
  useDict: () =>
    new Proxy({}, { get: (_target, key) => (key === "SLEEP_TIMER_PAUSES_IN" ? "Pauses in {time}" : String(key)) }),
}));
vi.mock("@/contexts/app-state/AppStateProvider", () => ({ useIsBackgrounded: () => false }));
vi.mock("@/components/Select", () => ({
  Select: (props: NonNullable<typeof mocks.select>) => {
    mocks.select = props;
    return <p>{props.description}</p>;
  },
}));
vi.mock("@/contexts/player/PlayerProvider", () => ({
  usePlayer: () => ({ ...mocks.player, changeStream: mocks.changeStream, setSleepTimer: mocks.setSleepTimer }),
}));

const HIGH = { id: "320", bitrate: 320, category: "MP3", url: "https://s.test/320" };
const LOW = { id: "64", bitrate: 64, category: "AAC+", url: "https://s.test/64" };
const keys = () => mocks.select?.options.map((option) => option.key);

describe("PlaybackSection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.player = {
      autoQuality: false,
      currentStream: HIGH,
      sleepAt: null,
      sleepChoice: null,
      sleepAtTrackEnd: true,
    };
  });
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("offers the minutes and the song's end once its place is known, and sets the timer", () => {
    render(<PlaybackSection />);
    expect(keys()).toEqual(["off", "15", "30", "45", "60", "track"]);
    expect(mocks.select?.value).toBe("off");
    expect(screen.getByText("SLEEP_TIMER_DESCRIPTION")).toBeTruthy();
    void mocks.select?.onChange("30");
    expect(mocks.setSleepTimer).toHaveBeenLastCalledWith(30);
    void mocks.select?.onChange("track");
    expect(mocks.setSleepTimer).toHaveBeenLastCalledWith("track");
    void mocks.select?.onChange("off");
    expect(mocks.setSleepTimer).toHaveBeenLastCalledWith(null);
  });

  it("a refused timer buzzes a warning", async () => {
    render(<PlaybackSection />);
    mocks.setSleepTimer.mockResolvedValueOnce(false);
    await expect(mocks.select?.onChange("track")).resolves.toBe(false);
    expect(mocks.warning).toHaveBeenCalledTimes(1);
  });

  it("leaves the song's end out when the service cannot tell it", () => {
    mocks.player = { ...mocks.player, sleepAtTrackEnd: false };
    render(<PlaybackSection />);
    expect(keys()).not.toContain("track");
  });

  it("counts a running timer down", () => {
    vi.useFakeTimers({ now: 1_000_000 });
    mocks.player = { ...mocks.player, sleepAt: 1_000_000 + 90_500, sleepChoice: 15 };
    render(<PlaybackSection />);
    expect(mocks.select?.value).toBe("15");
    expect(screen.getByText("Pauses in 1:31")).toBeTruthy();
    act(() => {
      vi.advanceTimersByTime(1_000);
    });
    expect(screen.getByText("Pauses in 1:30")).toBeTruthy();
  });

  it("a timer that outlived a reload (choice unknown) is its own row, so Off cancels it", () => {
    vi.useFakeTimers({ now: 1_000_000 });
    mocks.player = { ...mocks.player, sleepAt: 1_000_000 + 60_000, sleepChoice: null };
    render(<PlaybackSection />);
    expect(mocks.select?.value).toBe("running");
    expect(mocks.select?.options[0]).toEqual({ key: "running", label: "Pauses in 1:00" });
    // Said once: the row's description is the plain one.
    expect(mocks.select?.description).toBe("SLEEP_TIMER_DESCRIPTION");
    // Select skips a choice equal to its value: "Off" must not be the value.
    void mocks.select?.onChange("off");
    expect(mocks.setSleepTimer).toHaveBeenLastCalledWith(null);
  });

  it("turns automatic quality on, and off keeping the stream heard as the pick", () => {
    render(<PlaybackSection />);
    fireEvent.click(screen.getByRole("switch"));
    expect(mocks.changeStream).toHaveBeenLastCalledWith("auto");
    cleanup();
    mocks.player = { ...mocks.player, autoQuality: true, playingStream: LOW };
    render(<PlaybackSection />);
    expect(screen.getByRole("switch").getAttribute("aria-checked")).toBe("true");
    fireEvent.click(screen.getByRole("switch"));
    expect(mocks.changeStream).toHaveBeenLastCalledWith(LOW);
  });
});
