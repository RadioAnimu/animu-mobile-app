/**
 * Web stand-in for the app's files: one Cache Storage bucket per namespace,
 * an entry per file name. Cache Storage keeps binary data as is, persists
 * across sessions (the browser may evict it under storage pressure, as an OS
 * may purge a cache directory) and reports each entry's size.
 */

/** Synthetic URL an entry is keyed by; never fetched. */
const keyOf = (name: string) => `https://animu.local/${encodeURIComponent(name)}`;
const nameOf = (url: string) => decodeURIComponent(url.slice(url.lastIndexOf("/") + 1));

/** Header carrying the moment an entry was written (Cache Storage has no mtime). */
const SAVED_AT = "x-animu-saved-at";

export interface WebStoreEntry {
  name: string;
  bytes: number;
  savedAt: number;
}

export class WebStore {
  constructor(private readonly namespace: string) {}

  private open(): Promise<Cache> {
    return caches.open(`animu:${this.namespace}`);
  }

  async write(name: string, body: Uint8Array | string): Promise<void> {
    const cache = await this.open();
    // A Blob keeps the bytes binary; its size becomes the entry's length.
    const blob = new Blob([body as BlobPart]);
    await cache.put(
      keyOf(name),
      new Response(blob, {
        headers: { "content-length": String(blob.size), [SAVED_AT]: String(Date.now()) },
      }),
    );
  }

  private async response(name: string): Promise<Response | null> {
    const cache = await this.open();
    return (await cache.match(keyOf(name))) ?? null;
  }

  async bytes(name: string): Promise<Uint8Array | null> {
    const response = await this.response(name);
    return response ? new Uint8Array(await response.arrayBuffer()) : null;
  }

  async text(name: string): Promise<string | null> {
    const response = await this.response(name);
    return response ? response.text() : null;
  }

  async size(name: string): Promise<number | null> {
    const response = await this.response(name);
    return response ? Number(response.headers.get("content-length") ?? 0) : null;
  }

  async remove(name: string): Promise<void> {
    const cache = await this.open();
    await cache.delete(keyOf(name));
  }

  async list(): Promise<WebStoreEntry[]> {
    const cache = await this.open();
    const requests = await cache.keys();
    return Promise.all(
      requests.map(async (request) => {
        const response = await cache.match(request);
        return {
          name: nameOf(request.url),
          bytes: Number(response?.headers.get("content-length") ?? 0),
          savedAt: Number(response?.headers.get(SAVED_AT) ?? 0),
        };
      }),
    );
  }

  async clear(): Promise<void> {
    await caches.delete(`animu:${this.namespace}`);
  }
}
