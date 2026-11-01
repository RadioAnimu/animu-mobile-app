import type { DictionaryStorage } from "@/core/japanese/dictionary-manager";
import type { DictionaryFileName } from "@/core/japanese/dictionary";
import { freeQuotaBytes, refreshDiskCapacity } from "@/core/services/device-storage.service.web";
import { md5 } from "@/utils/md5";
import { WebStore } from "@/utils/web-store";

const VERSION_FILE = "version.txt";
/** `base.dat.gz` downloaded → `base.dat` stored, unpacked. */
const storedName = (name: DictionaryFileName) => name.replace(/\.gz$/, "");

/**
 * Web build: the dictionary lives in Cache Storage (see {@link WebStore}),
 * downloaded with fetch — both mirrors allow any origin. The MD5 the
 * install verifies is computed here, as browsers have no native MD5.
 */
export class DictionaryFileStorage implements DictionaryStorage {
  private readonly store = new WebStore("japanese-dictionary");

  async statDownload(name: DictionaryFileName) {
    const bytes = await this.store.bytes(name);
    return bytes ? { bytes: bytes.length, md5: md5(bytes) } : null;
  }

  async download(
    url: string,
    name: DictionaryFileName,
    onBytes: (written: number) => void,
    signal: AbortSignal,
  ): Promise<void> {
    await this.store.remove(name);
    const response = await fetch(url, { signal });
    if (!response.ok || !response.body) throw new Error(`${name}: HTTP ${response.status}`);
    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let written = 0;
    for (;;) {
      // react-doctor-disable-next-line async-await-in-loop -- a stream is read chunk by chunk.
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      written += value.length;
      onBytes(written);
    }
    const bytes = new Uint8Array(written);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.length;
    }
    await this.store.write(name, bytes);
  }

  async readDownload(name: DictionaryFileName): Promise<Uint8Array> {
    const bytes = await this.store.bytes(name);
    if (!bytes) throw new Error(`${name}: not downloaded`);
    return bytes;
  }

  async removeDownload(name: DictionaryFileName): Promise<void> {
    await this.store.remove(name);
  }

  async statStored(name: DictionaryFileName): Promise<number | null> {
    return this.store.size(storedName(name));
  }

  async writeStored(name: DictionaryFileName, bytes: Uint8Array): Promise<void> {
    await this.store.write(storedName(name), bytes);
    void refreshDiskCapacity();
  }

  async readStored(name: DictionaryFileName): Promise<Uint8Array> {
    const bytes = await this.store.bytes(storedName(name));
    if (!bytes) throw new Error(`${name}: not installed`);
    return bytes;
  }

  async readVersion(): Promise<string | null> {
    return (await this.store.text(VERSION_FILE))?.trim() ?? null;
  }

  async writeVersion(version: string): Promise<void> {
    await this.store.write(VERSION_FILE, version);
  }

  async removeAll(): Promise<void> {
    await this.store.clear();
    void refreshDiskCapacity();
  }

  freeBytes(): number {
    return freeQuotaBytes();
  }
}
