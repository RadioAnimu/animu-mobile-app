import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import { createStore } from "@/core/external-store";
import {
  DICTIONARY_BYTES,
  DICTIONARY_FILE_NAMES,
  DICTIONARY_FILES,
  DICTIONARY_MIRRORS,
  DICTIONARY_STORED_BYTES,
  DICTIONARY_VERSION,
  type DictionaryFileName,
} from "@/core/japanese/dictionary";
import {
  JAPANESE_DICTIONARY_INITIAL,
  JapaneseDictionary,
  type DictionaryStorage,
  type JapaneseDictionarySnapshot,
} from "@/core/japanese/dictionary-manager";
import type { JapaneseTokenizer, LoadFile } from "@/core/japanese/tokenizer";

type Download = { bytes: number; md5: string };

/** Files on a fake disk: a download stores what the mirror serves. */
class FakeStorage implements DictionaryStorage {
  downloads = new Map<string, Download>();
  stored = new Map<string, number>();
  version: string | null = null;
  urls: string[] = [];
  /** What each URL serves (default: the published file). */
  serve = (url: string, name: DictionaryFileName): Download => {
    void url;
    return { bytes: DICTIONARY_FILES[name].bytes, md5: DICTIONARY_FILES[name].md5 };
  };

  statDownload = vi.fn(async (name: DictionaryFileName) => this.downloads.get(name) ?? null);
  download = vi.fn(async (url: string, name: DictionaryFileName, onBytes: (written: number) => void) => {
    this.urls.push(url);
    const served = this.serve(url, name);
    onBytes(served.bytes);
    this.downloads.set(name, served);
  });
  readDownload = vi.fn(async (name: DictionaryFileName) => new Uint8Array(this.downloads.get(name)?.bytes ?? 0));
  removeDownload = vi.fn(async (name: DictionaryFileName) => {
    this.downloads.delete(name);
  });
  statStored = vi.fn(async (name: DictionaryFileName) => this.stored.get(name) ?? null);
  writeStored = vi.fn(async (name: DictionaryFileName, bytes: Uint8Array) => {
    this.stored.set(name, bytes.length);
  });
  readStored = vi.fn(async (name: DictionaryFileName) => new Uint8Array(this.stored.get(name) ?? 0));
  readVersion = vi.fn(async () => this.version);
  writeVersion = vi.fn(async (version: string) => {
    this.version = version;
  });
  removeAll = vi.fn(async () => {
    this.downloads.clear();
    this.stored.clear();
    this.version = null;
  });
}

/** Unpacks a fake `.gz` to its published stored length. */
const fakeUnpack = vi.fn(async (gz: Uint8Array, unpacked: number, onProgress?: (done: number) => void) => {
  onProgress?.(gz.length);
  const name = DICTIONARY_FILE_NAMES.find((file) => DICTIONARY_FILES[file].unpacked === unpacked && DICTIONARY_FILES[file].bytes === gz.length);
  return new Uint8Array(name ? DICTIONARY_FILES[name].stored : 0);
});

const tokenizer: JapaneseTokenizer = { tokenize: () => [] };

