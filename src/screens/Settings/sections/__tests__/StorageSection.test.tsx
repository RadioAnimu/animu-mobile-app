// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { StorageSection } from "@/screens/Settings/sections/StorageSection";

const mocks = vi.hoisted(() => ({
  storage: {} as Record<string, unknown>,
  wiping: false,
  measure: vi.fn(async () => null),
}));

vi.mock("react-native", async () => (await import("@/__tests__/react-native-mock")).createReactNativeMock());
vi.mock("@/components/Icon", () => ({ Icon: ({ name }: { name: string }) => <i data-icon={name} /> }));
vi.mock("@/components/SectionTitle", () => ({ SectionTitle: ({ title }: { title: string }) => <h2>{title}</h2> }));
vi.mock("@/hooks/useStackedRows", () => ({ useStackedRows: () => false }));
vi.mock("@/components/Avatar", () => ({ Avatar: () => null }));
vi.mock("@/utils/haptics", () => ({ haptics: { tap: vi.fn(), warning: vi.fn(), select: vi.fn(), error: vi.fn() } }));
vi.mock("@/hooks/useDict", () => ({
  useDict: () =>
    new Proxy({} as Record<string, string>, { get: (_target, key) => String(key) }),
}));
vi.mock("@/contexts/user/UserSettingsProvider", () => ({
  useUserSettings: () => ({ settings: { cacheEnabled: true } }),
}));
vi.mock("@/hooks/useSaveSettings", () => ({ useSaveSettings: () => vi.fn() }));
vi.mock("@/hooks/useCoverDisk", () => ({
  useCoverDiskClearing: () => mocks.wiping,
  useFreedCoverToast: () => vi.fn(),
}));
vi.mock("@/hooks/useCoverStorage", () => ({
  useCoverStorageSnapshot: () => ({ measure: mocks.measure, ...mocks.storage }),
}));

const storageRow = () => screen.getByRole("button", { name: /STORAGE_TITLE/ });
const MB = 1024 * 1024;

describe("StorageSection", () => {
  beforeEach(() => {
    mocks.wiping = false;
    mocks.storage = { snapshot: { totalBytes: 3.9 * MB }, measuring: false, failed: false };
  });
  afterEach(cleanup);

  it("shows the measured total", () => {
    render(<StorageSection onOpenStorage={vi.fn()} />);
    expect(storageRow().getAttribute("aria-label")).toBe("STORAGE_TITLE, 3NUMBER_DECIMAL_SEPARATOR9 MB");
  });

  it("keeps the last total while measuring again, and a placeholder before the first", () => {
    mocks.storage = { snapshot: { totalBytes: 12 * MB }, measuring: true, failed: false };
    render(<StorageSection onOpenStorage={vi.fn()} />);
    expect(storageRow().getAttribute("aria-label")).toContain("12 MB");
    cleanup();
    mocks.storage = { snapshot: null, measuring: true, failed: false };
    render(<StorageSection onOpenStorage={vi.fn()} />);
    expect(storageRow().getAttribute("aria-label")).toContain("SETTINGS_VALUE_LOADING");
  });

  it("shows a dash, not 0 MB, when the measurement failed", () => {
    mocks.storage = { snapshot: null, measuring: false, failed: true };
    render(<StorageSection onOpenStorage={vi.fn()} />);
    expect(screen.getByText("—")).toBeTruthy();
    expect(storageRow().getAttribute("aria-label")).toContain("SETTINGS_VALUE_FAILED");
  });

  it("says the wipe is running while it is", () => {
    mocks.wiping = true;
    render(<StorageSection onOpenStorage={vi.fn()} />);
    expect(storageRow().getAttribute("aria-label")).toContain("SETTINGS_STORAGE_CLEANING");
  });
});
