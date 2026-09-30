// @vitest-environment jsdom
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useResolvedArtwork } from "@/hooks/useResolvedArtwork";

const { service } = vi.hoisted(() => ({
  service: {
    peekArtwork: vi.fn<(url: string) => string | undefined>(),
    resolveArtwork: vi.fn(),
  },
}));

vi.mock("@/core/player", () => ({ playerService: () => service }));
vi.mock("@/core/player/storage/artwork", () => ({
  pickPreviewArtwork: vi.fn(() => "preview-src"),
}));

const URL_A = "https://cdn.test/a.jpg";
const URL_B = "https://cdn.test/b.jpg";

describe("useResolvedArtwork", () => {
  beforeEach(() => {
    service.peekArtwork.mockReset().mockReturnValue(undefined);
    service.resolveArtwork.mockReset();
  });

  it("returns undefined and never resolves when there is no url", () => {
    const { result } = renderHook(() => useResolvedArtwork(undefined));
    expect(result.current).toBeUndefined();
    expect(service.resolveArtwork).not.toHaveBeenCalled();
  });

  it("uses the already-cached local file without downloading", () => {
    service.peekArtwork.mockReturnValue("file:///cache/a.jpg");
    const { result } = renderHook(() => useResolvedArtwork(URL_A));
    expect(result.current).toBe("file:///cache/a.jpg");
    expect(service.resolveArtwork).not.toHaveBeenCalled();
  });

  it("paints the preview first, then upgrades to the final file", async () => {
    let onPreview: (p: string) => void = () => undefined;
    let finish: (r: string) => void = () => undefined;
    service.resolveArtwork.mockImplementation(
      (_url: string, cb: (p: string) => void) => {
        onPreview = cb;
        return new Promise<string>((res) => (finish = res));
      },
    );
    const { result } = renderHook(() => useResolvedArtwork(URL_A));
    expect(result.current).toBeUndefined();
    expect(service.resolveArtwork).toHaveBeenCalledWith(
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
    service.resolveArtwork.mockRejectedValue(new Error("offline"));
    const { result } = renderHook(() => useResolvedArtwork(URL_A));
    await waitFor(() => expect(result.current).toBe(URL_A));
  });

  it("ignores a late result after the url changed or it unmounted", async () => {
    let finishA: (r: string) => void = () => undefined;
    service.resolveArtwork.mockImplementationOnce(
      () => new Promise<string>((res) => (finishA = res)),
    );
    service.peekArtwork.mockImplementation((u) =>
      u === URL_B ? "file:///b.jpg" : undefined,
    );
    const { result, rerender, unmount } = renderHook(
      ({ url }) => useResolvedArtwork(url),
      { initialProps: { url: URL_A as string | undefined } },
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
