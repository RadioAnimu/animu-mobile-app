// @vitest-environment jsdom
import { cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  track: null as Record<string, unknown> | null,
  backgrounded: false,
  lyricsFor: vi.fn(),
}));

vi.mock("@/contexts/player/PlayerProvider", () => ({ usePlayer: () => ({ currentTrack: mocks.track }) }));
vi.mock("@/contexts/app-state/AppStateProvider", () => ({ useIsBackgrounded: () => mocks.backgrounded }));
vi.mock("@/core/lyrics", () => ({
  lyricsService: () => ({ lyricsFor: mocks.lyricsFor }),
  LyricsService: {
    isSong: (track: { title?: string } | null) => Boolean(track?.title),
    keyOf: (track: { title: string }) => track.title,
  },
}));

const { useLyricsAvailability } = await import("@/hooks/useLyricsAvailability");

describe("useLyricsAvailability", () => {
  beforeEach(() => {
    mocks.track = { title: "Gurenge" };
    mocks.backgrounded = false;
    mocks.lyricsFor.mockReset();
  });
  afterEach(cleanup);

  it("is checking, then available for lyrics", async () => {
    mocks.lyricsFor.mockResolvedValue({ kind: "synced" });
    const { result } = renderHook(() => useLyricsAvailability());
    expect(result.current).toBe("checking");
    await waitFor(() => expect(result.current).toBe("available"));
  });

  it("is missing for no lyrics, an instrumental, or a jingle", async () => {
    mocks.lyricsFor.mockResolvedValue(null);
    const { result } = renderHook(() => useLyricsAvailability());
    await waitFor(() => expect(result.current).toBe("missing"));
    mocks.lyricsFor.mockResolvedValue({ kind: "instrumental" });
    mocks.track = { title: "Interlude" };
    const second = renderHook(() => useLyricsAvailability());
    await waitFor(() => expect(second.result.current).toBe("missing"));
    mocks.track = null;
    expect(renderHook(() => useLyricsAvailability()).result.current).toBe("missing");
  });

  it("is unknown when the lookup fails", async () => {
    mocks.lyricsFor.mockRejectedValue(new Error("offline"));
    const { result } = renderHook(() => useLyricsAvailability());
    await waitFor(() => expect(result.current).toBe("unknown"));
  });

  it("looks nothing up in the background, and once per song", async () => {
    mocks.backgrounded = true;
    renderHook(() => useLyricsAvailability());
    expect(mocks.lyricsFor).not.toHaveBeenCalled();
    mocks.backgrounded = false;
    mocks.lyricsFor.mockResolvedValue({ kind: "synced" });
    const { rerender } = renderHook(() => useLyricsAvailability());
    mocks.track = { title: "Gurenge" }; // the same song, re-emitted
    rerender();
    await waitFor(() => expect(mocks.lyricsFor).toHaveBeenCalledTimes(1));
  });
});
