import { describe, expect, it, vi } from "vitest";
import { DictionaryFileStorage } from "@/core/japanese/file-storage";

const downloads = vi.hoisted(() => ({ progress: [] as unknown[] }));

vi.mock("expo-file-system", () => {
  class File {
    exists = false;
    delete(): void {}
    static createDownloadTask(
      _url: string,
      _target: File,
      options: { onProgress: (event: { bytesWritten: unknown }) => void },
    ) {
      return {
        downloadAsync: async () => {
          for (const bytesWritten of downloads.progress) options.onProgress({ bytesWritten });
          return { uri: "file:///downloaded" };
        },
        release: () => {},
      };
    }
  }
  class Directory {
    exists = true;
    create(): void {}
  }
  return { File, Directory, Paths: { document: "file:///documents", availableDiskSpace: 0 } };
});

describe("DictionaryFileStorage.download", () => {
  it("reports native 64-bit progress (a BigInt) as a number", async () => {
    downloads.progress = [BigInt(1024), BigInt(4096)];
    const onBytes = vi.fn<(written: number) => void>();

    await new DictionaryFileStorage().download(
      "https://example.test/base.dat.gz",
      "base.dat.gz",
      onBytes,
      new AbortController().signal,
    );

    expect(onBytes.mock.calls).toEqual([[1024], [4096]]);
    expect(onBytes.mock.calls.every(([written]) => typeof written === "number")).toBe(true);
  });
});
