import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from "vitest";
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
  INSTALL_FREE_BYTES,
  JAPANESE_DICTIONARY_INITIAL,
  JapaneseDictionary,
  RETRY_DELAYS_MS,
  STALL_MS,
  type DictionaryStorage,
  type JapaneseDictionarySnapshot,
} from "@/core/japanese/dictionary-manager";
import type { JapaneseTokenizer, LoadFile } from "@/core/japanese/tokenizer";

type Download = { bytes: number; md5: string };
/** What a transfer does: serve bytes, fail like a dropped connection, or hang (no bytes). */
type Behavior = Download | "drop" | "hang";

const published = (name: DictionaryFileName): Download => ({
  bytes: DICTIONARY_FILES[name].bytes,
  md5: DICTIONARY_FILES[name].md5,
});

/** Files on a fake disk; each transfer does what `behave` says. */
class FakeStorage implements DictionaryStorage {
  downloads = new Map<string, Download>();
  stored = new Map<string, number>();
  version: string | null = null;
  free = Number.POSITIVE_INFINITY;
  urls: string[] = [];
  behave: (url: string, name: DictionaryFileName, attempt: number) => Behavior = (_url, name) => published(name);

  statDownload = vi.fn(async (name: DictionaryFileName) => this.downloads.get(name) ?? null);
  download = vi.fn(
    (url: string, name: DictionaryFileName, onBytes: (written: number) => void, signal: AbortSignal) => {
      this.urls.push(url);
      const behavior = this.behave(url, name, this.urls.filter((seen) => seen.endsWith(name)).length);
      if (behavior === "drop") return Promise.reject(new Error("connection reset"));
      if (behavior === "hang") {
        // A partial file is on disk while it hangs.
        this.downloads.set(name, { bytes: 10, md5: "partial" });
        return new Promise<void>((_resolve, reject) => {
          signal.addEventListener("abort", () => reject(new Error("AbortError")), { once: true });
        });
      }
      onBytes(behavior.bytes);
      this.downloads.set(name, behavior);
      return Promise.resolve();
    },
  );
  readDownload = vi.fn(async (name: DictionaryFileName) => new Uint8Array(this.downloads.get(name)?.bytes ?? 0));
  removeDownload = vi.fn(async (name: DictionaryFileName) => {
    this.downloads.delete(name);
  });
  writeStored = vi.fn(async (name: DictionaryFileName, bytes: Uint8Array) => {
    this.stored.set(name, bytes.length);
  });
  statStored = vi.fn(async (name: DictionaryFileName) => this.stored.get(name) ?? null);
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
  freeBytes = () => this.free;

  get empty(): boolean {
    return this.downloads.size === 0 && this.stored.size === 0 && this.version === null;
  }
}

/** Unpacks a fake `.gz` to its published stored length. */
const fakeUnpack = vi.fn(async (gz: Uint8Array, unpacked: number, onProgress?: (done: number) => void) => {
  onProgress?.(gz.length);
  const name = DICTIONARY_FILE_NAMES.find(
    (file) => DICTIONARY_FILES[file].unpacked === unpacked && DICTIONARY_FILES[file].bytes === gz.length,
  );
  return new Uint8Array(name ? DICTIONARY_FILES[name].stored : 0);
});

const tokenizer: JapaneseTokenizer = { tokenize: () => [] };

