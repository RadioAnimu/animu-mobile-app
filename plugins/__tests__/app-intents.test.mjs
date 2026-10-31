import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const iosAppIntents = require("../withIOSAppIntents.js");

const { PHRASE_KEYS, PHRASE_TRANSLATIONS } = iosAppIntents;

describe("withIOSAppIntents phrases", () => {
  it("keeps every phrase addressable by the app-name token", () => {
    for (const [locale, phrases] of Object.entries(PHRASE_TRANSLATIONS)) {
      for (const phrase of phrases) {
        expect(phrase, `${locale}: "${phrase}" must contain the token`).toContain(
          "${applicationName}",
        );
      }
    }
  });

  it("declares the same number of phrases for every locale", () => {
    // AppShortcuts.strings on iOS 16 requires the keys to match 1:1 with the
    // Swift source, so a locale with a different count silently drops phrases.
    for (const [locale, phrases] of Object.entries(PHRASE_TRANSLATIONS)) {
      expect(phrases).toHaveLength(PHRASE_KEYS.length);
      expect(locale).toBeTruthy();
    }
  });

  it("bakes every base phrase into the generated Swift source", () => {
    const swift = iosAppIntents.buildSwiftSource();

    for (const phrase of PHRASE_KEYS) {
      const swiftPhrase = phrase.replace("${applicationName}", "\\(.applicationName)");
      expect(swift).toContain(`"${swiftPhrase}"`);
    }
  });

  it("plays natively through the player's voice API, without a deep link", () => {
    const swift = iosAppIntents.buildSwiftSource();

    expect(swift).toContain("import AnythingPlayer");
    expect(swift).toContain('await RNAPVoice.play(query: "")');
    expect(swift).toContain("extension PlayAnimuIntent: AudioPlaybackIntent {}");
    expect(swift).not.toContain("openAppWhenRun");
  });

  it("emits a .strings key for every base phrase", () => {
    const strings = iosAppIntents.stringsContent("pt-BR");

    for (const phrase of PHRASE_KEYS) {
      expect(strings).toContain(`"${phrase}" =`);
    }
  });
});
