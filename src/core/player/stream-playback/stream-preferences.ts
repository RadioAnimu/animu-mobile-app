import AsyncStorage from "@react-native-async-storage/async-storage";
import type { Stream } from "@/core/domain/stream";
import { CONFIG } from "@/utils/player.config";

export const CURRENT_STREAM_KEY = "currentStream";

/**
 * Persists and resolves the user's preferred stream quality.
 * Corrupt/missing storage never throws — callers always get a usable stream.
 */
export class StreamPreferences {
  private currentStream: Stream = CONFIG.DEFAULT_STREAM_OPTION;

  get current(): Stream {
    return this.currentStream;
  }

  /**
   * Setup path: stored preference wins when it still exists in the fetched
   * `options`; otherwise the first option (or the hardcoded default) is
   * picked and persisted immediately so every other code path sees a valid
   * stream.
   */
  async load(options: Stream[]): Promise<void> {
    const stored = await this.storedIn(options);
    if (stored) {
      this.currentStream = stored;
      return;
    }

    // An empty fetched list verifies and selects nothing (degraded API): keep
    // the hardcoded default in memory WITHOUT persisting it — overwriting the
    // stored preference with a fallback would lose the user's choice the next
    // time a real list arrives. A non-empty list is authoritative.
    if (options.length === 0) return;

    // First launch or stored stream no longer exists — pick first from API
    this.currentStream = options[0] ?? CONFIG.DEFAULT_STREAM_OPTION;
    await this.persist();
  }

  /**
   * Play path (native setup may have just completed): a fresh stored read
   * wins, then the first fetched option, otherwise keep the current value.
   */
  async restore(options: Stream[]): Promise<void> {
    const stored = await this.storedIn(options);
    // Same existence guard as load(): a station that renamed/removed the
    // relay must not send playback to a dead URL. An empty fetched list
    // verifies nothing (and selects nothing) — the current value (already
    // validated by load(), else the hardcoded default) stays in place.
    if (stored) {
      this.currentStream = stored;
    } else if (options.length > 0) {
      this.currentStream = options[0];
      await this.persist();
    } else {
      // Nothing to select from: keep the current value untouched.
    }
  }

  async set(stream: Stream): Promise<void> {
    this.currentStream = stream;
    await this.persist();
  }

  reset(): void {
    this.currentStream = CONFIG.DEFAULT_STREAM_OPTION;
  }

  /** The stored preference as the fetched `options` list it now (fresh URL, bitrate, label). */
  private async storedIn(options: Stream[]): Promise<Stream | null> {
    try {
      const raw = await AsyncStorage.getItem(CURRENT_STREAM_KEY);
      const id = raw ? (JSON.parse(raw) as Partial<Stream> | null)?.id : undefined;
      return options.find((option) => option.id === id) ?? null;
    } catch {
      return null;
    }
  }

  private async persist(): Promise<void> {
    try {
      await AsyncStorage.setItem(
        CURRENT_STREAM_KEY,
        JSON.stringify(this.currentStream),
      );
    } catch (error) {
      console.warn("[StreamPreferences] Failed to persist stream:", error);
    }
  }
}
