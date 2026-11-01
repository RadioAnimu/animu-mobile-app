import { beforeEach, describe, expect, it } from "vitest";
import { installFakeCacheStorage } from "@/__tests__/fake-cache-storage";
import { WebStore } from "@/utils/web-store";

describe("WebStore", () => {
  beforeEach(() => {
    installFakeCacheStorage();
  });

  it("keeps binary bytes and text as written, with their size", async () => {
    const store = new WebStore("test");
    const bytes = Uint8Array.from([0, 1, 254, 255, 128]);
    await store.write("blob.dat", bytes);
    await store.write("note.txt", "olá");

    expect(await store.bytes("blob.dat")).toEqual(bytes);
    expect(await store.text("note.txt")).toBe("olá");
    expect(await store.size("blob.dat")).toBe(5);
    expect(await store.size("note.txt")).toBe(4); // UTF-8
    expect(await store.bytes("missing")).toBeNull();
  });

  it("lists entries with their sizes and write times", async () => {
    const store = new WebStore("test");
    await store.write("a b/ç.json", "{}");
    await store.write("b", Uint8Array.from([1, 2, 3]));

    const entries = await store.list();
    expect(entries.map((entry) => entry.name).sort()).toEqual(["a b/ç.json", "b"]);
    expect(entries.every((entry) => entry.savedAt > 0)).toBe(true);
    expect(entries.map((entry) => entry.bytes).sort()).toEqual([2, 3]);
  });

  it("removes one entry or the whole namespace, leaving others alone", async () => {
    const store = new WebStore("one");
    const other = new WebStore("two");
    await store.write("x", "1");
    await store.write("y", "2");
    await other.write("x", "3");

    await store.remove("x");
    expect(await store.text("x")).toBeNull();
    expect(await store.text("y")).toBe("2");

    await store.clear();
    expect(await store.list()).toEqual([]);
    expect(await other.text("x")).toBe("3");
  });
});
