import { describe, expect, it, vi } from "vitest";

import { abortPlayerRequests, createApiClient } from "@/api/client";

// `client.ts` pulls native modules at import time only to build CLIENT_INFO —
// stub them out so the fetch wrapper's abort logic can be tested in node.
vi.mock("react-native", () => ({
  Platform: { OS: "web", Version: "0" },
}));
vi.mock("expo-application", () => ({
  nativeApplicationVersion: "2.2.0",
  nativeBuildVersion: "1",
}));
vi.mock("expo-device", () => ({
  osVersion: "18",
  modelName: "Test",
  deviceType: 1,
  DeviceType: { TABLET: 2, PHONE: 1 },
  manufacturer: "Test",
  isDevice: true,
}));
vi.mock("expo-localization", () => ({
  getLocales: () => [{ languageTag: "en-US", regionCode: "US" }],
}));
vi.mock("expo-constants", () => ({ default: { expoConfig: null } }));

// A fetch that hangs until aborted — enough to observe the wrapper's signal.
vi.mock("expo/fetch", () => ({
  fetch: vi.fn(
    (_url: string, init?: { signal?: AbortSignal }) =>
      new Promise<never>((_resolve, reject) => {
        if (init?.signal) {
          init.signal.addEventListener("abort", () =>
            reject(new Error("aborted")),
          );
        }
      }),
  ),
}));

// Capture the fetchImpl handed to the package so the test exercises the
// player-scoped wrapper directly (AnimuApi is not otherwise inspectable).
const { captured } = vi.hoisted(() => ({
  captured: {
    fetchImpl: null as ((url: string, init?: unknown) => Promise<unknown>) | null,
  },
}));
vi.mock("animu-api", () => ({
  AnimuApi: class {
    constructor(options: {
      fetchImpl?: (url: string, init?: unknown) => Promise<unknown>;
    }) {
      captured.fetchImpl = options.fetchImpl ?? null;
    }
  },
  clientUserAgent: () => "ua",
  DEFAULT_COVER: "https://cdn.animu.test/default.jpg",
  FALLBACK_STREAMS: [
    { id: "320", bitrate: 320, category: "MP3", url: "https://stream.animu.test/320" },
    { id: "192", bitrate: 192, category: "MP3", url: "https://stream.animu.test/192" },
    { id: "64", bitrate: 64, category: "AAC+", url: "https://stream.animu.test/64" },
  ],
}));

/** Resolves immediately while the fetch stays pending: "pending" = no abort. */
const probe = (promise: Promise<unknown>) =>
  Promise.race([promise, Promise.resolve("pending")]);

/** Settles a possibly-rejecting fetch into a plain outcome string. */
const outcome = async (promise: Promise<unknown>) =>
  promise.then(
    () => "resolved",
    () => "aborted",
  );

describe("playerScopedFetch", () => {
  it("aborts only player-scoped requests when the watchdog fires", async () => {
    createApiClient("medium", undefined, { playerScoped: true });
    const impl = captured.fetchImpl;
    expect(impl).toBeTruthy();

    // The package's OWN controller must stay untouched — its timeout and the
    // in-flight bookkeeping depend on deciding "timed out" from it.
    const packageController = new AbortController();
    const request = impl!("https://api.animu.moe", {
      signal: packageController.signal,
    });

    expect(await probe(request)).toBe("pending");
    abortPlayerRequests();
    expect(await outcome(request)).toBe("aborted");
    expect(packageController.signal.aborted).toBe(false);
  });

  it("bridges the package's own abort without consuming the scope", async () => {
    createApiClient("medium", undefined, { playerScoped: true });
    const impl = captured.fetchImpl!;

    // Package timeout abort → the request rejects...
    const first = new AbortController();
    const firstRequest = impl("https://api.animu.moe", {
      signal: first.signal,
    });
    expect(await probe(firstRequest)).toBe("pending");
    first.abort();
    expect(await outcome(firstRequest)).toBe("aborted");

    // ...but the SCOPE survives: a fresh request keeps running.
    const second = new AbortController();
    const secondRequest = impl("https://api.animu.moe", {
      signal: second.signal,
    });
    expect(await probe(secondRequest)).toBe("pending");
    expect(second.signal.aborted).toBe(false);
    abortPlayerRequests();
    expect(await outcome(secondRequest)).toBe("aborted");
  });
});
