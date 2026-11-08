import AsyncStorage from "@react-native-async-storage/async-storage";
import { AUTO_QUALITY, type Stream } from "@/core/domain/stream";
import { CONFIG } from "@/utils/player.config";

export const CURRENT_STREAM_KEY = "currentStream";

/** What is stored: a stream picked, or automatic quality. */
type Stored = Stream | typeof AUTO_QUALITY;

/**
 * Persists and resolves the listener's stream quality: a stream they picked,
 * or automatic quality (RNAP starts at the top stream and steps down on
 * stalls). Corrupt/missing storage never throws — callers always get a
 * usable stream.
 */
export class StreamPreferences {
  private currentStream: Stream = CONFIG.DEFAULT_STREAM_OPTION;
  private automatic = false;

  /** The stream picked; under automatic quality, the one a load opens at. */
  get current(): Stream {
    return this.currentStream;
  }

  /** Automatic quality: RNAP follows the connection. */
  get auto(): boolean {
    return this.automatic;
  }

  /**
   * Setup path: the stored choice wins when it still exists in the fetched
   * `options`. A first launch (nothing stored, or nothing readable) gets
   * automatic quality; a stored stream the station dropped falls back to the
   * first option. Either is persisted at once, so every other code path sees
   * a valid choice.
   */
  async load(options: Stream[]): Promise<void> {
    const raw = await this.readStored();
    const stored = this.storedIn(raw, options);
    if (stored) {
      this.adopt(stored, options);
      return;
    }

    // An empty fetched list verifies and selects nothing (degraded API): keep
    // the hardcoded default in memory WITHOUT persisting it — overwriting the
    // stored preference with a fallback would lose the user's choice the next
    // time a real list arrives. A non-empty list is authoritative.
    if (options.length === 0) return;

    if (raw != null) {
      // The stored stream no longer exists: the first from the API.
      this.adopt(options[0] ?? CONFIG.DEFAULT_STREAM_OPTION, options);
    } else {
      this.adopt(AUTO_QUALITY, options);
    }
    await this.persist();
  }

  /**
   * Play path (native setup may have just completed): a fresh stored read
   * wins, then the first fetched option, otherwise keep the current value.
   */
  async restore(options: Stream[]): Promise<void> {
    const stored = this.storedIn(await this.readStored(), options);
    // Same existence guard as load(): a station that renamed/removed the
    // relay must not send playback to a dead URL. An empty fetched list
    // verifies nothing (and selects nothing) — the current value (already
    // validated by load(), else the hardcoded default) stays in place.
    if (stored) {
      this.adopt(stored, options);
    } else if (options.length > 0) {
      // Automatic quality needs no stream to exist; a pick moves to the first.
      this.adopt(this.automatic ? AUTO_QUALITY : options[0], options);
      await this.persist();
    } else {
      // Nothing to select from: keep the current value untouched.
    }
  }

  async set(stream: Stream): Promise<void> {
    this.adopt(stream, []);
    await this.persist();
  }

  /** Automatic quality; a load opens at the top of `options`. */
  async setAuto(options: Stream[]): Promise<void> {
    this.adopt(AUTO_QUALITY, options);
    await this.persist();
  }

  reset(): void {
    this.currentStream = CONFIG.DEFAULT_STREAM_OPTION;
    this.automatic = false;
  }

  private adopt(choice: Stored, options: Stream[]): void {
    this.automatic = choice === AUTO_QUALITY;
    if (choice !== AUTO_QUALITY) {
      this.currentStream = choice;
    } else if (options.length > 0) {
      this.currentStream = options[0];
    } else {
      // Nothing fetched: a load opens at the stream already current.
    }
  }

  /**
   * The stored choice (`raw`, as read) as the fetched `options` list it now
   * (fresh URL, bitrate, label); `null` when nothing usable is stored.
   */
  private storedIn(raw: unknown, options: Stream[]): Stored | null {
    // Automatic quality needs no stream to exist (an empty list keeps it too).
    if (raw === AUTO_QUALITY) return AUTO_QUALITY;
    const id = (raw as Partial<Stream> | null)?.id;
    return options.find((option) => option.id === id) ?? null;
  }

  /** What is stored, parsed; `null` when nothing (readable) is. */
  private async readStored(): Promise<unknown> {
    try {
      const raw = await AsyncStorage.getItem(CURRENT_STREAM_KEY);
      return raw ? (JSON.parse(raw) as unknown) : null;
    } catch {
      return null;
    }
  }

  private async persist(): Promise<void> {
    try {
      await AsyncStorage.setItem(
        CURRENT_STREAM_KEY,
        JSON.stringify(this.automatic ? AUTO_QUALITY : this.currentStream),
      );
    } catch (error) {
      console.warn("[StreamPreferences] Failed to persist stream:", error);
    }
  }
}
