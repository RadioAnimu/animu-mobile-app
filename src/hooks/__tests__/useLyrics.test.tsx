// @vitest-environment jsdom
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createStore } from "@/core/external-store";
import { LYRICS_IDLE, type LyricsSnapshot } from "@/core/lyrics/store";

const mocks = vi.hoisted(() => ({
  track: null as Record<string, unknown> | null,
  service: { show: vi.fn(), hide: vi.fn(), retry: vi.fn() },
  store: null as unknown as ReturnType<typeof createStore<LyricsSnapshot>>,
}));

vi.mock("@/contexts/player/PlayerProvider", () => ({ usePlayer: () => ({ currentTrack: mocks.track }) }));
vi.mock("@/core/lyrics", () => ({
  lyricsService: () => mocks.service,
  get lyricsStore() {
    return mocks.store;
  },
  LyricsService: {
    isSong: (track: { title?: string } | null) => Boolean(track?.title),
    keyOf: (track: { title: string }) => track.title.toLowerCase(),
  },
}));

const { useLyrics } = await import("@/hooks/useLyrics");

describe("useLyrics", () => {
  beforeEach(() => {
    mocks.store = createStore<LyricsSnapshot>(LYRICS_IDLE);
    mocks.track = { title: "Gurenge", raw: "LiSA - Gurenge" };
  });
  afterEach(cleanup);

  it("follows the heard song while mounted, and stops on unmount", () => {
    const { rerender, unmount } = renderHook(() => useLyrics());
    expect(mocks.service.show).toHaveBeenCalledTimes(1);
    // The same song re-emitted (a new object) is not a new lookup.
    mocks.track = { ...mocks.track };
    rerender();
    expect(mocks.service.show).toHaveBeenCalledTimes(1);
    mocks.track = { title: "Zankyosanka", raw: "Aimer - Zankyosanka" };
    rerender();
    expect(mocks.service.show).toHaveBeenCalledTimes(2);
    unmount();
    expect(mocks.service.hide).toHaveBeenCalled();
  });

  it("shows loading until the snapshot is about the current song", () => {
    mocks.store.setSnapshot({ status: "ready", trackKey: "other", lyrics: null });
    const { result } = renderHook(() => useLyrics());
    expect(result.current.status).toBe("loading");
    act(() => mocks.store.setSnapshot({ status: "missing", trackKey: "gurenge", lyrics: null }));
    expect(result.current.status).toBe("missing");
    result.current.retry();
    expect(mocks.service.retry).toHaveBeenCalled();
  });

  it("is idle when no song is heard", () => {
    mocks.track = null;
    const { result } = renderHook(() => useLyrics());
    expect(result.current.status).toBe("idle");
  });
});
