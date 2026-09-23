import AsyncStorage from "@react-native-async-storage/async-storage";

const STORAGE_KEY = "recentSearches";

/** Kept queries: enough to be handy, few enough to scan at a glance. */
const MAX_ITEMS = 5;

/**
 * Recent request-search queries, most recent first.
 *
 * Best effort by design: a storage failure degrades to an empty list rather
 * than breaking search, and a corrupt value is discarded on read.
 */
class RecentSearchesService {
  async getAll(): Promise<string[]> {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      if (!stored) return [];
      const parsed: unknown = JSON.parse(stored);
      if (!Array.isArray(parsed)) return [];
      return parsed.filter((item): item is string => typeof item === "string");
    } catch {
      return [];
    }
  }

  /** Moves `query` to the front (de-duplicated) and returns the new list. */
  async add(query: string): Promise<string[]> {
    const current = await this.getAll();
    const next = [
      query,
      ...current.filter((item) => item !== query),
    ].slice(0, MAX_ITEMS);
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch (error) {
      console.warn("[RecentSearches] save failed:", error);
    }
    return next;
  }

  async clear(): Promise<void> {
    try {
      await AsyncStorage.removeItem(STORAGE_KEY);
    } catch (error) {
      console.warn("[RecentSearches] clear failed:", error);
    }
  }
}

export const recentSearchesService = new RecentSearchesService();
