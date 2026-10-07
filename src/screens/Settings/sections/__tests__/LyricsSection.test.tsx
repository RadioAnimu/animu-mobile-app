// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { Alert } from "react-native";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LyricsSection } from "@/screens/Settings/sections/LyricsSection";

const mocks = vi.hoisted(() => ({
  snapshot: { install: "none", progress: 0, reader: "idle" } as Record<string, unknown>,
  install: vi.fn(async () => {}),
  remove: vi.fn(async () => {}),
  updateSettings: vi.fn(async () => {}),
}));

vi.mock("react-native", async () => (await import("@/__tests__/react-native-mock")).createReactNativeMock());
vi.mock("@/components/Icon", () => ({ Icon: () => <i /> }));
vi.mock("@/components/SectionTitle", () => ({ SectionTitle: ({ title }: { title: string }) => <h2>{title}</h2> }));
vi.mock("@/components/Select", () => ({
  Select: ({ label, value, onChange }: { label: string; value: string; onChange: (key: string) => void }) => (
    <button type="button" aria-label={label} data-value={value} onClick={() => onChange("hiragana")} />
  ),
}));
vi.mock("@/contexts/user/UserSettingsProvider", () => ({
  useUserSettings: () => ({ settings: { lyricsPronunciation: "romaji" }, updateSettings: mocks.updateSettings }),
}));
vi.mock("@/core/japanese", () => ({
  DICTIONARY_BYTES: 17_791_956,
  DICTIONARY_STORED_BYTES: 64_554_959,
  japaneseDictionary: { install: mocks.install, remove: mocks.remove },
}));
vi.mock("@/hooks/useJapaneseDictionary", () => ({ useJapaneseDictionary: () => mocks.snapshot }));
vi.mock("@/hooks/useStackedRows", () => ({ useStackedRows: () => false }));
vi.mock("@/components/Avatar", () => ({ Avatar: () => null }));
vi.mock("@/utils/haptics", () => ({ haptics: { tap: vi.fn(), warning: vi.fn(), select: vi.fn() } }));
vi.mock("@/hooks/useDict", () => ({
  useDict: () =>
    new Proxy({} as Record<string, string>, { get: (_target, key) => String(key) }),
}));

const dictionaryRow = () => screen.getByRole("button", { name: /SETTINGS_JP_DICTIONARY_ROW/ });

describe("LyricsSection", () => {
  beforeEach(() => {
    mocks.snapshot = { install: "none", progress: 0, reader: "idle" };
  });
  afterEach(cleanup);

  it("stores the pronunciation choice", () => {
    render(<LyricsSection />);
    const select = screen.getByRole("button", { name: "SETTINGS_LYRICS_PRONUNCIATION_ROW" });
    expect(select.getAttribute("data-value")).toBe("romaji");
    fireEvent.click(select);
    expect(mocks.updateSettings).toHaveBeenCalledWith({ lyricsPronunciation: "hiragana" });
  });

  it("downloads the dictionary, showing its size and progress", () => {
    render(<LyricsSection />);
    expect(dictionaryRow().getAttribute("aria-label")).toContain("SETTINGS_JP_DICTIONARY_SIZE");
    fireEvent.click(dictionaryRow());
    expect(mocks.install).toHaveBeenCalled();
    cleanup();
    mocks.snapshot = { install: "downloading", progress: 0.42, reader: "idle" };
    render(<LyricsSection />);
    expect(dictionaryRow().getAttribute("aria-label")).toContain("42%");
  });

  it("asks before removing an installed dictionary", () => {
    mocks.snapshot = { install: "installed", progress: 1, reader: "ready" };
    render(<LyricsSection />);
    fireEvent.click(dictionaryRow());
    expect(mocks.install).not.toHaveBeenCalled();
    const [, , buttons] = vi.mocked(Alert.alert).mock.calls.at(-1)!;
    buttons?.find((button) => button.style === "destructive")?.onPress?.();
    expect(mocks.remove).toHaveBeenCalled();
  });
});
