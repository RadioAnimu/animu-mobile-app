// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LyricsButton } from "@/components/LyricsButton";

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  restore: vi.fn(async () => {}),
  track: null as Record<string, unknown> | null,
}));

vi.mock("react-native", async () => (await import("@/__tests__/react-native-mock")).createReactNativeMock());
vi.mock("@react-navigation/native", () => ({ useNavigation: () => ({ navigate: mocks.navigate }) }));
vi.mock("@/components/Icon", () => ({ Icon: () => <i /> }));
vi.mock("@/contexts/player/PlayerProvider", () => ({ usePlayer: () => ({ currentTrack: mocks.track }) }));
vi.mock("@/core/japanese", () => ({ japaneseDictionary: { restore: mocks.restore } }));
vi.mock("@/core/lyrics", () => ({
  LyricsService: { isSong: (track: { raw?: string } | null) => Boolean(track && !track.raw?.toLowerCase().includes("animu")) },
}));
vi.mock("@/hooks/useDict", () => ({ useDict: () => ({ A11Y_OPEN_LYRICS: "Show lyrics" }) }));
vi.mock("@/utils/haptics", () => ({ haptics: { tap: vi.fn() } }));

describe("LyricsButton", () => {
  afterEach(cleanup);

  it("opens the lyrics while a song is heard", () => {
    mocks.track = { raw: "LiSA - Gurenge", title: "Gurenge" };
    render(<LyricsButton />);
    fireEvent.click(screen.getByRole("button", { name: "Show lyrics" }));
    expect(mocks.navigate).toHaveBeenCalledWith("Lyrics");
  });

  it("cleans up an interrupted dictionary install at launch", () => {
    mocks.track = null;
    render(<LyricsButton />);
    expect(mocks.restore).toHaveBeenCalled();
  });

  it("is absent for station filler", () => {
    mocks.track = { raw: "Rádio Animu - jingle", title: "jingle" };
    render(<LyricsButton />);
    expect(screen.queryByRole("button")).toBeNull();
  });
});
