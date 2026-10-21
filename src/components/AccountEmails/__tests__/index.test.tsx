// @vitest-environment jsdom
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { AccessibilityInfo, Alert, Animated } from "react-native";
import type { AuthAccountEmail, LinkedProvider } from "animu-api";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AccountEmails } from "@/components/AccountEmails";
import { isAppleRelayEmail } from "@/components/AccountEmails/relay-email";

vi.mock("react-native", async () =>
  (await import("@/__tests__/react-native-mock")).createReactNativeMock(),
);
vi.mock("react-native-keyboard-controller", async () =>
  (await import("@/__tests__/keyboard-controller-mock")).createKeyboardControllerMock(),
);
vi.mock("@react-native-vector-icons/material-icons/static", async () =>
  (await import("@/__tests__/react-native-mock")).createIconMock(),
);

const mocks = vi.hoisted(() => ({
  auth: {} as Record<string, unknown>,
  toast: vi.fn(),
  showError: vi.fn(),
  flow: {} as Record<string, unknown>,
  flowOptions: {} as Record<string, (...args: never[]) => unknown>,
  haptics: { success: vi.fn(), tap: vi.fn() },
  resendStart: vi.fn(),
  resendRemaining: 0,
}));

vi.mock("@/contexts/auth/AuthProvider", () => ({ useAuth: () => mocks.auth }));
vi.mock("@/contexts/alert/AlertProvider", () => ({
  useAlert: () => ({ toast: mocks.toast, error: mocks.showError }),
}));
vi.mock("@/hooks/useDict", () => ({
  useDict: () => ({
    ACCOUNT_SHOW: "Show",
    ACCOUNT_HIDE: "Hide",
    ACCOUNT_EMAIL_REMOVE: "Remove",
    ACCOUNT_EMAIL_EMPTY: "No emails yet",
    ACCOUNT_EMAIL_EXTRA_DESC: "Animu Connect",
    ACCOUNT_ANIMU_CONNECT_DESC: "Connect pitch",
    ACCOUNT_ANIMU_CONNECT_FORM_HINT: "Add an address",
    ACCOUNT_EMAIL_ADD: "Add extra email",
    ACCOUNT_EMAIL_ADD_DESC: "One more address you can sign in with",
    ACCOUNT_EMAIL_PROVIDER_HINT: "Provider emails are automatic",
    ACCOUNT_EMAIL_EXTRA_LIMIT: "Only one extra email",
    ACCOUNT_EMAIL_RELAY: "Apple Hide My Email",
    ACCOUNT_EMAIL_CODE_VALIDITY: "Single use, expires in {minutes} minutes",
    ACCOUNT_EMAIL_REMOVE_CONFIRM_TITLE: "Remove email?",
    ACCOUNT_EMAIL_REMOVE_CONFIRM_MSG: "Remove {email} from your account",
    ACCOUNT_CANCEL: "Cancel",
    ACCOUNT_EMAIL_REMOVED: "Removed",
    ACCOUNT_EMAIL_SAVED: "Saved",
    ACCOUNT_EMAIL_TAKEN: "Taken",
    ACCOUNT_ACTION_FAILED: "Action failed",
    LOGIN_EMAIL_INVALID: "Not an email",
    LOGIN_CODE_SENT: "Code sent",
    EMAIL_CODE_STEP: "Step {step} of {total} · {label}",
    EMAIL_CODE_STEP_EMAIL: "Enter email",
    EMAIL_CODE_STEP_CODE: "Enter code",
    A11Y_EMAIL_CODE_STEP_EMAIL: "Step 1 of 2. Enter your email address.",
    A11Y_EMAIL_CODE_STEP_CODE: "Step 2 of 2. Enter the 4-digit code.",
  }),
}));
vi.mock("@/hooks/useEmailCodeFlow", () => ({
  useEmailCodeFlow: (
    options: Record<string, (...args: never[]) => unknown>,
  ) => {
    mocks.flowOptions = options;
    return mocks.flow;
  },
  emailCodeError: (
    _dict: unknown,
    error: { code?: string },
    fallback: string,
    options?: { invalid?: string },
  ) => (error.code === "invalid_request" && options?.invalid) || fallback,
}));
vi.mock("@/hooks/useResendCooldown", () => ({
  useResendCooldown: () => ({
    remaining: mocks.resendRemaining,
    start: mocks.resendStart,
  }),
}));
vi.mock("@/utils/haptics", () => ({ haptics: mocks.haptics }));
vi.mock("@/constants/auth", () => ({
  providerLabel: (name: string) => `label:${name}`,
}));
vi.mock("@/components/MaskedValue", () => ({
  MaskedValue: ({
    value,
    mask,
  }: {
    value: string;
    mask: (v: string) => string;
  }) => (
    <span data-testid="masked" data-real={value}>
      {mask(value)}
    </span>
  ),
}));
vi.mock("@/components/ProviderIcon", () => ({
  ProviderIcon: ({ provider }: { provider: string }) => (
    <i data-testid="mark" data-provider={provider} />
  ),
}));
vi.mock("@/components/EmailCodeFields", () => ({
  EmailCodeFields: ({ autoFocusEmail }: { autoFocusEmail?: boolean }) => (
    <div
      data-testid="code-fields"
      data-autofocus={String(!!autoFocusEmail)}
    />
  ),
}));
vi.mock("@/components/FormError", () => ({
  FormError: ({ message }: { message: string }) => (
    <p role="alert">{message}</p>
  ),
}));
vi.mock("@/components/ConnectActions", () => ({
  ConnectActions: ({
    busy,
    resendRemaining,
    onResend,
  }: {
    busy: boolean;
    resendRemaining: number;
    onResend: () => void;
  }) => (
    <div data-testid="connect-actions" data-busy={String(busy)}>
      <button onClick={onResend}>resend {resendRemaining}</button>
    </div>
  ),
}));