describe("JapaneseDictionary", () => {
  let storage: FakeStorage;
  let store: ReturnType<typeof createStore<JapaneseDictionarySnapshot>>;
  let build: Mock<(load: LoadFile) => Promise<JapaneseTokenizer>>;
  let waits: number[];
  let dictionary: JapaneseDictionary;

  const create = (onStore = createStore<JapaneseDictionarySnapshot>(JAPANESE_DICTIONARY_INITIAL)) =>
    new JapaneseDictionary({
      storage,
      store: onStore,
      buildTokenizer: build,
      unpack: fakeUnpack,
      wait: async (ms) => {
        waits.push(ms);
      },
    });

  beforeEach(() => {
    storage = new FakeStorage();
    store = createStore<JapaneseDictionarySnapshot>(JAPANESE_DICTIONARY_INITIAL);
    build = vi.fn(async (_load: LoadFile) => tokenizer);
    waits = [];
    dictionary = create(store);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  const quiet = () => vi.spyOn(console, "warn").mockImplementation(() => {});

  describe("install", () => {
    it("downloads, verifies and unpacks every file, keeping only the unpacked ones", async () => {
      const progress: number[] = [];
      store.subscribe(() => progress.push(store.getSnapshot().progress));
      await dictionary.install();
      expect(store.getSnapshot()).toMatchObject({ install: "installed", progress: 1, failure: null });
      expect(storage.stored.size).toBe(DICTIONARY_FILE_NAMES.length);
      expect(storage.downloads.size).toBe(0);
      expect(storage.version).toBe(DICTIONARY_VERSION);
      expect(progress).toEqual([...progress].sort((a, b) => a - b));
      expect(DICTIONARY_BYTES).toBe(17_791_956);
      expect(DICTIONARY_STORED_BYTES).toBe(64_554_959);
    });

    it("rides out a dropped connection or a network switch", async () => {
      // Every mirror drops twice for one file (Wi-Fi gone, then mobile data).
      storage.behave = (_url, name, attempt) => (name === "tid_pos.dat.gz" && attempt <= 4 ? "drop" : published(name));
      await dictionary.install();
      expect(store.getSnapshot().install).toBe("installed");
      expect(waits).toEqual([RETRY_DELAYS_MS[0], RETRY_DELAYS_MS[1]]);
    });

    it("starts a stalled transfer over", async () => {
      vi.useFakeTimers();
      storage.behave = (_url, name, attempt) => (name === "base.dat.gz" && attempt === 1 ? "hang" : published(name));
      const done = dictionary.install();
      await vi.advanceTimersByTimeAsync(STALL_MS + 2_000);
      await done;
      expect(store.getSnapshot().install).toBe("installed");
      expect(storage.urls.filter((url) => url.endsWith("base.dat.gz"))).toEqual([
        `${DICTIONARY_MIRRORS[0]}base.dat.gz`,
        `${DICTIONARY_MIRRORS[1]}base.dat.gz`,
      ]);
    });

    it("drops a mirror serving other bytes for good", async () => {
      storage.behave = (url, name) =>
        url.startsWith(DICTIONARY_MIRRORS[0]) && name === "cc.dat.gz"
          ? { bytes: DICTIONARY_FILES[name].bytes, md5: "tampered" }
          : published(name);
      await dictionary.install();
      expect(store.getSnapshot().install).toBe("installed");
      expect(storage.urls).toContain(`${DICTIONARY_MIRRORS[1]}cc.dat.gz`);
    });

    it("gives up after the retries and leaves no file behind", async () => {
      quiet();
      storage.behave = (_url, name) => (name === "tid.dat.gz" ? "drop" : published(name));
      await dictionary.install();
      expect(store.getSnapshot()).toMatchObject({ install: "error", failure: "network", progress: 0 });
      expect(waits).toEqual([...RETRY_DELAYS_MS]);
      expect(storage.empty).toBe(true);
    });

    it("fails fast when no mirror serves the published file", async () => {
      quiet();
      storage.behave = () => ({ bytes: 1, md5: "bad" });
      await dictionary.install();
      expect(store.getSnapshot()).toMatchObject({ install: "error", failure: "network" });
      expect(waits).toEqual([]);
      expect(storage.empty).toBe(true);
    });

    it("fails when a file unpacks to unexpected content, leaving nothing", async () => {
      quiet();
      fakeUnpack.mockResolvedValueOnce(new Uint8Array(3));
      await dictionary.install();
      expect(store.getSnapshot().install).toBe("error");
      expect(storage.empty).toBe(true);
    });

    it("refuses to start without room for it", async () => {
      quiet();
      storage.free = INSTALL_FREE_BYTES - 1;
      await dictionary.install();
      expect(store.getSnapshot()).toMatchObject({ install: "error", failure: "space" });
      expect(storage.urls).toEqual([]);
    });

    it("cancels mid-transfer, deleting what it wrote", async () => {
      storage.behave = (_url, name) => (name === "tid.dat.gz" ? "hang" : published(name));
      const done = dictionary.install();
      await vi.waitFor(() => expect(storage.downloads.has("tid.dat.gz")).toBe(true));
      await dictionary.cancel();
      await done;
      expect(store.getSnapshot()).toMatchObject({ install: "none", progress: 0 });
      expect(storage.empty).toBe(true);
    });
  });

  describe("restore", () => {
    it("adopts a complete install", async () => {
      await dictionary.install();
      const later = create();
      await later.restore();
      expect(later.snapshot.install).toBe("installed");
    });

    it("deletes an install the app was killed in, or an older layout", async () => {
      await dictionary.install();
      storage.stored.delete("tid.dat.gz");
      await create().restore();
      expect(storage.empty).toBe(true);

      await create().install();
      storage.version = "kuromoji-0.1.2-ipadic";
      const older = create();
      await older.restore();
      expect(older.snapshot.install).toBe("none");
      expect(storage.empty).toBe(true);
    });
  });

  describe("reader", () => {
    it("builds once from the stored files, only when installed", async () => {
      await dictionary.loadReader();
      expect(build).not.toHaveBeenCalled();
      await dictionary.install();
      await Promise.all([dictionary.loadReader(), dictionary.loadReader()]);
      expect(build).toHaveBeenCalledTimes(1);
      expect(store.getSnapshot().reader).toBe("ready");
      const load = build.mock.calls[0][0];
      expect((await load("tid_pos.dat.gz")).length).toBe(DICTIONARY_FILES["tid_pos.dat.gz"].stored);
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
      quiet();
      build.mockRejectedValueOnce(new Error("out of memory"));
      await dictionary.install();
      await dictionary.loadReader();
      expect(store.getSnapshot().reader).toBe("error");
    });
  });

  it("removes the files and the reader", async () => {
    await dictionary.install();
    await dictionary.loadReader();
    await dictionary.remove();
    expect(store.getSnapshot()).toEqual(JAPANESE_DICTIONARY_INITIAL);
    expect(dictionary.currentReader).toBeNull();
    expect(storage.empty).toBe(true);
  });
});
