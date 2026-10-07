import { Directory, File, Paths } from "expo-file-system";
import type { DictionaryStorage } from "@/core/japanese/dictionary-manager";
import type { DictionaryFileName } from "@/core/japanese/dictionary";

const VERSION_FILE = "version.txt";

/**
 * The dictionary lives in the documents directory (not the cache): the OS
 * must not purge a 17.8 MB download the user asked for.
 */
export class DictionaryFileStorage implements DictionaryStorage {
  private readonly dir = new Directory(Paths.document, "japanese-dictionary");

  private file(name: string): File {
    return new File(this.dir, name);
  }

  private ensureDir(): void {
    if (!this.dir.exists) this.dir.create({ idempotent: true, intermediates: true });
  }

  async stat(name: DictionaryFileName, withMd5: boolean) {
    const file = this.file(name);
    if (!file.exists) return null;
    return { bytes: file.size, md5: withMd5 ? file.md5 : null };
  }

  async download(url: string, name: DictionaryFileName, onBytes: (written: number) => void): Promise<void> {
    this.ensureDir();
    const target = this.file(name);
    if (target.exists) target.delete();
    const task = File.createDownloadTask(url, target, {
      onProgress: ({ bytesWritten }: { bytesWritten: number }) => onBytes(bytesWritten),
    });
    await task.downloadAsync();
  }

  async remove(name: DictionaryFileName): Promise<void> {
    const file = this.file(name);
    if (file.exists) file.delete();
  }

  async read(name: DictionaryFileName): Promise<Uint8Array> {
    return this.file(name).bytes();
  }

  async readVersion(): Promise<string | null> {
    const file = this.file(VERSION_FILE);
    return file.exists ? (await file.text()).trim() : null;
  }

  async writeVersion(version: string): Promise<void> {
    this.ensureDir();
    this.file(VERSION_FILE).write(version);
  }

  async removeAll(): Promise<void> {
    if (this.dir.exists) this.dir.delete();
  }

  /** Bytes on disk (Storage screen). */
  size(): number {
    return this.dir.exists ? (this.dir.size ?? 0) : 0;
  }
}
