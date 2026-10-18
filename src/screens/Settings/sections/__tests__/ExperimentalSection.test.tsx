// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { Alert } from "react-native";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ExperimentalSection } from "@/screens/Settings/sections/ExperimentalSection";

const mocks = vi.hoisted(() => ({
  snapshot: { install: "none", progress: 0, reader: "idle" } as Record<string, unknown>,
  install: vi.fn(async () => {}),
  remove: vi.fn(async () => {}),
  cancel: vi.fn(async () => {}),
  save: vi.fn(async () => true),
  settings: { visualizerHz: 60 },
}));

vi.mock("react-native", async () => (await import("@/__tests__/react-native-mock")).createReactNativeMock());
vi.mock("@/components/Icon", () => ({ Icon: () => <i /> }));
vi.mock("@/components/SectionTitle", () => ({ SectionTitle: ({ title }: { title: string }) => <h2>{title}</h2> }));
vi.mock("@/core/japanese", () => ({
  DICTIONARY_BYTES: 17_791_956,
  DICTIONARY_STORED_BYTES: 64_554_959,
  japaneseDictionary: { install: mocks.install, remove: mocks.remove, cancel: mocks.cancel },
}));
vi.mock("@/hooks/useJapaneseDictionary", () => ({ useJapaneseDictionary: () => mocks.snapshot }));
vi.mock("@/hooks/useStackedRows", () => ({ useStackedRows: () => false }));
vi.mock("@/hooks/useSaveSettings", () => ({ useSaveSettings: () => mocks.save }));
vi.mock("@/contexts/user/UserSettingsProvider", () => ({
  useUserSettings: () => ({ settings: mocks.settings }),
}));
vi.mock("@/components/Avatar", () => ({ Avatar: () => null }));
vi.mock("@/utils/haptics", () => ({ haptics: { tap: vi.fn(), warning: vi.fn(), select: vi.fn() } }));
vi.mock("@/hooks/useDict", () => ({
  useDict: () =>
    new Proxy({} as Record<string, string>, { get: (_target, key) => String(key) }),
}));

const dictionaryRow = () => screen.getByRole("button", { name: /SETTINGS_JP_DICTIONARY_ROW/ });

describe("ExperimentalSection", () => {
  beforeEach(() => {
    mocks.snapshot = { install: "none", progress: 0, reader: "idle", failure: null };
    mocks.settings = { visualizerHz: 60 };
    vi.clearAllMocks();
  });
  afterEach(cleanup);

  it("titles the group and has no pronunciation picker: that lives in the lyrics", () => {
    render(<ExperimentalSection />);
    expect(screen.getByText("SETTINGS_EXPERIMENTAL_TITLE")).toBeTruthy();
    expect(screen.getByRole("switch", { name: /SETTINGS_VISUALIZER_SWITCH/ })).toBeTruthy();
    expect(screen.getAllByRole("button")).toHaveLength(1);
  });

  it("turns the visualizer off and on again through the save helper", () => {
    render(<ExperimentalSection />);
    fireEvent.click(screen.getByRole("switch", { name: /SETTINGS_VISUALIZER_SWITCH/ }));
    expect(mocks.save).toHaveBeenLastCalledWith({ visualizerHz: 0 });
    cleanup();
    mocks.settings = { visualizerHz: 0 };
    render(<ExperimentalSection />);
    fireEvent.click(screen.getByRole("switch", { name: /SETTINGS_VISUALIZER_SWITCH/ }));
    expect(mocks.save).toHaveBeenLastCalledWith({ visualizerHz: 1 });
  });

  it("downloads the dictionary, showing its size, the action and the progress", () => {
    render(<ExperimentalSection />);
    expect(dictionaryRow().getAttribute("aria-label")).toContain("SETTINGS_JP_DICTIONARY_SIZE");
    expect(dictionaryRow().getAttribute("aria-label")).toContain("SETTINGS_JP_DICTIONARY_DOWNLOAD");
    expect(document.querySelector('[data-icon="chevron-right"]')).toBeNull();
    fireEvent.click(dictionaryRow());
    expect(mocks.install).toHaveBeenCalled();
    cleanup();
    mocks.snapshot = { install: "downloading", progress: 0.42, reader: "idle", failure: null };
    render(<ExperimentalSection />);
    expect(dictionaryRow().getAttribute("aria-label")).toContain("42% · SETTINGS_JP_DICTIONARY_CANCEL");
    expect(dictionaryRow().getAttribute("aria-valuetext")).toBe("42%");
  });

  it("asks before stopping a download", () => {
    mocks.snapshot = { install: "downloading", progress: 0.3, reader: "idle", failure: null };
    render(<ExperimentalSection />);
    fireEvent.click(dictionaryRow());
    const [title, , buttons] = vi.mocked(Alert.alert).mock.calls.at(-1)!;
    expect(title).toBe("SETTINGS_JP_DICTIONARY_STOP_TITLE");
    expect(buttons?.find((button) => button.style === "cancel")?.text).toBe("ACCOUNT_CANCEL");
    buttons?.find((button) => button.style === "destructive")?.onPress?.();
    expect(mocks.cancel).toHaveBeenCalled();
  });

  it("tells a full device from a failed network, and offers a retry for both", () => {
    mocks.snapshot = { install: "error", progress: 0, reader: "idle", failure: "space" };
    render(<ExperimentalSection />);
    expect(dictionaryRow().getAttribute("aria-label")).toContain("SETTINGS_JP_DICTIONARY_NO_SPACE");
    expect(dictionaryRow().getAttribute("aria-label")).toContain("SETTINGS_JP_DICTIONARY_RETRY");
    cleanup();
    mocks.snapshot = { install: "error", progress: 0, reader: "idle", failure: "network" };
    render(<ExperimentalSection />);
    expect(dictionaryRow().getAttribute("aria-label")).toContain("SETTINGS_JP_DICTIONARY_FAILED");
    fireEvent.click(dictionaryRow());
    expect(mocks.install).toHaveBeenCalled();
  });

  it("asks before removing an installed dictionary", () => {
    mocks.snapshot = { install: "installed", progress: 1, reader: "ready", failure: null };
    render(<ExperimentalSection />);
    expect(dictionaryRow().getAttribute("aria-label")).toContain("SETTINGS_JP_DICTIONARY_INSTALLED");
    fireEvent.click(dictionaryRow());
    expect(mocks.install).not.toHaveBeenCalled();
    const [, , buttons] = vi.mocked(Alert.alert).mock.calls.at(-1)!;
    expect(buttons?.find((button) => button.style === "cancel")?.text).toBe("ACCOUNT_CANCEL");
    buttons?.find((button) => button.style === "destructive")?.onPress?.();
    expect(mocks.remove).toHaveBeenCalled();
  });
});
