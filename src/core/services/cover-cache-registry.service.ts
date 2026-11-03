import AsyncStorage from "@react-native-async-storage/async-storage";

/**
 * The app surface a cached cover was last displayed in, one entry per URL
 * (expo-image keys its disk cache by URL), so Settings can size each category.
 */
export type CoverCacheCategory = "live" | "requested" | "played" | "search";

const REGISTRY_KEY = "coverCacheRegistry";
const MAX_ENTRIES = 500;
/** Debounce for display tags: History tags dozens at once, and each write serializes the whole registry. */
const PERSIST_DEBOUNCE_MS = 1_000;

interface RegistryEntry {
  category: CoverCacheCategory;
  at: number;
}

interface RegistryShape {
  entries: Record<string, RegistryEntry>;
}

/**
 * Persists each cached cover URL's category. Non-authoritative: expo-image
 * owns the files and may evict them, so missing URLs are pruned on measure.
 */
export class CoverCacheRegistry {
  /** An entry the size cap dropped: its file must go too, or no measure or trim sees it again. */
  onEvict: (url: string) => void = () => {};
  private readonly entries = new Map<string, RegistryEntry>();
  private loaded: Promise<void> | null = null;
  private persistChain: Promise<void> = Promise.resolve();
  private persistTimer: ReturnType<typeof setTimeout> | null = null;
  /** Set while the user is wiping the registry — display tags are silenced. */
  private clearing = false;

  /** Reads persisted entries once. */
  load(): Promise<void> {
    this.loaded ??= AsyncStorage.getItem(REGISTRY_KEY)
      .then((raw) => {
        if (!raw) return;
        const parsed = JSON.parse(raw) as Partial<RegistryShape>;
        // A tag that fired while this AsyncStorage read was still in flight
        // is newer than the stored state: it keeps its entry and stays at
        // the ring's newest end, so the cap never evicts it first.
        const fresh = [...this.entries];
        this.entries.clear();
        for (const [url, entry] of Object.entries(parsed.entries ?? {})) this.entries.set(url, entry);
        for (const [url, entry] of fresh) {
          this.entries.delete(url);
          this.entries.set(url, entry);
        }
      })
      .catch((error: unknown) => {
        console.warn("[CoverCacheRegistry] load failed:", error);
      });
    return this.loaded;
  }

  /**
   * Tags a URL with the category that displayed it (its latest display wins).
   * An identical re-tag (recycled list rows) skips the write but still moves
   * the entry to the ring's newest end, so the trimmer never evicts a cover
   * on screen.
   */
  tag(url: string, category: CoverCacheCategory): void {
    if (this.clearing) return;
    if (!url || !/^https?:/i.test(url)) return;
    if (!this.loaded) void this.load();

    const existing = this.entries.get(url);
    const identical = existing?.category === category;
    this.entries.delete(url);
    this.entries.set(url, { category, at: Date.now() });
    // `while`: tags made during the load can leave the merge over the cap.
    while (this.entries.size > MAX_ENTRIES) {
      const oldest = this.entries.keys().next().value;
      if (oldest == null) break;
      this.entries.delete(oldest);
      this.onEvict(oldest);
    }
    if (!identical) this.schedulePersist();
  }

  /** When the URL was last tagged. */
  taggedAt(url: string): number | undefined {
    return this.entries.get(url)?.at;
  }

  /** URLs grouped by category, in tag order (oldest first per group). */
  groupByCategory(): Record<CoverCacheCategory, string[]> {
    const groups: Record<CoverCacheCategory, string[]> = {
      live: [],
      requested: [],
      played: [],
      search: [],
    };
    for (const [url, entry] of this.entries) {
      groups[entry.category].push(url);
    }
    return groups;
  }

  /** Drops every entry and the persisted registry; a tag arriving mid-wipe is dropped. */
  async clear(): Promise<void> {
    this.clearing = true;
    try {
      // A pending debounced write would resurrect the entries.
      this.cancelScheduledPersist();
      await this.load();
      await this.persistChain;
      this.entries.clear();
      await AsyncStorage.removeItem(REGISTRY_KEY);
    } finally {
      this.clearing = false;
    }
  }

  /** Drops entries whose URLs are no longer in the disk cache. */
  async prune(missingUrls: string[]): Promise<void> {
    if (this.clearing || missingUrls.length === 0) return;
    for (const url of missingUrls) this.entries.delete(url);
    await this.flushPersist();
  }

  private schedulePersist(): void {
    this.cancelScheduledPersist();
    this.persistTimer = setTimeout(() => {
      this.persistTimer = null;
      void this.chainPersist();
    }, PERSIST_DEBOUNCE_MS);
  }

  private cancelScheduledPersist(): void {
    if (this.persistTimer == null) return;
    clearTimeout(this.persistTimer);
    this.persistTimer = null;
  }

  /** Each write queues behind the last and serializes the map as it is then: no stale snapshot. */
  private chainPersist(): Promise<void> {
    this.persistChain = this.persistChain.then(() => this.persist()).catch(
      (error: unknown) => {
        console.warn("[CoverCacheRegistry] persist chain failed:", error);
      },
    );
    return this.persistChain;
  }

  /** Writes now, cancelling a pending debounce, and awaits the chain. */
  private flushPersist(): Promise<void> {
    this.cancelScheduledPersist();
    return this.chainPersist();
  }

  private async persist(): Promise<void> {
    const shape: RegistryShape = { entries: Object.fromEntries(this.entries) };
    await AsyncStorage.setItem(REGISTRY_KEY, JSON.stringify(shape));
  }
}

export const coverCacheRegistry = new CoverCacheRegistry();
