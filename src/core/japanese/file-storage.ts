import { Directory, File, Paths } from "expo-file-system";
import type { DictionaryStorage } from "@/core/japanese/dictionary-manager";
import type { DictionaryFileName } from "@/core/japanese/dictionary";

const VERSION_FILE = "version.txt";
/** `base.dat.gz` downloaded → `base.dat` stored, unpacked. */
const storedName = (name: DictionaryFileName) => name.replace(/\.gz$/, "");
/** Typed as a number, but iOS answers `null` when it cannot stat the volume. */
const availableDiskSpace = (): number | null => Paths.availableDiskSpace;

/**
 * The dictionary lives in the documents directory (not the cache): the OS
 * must not purge a download the user asked for. Downloads are removed once
 * unpacked.
 */
export class DictionaryFileStorage implements DictionaryStorage {
  private readonly dir = new Directory(Paths.document, "japanese-dictionary");

  private file(name: string): File {
    return new File(this.dir, name);
  }

  private ensureDir(): void {
    if (!this.dir.exists) this.dir.create({ idempotent: true, intermediates: true });
  }

  async statDownload(name: DictionaryFileName) {
    const file = this.file(name);
    if (!file.exists) return null;
    // An unreadable file has no hash (a mismatch), as with the old `md5` getter.
    return { bytes: file.size, md5: await file.digest("MD5").catch(() => null) };
  }

  async download(
    url: string,
    name: DictionaryFileName,
    onBytes: (written: number) => void,
    signal: AbortSignal,
  ): Promise<void> {
    this.ensureDir();
    const target = this.file(name);
    if (target.exists) target.delete();
    const task = File.createDownloadTask(url, target, {
      onProgress: ({ bytesWritten }: { bytesWritten: number }) => onBytes(bytesWritten),
      signal,
    });
    try {
      // `null` is a paused task: nothing here pauses, so it did not finish.
      if (!(await task.downloadAsync())) throw new Error(`${name}: download did not finish`);
    } finally {
      task.release();
    }
  }

  async readDownload(name: DictionaryFileName): Promise<Uint8Array> {
    return this.file(name).bytes();
  }

  async removeDownload(name: DictionaryFileName): Promise<void> {
    const file = this.file(name);
    if (file.exists) file.delete();
  }

  async statStored(name: DictionaryFileName): Promise<number | null> {
    const file = this.file(storedName(name));
    return file.exists ? file.size : null;
  }

  async writeStored(name: DictionaryFileName, bytes: Uint8Array): Promise<void> {
    this.ensureDir();
    const file = this.file(storedName(name));
    if (file.exists) file.delete();
    await file.write(bytes);
  }

  async readStored(name: DictionaryFileName): Promise<Uint8Array> {
    return this.file(storedName(name)).bytes();
  }

  async readVersion(): Promise<string | null> {
    const file = this.file(VERSION_FILE);
    return file.exists ? (await file.text()).trim() : null;
  }

  async writeVersion(version: string): Promise<void> {
    this.ensureDir();
    await this.file(VERSION_FILE).write(version);
  }

  async removeAll(): Promise<void> {
    if (this.dir.exists) this.dir.delete();
  }

  freeBytes(): number {
    try {
      return availableDiskSpace() ?? 0;
    } catch {
      // Unknown: let the install try (a full disk then fails the write).
      return Number.POSITIVE_INFINITY;
    }
  }
}
