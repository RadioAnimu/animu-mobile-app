import AsyncStorage from "@react-native-async-storage/async-storage";
import type { Stream } from "../domain/stream";
import { CONFIG } from "../../utils/player.config";

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
    const stored = await this.readStored();
    if (stored && options.some((option) => option.id === stored.id)) {
      this.currentStream = stored;
      return;
    }

    // First launch or stored stream no longer exists — pick first from API
    this.currentStream = options[0] ?? CONFIG.DEFAULT_STREAM_OPTION;
    await this.persist();
  }

  /**
   * Play path (native setup may have just completed): a fresh stored read
   * wins, then the first fetched option, otherwise keep the current value.
   */
  async restore(options: Stream[]): Promise<void> {
    const stored = await this.readStored();
    if (stored) {
      this.currentStream = stored;
    } else if (options.length > 0) {
      this.currentStream = options[0];
    }
  }

  async set(stream: Stream): Promise<void> {
    this.currentStream = stream;
    await this.persist();
  }

  reset(): void {
    this.currentStream = CONFIG.DEFAULT_STREAM_OPTION;
  }

  private async readStored(): Promise<Stream | null> {
    try {
      const raw = await AsyncStorage.getItem(CURRENT_STREAM_KEY);
      return raw ? (JSON.parse(raw) as Stream) : null;
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