const row = (overrides: Partial<AuthAccountEmail>): AuthAccountEmail =>
  ({
    id: 1,
    email: "ana@example.com",
    provider: "google",
    source: "google",
    removable: false,
    ...overrides,
  }) as AuthAccountEmail;

function setAuth(
  emails: AuthAccountEmail[],
  extra: {
    linkedProviders?: LinkedProvider[];
    providers?: string[];
    refreshEmails?: () => Promise<void>;
    removeEmail?: (id: number) => Promise<void>;
  } = {},
) {
  mocks.auth = {
    emails,
    profile: { linkedProviders: extra.linkedProviders ?? [] },
    providers: (extra.providers ?? ["google", "apple", "discord"]).map(
      (name) => ({
        name,
      }),
    ),
    refreshEmails: extra.refreshEmails ?? vi.fn().mockResolvedValue(undefined),
    requestAddEmail: vi.fn(),
    verifyAddEmail: vi.fn(),
    removeEmail: extra.removeEmail ?? vi.fn().mockResolvedValue(undefined),
  };
}

const marksIn = (container: HTMLElement) =>
  within(container)
    .queryAllByTestId("mark")
    .map((mark) => mark.getAttribute("data-provider"));

/** The grouped row (mask + provider marks) of a given address. */
const rowOf = (email: string): HTMLElement =>
  screen
    .getAllByTestId("masked")
    .find((node) => node.getAttribute("data-real") === email)!.parentElement!
    .parentElement!;

async function renderLoaded() {
  const view = render(<AccountEmails />);
  // Let the mount-time refreshEmails() promise settle.
  await act(async () => undefined);
  return view;
}

/** Opens the collapsed add-email form (the card's "Add extra email" row). */
function expandAddForm() {
  fireEvent.click(screen.getByRole("button", { name: /^Add extra email/ }));
}

