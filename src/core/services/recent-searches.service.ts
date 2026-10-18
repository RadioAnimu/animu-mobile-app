import AsyncStorage from "@react-native-async-storage/async-storage";

import { foldForSearch } from "@/utils/search-match";

const STORAGE_KEY = "recentSearches";

/**
 * Searches kept in history. Only a handful show at once (see the screen);
 * the rest still answer the type-ahead filter, so an old search resurfaces
 * the moment its first letters are typed.
 */
export const MAX_HISTORY = 100;

/** One remembered request search. */
export interface RecentSearch {
  /** The query as the user typed it (trimmed). */
  query: string;
  /**
   * Server `total_count` when the search ran; null for entries written before
   * the count was kept.
   */
  total: number | null;
  /** When the search ran, epoch ms; 0 for entries written before it was kept. */
  searchedAt: number;
  /** How many times it was searched — ranks the type-ahead matches. */
  uses: number;
}

/** What one doubling of a search's use count is worth, in recency. */
const REPEAT_BOOST_MS = 3 * 24 * 60 * 60 * 1000;

/**
 * History ordered for type-ahead: recency first, with a modest lift for
 * searches made again and again — each doubling of `uses` counts like having
 * searched it three days later. A habit beats a one-off from last week, but
 * not one from this morning.
 */
export function byFrecency(items: readonly RecentSearch[]): RecentSearch[] {
  const score = (item: RecentSearch) =>
    item.searchedAt + Math.log2(item.uses) * REPEAT_BOOST_MS;
  return [...items].sort((a, b) => score(b) - score(a));
}

/** The stored finite number, or null when the value is missing or not a number. */
function storedNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

/**
 * One stored item, in today's object shape or the legacy bare-string shape
 * (`total` unknown → null, `searchedAt` unknown → 0). Anything else is
 * malformed and dropped.
 */
function parseEntry(item: unknown): RecentSearch | null {
  if (typeof item === "string") {
    const query = item.trim();
    return query ? { query, total: null, searchedAt: 0, uses: 1 } : null;
  }
  if (typeof item !== "object" || item === null) return null;
  const candidate = item as Record<string, unknown>;
  if (typeof candidate.query !== "string") return null;
  const query = candidate.query.trim();
  if (!query) return null;
  return {
    query,
    total: storedNumber(candidate.total),
    searchedAt: storedNumber(candidate.searchedAt) ?? 0,
    uses: Math.max(1, storedNumber(candidate.uses) ?? 1),
  };
}

/** Reads the raw storage value; a corrupt one is discarded rather than thrown. */
function parseEntries(raw: string | null): RecentSearch[] {
  if (!raw) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  const entries: RecentSearch[] = [];
  for (const item of parsed) {
    const entry = parseEntry(item);
    if (entry) entries.push(entry);
  }
  return entries;
}

/**
 * Recent request searches — the query plus how many results it had — most
 * recent first.
 *
 * Best effort by design: a storage failure degrades to an empty list rather
 * than breaking search, and a corrupt value is discarded on read.
 */
class RecentSearchesService {
  /**
   * Mutations are read-modify-write; chaining them keeps a quick
   * search-then-remove from reading the same snapshot and losing one.
   */
  private queue: Promise<unknown> = Promise.resolve();

  private serialize<T>(mutation: () => Promise<T>): Promise<T> {
    const result = this.queue.then(mutation);
    this.queue = result.catch(() => undefined);
    return result;
  }

  /** Newest first. */
  async getAll(): Promise<RecentSearch[]> {
    try {
      return parseEntries(await AsyncStorage.getItem(STORAGE_KEY));
    } catch {
      return [];
    }
  }

  /**
   * Moves `query` to the front (de-duplicated case- and accent-insensitively,
   * keeping the newest casing) and returns the new list.
   *
   * A search that found nothing (`total <= 0`) is not worth remembering: it is
   * dropped, and so is any older entry for the same words — that entry points
   * at results which no longer come back.
   */
  add(query: string, total: number): Promise<RecentSearch[]> {
    return this.serialize(async () => {
      const current = await this.getAll();
      const trimmed = query.trim();
      if (!trimmed) return current;

      const key = foldForSearch(trimmed);
      const previous = current.find(
        (item) => foldForSearch(item.query) === key,
      );
      const rest = current.filter((item) => item !== previous);
      if (!(total > 0)) {
        await this.save(rest);
        return rest;
      }

      const next = [
        {
          query: trimmed,
          total,
          searchedAt: Date.now(),
          uses: (previous?.uses ?? 0) + 1,
        },
        ...rest,
      ].slice(0, MAX_HISTORY);
      await this.save(next);
      return next;
    });
  }

  /**
   * Drops `query` — matched the same loose way `add` de-duplicates, so
   * "Naruto" also removes "naruto" — and returns the new list.
   */
  remove(query: string): Promise<RecentSearch[]> {
    return this.serialize(async () => {
      const key = foldForSearch(query);
      const next = (await this.getAll()).filter(
        (item) => foldForSearch(item.query) !== key,
      );
      await this.save(next);
      return next;
    });
  }

  /** Forgets everything. */
  clear(): Promise<void> {
    return this.serialize(async () => {
      try {
        await AsyncStorage.removeItem(STORAGE_KEY);
      } catch (error) {
        console.warn("[RecentSearches] clear failed:", error);
      }
    });
  }

  /**
   * Puts removed entries back — the "Undo" after a remove or clear. Anything
   * searched in the meantime wins over its restored copy, and the merged list
   * is re-ordered newest first.
   */
  restore(items: readonly RecentSearch[]): Promise<RecentSearch[]> {
    return this.serialize(async () => {
      const current = await this.getAll();
      const kept = new Set(current.map((item) => foldForSearch(item.query)));
      const next = [
        ...current,
        ...items.filter((item) => !kept.has(foldForSearch(item.query))),
      ]
        // Stable: equal times (legacy 0s) keep their relative order.
        .sort((a, b) => b.searchedAt - a.searchedAt)
        .slice(0, MAX_HISTORY);
      await this.save(next);
      return next;
    });
  }

  private async save(items: RecentSearch[]): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch (error) {
      console.warn("[RecentSearches] save failed:", error);
    }
  }
}

export const recentSearchesService = new RecentSearchesService();
