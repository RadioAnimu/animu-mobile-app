import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import type { JapaneseTokenizer, LoadFile } from "@/core/japanese/tokenizer";
import { createStore } from "@/core/external-store";
import {
  DICTIONARY_BYTES,
  DICTIONARY_FILE_NAMES,
  DICTIONARY_FILES,
  DICTIONARY_MIRRORS,
  DICTIONARY_VERSION,
  type DictionaryFileName,
} from "@/core/japanese/dictionary";
import {
  JAPANESE_DICTIONARY_INITIAL,
  JapaneseDictionary,
  type DictionaryStorage,
  type JapaneseDictionarySnapshot,
} from "@/core/japanese/dictionary-manager";

/** Files on a fake disk: a download stores what the mirror serves. */
class FakeStorage implements DictionaryStorage {
  files = new Map<string, { bytes: number; md5: string }>();
  version: string | null = null;
  /** What each URL serves (default: the published file). */
  serve = (url: string, name: DictionaryFileName): { bytes: number; md5: string } => {
    void url;
    return { ...DICTIONARY_FILES[name] };
  };
  downloads: string[] = [];

  stat = vi.fn(async (name: DictionaryFileName, withMd5: boolean) => {
    const file = this.files.get(name);
    return file ? { bytes: file.bytes, md5: withMd5 ? file.md5 : null } : null;
  });
  download = vi.fn(async (url: string, name: DictionaryFileName, onBytes: (written: number) => void) => {
    this.downloads.push(url);
    const served = this.serve(url, name);
    onBytes(served.bytes);
    this.files.set(name, served);
  });
  remove = vi.fn(async (name: DictionaryFileName) => {
    this.files.delete(name);
  });
  read = vi.fn(async () => new Uint8Array());
  readVersion = vi.fn(async () => this.version);
  writeVersion = vi.fn(async (version: string) => {
    this.version = version;
  });
  removeAll = vi.fn(async () => {
    this.files.clear();
    this.version = null;
  });
}

const tokenizer: JapaneseTokenizer = { tokenize: () => [] };

describe("JapaneseDictionary", () => {
  let storage: FakeStorage;
  let store: ReturnType<typeof createStore<JapaneseDictionarySnapshot>>;
  let build: Mock<(load: LoadFile) => Promise<JapaneseTokenizer>>;
  let dictionary: JapaneseDictionary;

  beforeEach(() => {
    storage = new FakeStorage();
    store = createStore<JapaneseDictionarySnapshot>(JAPANESE_DICTIONARY_INITIAL);
    build = vi.fn(async (_load: LoadFile) => tokenizer);
    dictionary = new JapaneseDictionary({ storage, store, buildTokenizer: build });
  });

  it("downloads and verifies every file, then marks the version", async () => {
    const progress: number[] = [];
    store.subscribe(() => progress.push(store.getSnapshot().progress));
    await dictionary.install();
    expect(store.getSnapshot()).toMatchObject({ install: "installed", progress: 1 });
    expect(storage.files.size).toBe(DICTIONARY_FILE_NAMES.length);
    expect(storage.version).toBe(DICTIONARY_VERSION);
    expect(progress.at(-1)).toBe(1);
    expect(progress).toEqual([...progress].sort((a, b) => a - b));
    expect(DICTIONARY_BYTES).toBe(17_791_956);
  });

  it("falls back to the next mirror when a file fails its checksum", async () => {
    storage.serve = (url, name) =>
      url.startsWith(DICTIONARY_MIRRORS[0]) && name === "cc.dat.gz"
        ? { bytes: DICTIONARY_FILES[name].bytes, md5: "tampered" }
        : { ...DICTIONARY_FILES[name] };
    await dictionary.install();
    expect(store.getSnapshot().install).toBe("installed");
    expect(storage.downloads).toContain(`${DICTIONARY_MIRRORS[1]}cc.dat.gz`);
    expect(storage.files.get("cc.dat.gz")?.md5).toBe(DICTIONARY_FILES["cc.dat.gz"].md5);
  });

  it("fails (retryable) when no mirror serves the published file", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    storage.serve = () => ({ bytes: 1, md5: "bad" });
    await dictionary.install();
    expect(store.getSnapshot().install).toBe("error");
    expect(storage.version).toBeNull();
    expect(storage.files.size).toBe(0);
    warn.mockRestore();
  });

  it("keeps files an interrupted install already verified", async () => {
    storage.files.set("base.dat.gz", { ...DICTIONARY_FILES["base.dat.gz"] });
    await dictionary.install();
    expect(storage.downloads.some((url) => url.endsWith("base.dat.gz"))).toBe(false);
    expect(storage.downloads).toHaveLength(DICTIONARY_FILE_NAMES.length - 1);
  });

  it("restores an install from disk, and not a partial one", async () => {
    await dictionary.install();
    const later = new JapaneseDictionary({
      storage,
      store: createStore<JapaneseDictionarySnapshot>(JAPANESE_DICTIONARY_INITIAL),
      buildTokenizer: build,
    });
    await later.restore();
    expect(later.snapshot.install).toBe("installed");

    storage.files.delete("tid.dat.gz");
    const partial = new JapaneseDictionary({
      storage,
      store: createStore<JapaneseDictionarySnapshot>(JAPANESE_DICTIONARY_INITIAL),
      buildTokenizer: build,
    });
    await partial.restore();
    expect(partial.snapshot.install).toBe("none");
  });

  it("builds the reader once, only when installed", async () => {
    await dictionary.loadReader();
    expect(build).not.toHaveBeenCalled();
    await dictionary.install();
    await Promise.all([dictionary.loadReader(), dictionary.loadReader()]);
    expect(build).toHaveBeenCalledTimes(1);
    expect(store.getSnapshot().reader).toBe("ready");
    expect(dictionary.currentReader).not.toBeNull();
  });

  it("reports a failed build", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    build.mockRejectedValueOnce(new Error("out of memory"));
    await dictionary.install();
    await dictionary.loadReader();
    expect(store.getSnapshot().reader).toBe("error");
    expect(dictionary.currentReader).toBeNull();
    warn.mockRestore();
  });

  it("removes the files and the reader", async () => {
    await dictionary.install();
    await dictionary.loadReader();
    await dictionary.remove();
    expect(store.getSnapshot()).toEqual(JAPANESE_DICTIONARY_INITIAL);
    expect(dictionary.currentReader).toBeNull();
    expect(storage.removeAll).toHaveBeenCalled();
  });
});