describe("AccountEmails", () => {
  beforeEach(() => {
    mocks.flow = {
      step: "email",
      email: "",
      error: null,
      busy: false,
      sendCode: vi.fn(),
      verify: vi.fn(),
      backToEmail: vi.fn(),
      reset: vi.fn(),
      setError: vi.fn(),
    };
    mocks.resendRemaining = 0;
    setAuth([]);
  });
  afterEach(cleanup);

  describe("loading", () => {
    it("shows a spinner instead of the empty notice until emails are fetched", async () => {
      let done: () => void = () => undefined;
      setAuth([], {
        refreshEmails: () => new Promise<void>((res) => (done = res)),
      });
      render(<AccountEmails />);
      expect(screen.getByRole("progressbar")).toBeTruthy();
      expect(screen.queryByText("No emails yet")).toBeNull();

      await act(async () => done());
      expect(screen.queryByRole("progressbar")).toBeNull();
      expect(screen.getByText("No emails yet")).toBeTruthy();
    });

    it("keeps an already-known list visible while refreshing", () => {
      setAuth([row({})], {
        refreshEmails: () => new Promise<void>(() => undefined),
      });
      render(<AccountEmails />);
      expect(screen.queryByRole("progressbar")).toBeNull();
      expect(screen.getByTestId("masked").getAttribute("data-real")).toBe(
        "ana@example.com",
      );
    });
  });

  describe("grouping", () => {
    it("shows one row per address, merging case-insensitive duplicates", async () => {
      setAuth([
        row({ id: 1, email: "Ana@Example.com", provider: "apple" }),
        row({ id: 2, email: "ana@example.com", provider: "google" }),
        row({ id: 3, email: "bob@example.com", provider: "discord" }),
      ]);
      await renderLoaded();
      const addresses = screen
        .getAllByTestId("masked")
        .map((node) => node.getAttribute("data-real"));
      // First spelling wins; the duplicate does not get its own row.
      expect(addresses).toEqual(["Ana@Example.com", "bob@example.com"]);
    });

    it("lists each provider once, in the available-provider order", async () => {
      setAuth(
        [
          row({ id: 1, provider: "apple" }),
          row({ id: 2, provider: "discord" }),
          row({ id: 3, provider: "google" }),
          row({ id: 4, provider: "google" }),
        ],
        { providers: ["google", "apple", "discord"] },
      );
      await renderLoaded();
      expect(marksIn(rowOf("ana@example.com"))).toEqual([
        "google",
        "apple",
        "discord",
      ]);
      expect(screen.getByText("label:google")).toBeTruthy();
    });

    it("sorts providers missing from the available list last", async () => {
      setAuth(
        [
          row({ id: 1, provider: "discord" }),
          row({ id: 2, provider: "google" }),
        ],
        { providers: ["google"] },
      );
      await renderLoaded();
      expect(marksIn(rowOf("ana@example.com"))).toEqual(["google", "discord"]);
    });

    it("adds linked providers whose providerEmail matches (trim + case)", async () => {
      setAuth([row({ provider: "google" })], {
        linkedProviders: [
          { provider: "apple", providerEmail: "  ANA@example.com " },
          { provider: "discord", providerEmail: "other@example.com" },
          { provider: "google", providerEmail: "ana@example.com" },
          { provider: "apple" },
        ] as LinkedProvider[],
      });
      await renderLoaded();
      // apple added once (not duplicated by the no-email apple entry), google
      // not duplicated, discord (different address) absent.
      expect(marksIn(rowOf("ana@example.com"))).toEqual(["google", "apple"]);
    });

    it("keeps a removable row's delete when a later row for the address is not removable", async () => {
      setAuth([
        row({ id: 10, provider: "google", removable: true }),
        row({ id: 11, provider: "apple", removable: false }),
      ]);
      await renderLoaded();
      fireEvent.click(screen.getByRole("button", { name: /^Remove / }));
      expect(vi.mocked(Alert.alert).mock.calls[0][1]).toContain(
        "ana@example.com",
      );
    });

    it("uses the last removable row of the address as the delete target", async () => {
      const removeEmail = vi.fn().mockResolvedValue(undefined);
      setAuth(
        [
          row({ id: 20, provider: "google", removable: true }),
          row({ id: 21, provider: "apple", removable: true }),
        ],
        { removeEmail },
      );
      await renderLoaded();
      fireEvent.click(screen.getByRole("button", { name: /^Remove / }));
      const buttons = vi.mocked(Alert.alert).mock.calls[0][2]!;
      await act(async () => buttons[1].onPress?.());
      expect(removeEmail).toHaveBeenCalledWith(21);
    });
  });

  describe("extra (Animu Connect) address", () => {
    const extra = row({
      id: 30,
      email: "me@animu.test",
      provider: undefined,
      source: "animu",
      removable: true,
    });

    it("captions it with Animu Connect and hides the add action", async () => {
      setAuth([extra]);
      await renderLoaded();
      expect(screen.getByText("Animu Connect")).toBeTruthy();
      expect(marksIn(rowOf("me@animu.test"))).toEqual([]);
      expect(
        screen.queryByRole("button", { name: /^Add extra email/ }),
      ).toBeNull();
      expect(screen.queryByTestId("code-fields")).toBeNull();
    });

    it("offers the add action while no extra address exists", async () => {
      setAuth([row({})]);
      await renderLoaded();
      expect(
        screen.getByRole("button", { name: /^Add extra email/ }),
      ).toBeTruthy();
      // Collapsed: the form itself is not in the card yet.
      expect(screen.queryByTestId("code-fields")).toBeNull();
    });

    it("spells out the one-extra rule once an extra address exists", async () => {
      setAuth([extra, row({})]);
      await renderLoaded();
      expect(screen.getByText("Only one extra email")).toBeTruthy();
    });
  });

  describe("provider hint footnote", () => {
    const extra = row({
      id: 30,
      email: "me@animu.test",
      provider: undefined,
      source: "animu",
      removable: true,
    });

    it("explains why a provider address has no delete", async () => {
      setAuth([row({})]);
      await renderLoaded();
      expect(screen.getByText("Provider emails are automatic")).toBeTruthy();
    });

    it("stays away when every address is the user's own extra one", async () => {
      setAuth([extra]);
      await renderLoaded();
      expect(screen.queryByText("Provider emails are automatic")).toBeNull();
    });
  });

  describe("Apple Hide My Email relay", () => {
    it("warns that a relay address can't receive codes", async () => {
      setAuth([row({ email: "abc123@privaterelay.appleid.com" })]);
      await renderLoaded();
      expect(screen.getByText("Apple Hide My Email")).toBeTruthy();
    });

    it("leaves a normal address without the warning", async () => {
      setAuth([row({})]);
      await renderLoaded();
      expect(screen.queryByText("Apple Hide My Email")).toBeNull();
    });
  });

  describe("empty list", () => {
    it("shows the empty notice together with the add action", async () => {
      await renderLoaded();
      expect(screen.getByText("No emails yet")).toBeTruthy();
      expect(
        screen.getByRole("button", { name: /^Add extra email/ }),
      ).toBeTruthy();
    });
  });

  describe("removal", () => {
    const removable = row({
      id: 40,
      email: "ana@example.com",
      removable: true,
    });

    it("masks the address in the delete button's accessible name", async () => {
      setAuth([removable]);
      await renderLoaded();
      const button = screen.getByRole("button", {
        name: "Remove an•••@example.com",
      });
      expect(button).toBeTruthy();
      expect(button.getAttribute("aria-label")).not.toContain("ana@");
    });

    it("has no delete button for non-removable rows", async () => {
      setAuth([row({})]);
      await renderLoaded();
      expect(screen.queryByRole("button", { name: /^Remove/ })).toBeNull();
    });

    it("asks for confirmation, then removes and toasts", async () => {
      const removeEmail = vi.fn().mockResolvedValue(undefined);
      setAuth([removable], { removeEmail });
      await renderLoaded();

      fireEvent.click(screen.getByRole("button", { name: /^Remove / }));
      expect(Alert.alert).toHaveBeenCalledTimes(1);
      const [title, message, buttons] = vi.mocked(Alert.alert).mock.calls[0];
      expect(title).toBe("Remove email?");
      expect(message).toBe("Remove ana@example.com from your account");
      expect(buttons?.map((b) => b.style)).toEqual(["cancel", "destructive"]);
      expect(removeEmail).not.toHaveBeenCalled();

      await act(async () => buttons![1].onPress?.());
      expect(removeEmail).toHaveBeenCalledWith(40);
      expect(mocks.toast).toHaveBeenCalledWith("Removed");
      expect(mocks.showError).not.toHaveBeenCalled();
    });

    it("reports a failed removal and re-enables the delete button", async () => {
      const errorSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => undefined);
      const removeEmail = vi.fn().mockRejectedValue(new Error("nope"));
      setAuth([removable], { removeEmail });
      await renderLoaded();

      fireEvent.click(screen.getByRole("button", { name: /^Remove / }));
      const buttons = vi.mocked(Alert.alert).mock.calls[0][2]!;
      await act(async () => buttons[1].onPress?.());

      expect(mocks.showError).toHaveBeenCalledWith("Action failed");
      expect(mocks.toast).not.toHaveBeenCalled();
      expect(
        screen
          .getByRole("button", { name: /^Remove / })
          .getAttribute("aria-disabled"),
      ).toBeNull();
      errorSpy.mockRestore();
    });

    it("disables the delete while the add flow is busy", async () => {
      setAuth([removable]);
      mocks.flow = { ...mocks.flow, busy: true };
      await renderLoaded();
      const button = screen.getByRole("button", { name: /^Remove / });
      expect(button.getAttribute("aria-disabled")).toBe("true");
      fireEvent.click(button);
      expect(Alert.alert).not.toHaveBeenCalled();
    });
  });

  describe("add form", () => {
    it("refreshes the emails on mount", async () => {
      await renderLoaded();
      expect(mocks.auth.refreshEmails).toHaveBeenCalledTimes(1);
    });

    it("keeps the form behind the add row until the row is tapped", async () => {
      setAuth([row({})]);
      await renderLoaded();
      const addRow = screen.getByRole("button", { name: /^Add extra email/ });
      expect(addRow.getAttribute("aria-label")).toBe(
        "Add extra email, One more address you can sign in with",
      );
      expect(screen.queryByText("Add an address")).toBeNull();
      expect(screen.queryByTestId("code-fields")).toBeNull();
    });

    it("reveals the hint, the auto-focused field and Cancel on tap", async () => {
      setAuth([row({})]);
      await renderLoaded();
      expandAddForm();
      // Opening the form is a deliberate tap, so it gets the tap haptic.
      expect(mocks.haptics.tap).toHaveBeenCalledTimes(1);
      // The user asked to add an address, so the field may open its keyboard.
      expect(
        screen.getByTestId("code-fields").getAttribute("data-autofocus"),
      ).toBe("true");
      expect(screen.getByText("Add an address")).toBeTruthy();
      expect(screen.getByRole("button", { name: "Cancel" })).toBeTruthy();
      // The row gives way to the form it opened.
      expect(
        screen.queryByRole("button", { name: /^Add extra email/ }),
      ).toBeNull();
    });

    it("collapses the form and resets the flow on Cancel", async () => {
      setAuth([row({})]);
      await renderLoaded();
      expandAddForm();

      fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
      expect(mocks.flow.reset).toHaveBeenCalledTimes(1);
      expect(screen.queryByTestId("code-fields")).toBeNull();
      expect(
        screen.getByRole("button", { name: /^Add extra email/ }),
      ).toBeTruthy();
    });

    it("collapses the form once the address is verified", async () => {
      setAuth([row({})]);
      await renderLoaded();
      expandAddForm();
      expect(screen.getByTestId("code-fields")).toBeTruthy();

      act(() => void mocks.flowOptions.onVerified());
      expect(screen.queryByTestId("code-fields")).toBeNull();
      expect(
        screen.getByRole("button", { name: /^Add extra email/ }),
      ).toBeTruthy();
    });

    it("shows the flow error without a spinner on the email step (the button owns it)", async () => {
      setAuth([row({})]);
      mocks.flow = { ...mocks.flow, error: "Bad address", busy: true };
      await renderLoaded();
      expandAddForm();
      expect(screen.getByRole("alert").textContent).toBe("Bad address");
      expect(screen.queryByRole("progressbar")).toBeNull();
    });

    it("shows a spinner on the code step while busy", async () => {
      setAuth([row({})]);
      mocks.flow = { ...mocks.flow, step: "code", busy: true };
      await renderLoaded();
      expandAddForm();
      expect(screen.getByRole("progressbar")).toBeTruthy();
    });

    it("keeps the hint and wires resend on the code step, with Cancel still there", async () => {
      setAuth([row({})]);
      mocks.flow = { ...mocks.flow, step: "code", email: "  new@example.com " };
      mocks.resendRemaining = 12;
      await renderLoaded();
      expandAddForm();
      // The code step is the same form: nothing is swapped for a new sentence.
      expect(screen.getByText("Add an address")).toBeTruthy();
      expect(screen.getByRole("button", { name: "Cancel" })).toBeTruthy();

      fireEvent.click(screen.getByText("resend 12"));
      expect(mocks.flow.sendCode).toHaveBeenCalledTimes(1);
      // Changing the address is the email row's job now, not these actions'.
      expect(screen.queryByText("change email")).toBeNull();
    });

    it("shows the step indicator above the fields on both steps", async () => {
      setAuth([row({})]);
      const { rerender } = await renderLoaded();
      expandAddForm();
      const indicator = screen.getByText("Step 1 of 2 · Enter email");
      expect(
        indicator.compareDocumentPosition(screen.getByTestId("code-fields")) &
          Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();

      mocks.flow = { ...mocks.flow, step: "code", email: "new@example.com" };
      rerender(<AccountEmails />);
      expect(screen.getByText("Step 2 of 2 · Enter code")).toBeTruthy();
      expect(screen.queryByText("Step 1 of 2 · Enter email")).toBeNull();
      expect(screen.getByText("Add an address")).toBeTruthy();
    });

    it("announces a real step change once, and fades the body in", async () => {
      setAuth([row({})]);
      const announce = vi.mocked(AccessibilityInfo.announceForAccessibility);
      const timing = vi.mocked(Animated.timing);
      const { rerender } = await renderLoaded();
      expandAddForm();
      announce.mockClear();
      timing.mockClear();
      expect(announce).not.toHaveBeenCalled();

      mocks.flow = { ...mocks.flow, step: "code", email: "new@example.com" };
      rerender(<AccountEmails />);
      expect(announce).toHaveBeenCalledTimes(1);
      expect(announce).toHaveBeenLastCalledWith(
        "Step 2 of 2. Enter the 4-digit code.",
      );
      expect(timing).toHaveBeenCalledTimes(1);

      // A countdown tick / resend re-renders on the same step: silent.
      mocks.resendRemaining = 9;
      rerender(<AccountEmails />);
      expect(announce).toHaveBeenCalledTimes(1);
      expect(timing).toHaveBeenCalledTimes(1);

      mocks.flow = { ...mocks.flow, step: "email" };
      rerender(<AccountEmails />);
      expect(announce).toHaveBeenCalledTimes(2);
      expect(announce).toHaveBeenLastCalledWith(
        "Step 1 of 2. Enter your email address.",
      );
    });

    it("shows the code's validity window on the code step", async () => {
      setAuth([row({})]);
      mocks.flow = { ...mocks.flow, step: "code", email: "new@example.com" };
      await renderLoaded();
      expandAddForm();
      expect(screen.getByText("Single use, expires in 10 minutes")).toBeTruthy();
    });

    it("does not render the code-step actions on the email step", async () => {
      setAuth([row({})]);
      await renderLoaded();
      expandAddForm();
      expect(screen.queryByTestId("connect-actions")).toBeNull();
      expect(
        screen.queryByText("Single use, expires in 10 minutes"),
      ).toBeNull();
    });

    it("starts the resend cooldown and toasts when a code is sent", async () => {
      await renderLoaded();
      act(() => void mocks.flowOptions.onCodeSent());
      expect(mocks.resendStart).toHaveBeenCalledTimes(1);
      expect(mocks.toast).toHaveBeenCalledWith("Code sent");
    });

    it("celebrates a verified address with haptics and a toast", async () => {
      await renderLoaded();
      act(() => void mocks.flowOptions.onVerified());
      expect(mocks.haptics.success).toHaveBeenCalledTimes(1);
      expect(mocks.toast).toHaveBeenCalledWith("Saved");
    });

    it("says a malformed address is not an email, on the code request only", async () => {
      await renderLoaded();
      const invalid = { code: "invalid_request" } as never;
      expect(mocks.flowOptions.mapRequestError(invalid)).toBe("Not an email");
      expect(mocks.flowOptions.mapVerifyError(invalid)).toBe("Action failed");
    });

    it("maps flow errors to the generic failure message", async () => {
      await renderLoaded();
      expect(mocks.flowOptions.mapRequestError(new Error("x") as never)).toBe(
        "Action failed",
      );
      expect(mocks.flowOptions.mapVerifyError(new Error("x") as never)).toBe(
        "Action failed",
      );
    });
  });

  describe("isAppleRelayEmail", () => {
    it("matches Apple's Hide My Email relay domain", () => {
      expect(isAppleRelayEmail("abc123@privaterelay.appleid.com")).toBe(true);
    });

    it("matches the domain case-insensitively and past the local part's @", () => {
      expect(isAppleRelayEmail("A.B+tag@PRIVATERELAY.AppleID.com")).toBe(true);
      // The last @ is the separator, so a relay address can't be spoofed by a
      // local part that merely looks like the domain.
      expect(isAppleRelayEmail("privaterelay.appleid.com@example.com")).toBe(
        false,
      );
    });

    it("rejects anything else", () => {
      expect(isAppleRelayEmail("ana@example.com")).toBe(false);
      expect(isAppleRelayEmail("ana@appleid.com")).toBe(false);
      expect(isAppleRelayEmail("ana@notprivaterelay.appleid.com.evil.test")).toBe(
        false,
      );
      // Not an address at all.
      expect(isAppleRelayEmail("privaterelay.appleid.com")).toBe(false);
      expect(isAppleRelayEmail("")).toBe(false);
    });
  });
});
