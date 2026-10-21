// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ConnectActions } from "@/components/ConnectActions";

vi.mock("react-native", async () =>
  (await import("@/__tests__/react-native-mock")).createReactNativeMock(),
);
vi.mock("@/hooks/useDict", () => ({
  useDict: () => ({
    LOGIN_CODE_RESEND: "Resend code",
    LOGIN_CODE_RESEND_IN: "Resend in {seconds}s",
  }),
}));
vi.mock("@/utils/haptics", () => ({ haptics: { tap: vi.fn() } }));

describe("ConnectActions", () => {
  afterEach(cleanup);

  it("offers only resend: changing the address lives on the email row", () => {
    render(<ConnectActions busy={false} resendRemaining={0} onResend={vi.fn()} />);
    expect(screen.getAllByRole("button")).toHaveLength(1);
    expect(screen.getByRole("button").textContent).toBe("Resend code");
  });

  it("resends when available", () => {
    const onResend = vi.fn();
    render(<ConnectActions busy={false} resendRemaining={0} onResend={onResend} />);
    fireEvent.click(screen.getByRole("button"));
    expect(onResend).toHaveBeenCalledTimes(1);
  });

  it("shows the countdown and locks while it runs", () => {
    const onResend = vi.fn();
    render(<ConnectActions busy={false} resendRemaining={7} onResend={onResend} />);
    const button = screen.getByRole("button");
    expect(button.textContent).toBe("Resend in 7s");
    fireEvent.click(button);
    expect(onResend).not.toHaveBeenCalled();
  });

  it("locks while a send or verify is in flight", () => {
    const onResend = vi.fn();
    render(<ConnectActions busy resendRemaining={0} onResend={onResend} />);
    fireEvent.click(screen.getByRole("button"));
    expect(onResend).not.toHaveBeenCalled();
  });
});
