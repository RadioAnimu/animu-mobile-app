import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  DICT_FILES,
  JapaneseDictionaryManager,
  kuromojiTransliterator,
  type DictionaryFileSystem,
  type MinimalTokenizer,
} from "../dictionary-manager";
import {
  getJapaneseEngine,
  getJapaneseEngineVersion,
  setJapaneseEngine,
} from "../engine";
import { JAPANESE_DICT_INITIAL, japaneseDictStore } from "../dictionary-store";

const makeFs = (options: { failOnPrimary?: boolean } = {}): {
  fs: DictionaryFileSystem;
  downloaded: string[];
} => {
  const downloaded: string[] = [];
  return {
    downloaded,
    fs: {
      makeDir: vi.fn(async () => {}),
      removeDir: vi.fn(async () => {}),
      fileExists: vi.fn(async () => true),
      downloadFile: vi.fn(async (url: string) => {
        if (options.failOnPrimary && url.includes("primary")) {
          throw new Error("503");
        }
        downloaded.push(url);
      }),
      readFileBytes: vi.fn(async () => new Uint8Array([1, 2, 3])),
      writeFileText: vi.fn(async () => {}),
      readFileText: vi.fn(async (_dir: string, name: string) =>
        name === "manifest.json"
          ? JSON.stringify({
              version: "test-dict",
              files: {},
            })
          : null,
      ),
    },
  };
};

const makeTokenizer = (): MinimalTokenizer => ({
  tokenize: (text: string) =>
    text.split("").map((char) => ({ surface_form: char, reading: "ア" })),
});

const makeManager = (
  fs: DictionaryFileSystem,
  buildTokenizer = vi.fn(async () => makeTokenizer()),
) =>
  new JapaneseDictionaryManager({
    fs,
    cdnUrls: ["https://primary/", "https://fallback/"],
    dictVersion: "test-dict",
    dictDir: "dict",
    buildTokenizer: buildTokenizer as never,
    onEngine: setJapaneseEngine,
  });

const snapshot = () => japaneseDictStore.getSnapshot();

beforeEach(() => {
  japaneseDictStore.setSnapshot(JAPANESE_DICT_INITIAL);
});

afterEach(() => {
  setJapaneseEngine(null);
});

describe("JapaneseDictionaryManager.download", () => {
  it("downloads every file and writes the manifest, then reports ready", async () => {
    const { fs, downloaded } = makeFs();
    const manager = makeManager(fs);

    await manager.download();

    expect(downloaded).toHaveLength(DICT_FILES.length);
    expect(snapshot().download).toBe("ready");
    expect(snapshot().progress).toBe(1);
    expect(fs.writeFileText).toHaveBeenCalledWith(
      "dict",
      "manifest.json",
      expect.stringContaining("test-dict"),
    );
  });

  it("falls back to the secondary CDN per file and still succeeds", async () => {
    const { fs, downloaded } = makeFs({ failOnPrimary: true });
    const manager = makeManager(fs);

    await manager.download();

    expect(snapshot().download).toBe("ready");
    expect(downloaded.every((url) => url.includes("fallback"))).toBe(true);
  });

  it("reports error (and stops) when every CDN fails", async () => {
    const failingFs: DictionaryFileSystem = {
      ...makeFs().fs,
      downloadFile: vi.fn(async () => {
        throw new Error("offline");
      }),
    };
    const manager = makeManager(failingFs);

    await manager.download();

    expect(snapshot().download).toBe("error");
  });

  it("shares one run between concurrent download calls", async () => {
    const { fs } = makeFs();
    const manager = makeManager(fs);

    await Promise.all([manager.download(), manager.download()]);

    expect(fs.downloadFile).toHaveBeenCalledTimes(DICT_FILES.length);
  });
});

describe("JapaneseDictionaryManager.ensureTokenizer", () => {
  it("installs the engine when the dictionary is ready", async () => {
    const { fs } = makeFs();
    const manager = makeManager(fs);
    await manager.download();

    await manager.ensureTokenizer();

    expect(snapshot().tokenizer).toBe("ready");
    expect(getJapaneseEngine()).not.toBeNull();
  });

  it("does nothing while the dictionary is missing", async () => {
    const buildTokenizer = vi.fn(async () => makeTokenizer());
    const { fs } = makeFs();
    const manager = makeManager(fs, buildTokenizer);

    await manager.ensureTokenizer();

    expect(buildTokenizer).not.toHaveBeenCalled();
    expect(snapshot().tokenizer).toBe("idle");
  });

  it("reports a tokenizer error when the build fails", async () => {
    const buildTokenizer = vi.fn(async () => {
      throw new Error("corrupt dict");
    });
    const { fs } = makeFs();
    const manager = makeManager(fs, buildTokenizer);
    await manager.download();

    await manager.ensureTokenizer();

    expect(snapshot().tokenizer).toBe("error");
    expect(getJapaneseEngine()).toBeNull();
  });
});

describe("JapaneseDictionaryManager.remove / restore", () => {
  it("removes the engine and the files", async () => {
    const { fs } = makeFs();
    const manager = makeManager(fs);
    await manager.download();
    await manager.ensureTokenizer();

    await manager.remove();

    expect(snapshot().download).toBe("none");
    expect(snapshot().tokenizer).toBe("idle");
    expect(getJapaneseEngine()).toBeNull();
    expect(fs.removeDir).toHaveBeenCalled();
  });

  it("restore marks a valid on-disk install as ready", async () => {
    const { fs } = makeFs();
    const manager = makeManager(fs);

    await manager.restore();

    expect(snapshot().download).toBe("ready");
  });
});

describe("kuromojiTransliterator", () => {
  it("folds katakana readings to hiragana and falls back to the surface", () => {
    const tokenizer: MinimalTokenizer = {
      tokenize: (text: string) =>
        text.split("").map((char, index) =>
          index % 2 === 0
            ? { surface_form: char, reading: "ニホン" }
            : { surface_form: char },
        ),
    };
    const engine = kuromojiTransliterator(tokenizer);

    expect(engine.toHiragana("ab")).toBe("にほんb");
  });

  it("falls back to the raw text when tokenization throws", () => {
    const engine = kuromojiTransliterator({
      tokenize: () => {
        throw new Error("boom");
      },
    });
    expect(engine.toHiragana("無敵")).toBe("無敵");
  });
});

describe("engine registry", () => {
  it("bumps the version on every install/removal", () => {
    const before = getJapaneseEngineVersion();
    const engine = kuromojiTransliterator(makeTokenizer());

    setJapaneseEngine(engine);
    const afterInstall = getJapaneseEngineVersion();
    setJapaneseEngine(null);

    expect(afterInstall).toBeGreaterThan(before);
    expect(getJapaneseEngine()).toBeNull();
  });
});
