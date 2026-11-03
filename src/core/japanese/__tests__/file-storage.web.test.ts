import { createHash } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { installFakeCacheStorage } from "@/__tests__/fake-cache-storage";
import { DictionaryFileStorage } from "@/core/japanese/file-storage.web";
import { refreshDiskCapacity } from "@/core/services/device-storage.service.web";

const bytes = Uint8Array.from({ length: 70_000 }, (_, i) => (i * 7) & 0xff);
const md5 = (data: Uint8Array) => createHash("md5").update(data).digest("hex");

/** A response whose body arrives in 3 chunks. */
function streamed(data: Uint8Array): Response {
  const third = Math.ceil(data.length / 3);
  return new Response(
    new ReadableStream({
      start(controller) {
        for (let offset = 0; offset < data.length; offset += third) controller.enqueue(data.slice(offset, offset + third));
        controller.close();
      },
    }),
  );
}

describe("DictionaryFileStorage (web)", () => {
  beforeEach(() => {
    installFakeCacheStorage();
    vi.stubGlobal("navigator", { storage: { estimate: async () => ({ quota: 1_000_000_000, usage: 400_000_000 }) } });
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("downloads with progress and reports the download's size and MD5", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => streamed(bytes)));
    const storage = new DictionaryFileStorage();
    const progress: number[] = [];
    await storage.download("https://cdn.test/base.dat.gz", "base.dat.gz", (n) => progress.push(n), new AbortController().signal);

    expect(progress).toEqual([23_334, 46_668, 70_000]);
    expect(await storage.statDownload("base.dat.gz")).toEqual({ bytes: 70_000, md5: md5(bytes) });
    expect(await storage.readDownload("base.dat.gz")).toEqual(bytes);
  });

  it("fails a download the server refused", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("nope", { status: 404 })));
    const storage = new DictionaryFileStorage();
    await expect(
      storage.download("https://cdn.test/base.dat.gz", "base.dat.gz", () => {}, new AbortController().signal),
    ).rejects.toThrow("HTTP 404");
    expect(await storage.statDownload("base.dat.gz")).toBeNull();
  });

  it("stores unpacked files under their name without .gz, with the version", async () => {
    const storage = new DictionaryFileStorage();
    await storage.writeStored("tid.dat.gz", bytes);
    await storage.writeVersion("0.1.2\n");

    expect(await storage.statStored("tid.dat.gz")).toBe(70_000);
    expect(await storage.readStored("tid.dat.gz")).toEqual(bytes);
    expect(await storage.readVersion()).toBe("0.1.2");

    await storage.removeAll();
    expect(await storage.statStored("tid.dat.gz")).toBeNull();
    expect(await storage.readVersion()).toBeNull();
  });

  it("reports the site's free quota once the browser has answered", async () => {
    await refreshDiskCapacity();
    expect(new DictionaryFileStorage().freeBytes()).toBe(600_000_000);
  });
});