describe("JapaneseDictionary", () => {
  let storage: FakeStorage;
  let store: ReturnType<typeof createStore<JapaneseDictionarySnapshot>>;
  let build: Mock<(load: LoadFile) => Promise<JapaneseTokenizer>>;
  let dictionary: JapaneseDictionary;

  const create = () =>
    new JapaneseDictionary({
      storage,
      store: createStore<JapaneseDictionarySnapshot>(JAPANESE_DICTIONARY_INITIAL),
      buildTokenizer: build,
      unpack: fakeUnpack,
    });

  beforeEach(() => {
    storage = new FakeStorage();
    store = createStore<JapaneseDictionarySnapshot>(JAPANESE_DICTIONARY_INITIAL);
    build = vi.fn(async (_load: LoadFile) => tokenizer);
    dictionary = new JapaneseDictionary({ storage, store, buildTokenizer: build, unpack: fakeUnpack });
  });

  it("downloads, verifies and unpacks every file, keeping only the unpacked ones", async () => {
    const progress: number[] = [];
    store.subscribe(() => progress.push(store.getSnapshot().progress));
    await dictionary.install();
    expect(store.getSnapshot()).toMatchObject({ install: "installed", progress: 1 });
    expect(storage.stored.size).toBe(DICTIONARY_FILE_NAMES.length);
    expect(storage.downloads.size).toBe(0);
    expect(storage.version).toBe(DICTIONARY_VERSION);
    expect(progress).toEqual([...progress].sort((a, b) => a - b));
    expect(DICTIONARY_BYTES).toBe(17_791_956);
    expect(DICTIONARY_STORED_BYTES).toBe(64_554_959);
  });

  it("falls back to the next mirror when a file fails its checksum", async () => {
    storage.serve = (url, name) =>
      url.startsWith(DICTIONARY_MIRRORS[0]) && name === "cc.dat.gz"
        ? { bytes: DICTIONARY_FILES[name].bytes, md5: "tampered" }
        : { bytes: DICTIONARY_FILES[name].bytes, md5: DICTIONARY_FILES[name].md5 };
    await dictionary.install();
    expect(store.getSnapshot().install).toBe("installed");
    expect(storage.urls).toContain(`${DICTIONARY_MIRRORS[1]}cc.dat.gz`);
  });

  it("fails (retryable) when no mirror serves the published file", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    storage.serve = () => ({ bytes: 1, md5: "bad" });
    await dictionary.install();
    expect(store.getSnapshot().install).toBe("error");
    expect(storage.version).toBeNull();
    expect(storage.downloads.size).toBe(0);
    warn.mockRestore();
  });

  it("fails when a file unpacks to unexpected content", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    fakeUnpack.mockResolvedValueOnce(new Uint8Array(3));
    await dictionary.install();
    expect(store.getSnapshot().install).toBe("error");
    expect(storage.stored.size).toBe(0);
    warn.mockRestore();
  });

  it("keeps files an interrupted install already unpacked or downloaded", async () => {
    storage.stored.set("base.dat.gz", DICTIONARY_FILES["base.dat.gz"].stored);
    storage.downloads.set("check.dat.gz", { bytes: DICTIONARY_FILES["check.dat.gz"].bytes, md5: DICTIONARY_FILES["check.dat.gz"].md5 });
    await dictionary.install();
    expect(storage.urls.some((url) => url.endsWith("base.dat.gz") || url.endsWith("check.dat.gz"))).toBe(false);
    expect(storage.urls).toHaveLength(DICTIONARY_FILE_NAMES.length - 2);
  });

  it("restores an install from disk, but not a partial or older one", async () => {
    await dictionary.install();
    const later = create();
    await later.restore();
    expect(later.snapshot.install).toBe("installed");

    storage.stored.delete("tid.dat.gz");
    const partial = create();
    await partial.restore();
    expect(partial.snapshot.install).toBe("none");

    await dictionary.install();
    storage.version = "kuromoji-0.1.2-ipadic";
    const older = create();
    await older.restore();
    expect(older.snapshot.install).toBe("none");
  });

  it("builds the reader once from the padded files, only when installed", async () => {
    await dictionary.loadReader();
    expect(build).not.toHaveBeenCalled();
    await dictionary.install();
    await Promise.all([dictionary.loadReader(), dictionary.loadReader()]);
    expect(build).toHaveBeenCalledTimes(1);
    expect(store.getSnapshot().reader).toBe("ready");
    const load = build.mock.calls[0][0];
    expect((await load("tid_pos.dat.gz")).length).toBe(DICTIONARY_FILES["tid_pos.dat.gz"].unpacked);
  });

  it("lets the reader go when lyrics close, dropping a build still running", async () => {
    await dictionary.install();
    await dictionary.loadReader();
    dictionary.unloadReader();
    expect(dictionary.currentReader).toBeNull();
    expect(store.getSnapshot().reader).toBe("idle");

    let finish!: () => void;
    build.mockImplementationOnce(() => new Promise((resolve) => (finish = () => resolve(tokenizer))));
    const loading = dictionary.loadReader();
    dictionary.unloadReader();
    finish();
    await loading;
    expect(dictionary.currentReader).toBeNull();
  });

  it("reports a failed build", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    build.mockRejectedValueOnce(new Error("out of memory"));
    await dictionary.install();
    await dictionary.loadReader();
    expect(store.getSnapshot().reader).toBe("error");
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
