// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Lyrics } from "@/core/lyrics";
import { LyricsBody } from "@/screens/Lyrics/LyricsBody";

vi.mock("react-native", async () => (await import("@/__tests__/react-native-mock")).createReactNativeMock());
vi.mock("@/components/Icon", () => ({ Icon: ({ name }: { name: string }) => <i data-icon={name} /> }));
vi.mock("@/screens/Lyrics/Segments", () => ({
  SegmentColumns: ({ segments }: { segments: { text: string; label: string }[] }) => (
    <div data-testid="columns">{segments.map((segment) => `${segment.text}/${segment.label}`).join(" ")}</div>
  ),
}));
vi.mock("@/screens/Lyrics/SyncedLyrics", () => ({
  SyncedLyrics: ({ entries, known }: { entries: unknown[]; known: boolean }) => (
    <div data-testid="synced" data-count={entries.length} data-known={String(known)} />
  ),
}));
vi.mock("@/hooks/useDict", () => ({
  useDict: () => ({
    LYRICS_NOT_A_SONG: "No lyrics right now",
    LYRICS_LOADING: "Looking for lyrics…",
    LYRICS_ERROR: "Couldn't load",
    LYRICS_RETRY: "Try again",
    LYRICS_MISSING: "No lyrics yet",
    LYRICS_MISSING_HINT: "Add them at lrclib.net",
    LYRICS_INSTRUMENTAL: "Instrumental",
    LYRICS_UNSYNCED: "Not synced to this version",
    LYRICS_SOURCE: "Lyrics from LRCLIB",
  }),
}));

const source = { provider: "lrclib" as const, id: 3, title: "t", artist: "a", album: "", durationMs: null };
const position = { get: () => 0, set: () => {} } as never;

const body = (props: Partial<Parameters<typeof LyricsBody>[0]>) =>
  render(
    <LyricsBody
      status="ready"
      lyrics={null}
      labels={[]}
      position={position}
      known
      reduceMotion={false}
      onRetry={() => {}}
      {...props}
    />,
  );

describe("LyricsBody", () => {
  afterEach(cleanup);

  it("explains every state without lyrics", () => {
    body({ status: "idle" });
    expect(screen.getByText("No lyrics right now")).toBeTruthy();
    cleanup();
    body({ status: "loading" });
    expect(screen.getByRole("progressbar")).toBeTruthy();
    cleanup();
    body({ status: "missing" });
    expect(screen.getByText("Add them at lrclib.net")).toBeTruthy();
    cleanup();
    body({ lyrics: { kind: "instrumental", source } });
    expect(screen.getByText("Instrumental")).toBeTruthy();
  });

  it("retries a failed lookup", () => {
    const onRetry = vi.fn();
    body({ status: "error", onRetry });
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(onRetry).toHaveBeenCalled();
  });

  it("shows untimed lyrics with their labels, and why they are not synced", () => {
    const lyrics: Lyrics = { kind: "plain", lines: ["君の名は", "", "Hello"], otherCut: true, language: "ja", source };
    body({
      lyrics,
      labels: [
        { kind: "words", segments: [{ text: "君の名は", label: "kimi no na wa", spaceAfter: false }] },
        null,
        null,
      ],
    });
    expect(screen.getByText("Not synced to this version")).toBeTruthy();
    expect(screen.getByTestId("columns").textContent).toBe("君の名は/kimi no na wa");
    expect(screen.getByText("Lyrics from LRCLIB")).toBeTruthy();
  });

  it("hands synced lyrics to the follow view", () => {
    const lyrics: Lyrics = {
      kind: "synced",
      entries: [{ kind: "line", startMs: 0, endMs: 1, text: "a", words: null }],
      wordTimed: false,
      romaji: null,
      language: "other",
      source,
    };
    body({ lyrics, known: false });
    const synced = screen.getByTestId("synced");
    expect(synced.getAttribute("data-count")).toBe("1");
    expect(synced.getAttribute("data-known")).toBe("false");
  });
});
