import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DEFAULT_STORE_LINKS } from "@/api/store-links";

const fetchMock = vi.fn();

const storeLinks = async () =>
  (await import("@/api/store-links")) as typeof import("@/api/store-links");

const RESPONSE = (payload: unknown, ok = true, status = 200) =>
  ({ ok, status, json: async () => payload }) as Response;

/** Store list from the endpoint: the merged-over shape. */
const REMOTE_STORES = {
  version: 1,
  stores: {
    play: { ...DEFAULT_STORE_LINKS.play, name: "Play Store" },
    "app-store": { ...DEFAULT_STORE_LINKS["app-store"], url: "https://apps.test/animu" },
    altstore: DEFAULT_STORE_LINKS.altstore,
    apk: { ...DEFAULT_STORE_LINKS.apk },
  },
};

beforeEach(() => {
  vi.resetAllMocks();
  // Fresh module per test: the in-memory link cache is session-long.
  vi.resetModules();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("getStoreLinks", () => {
  it("merges valid remote stores over the bundled defaults", async () => {
    fetchMock.mockResolvedValue(RESPONSE(REMOTE_STORES));
    const links = await (await storeLinks()).getStoreLinks();
    expect(links.play.name).toBe("Play Store");
    expect(links["app-store"].url).toBe("https://apps.test/animu");
    expect(links.altstore).toEqual(DEFAULT_STORE_LINKS.altstore);
  });

  it("falls back to the defaults when the endpoint is unreachable", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    fetchMock.mockRejectedValue(new Error("offline"));
    await expect((await storeLinks()).getStoreLinks()).resolves.toEqual(
      DEFAULT_STORE_LINKS,
    );
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it("falls back to the defaults on an HTTP error without reading the body", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const json = vi.fn(async () => REMOTE_STORES);
    fetchMock.mockResolvedValue({ ok: false, status: 503, json } as unknown as Response);
    await expect((await storeLinks()).getStoreLinks()).resolves.toEqual(
      DEFAULT_STORE_LINKS,
    );
    expect(json).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it("falls back to the defaults on an invalid payload shape", async () => {
    fetchMock.mockResolvedValue(RESPONSE({ version: 2 }));
    await expect((await storeLinks()).getStoreLinks()).resolves.toEqual(
      DEFAULT_STORE_LINKS,
    );
  });

  it("keeps a store's default when its remote entry is broken", async () => {
    fetchMock.mockResolvedValue(
      RESPONSE({
        version: 1,
        stores: {
          play: { name: 42, url: "https://play.test" },
          altstore: { ...DEFAULT_STORE_LINKS.altstore },
        },
      }),
    );
    const links = await (await storeLinks()).getStoreLinks();
    expect(links.play).toEqual(DEFAULT_STORE_LINKS.play);
    expect(links.altstore).toEqual(DEFAULT_STORE_LINKS.altstore);
  });

  it("keeps the bundled entry when a remote URL has an unsanctioned scheme", async () => {
    fetchMock.mockResolvedValue(
      RESPONSE({
        version: 1,
        stores: {
          play: { ...DEFAULT_STORE_LINKS.play, name: "Play Store", url: "ftp://play.test" },
          altstore: { name: "AltStore", url: 42 },
          "app-store": { name: "App Store", url: "itms-apps://apps.test" },
          apk: { name: "Google Play", url: null },
        },
      }),
    );
    const links = await (await storeLinks()).getStoreLinks();
    expect(links.play).toEqual(DEFAULT_STORE_LINKS.play);
    expect(links.altstore).toEqual(DEFAULT_STORE_LINKS.altstore);
    expect(links["app-store"].url).toBe("itms-apps://apps.test");
    // An explicit null is a deliberate "not listed".
    expect(links.apk).toEqual({ name: "Google Play", url: null });
  });

  it("shares one fetch between concurrent callers", async () => {
    fetchMock.mockResolvedValue(RESPONSE(REMOTE_STORES));
    const { getStoreLinks } = await storeLinks();
    const [a, b] = await Promise.all([getStoreLinks(), getStoreLinks()]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(a).toEqual(b);
  });

  it("asks again after a failure, but keeps a good answer for the session", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    fetchMock
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValue(RESPONSE(REMOTE_STORES));
    const { getStoreLinks } = await storeLinks();
    await expect(getStoreLinks()).resolves.toEqual(DEFAULT_STORE_LINKS);
    expect((await getStoreLinks()).play.name).toBe("Play Store");
    await getStoreLinks();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    warn.mockRestore();
  });

  it("aborts a slow endpoint after five seconds", async () => {
    vi.useFakeTimers();
    // A fetch that honours the signal and never resolves on its own.
    fetchMock.mockImplementationOnce(
      (_url: string, init?: { signal?: AbortSignal }) =>
        new Promise<Response>((_, reject) => {
          init?.signal?.addEventListener("abort", () =>
            reject(new Error("The operation was aborted")),
          );
        }),
    );
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const pending = (await storeLinks()).getStoreLinks();
    await vi.advanceTimersByTimeAsync(4999);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    await expect(pending).resolves.toEqual(DEFAULT_STORE_LINKS);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});
