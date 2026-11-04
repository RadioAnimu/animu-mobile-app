// @vitest-environment jsdom
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useResolvedArtwork } from "@/hooks/useResolvedArtwork";

const { artwork } = vi.hoisted(() => ({
  artwork: {
    isRemote: vi.fn((url: string) => /^https?:/i.test(url)),
    peek: vi.fn<(url: string) => string | undefined>(),
    resolve: vi.fn(),
  },
}));

vi.mock("@/core/player", () => ({ playerService: () => ({ artwork }) }));
vi.mock("@/core/player/storage/artwork", () => ({
  pickPreviewArtwork: vi.fn(() => "preview-src"),
}));

const URL_A = "https://cdn.test/a.jpg";
const URL_B = "https://cdn.test/b.jpg";

describe("useResolvedArtwork", () => {
  beforeEach(() => {
    artwork.peek.mockReset().mockReturnValue(undefined);
    artwork.isRemote.mockImplementation((url: string) => /^https?:/i.test(url));
    artwork.resolve.mockReset();
  });

  it("returns undefined and never resolves when there is no url", () => {
    const { result } = renderHook(() => useResolvedArtwork(undefined));
    expect(result.current).toBeUndefined();
    expect(artwork.resolve).not.toHaveBeenCalled();
  });

  it("uses the already-cached local file without downloading", () => {
    artwork.peek.mockReturnValue("file:///cache/a.jpg");
    const { result } = renderHook(() => useResolvedArtwork(URL_A));
    expect(result.current).toBe("file:///cache/a.jpg");
    expect(artwork.resolve).not.toHaveBeenCalled();
  });

  it("uses a URL that needs no download (the web) as is, on the first render", () => {
    artwork.isRemote.mockReturnValue(false);
    const { result } = renderHook(() => useResolvedArtwork(URL_A));
    expect(result.current).toBe(URL_A);
    expect(artwork.resolve).not.toHaveBeenCalled();
  });

  it("uses a local file URI as is, on the first render", () => {
    const { result } = renderHook(() => useResolvedArtwork("file:///cache/a.jpg"));
    expect(result.current).toBe("file:///cache/a.jpg");
    expect(artwork.resolve).not.toHaveBeenCalled();
  });

  it("paints the preview first, then upgrades to the final file", async () => {
    let onPreview: (p: string) => void = () => undefined;
    let finish: (r: string) => void = () => undefined;
    artwork.resolve.mockImplementation(
      (_url: string, cb: (p: string) => void) => {
        onPreview = cb;
        return new Promise<string>((res) => (finish = res));
      },
    );
    const { result } = renderHook(() => useResolvedArtwork(URL_A));
    expect(result.current).toBeUndefined();
    expect(artwork.resolve).toHaveBeenCalledWith(
      URL_A,
      expect.any(Function),
      "preview-src",
    );

    act(() => onPreview("file:///preview.jpg"));
    expect(result.current).toBe("file:///preview.jpg");

    await act(async () => finish("file:///final.jpg"));
    expect(result.current).toBe("file:///final.jpg");
  });

  it("falls back to the remote url when resolution fails", async () => {
    artwork.resolve.mockRejectedValue(new Error("offline"));
    const { result } = renderHook(() => useResolvedArtwork(URL_A));
    await waitFor(() => expect(result.current).toBe(URL_A));
  });

  it("ignores a late result after the url changed or it unmounted", async () => {
    let finishA: (r: string) => void = () => undefined;
    artwork.resolve.mockImplementationOnce(
      () => new Promise<string>((res) => (finishA = res)),
    );
    artwork.peek.mockImplementation((u) =>
      u === URL_B ? "file:///b.jpg" : undefined,
    );
    const initialProps: { url: string | undefined } = { url: URL_A };
    const { result, rerender, unmount } = renderHook(
      ({ url }) => useResolvedArtwork(url),
      { initialProps },
    );
    rerender({ url: URL_B });
    expect(result.current).toBe("file:///b.jpg");
    await act(async () => finishA("file:///stale-a.jpg"));
    expect(result.current).toBe("file:///b.jpg");

    rerender({ url: undefined });
    expect(result.current).toBeUndefined();
    unmount();
  });
});
