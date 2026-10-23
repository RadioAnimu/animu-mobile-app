// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { Platform } from "react-native";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LyricsButton } from "@/components/LyricsButton";

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  restore: vi.fn(async () => {}),
  install: vi.fn(async () => {}),
  dictionary: "none" as string,
  availability: "available" as string,
}));

vi.mock("react-native", async () => (await import("@/__tests__/react-native-mock")).createReactNativeMock());
vi.mock("@react-navigation/native", () => ({ useNavigation: () => ({ navigate: mocks.navigate }) }));
vi.mock("@/components/KaraokeMicIcon", () => ({
  KaraokeMicIcon: ({ color }: { color: string }) => <i data-icon="karaoke-mic" data-color={color} />,
}));
vi.mock("@/core/japanese", () => ({
  japaneseDictionary: {
    restore: mocks.restore,
    install: mocks.install,
    get snapshot() {
      return { install: mocks.dictionary };
    },
  },
}));
vi.mock("@/hooks/useLyricsAvailability", () => ({ useLyricsAvailability: () => mocks.availability }));
vi.mock("@/hooks/useDict", () => ({
  useDict: () => ({ A11Y_OPEN_LYRICS: "Show lyrics", LYRICS_MISSING: "No lyrics yet" }),
}));
vi.mock("@/utils/haptics", () => ({ haptics: { tap: vi.fn() } }));

const button = () => screen.getByRole("button", { name: "Show lyrics" });
const icon = () => button().querySelector("i")!;

describe("LyricsButton", () => {
  let idle: () => void;
  const cancelIdle = vi.fn();
  beforeEach(() => {
    vi.stubGlobal("requestIdleCallback", vi.fn((callback: () => void) => {
      idle = callback;
      return 12;
    }));
    vi.stubGlobal("cancelIdleCallback", cancelIdle);
  });
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    Object.assign(Platform, { isTV: false });
    mocks.install.mockClear();
  });

  it("is a green microphone that opens the lyrics", () => {
    mocks.availability = "available";
    render(<LyricsButton size={27} hitSlop={7} />);
    expect(icon().getAttribute("data-icon")).toBe("karaoke-mic");
    expect(icon().getAttribute("data-color")).toBe("#6BDB00");
    fireEvent.click(button());
    expect(mocks.navigate).toHaveBeenCalledWith("Lyrics");
  });

  it.each(["missing", "checking"])("is greyed out and inactive while %s", (availability) => {
    mocks.availability = availability;
    mocks.navigate.mockClear();
    render(<LyricsButton size={27} hitSlop={7} />);
    expect(button().getAttribute("aria-disabled")).toBe("true");
    expect(icon().getAttribute("data-color")).not.toBe("#6BDB00");
    fireEvent.click(button());
    expect(mocks.navigate).not.toHaveBeenCalled();
  });

  it("stays usable after a failed lookup (the lyrics retry)", () => {
    mocks.availability = "unknown";
    render(<LyricsButton size={27} hitSlop={7} />);
    expect(button().getAttribute("aria-disabled")).toBeNull();
  });

  it("cleans up an interrupted dictionary install at launch", () => {
    render(<LyricsButton size={27} hitSlop={7} />);
    expect(mocks.restore).not.toHaveBeenCalled();
    idle();
    expect(mocks.restore).toHaveBeenCalled();
  });

  it("installs a missing dictionary at launch on a TV, and only there", async () => {
    mocks.dictionary = "none";
    render(<LyricsButton size={27} hitSlop={7} />);
    idle();
    await waitFor(() => expect(mocks.restore).toHaveBeenCalled());
    await Promise.resolve();
    expect(mocks.install).not.toHaveBeenCalled();
    cleanup();

    Object.assign(Platform, { isTV: true });
    render(<LyricsButton size={27} hitSlop={7} />);
    idle();
    await waitFor(() => expect(mocks.install).toHaveBeenCalledTimes(1));

    mocks.dictionary = "installed";
    mocks.install.mockClear();
    cleanup();
    render(<LyricsButton size={27} hitSlop={7} />);
    idle();
    await Promise.resolve();
    await Promise.resolve();
    expect(mocks.install).not.toHaveBeenCalled();
  });

  it("cancels dictionary work when unmounted before the idle slot", () => {
    const { unmount } = render(<LyricsButton size={27} hitSlop={7} />);
    unmount();
    expect(cancelIdle).toHaveBeenCalledWith(12);
    expect(mocks.restore).not.toHaveBeenCalled();
  });
});
