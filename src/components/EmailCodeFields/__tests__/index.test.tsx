// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { EmailCodeFields } from "@/components/EmailCodeFields";
import type { EmailCodeFlow } from "@/hooks/useEmailCodeFlow";

vi.mock("react-native", async () =>
  (await import("@/__tests__/react-native-mock")).createReactNativeMock(),
);
vi.mock("react-native-keyboard-controller", async () =>
  (await import("@/__tests__/keyboard-controller-mock")).createKeyboardControllerMock(),
);
vi.mock("@react-native-vector-icons/material-icons/static", async () =>
  (await import("@/__tests__/react-native-mock")).createIconMock(),
);
vi.mock("@/utils/keyboard", () => ({ focusWithKeyboard: vi.fn() }));
vi.mock("@/hooks/useDict", () => ({
  useDict: () => ({
    A11Y_CLEAR_INPUT: "Clear",
    A11Y_EMAIL_CODE_CHANGE: "Change email address",
    EMAIL_CODE_CHANGE: "Change",
    EMAIL_CODE_INSTRUCTION: "Enter the 4-digit code from your email.",
    LOGIN_EMAIL: "Email",
    LOGIN_EMAIL_PLACEHOLDER: "you@example.com",
    LOGIN_SEND_CODE: "Send code",
    LOGIN_CODE: "Code",
  }),
}));

function makeFlow(overrides: Partial<EmailCodeFlow> = {}): EmailCodeFlow {
  return {
    step: "email",
    email: "",
    setEmail: vi.fn(),
    code: "",
    setCode: vi.fn(),
    busy: false,
    error: null,
    setError: vi.fn(),
    sendCode: vi.fn(async () => undefined),
    verify: vi.fn(async () => undefined),
    backToEmail: vi.fn(),
    reset: vi.fn(),
    ...overrides,
  };
}

describe("EmailCodeFields", () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(cleanup);

  it("renders the email field and no address row on the email step", () => {
    render(<EmailCodeFields flow={makeFlow()} />);
    expect(screen.getByRole("textbox", { name: "Email" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Change email address" })).toBeNull();
  });

  it("keeps the address on the code step, read-only, ahead of the code boxes", () => {
    render(
      <EmailCodeFields flow={makeFlow({ step: "code", email: " me@example.com " })} />,
    );
    const address = screen.getByText("me@example.com");
    const code = screen.getByRole("textbox", { name: "Code" });
    expect(screen.queryByRole("textbox", { name: "Email" })).toBeNull();
    expect(
      address.compareDocumentPosition(code) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    // One label for the code field: the instruction, not "Code" on top of it.
    expect(screen.getByText("Enter the 4-digit code from your email.")).toBeTruthy();
    expect(screen.queryByText("Code")).toBeNull();
  });

  it("goes back to the email step from Change, unless a request is running", () => {
    const flow = makeFlow({ step: "code", email: "me@example.com" });
    const { rerender } = render(<EmailCodeFields flow={flow} />);
    fireEvent.click(screen.getByRole("button", { name: "Change email address" }));
    expect(flow.backToEmail).toHaveBeenCalledTimes(1);

    const busy = { ...flow, busy: true };
    rerender(<EmailCodeFields flow={busy} />);
    fireEvent.click(screen.getByRole("button", { name: "Change email address" }));
    expect(flow.backToEmail).toHaveBeenCalledTimes(1);
  });

  it("keeps the code input editable while busy (the busy flag guards typing)", () => {
    render(
      <EmailCodeFields flow={makeFlow({ step: "code", email: "a@b.co", busy: true })} />,
    );
    const input = screen.getByRole("textbox", { name: "Code" }) as HTMLInputElement;
    expect(input.disabled).toBe(false);
  });

  it("submits once when the fourth digit lands, and re-arms on edit", () => {
    const flow = makeFlow({ step: "code", email: "a@b.co", code: "123" });
    const { rerender } = render(<EmailCodeFields flow={flow} />);
    expect(flow.verify).not.toHaveBeenCalled();

    rerender(<EmailCodeFields flow={{ ...flow, code: "1234" }} />);
    expect(flow.verify).toHaveBeenCalledTimes(1);
    rerender(<EmailCodeFields flow={{ ...flow, code: "1234" }} />);
    expect(flow.verify).toHaveBeenCalledTimes(1);

    rerender(<EmailCodeFields flow={{ ...flow, code: "123" }} />);
    rerender(<EmailCodeFields flow={{ ...flow, code: "1235" }} />);
    expect(flow.verify).toHaveBeenCalledTimes(2);
  });
});
