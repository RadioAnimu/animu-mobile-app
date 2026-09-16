import AsyncStorage from "@react-native-async-storage/async-storage";

/**
 * Which app surface a cached cover was last displayed in. One entry per
 * remote URL — the disk keys of expo-image's cache are the URLs
 * themselves, so tagging at display time is what allows the Settings
 * storage card to attribute real cached file sizes per category.
 */
export type CoverCacheCategory = "live" | "requested" | "played" | "search";

const REGISTRY_KEY = "coverCacheRegistry";
/** AsyncStorage stays small even for heavy browsing sessions. */
const MAX_ENTRIES = 500;

interface RegistryEntry {
  category: CoverCacheCategory;
  /** Display recency — used both for the LRU cap and legend metadata. */
  at: number;
}

interface RegistryShape {
  entries: Record<string, RegistryEntry>;
}

/**
 * Persists which category each cached cover URL belongs to. Non-authoritative
 * by design: expo-image owns the actual files and may evict at any time, so
 * missing URLs are pruned on measurement instead of cleaned up here.
 */
export class CoverCacheRegistry {
  private entries = new Map<string, RegistryEntry>();
  private loaded: Promise<void> | null = null;
  /** Serialization chain — rapid tags never interleave AsyncStorage writes. */
  private persistChain: Promise<void> = Promise.resolve();
  /** Set while the user is wiping the registry — display tags are silenced. */
  private clearing = false;

  /** Reads persisted entries once; subsequent calls reuse the resolved load. */
  load(): Promise<void> {
    if (!this.loaded) {
      this.loaded = AsyncStorage.getItem(REGISTRY_KEY)
        .then((raw) => {
          if (!raw) return;
          const parsed = JSON.parse(raw) as RegistryShape;
          for (const [url, entry] of Object.entries(parsed.entries ?? {})) {
            // A tag that fired while this AsyncStorage read was still in
            // flight is newer than the stored state — never clobber it.
            if (!this.entries.has(url)) this.entries.set(url, entry);
          }
        })
        .catch((error) => {
          console.warn("[CoverCacheRegistry] load failed:", error);
        });
    }
    return this.loaded;
  }

  /**
   * Tags a URL with the category that displayed it. A URL keeps the
   * category of its most recent display, which mirrors how the user
   * experienced the cached file.
   *
   * Persistence is chained (each write queues behind the previous one)
   * so a burst of rapid tags can never write a stale snapshot over a
   * newer one — each queued persist serializes the exact map state at
   * its write time.
   *
   * Re-tagging an identical (url, category) pair is a no-op: list
   * recycling remounts the same rows while scrolling, and a write per
   * remount would churn AsyncStorage for zero information.
   */
  tag(url: string, category: CoverCacheCategory): void {
    if (this.clearing) return;
    if (!url || !/^https?:/i.test(url)) return;
    if (!this.loaded) this.load();

    const existing = this.entries.get(url);
    if (existing && existing.category === category) return;

    this.entries.delete(url);
    this.entries.set(url, { category, at: Date.now() });
    if (this.entries.size > MAX_ENTRIES) {
      const oldest = this.entries.keys().next().value;
      if (oldest != null) this.entries.delete(oldest);
    }
    void this.softPersist();
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

  /** Drops every entry and clears the persisted registry. Round-trip safe: a tag arriving mid-wipe is dropped, not revived. */
  async clear(): Promise<void> {
    this.clearing = true;
    try {
      await this.load();
      // Flush parked writes (they see the already-empty map), then drop
      // any entries a racing tag added while waiting before the wipe.
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
    await this.softPersist();
  }

  /** Chains persists so concurrent tags can't write stale snapshots (last queued write wins). */
  private softPersist(): Promise<void> {
    this.persistChain = this.persistChain.then(() => this.persist()).catch(
      (error) => {
        console.warn("[CoverCacheRegistry] persist chain failed:", error);
      },
    );
    return this.persistChain;
  }

  private async persist(): Promise<void> {
    const shape: RegistryShape = { entries: Object.fromEntries(this.entries) };
    await AsyncStorage.setItem(REGISTRY_KEY, JSON.stringify(shape));
  }
}

export const coverCacheRegistry = new CoverCacheRegistry();
