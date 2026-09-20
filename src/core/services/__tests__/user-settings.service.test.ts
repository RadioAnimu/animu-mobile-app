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

  it("falls back to defaults on corrupt JSON", async () => {
    memory.set("userSettings", "{not json");

    const settings = await userSettingsService.initialize();

    expect(settings).toEqual(DEFAULT_USER_SETTINGS);
  });
});
