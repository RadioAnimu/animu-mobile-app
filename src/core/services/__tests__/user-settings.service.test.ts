import { beforeEach, describe, expect, it, vi } from "vitest";

import { userSettingsService } from "@/core/services/user-settings.service";
import { DEFAULT_USER_SETTINGS } from "@/constants/settings";

const memory = new Map<string, string>();

vi.mock("@react-native-async-storage/async-storage", () => ({
  default: {
    getItem: vi.fn(async (key: string) => memory.get(key) ?? null),
    setItem: vi.fn(async (key: string, value: string) => {
      memory.set(key, value);
    }),
  },
}));

describe("userSettingsService.initialize", () => {
  beforeEach(() => {
    memory.clear();
  });

  it("falls back to the default language when storage holds an unknown key", async () => {
    memory.set(
      "userSettings",
      JSON.stringify({ selectedLanguage: "JP", hapticsEnabled: false }),
    );

    const settings = await userSettingsService.initialize();

    expect(settings.selectedLanguage).toBe(
      DEFAULT_USER_SETTINGS.selectedLanguage,
    );
    // A valid stored field is still honored.
    expect(settings.hapticsEnabled).toBe(false);
  });

  it("falls back to the default lyrics pronunciation when storage holds an unknown one", async () => {
    memory.set("userSettings", JSON.stringify({ lyricsPronunciation: "katakana" }));
    expect((await userSettingsService.initialize()).lyricsPronunciation).toBe("romaji");
    memory.set("userSettings", JSON.stringify({ lyricsPronunciation: "hiragana" }));
    expect((await userSettingsService.initialize()).lyricsPronunciation).toBe("hiragana");
  });

  it("keeps a supported language untouched", async () => {
    memory.set("userSettings", JSON.stringify({ selectedLanguage: "EN" }));

    const settings = await userSettingsService.initialize();

    expect(settings.selectedLanguage).toBe("EN");
  });

  it("merges defaults for fields missing from storage", async () => {
    memory.set("userSettings", JSON.stringify({ selectedLanguage: "ES" }));

    const settings = await userSettingsService.initialize();

    expect(settings.cacheEnabled).toBe(DEFAULT_USER_SETTINGS.cacheEnabled);
    expect(settings.visualizerHz).toBe(DEFAULT_USER_SETTINGS.visualizerHz);
  });

  it("strips the removed legacy liveUpdatesInBackground key from storage", async () => {
    // Users upgrading from a build that still stored the removed toggle must
    // not carry the key around (or re-persist it on the next settings write).
    memory.set("userSettings", JSON.stringify({ liveUpdatesInBackground: false }));

    const settings = await userSettingsService.initialize();

    expect(settings).toEqual(DEFAULT_USER_SETTINGS);
  });

  it("moves the old uncapped default to the cover cache cap once, and saves it", async () => {
    memory.set("userSettings", JSON.stringify({ coverCacheLimitBytes: 0 }));
    const settings = await userSettingsService.initialize();
    expect(settings.coverCacheLimitBytes).toBe(100 * 1024 * 1024);
    expect(settings.settingsVersion).toBe(2);
    expect(JSON.parse(memory.get("userSettings")!)).toMatchObject({
      coverCacheLimitBytes: 100 * 1024 * 1024,
      settingsVersion: 2,
    });
  });

  it("keeps an Unlimited picked after the cap became the default", async () => {
    memory.set("userSettings", JSON.stringify({ coverCacheLimitBytes: 0, settingsVersion: 2 }));
    expect((await userSettingsService.initialize()).coverCacheLimitBytes).toBe(0);
  });

  it("keeps a limit chosen before the cap became the default", async () => {
    memory.set("userSettings", JSON.stringify({ coverCacheLimitBytes: 250 * 1024 * 1024 }));
    expect((await userSettingsService.initialize()).coverCacheLimitBytes).toBe(250 * 1024 * 1024);
  });

  it("falls back to defaults on corrupt JSON", async () => {
    memory.set("userSettings", "{not json");

    const settings = await userSettingsService.initialize();

    expect(settings).toEqual(DEFAULT_USER_SETTINGS);
    // The singleton must ADOPT the fallback, not merely return it — a later
    // reader (getCurrentSettings) must not see a stale prior value.
    expect(userSettingsService.getCurrentSettings()).toEqual(
      DEFAULT_USER_SETTINGS,
    );
  });
});
