import { beforeEach, describe, expect, it, vi } from "vitest";

const storage = vi.hoisted(() => ({ exists: false, clock: 0, files: new Map<string, { text: string; modified: number }>() }));
vi.mock("expo-file-system", () => {
  class File {
    constructor(_dir: unknown, readonly name: string) {}
    get exists() { return storage.files.has(this.name); }
    get lastModified() { return storage.files.get(this.name)?.modified ?? null; }
    async text() { return storage.files.get(this.name)!.text; }
    write(text: string) { storage.files.set(this.name, { text, modified: ++storage.clock }); }
    delete() { storage.files.delete(this.name); }
  }
  class Directory {
    get exists() { return storage.exists; }
    get size() { return [...storage.files.values()].reduce((size, file) => size + file.text.length, 0); }
    create() { storage.exists = true; }
    list() { return [...storage.files.keys()].map((name) => new File(this, name)); }
    delete() { storage.exists = false; storage.files.clear(); }
  }
  return { Directory, File, Paths: { cache: "file://cache" } };
});

const { fileNameOf, LyricsFileCache } = await import("@/core/lyrics/file-cache");

beforeEach(() => { storage.exists = false; storage.clock = 0; storage.files.clear(); });

describe("fileNameOf", () => {
  it("is stable, file-safe and distinct per song", () => {
    const key = "gurenge|lisa|235";
    expect(fileNameOf(key)).toBe(fileNameOf(key));
    expect(fileNameOf(key)).toMatch(/^[0-9a-f]{8}-\d+\.json$/);
    expect(fileNameOf(key)).not.toBe(fileNameOf("gurenge|lisa|90"));
    expect(fileNameOf("新時代|ado|227")).toMatch(/^[0-9a-f]{8}-\d+\.json$/);
    // Existing UTF-16 cache identities must survive supplementary characters.
    expect(fileNameOf("😀")).toBe("cb31c4b8-2.json");
  });
});

describe("lyrics persistence", () => {
  it("round-trips a known miss and tolerates an OS-purged cache", async () => {
    const cache = new LyricsFileCache();
    expect(await cache.read("song")).toBeNull();
    expect(await cache.size()).toBe(0);
    const entry = { savedAt: 123, result: { kind: "none" as const } };
    await cache.write("song", entry);
    expect(await cache.read("song")).toEqual(entry);
    expect(await cache.size()).toBeGreaterThan(0);
    await cache.clear();
    expect(await cache.read("song")).toBeNull();
    await cache.clear();
  });

  it("rejects old formats, mismatched song keys, and incomplete lookups", async () => {
    const cache = new LyricsFileCache();
    for (const value of [
      { format: 0, key: "song", savedAt: 1, result: { kind: "none" } },
      { format: 1, key: "other", savedAt: 1, result: { kind: "none" } },
      { format: 1, key: "song", savedAt: "1", result: { kind: "none" } },
      { format: 1, key: "song", savedAt: 1 },
    ]) {
      storage.files.set(fileNameOf("song"), { text: JSON.stringify(value), modified: 0 });
      expect(await cache.read("song")).toBeNull();
    }
  });

  it("evicts the oldest lookup while retaining a rewritten song and recent songs", async () => {
    const cache = new LyricsFileCache();
    const entry = { savedAt: 123, result: { kind: "none" as const } };
    for (let i = 0; i < 400; i += 1) await cache.write(`song${i}`, entry);
    await cache.write("song0", entry);
    await cache.write("new song", entry);
    expect(storage.files.size).toBe(400);
    expect(await cache.read("song1")).toBeNull();
    expect(await cache.read("song0")).toEqual(entry);
    expect(await cache.read("new song")).toEqual(entry);
  });
});
