/** In-memory `CacheStorage` (the slice the web store uses), installed on `globalThis.caches`. */
class FakeCache {
  private readonly entries = new Map<string, Response>();

  async put(url: string, response: Response): Promise<void> {
    // Keep the bytes, so a match can be read more than once.
    const body = await response.arrayBuffer();
    this.entries.set(url, new Response(body, { headers: response.headers }));
  }

  async match(request: string | Request): Promise<Response | undefined> {
    const stored = this.entries.get(typeof request === "string" ? request : request.url);
    return stored?.clone();
  }

  async delete(url: string): Promise<boolean> {
    return this.entries.delete(url);
  }

  async keys(): Promise<Request[]> {
    return [...this.entries.keys()].map((url) => new Request(url));
  }
}

export function installFakeCacheStorage(): Map<string, FakeCache> {
  const buckets = new Map<string, FakeCache>();
  Object.assign(globalThis, {
    caches: {
      open: async (name: string) => {
        if (!buckets.has(name)) buckets.set(name, new FakeCache());
        return buckets.get(name)!;
      },
      delete: async (name: string) => buckets.delete(name),
    },
  });
  return buckets;
}
