// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { Alert } from "react-native";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ResetSection } from "@/screens/Settings/sections/ResetSection";

const mocks = vi.hoisted(() => ({
  resetSettings: vi.fn(async () => true),
  toast: vi.fn(),
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
  useUserSettings: () => ({ resetSettings: mocks.resetSettings }),
}));
vi.mock("@/contexts/alert/AlertProvider", () => ({
  useAlert: () => ({ toast: mocks.toast }),
}));

const confirmReset = async () => {
  render(<ResetSection />);
  fireEvent.click(screen.getByRole("button", { name: /SETTINGS_RESET_ROW/ }));
  const [, , buttons] = vi.mocked(Alert.alert).mock.calls.at(-1)!;
  buttons?.find((button) => button.style === "destructive")?.onPress?.();
  await vi.waitFor(() => expect(mocks.resetSettings).toHaveBeenCalled());
};

describe("ResetSection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.resetSettings.mockResolvedValue(true);
  });
  afterEach(cleanup);

  it("confirms first, then resets and says so", async () => {
    render(<ResetSection />);
    fireEvent.click(screen.getByRole("button", { name: /SETTINGS_RESET_ROW/ }));
    expect(mocks.resetSettings).not.toHaveBeenCalled();
    cleanup();

    await confirmReset();
    await vi.waitFor(() => expect(mocks.toast).toHaveBeenCalledWith("SETTINGS_RESET_TOAST"));
  });

  it("reports a reset that could not be saved", async () => {
    mocks.resetSettings.mockResolvedValue(false);
    await confirmReset();
    await vi.waitFor(() =>
      expect(mocks.toast).toHaveBeenCalledWith("SETTINGS_SAVE_FAILED", "error"),
    );
  });
});
