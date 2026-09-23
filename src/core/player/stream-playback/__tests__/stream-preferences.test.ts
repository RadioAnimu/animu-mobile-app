import { beforeEach, describe, expect, it, vi } from "vitest";

import { CONFIG } from "@/utils/player.config";
import {
  CURRENT_STREAM_KEY,
  StreamPreferences,
} from "@/core/player/stream-playback/stream-preferences";
import type { Stream } from "@/core/domain/stream";

const memory = new Map<string, string>();
let writeShouldThrow = false;

vi.mock("@react-native-async-storage/async-storage", () => ({
  default: {
    getItem: vi.fn(async (key: string) => memory.get(key) ?? null),
    setItem: vi.fn(async (key: string, value: string) => {
      if (writeShouldThrow) throw new Error("disk full");
      memory.set(key, value);
    }),
  },
}));

const stream = (id: string): Stream => ({
  id,
  bitrate: Number(id),
  category: "MP3",
  url: `https://stream.animu.moe/${id}`,
});

const OPTIONS: Stream[] = [stream("320"), stream("192")];

const store = (value: Stream) => memory.set(CURRENT_STREAM_KEY, JSON.stringify(value));
const storedId = () => {
  const raw = memory.get(CURRENT_STREAM_KEY);
  return raw ? (JSON.parse(raw) as Stream).id : undefined;
};

beforeEach(() => {
  memory.clear();
  writeShouldThrow = false;
});

describe("StreamPreferences.load", () => {
  it("adopts a stored stream that still exists in the fetched options", async () => {
    store(stream("192"));
    const prefs = new StreamPreferences();

    await prefs.load(OPTIONS);

    expect(prefs.current.id).toBe("192");
    // Already persisted — no rewrite needed.
    expect(storedId()).toBe("192");
  });

  it("falls back to the first option and persists it when the stored one is gone", async () => {
    store(stream("999"));
    const prefs = new StreamPreferences();

    await prefs.load(OPTIONS);

    expect(prefs.current.id).toBe("320");
    expect(storedId()).toBe("320");
  });

  it("picks and persists the first option on first launch", async () => {
    const prefs = new StreamPreferences();

    await prefs.load(OPTIONS);

    expect(prefs.current.id).toBe("320");
    expect(storedId()).toBe("320");
  });

  it("keeps the default WITHOUT overwriting a stored preference when the API list is empty", async () => {
    store(stream("192"));
    const prefs = new StreamPreferences();

    await prefs.load([]);

    // Nothing verifiable was fetched: the in-memory value stays the hardcoded
    // default, and the user's stored choice must survive for the next load.
    expect(prefs.current.id).toBe(CONFIG.DEFAULT_STREAM_OPTION.id);
    expect(storedId()).toBe("192");
  });

  it("treats corrupt stored JSON as no preference", async () => {
    memory.set(CURRENT_STREAM_KEY, "{not json");
    const prefs = new StreamPreferences();

    await prefs.load(OPTIONS);

    expect(prefs.current.id).toBe("320");
  });
});

describe("StreamPreferences.restore", () => {
  it("re-reads and adopts a stored stream that still exists", async () => {
    const prefs = new StreamPreferences();
    store(stream("192"));

    await prefs.restore(OPTIONS);

    expect(prefs.current.id).toBe("192");
  });

  it("moves to the first option and persists when the stored relay is gone", async () => {
    store(stream("999"));
    const prefs = new StreamPreferences();

    await prefs.restore(OPTIONS);

    expect(prefs.current.id).toBe("320");
    expect(storedId()).toBe("320");
  });

  it("never sends playback to an unverifiable stored relay when the list is empty", async () => {
    // load() already validated/adopted the current value at bootstrap.
    store(stream("999"));
    const prefs = new StreamPreferences();
    await prefs.load(OPTIONS); // current = 320 (999 invalid)
    memory.clear();

    await prefs.restore([]);

    expect(prefs.current.id).toBe("320");
    expect(storedId()).toBeUndefined();
  });

  it("keeps the current value when there is nothing to choose from", async () => {
    const prefs = new StreamPreferences();

    await prefs.restore([]);

    expect(prefs.current.id).toBe(CONFIG.DEFAULT_STREAM_OPTION.id);
  });
});

describe("StreamPreferences.set / reset", () => {
  it("persists an explicit choice", async () => {
    const prefs = new StreamPreferences();

    await prefs.set(stream("64"));

    expect(prefs.current.id).toBe("64");
    expect(storedId()).toBe("64");
  });

  it("resets to the hardcoded default in memory only", async () => {
    const prefs = new StreamPreferences();
    await prefs.set(stream("64"));

    prefs.reset();

    expect(prefs.current.id).toBe(CONFIG.DEFAULT_STREAM_OPTION.id);
    // reset() is in-memory; the persisted value is untouched until the next write.
    expect(storedId()).toBe("64");
  });

  it("does not throw when the persist write fails", async () => {
    const prefs = new StreamPreferences();
    writeShouldThrow = true;

    await expect(prefs.set(stream("64"))).resolves.toBeUndefined();
    expect(prefs.current.id).toBe("64");
  });
});
