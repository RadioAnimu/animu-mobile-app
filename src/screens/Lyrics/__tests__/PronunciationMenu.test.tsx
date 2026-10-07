// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { JapaneseDictionarySnapshot } from "@/core/japanese";
import { PronunciationMenu } from "@/screens/Lyrics/PronunciationMenu";

vi.mock("react-native", async () => (await import("@/__tests__/react-native-mock")).createReactNativeMock());
vi.mock("react-native-reanimated", async () => {
  const { View } = (await import("@/__tests__/react-native-mock")).createReactNativeMock();
  const transition = { duration: () => transition, springify: () => transition, damping: () => transition, stiffness: () => transition };
  return { default: { View }, FadeIn: transition, FadeOut: transition, ZoomIn: transition, ZoomOut: transition };
});
vi.mock("@/components/Icon", () => ({ Icon: ({ name }: { name: string }) => <i data-icon={name} /> }));
vi.mock("@/screens/Lyrics/PronunciationIcon", () => ({ PronunciationIcon: () => <i data-icon="bubbles" /> }));
vi.mock("@/core/japanese", () => ({ DICTIONARY_BYTES: 17_791_956, DICTIONARY_STORED_BYTES: 64_554_959 }));
vi.mock("@/utils/haptics", () => ({ haptics: { tap: vi.fn(), select: vi.fn() } }));
vi.mock("@/hooks/useDict", () => ({
  useDict: () => new Proxy({} as Record<string, string>, { get: (_target, key) => String(key) }),
}));

const idle: JapaneseDictionarySnapshot = { install: "none", progress: 0, reader: "idle", failure: null };

const menu = (props: Partial<Parameters<typeof PronunciationMenu>[0]> = {}) => {
  const handlers = { onSelect: vi.fn(), onInstall: vi.fn(), onCancelInstall: vi.fn() };
  render(
    <PronunciationMenu
      mode="romaji"
      modes={["off", "romaji"]}
      dictionary={idle}
      bottomInset={0}
      reduceMotion={false}
      {...handlers}
      {...props}
    />,
  );
  fireEvent.click(screen.getByRole("button", { name: "LYRICS_PRONUNCIATION" }));
  return handlers;
};

const item = (name: string) => screen.getAllByRole("menuitem").find((element) => element.textContent?.includes(name))!;

describe("PronunciationMenu", () => {
  afterEach(cleanup);

  it("opens on the button and checks the current mode", () => {
    menu();
    expect(screen.getByRole("menu")).toBeTruthy();
    expect(item("LYRICS_PRONUNCIATION_ROMAJI").querySelector('[data-icon="check"]')).not.toBeNull();
    expect(item("LYRICS_PRONUNCIATION_OFF").querySelector('[data-icon="check"]')).toBeNull();
  });

  it("selects a mode and closes", () => {
    const { onSelect } = menu();
    fireEvent.click(item("LYRICS_PRONUNCIATION_OFF"));
    expect(onSelect).toHaveBeenCalledWith("off");
    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("marks what needs the dictionary and offers it with its sizes", () => {
    const { onInstall } = menu();
    const hiragana = item("LYRICS_PRONUNCIATION_HIRAGANA");
    expect(hiragana.getAttribute("aria-disabled")).toBe("true");
    expect(hiragana.textContent).toContain("LYRICS_DICTIONARY_NEEDED");
    fireEvent.click(item("SETTINGS_JP_DICTIONARY_ROW"));
    expect(onInstall).toHaveBeenCalled();
  });

  it("follows a download and stops it", () => {
    const { onCancelInstall } = menu({ dictionary: { ...idle, install: "downloading", progress: 0.42 } });
    const stop = item("SETTINGS_JP_DICTIONARY_STOP");
    expect(stop.textContent).toContain("42%");
    fireEvent.click(stop);
    expect(onCancelInstall).toHaveBeenCalled();
  });

  it("hides the dictionary once installed", () => {
    menu({ modes: ["off", "romaji", "hiragana"], dictionary: { ...idle, install: "installed", progress: 1 } });
    expect(screen.getAllByRole("menuitem")).toHaveLength(3);
  });
});
