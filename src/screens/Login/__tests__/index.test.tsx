// @vitest-environment jsdom
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { AccessibilityInfo, Animated, BackHandler } from "react-native";
import { useEffect, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AnimuApiError } from "animu-api";

import { Login } from "@/screens/Login";

vi.mock("react-native", async () => ({
  ...(await import("@/__tests__/react-native-mock")).createReactNativeMock(),
  BackHandler: { addEventListener: vi.fn() },
}));
vi.mock("@/utils/browser", () => ({
  openInAppBrowser: vi.fn(async () => undefined),
}));
vi.mock("react-native-keyboard-controller", async () =>
  (await import("@/__tests__/keyboard-controller-mock")).createKeyboardControllerMock(),
);
vi.mock("@react-native-vector-icons/material-icons/static", async () =>
  (await import("@/__tests__/react-native-mock")).createIconMock(),
);
vi.mock("react-native-safe-area-context", () => ({
  SafeAreaView: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));

const mocks = vi.hoisted(() => ({
  toast: vi.fn(),
  haptics: { tap: vi.fn(), success: vi.fn(), error: vi.fn() },
  navigation: {
    canGoBack: vi.fn(() => true),
    goBack: vi.fn(),
    navigate: vi.fn(),
    setOptions: vi.fn(),
  },
  auth: {
    providers: [] as { name: string; label: string }[],
    loginWithProvider: vi.fn(),
    requestEmailLoginCode: vi.fn(),
    loginWithEmailCode: vi.fn(),
    isAuthenticating: false,
  },
  hardwareBack: null as null | (() => boolean),
}));

vi.mock("@react-navigation/native", () => ({
  useFocusEffect: (effect: () => void | (() => void)) =>
    useEffect(effect, [effect]),
}));
vi.mock("@/contexts/alert/AlertProvider", () => ({
  useAlert: () => ({ toast: mocks.toast }),
}));
vi.mock("@/contexts/auth/AuthProvider", () => ({ useAuth: () => mocks.auth }));
vi.mock("@/core/auth", () => ({
  AuthFlowCancelled: class AuthFlowCancelled extends Error {},
  ProviderEmailTaken: class ProviderEmailTaken extends Error {},
}));
vi.mock("@/api", () => ({ API: { PRIVACY_URL: "https://privacy.test" } }));
// Fluxer stands in for a provider that isn't configured on this build.
vi.mock("@/constants/auth", () => ({
  isProviderConfigured: (name: string) => name !== "fluxer",
}));
vi.mock("@/hooks/useDict", () => ({
  useDict: () => ({
    A11Y_BACK: "Back",
    A11Y_CLEAR_INPUT: "Clear",
    A11Y_EMAIL_CODE_CHANGE: "Change email address",
    A11Y_EMAIL_CODE_STEP_EMAIL: "Step 1 of 2. Enter your email address.",
    A11Y_EMAIL_CODE_STEP_CODE: "Step 2 of 2. Enter the 4-digit code.",
    SETTINGS_PRIVACY_POLICY: "Privacy Policy",
    LOGIN_SUCCESS: "Signed in",
    LOGIN_FAILED: "Could not sign in",
    LOGIN_EMAIL_INVALID: "Not an email address",
    LOGIN_PROVIDER_EMAIL_TAKEN: "{provider} email taken; link {provider} later",
    LOGIN_HEADLINE: "Sign in to Animu",
    LOGIN_SUBTITLE: "Listening is free",
    LOGIN_DISCORD_PERK: "Needed for song requests",
    LOGIN_REQUESTS_NOTICE: "Requests need Discord with 2FA",
    LOGIN_OR_CONTINUE: "or",
    LOGIN_CONTINUE_WITH: "Continue with {provider}",
    LOGIN_WITH_ANIMU_CONNECT: "Sign in with an email code",
    LOGIN_ANIMU_CONNECT_TAGLINE: "Animu Connect tagline",
    LOGIN_LEGAL: "Agree to {link}.",
    LOGIN_ANIMU_CONNECT_HINT: "Only for existing accounts",
    LOGIN_CONNECT_TITLE: "Animu Connect",
    LOGIN_CONNECT_SUBTITLE: "Sign in with an email code",
    LOGIN_CONNECT_NEW_HERE: "New here?",
    LOGIN_CONNECT_CODE_SENT: "If this email is on an account, a code is coming",
    LOGIN_CODE_SENT: "Code sent (Account copy)",
    LOGIN_EMAIL: "Email",
    LOGIN_EMAIL_PLACEHOLDER: "you@example.com",
    LOGIN_SEND_CODE: "Send code",
    LOGIN_CODE: "Code",
    EMAIL_CODE_STEP: "Step {step} of {total} · {label}",
    EMAIL_CODE_STEP_EMAIL: "Enter email",
    EMAIL_CODE_STEP_CODE: "Enter code",
    EMAIL_CODE_INSTRUCTION: "Enter the 4-digit code from your email.",
    EMAIL_CODE_CHANGE: "Change",
    LOGIN_CODE_VALIDITY: "Single use · expires in {minutes} minutes",
    LOGIN_CODE_RESEND: "Resend code",
    LOGIN_CODE_RESEND_IN: "Resend in {seconds}s",
    LOGIN_CODE_INVALID: "Wrong code ({attempts})",
  }),
}));
// The real countdown would lock "Resend code" the moment a code is sent.
vi.mock("@/hooks/useResendCooldown", () => ({
  useResendCooldown: () => ({ remaining: 0, start: vi.fn() }),
}));
vi.mock("@/utils/haptics", () => ({ haptics: mocks.haptics }));
vi.mock("@/utils/keyboard", () => ({ focusWithKeyboard: vi.fn() }));
vi.mock("@/components/Background", () => ({
  Background: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));
vi.mock("@/components/AuthBackdrop", () => ({ AuthBackdrop: () => <i /> }));
vi.mock("@/components/BackArrow", () => ({ BackArrow: () => <i /> }));
vi.mock("@/components/Logo", () => ({ Logo: () => <i /> }));
vi.mock("@/components/ProviderIcon", () => ({
  ProviderIcon: ({ provider }: { provider: string }) => (
    <i data-testid="mark" data-provider={provider} />
  ),
}));

const NAV = mocks.navigation as never;
const BRAND = "#6BDB00";
const CODE_INSTRUCTION = "Enter the 4-digit code from your email.";

const providerPills = () =>
  screen
    .getAllByRole("button")
    .filter((button) =>
      button.getAttribute("aria-label")?.startsWith("Continue with"),
    );

const openConnect = () =>
  fireEvent.click(screen.getByRole("button", { name: "Sign in with an email code" }));

async function sendCodeTo(email: string) {
  openConnect();
  await sendCodeFromEmailStep(email);
}

async function sendCodeFromEmailStep(email: string) {
  fireEvent.change(screen.getByRole("textbox", { name: "Email" }), {
    target: { value: email },
  });
  fireEvent.click(screen.getByRole("button", { name: "Send code" }));
  // fireEvent already wraps the tap in act; wait for the async request to
  // settle the form either way — the code step on success, the error slot
  // on failure — before the caller's assertions run.
  await waitFor(() => {
    expect(
      screen.queryByText(CODE_INSTRUCTION) ?? screen.getByRole("alert"),
    ).toBeTruthy();
  });
}

describe("Login screen", () => {
  beforeEach(() => {
    mocks.auth.providers = [
      { name: "apple", label: "Apple" },
      { name: "google", label: "Google" },
      { name: "discord", label: "Discord" },
      { name: "fluxer", label: "Fluxer" },
    ];
    mocks.auth.isAuthenticating = false;
    mocks.auth.loginWithProvider.mockResolvedValue(undefined);
    mocks.auth.requestEmailLoginCode.mockResolvedValue(undefined);
    mocks.auth.loginWithEmailCode.mockResolvedValue(undefined);
    mocks.navigation.canGoBack.mockReturnValue(true);
    mocks.hardwareBack = null;
    vi.mocked(BackHandler.addEventListener).mockImplementation(
      (_event, handler) => {
        mocks.hardwareBack = handler as () => boolean;
        return { remove: vi.fn() };
      },
    );
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  describe("method step", () => {
    it("lists Discord first, with its perk in the label", () => {
      render(<Login navigation={NAV} route={undefined as never} />);
      const [first] = providerPills();
      expect(first.getAttribute("aria-label")).toBe(
        "Continue with Discord, Needed for song requests",
      );
      expect(screen.getByText("Needed for song requests")).toBeTruthy();
    });

    it("keeps the other providers in their given order, equal and perk-free", () => {
      render(<Login navigation={NAV} route={undefined as never} />);
      expect(
        providerPills().map((pill) => pill.getAttribute("aria-label")),
      ).toEqual([
        "Continue with Discord, Needed for song requests",
        "Continue with Apple",
        "Continue with Google",
      ]);
    });

    it("hides providers that are not configured", () => {
      render(<Login navigation={NAV} route={undefined as never} />);
      expect(screen.queryByRole("button", { name: /Fluxer/ })).toBeNull();
    });

    it("explains the song-request rule and offers Animu Connect below an or", () => {
      render(<Login navigation={NAV} route={undefined as never} />);
      expect(screen.getByText("Requests need Discord with 2FA")).toBeTruthy();
      expect(screen.getByText("or")).toBeTruthy();
      expect(screen.getByText("Animu Connect tagline")).toBeTruthy();
      expect(
        screen.getByRole("button", { name: "Sign in with an email code" }),
      ).toBeTruthy();
    });

    it("signs in with the tapped provider, then toasts and goes back", async () => {
      render(<Login navigation={NAV} route={undefined as never} />);
      fireEvent.click(screen.getByRole("button", { name: "Continue with Google" }));
      await waitFor(() => expect(mocks.navigation.goBack).toHaveBeenCalled());
      expect(mocks.auth.loginWithProvider).toHaveBeenCalledExactlyOnceWith("google");
      expect(mocks.haptics.success).toHaveBeenCalled();
      expect(mocks.toast).toHaveBeenCalledWith("Signed in");
      expect(mocks.navigation.goBack).toHaveBeenCalled();
    });

    it("opens Home when there is nothing to go back to", async () => {
      mocks.navigation.canGoBack.mockReturnValue(false);
      render(<Login navigation={NAV} route={undefined as never} />);
      fireEvent.click(screen.getByRole("button", { name: "Continue with Google" }));
      await waitFor(() => expect(mocks.navigation.navigate).toHaveBeenCalled());
      expect(mocks.navigation.navigate).toHaveBeenCalledWith("Main", {
        screen: "Home",
      });
    });

    it("stays silent when the user dismisses the provider prompt", async () => {
      const { AuthFlowCancelled } = await import("@/core/auth");
      mocks.auth.loginWithProvider.mockRejectedValue(new AuthFlowCancelled());
      render(<Login navigation={NAV} route={undefined as never} />);
      const googlePill = screen.getByRole("button", {
        name: "Continue with Google",
      });
      fireEvent.click(googlePill);
      // The dismissal path settles silently: the pill's spinner goes away
      // (and nothing else appears) once the rejected flow unwinds.
      await waitFor(() =>
        expect(googlePill.getAttribute("aria-busy")).toBe("false"),
      );
      expect(screen.queryByRole("alert")).toBeNull();
      expect(mocks.toast).not.toHaveBeenCalled();
      expect(mocks.navigation.goBack).not.toHaveBeenCalled();
    });

    it("shows the generic failure for any other provider error", async () => {
      mocks.auth.loginWithProvider.mockRejectedValue(new Error("boom"));
      render(<Login navigation={NAV} route={undefined as never} />);
      fireEvent.click(screen.getByRole("button", { name: "Continue with Google" }));
      await waitFor(() => expect(screen.getByRole("alert")).toBeTruthy());
      expect(screen.getByRole("alert").textContent).toContain("Could not sign in");
      expect(mocks.navigation.goBack).not.toHaveBeenCalled();
    });

    it("explains an email already on another account, naming the provider", async () => {
      const { ProviderEmailTaken } = await import("@/core/auth");
      mocks.auth.loginWithProvider.mockRejectedValue(new ProviderEmailTaken());
      render(<Login navigation={NAV} route={undefined as never} />);
      fireEvent.click(screen.getByRole("button", { name: "Continue with Google" }));
      await waitFor(() => expect(screen.getByRole("alert")).toBeTruthy());
      expect(screen.getByRole("alert").textContent).toContain(
        "Google email taken; link Google later",
      );
      expect(screen.queryByText("Could not sign in")).toBeNull();
      expect(mocks.haptics.error).toHaveBeenCalled();
      expect(mocks.navigation.goBack).not.toHaveBeenCalled();
    });

    it("locks every pill while a sign-in is running", () => {
      mocks.auth.isAuthenticating = true;
      render(<Login navigation={NAV} route={undefined as never} />);
      for (const pill of providerPills()) {
        expect(pill.getAttribute("aria-disabled")).toBe("true");
      }
      expect(
        screen
          .getByRole("button", { name: "Sign in with an email code" })
          .getAttribute("aria-disabled"),
      ).toBe("true");
    });
  });

  describe("connect step", () => {
    it("opens on the email form with the eligibility notice above the field", () => {
      render(<Login navigation={NAV} route={undefined as never} />);
      openConnect();
      expect(screen.getByText("Animu Connect")).toBeTruthy();
      const notice = screen.getByText("Only for existing accounts");
      const field = screen.getByRole("textbox", { name: "Email" });
      // Above the field, not below: the keyboard covers whatever follows it.
      expect(
        notice.compareDocumentPosition(field) &
          Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();
      expect(screen.queryByText("Needed for song requests")).toBeNull();
    });

    it("returns to the method step from New here", () => {
      render(<Login navigation={NAV} route={undefined as never} />);
      openConnect();
      fireEvent.click(screen.getByRole("button", { name: "New here?" }));
      expect(screen.getByText("Sign in to Animu")).toBeTruthy();
      expect(screen.queryByRole("textbox", { name: "Email" })).toBeNull();
    });

    it("steps out of the form with the arrow before leaving", () => {
      render(<Login navigation={NAV} route={undefined as never} />);
      openConnect();
      fireEvent.click(screen.getByRole("button", { name: "Back" }));
      expect(screen.getByText("Sign in to Animu")).toBeTruthy();
      expect(mocks.navigation.goBack).not.toHaveBeenCalled();
      fireEvent.click(screen.getByRole("button", { name: "Back" }));
      expect(mocks.navigation.goBack).toHaveBeenCalledTimes(1);
    });

    it("steps out with hardware back, and leaves Login on the method step", () => {
      render(<Login navigation={NAV} route={undefined as never} />);
      expect(mocks.hardwareBack?.()).toBe(false);
      openConnect();
      let handled = false;
      act(() => {
        handled = mocks.hardwareBack?.() ?? false;
      });
      expect(handled).toBe(true);
      expect(screen.getByText("Sign in to Animu")).toBeTruthy();
    });

    it("enables the iOS swipe only on the method step", () => {
      render(<Login navigation={NAV} route={undefined as never} />);
      expect(mocks.navigation.setOptions).toHaveBeenLastCalledWith({
        gestureEnabled: true,
      });
      openConnect();
      expect(mocks.navigation.setOptions).toHaveBeenLastCalledWith({
        gestureEnabled: false,
      });
    });

    it("toasts the neutral code-sent copy and shows the validity window", async () => {
      render(<Login navigation={NAV} route={undefined as never} />);
      await sendCodeTo("  me@example.com ");
      expect(mocks.auth.requestEmailLoginCode).toHaveBeenCalledWith(
        "me@example.com",
      );
      expect(mocks.toast).toHaveBeenCalledWith(
        "If this email is on an account, a code is coming",
      );
      expect(mocks.toast).not.toHaveBeenCalledWith("Code sent (Account copy)");
      expect(screen.getByText(CODE_INSTRUCTION)).toBeTruthy();
      expect(
        screen.getByText("Single use · expires in 10 minutes"),
      ).toBeTruthy();
      // The eligibility notice belongs to the email step only.
      expect(screen.queryByText("Only for existing accounts")).toBeNull();
      expect(screen.queryByRole("button", { name: "New here?" })).toBeNull();
    });

    it("keeps the same header and a step indicator across both steps", async () => {
      const { container } = render(
        <Login navigation={NAV} route={undefined as never} />,
      );
      openConnect();
      const header = () => [
        screen.getByText("Animu Connect").textContent,
        screen.getByText("Sign in with an email code").textContent,
        container.querySelector("[data-icon]:not([data-icon='info-outline'])")
          ?.getAttribute("data-icon"),
      ];
      const emailHeader = header();
      expect(emailHeader[2]).toBe("alternate-email");
      expect(screen.getByText("Step 1 of 2 · Enter email")).toBeTruthy();
      expect(
        screen.getByTestId("step-segment-code").getAttribute("data-style"),
      ).not.toContain(BRAND);

      await sendCodeFromEmailStep("me@example.com");
      expect(header()).toEqual(emailHeader);
      expect(screen.getByText("Step 2 of 2 · Enter code")).toBeTruthy();
      expect(
        screen.getByTestId("step-segment-code").getAttribute("data-style"),
      ).toContain(BRAND);
    });

    it("shows the address read-only with Change, and the code boxes after it", async () => {
      render(<Login navigation={NAV} route={undefined as never} />);
      await sendCodeTo("  me@example.com ");
      expect(screen.getByText("me@example.com")).toBeTruthy();
      // The email field is gone; the code boxes are in.
      expect(screen.queryByRole("textbox", { name: "Email" })).toBeNull();
      const address = screen.getByText("me@example.com");
      const code = screen.getByRole("textbox", { name: "Code" });
      expect(
        address.compareDocumentPosition(code) &
          Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();
      expect(
        screen.queryByRole("button", { name: "Use a different email" }),
      ).toBeNull();
      expect(screen.getByRole("button", { name: "Resend code" })).toBeTruthy();
    });

    it("returns to the email step, keeping the address, from Change", async () => {
      render(<Login navigation={NAV} route={undefined as never} />);
      await sendCodeTo("me@example.com");
      fireEvent.click(
        screen.getByRole("button", { name: "Change email address" }),
      );
      const field = screen.getByRole("textbox", { name: "Email" }) as HTMLInputElement;
      expect(field.value).toBe("me@example.com");
      expect(screen.getByText("Step 1 of 2 · Enter email")).toBeTruthy();
      expect(mocks.navigation.goBack).not.toHaveBeenCalled();
    });

    it("steps back code → email → method with the arrow", async () => {
      render(<Login navigation={NAV} route={undefined as never} />);
      await sendCodeTo("me@example.com");
      fireEvent.click(screen.getByRole("button", { name: "Back" }));
      expect(screen.getByRole("textbox", { name: "Email" })).toBeTruthy();
      fireEvent.click(screen.getByRole("button", { name: "Back" }));
      expect(screen.getByText("Sign in to Animu")).toBeTruthy();
    });

    it("keeps the step while a verify is running, for Change, the arrow and hardware back", async () => {
      let settle: () => void = () => undefined;
      mocks.auth.loginWithEmailCode.mockReturnValue(
        new Promise<void>((resolve) => {
          settle = resolve;
        }),
      );
      render(<Login navigation={NAV} route={undefined as never} />);
      await sendCodeTo("me@example.com");
      fireEvent.change(screen.getByRole("textbox", { name: "Code" }), {
        target: { value: "1234" },
      });
      await waitFor(() =>
        expect(mocks.auth.loginWithEmailCode).toHaveBeenCalledTimes(1),
      );

      const change = screen.getByRole("button", { name: "Change email address" });
      expect(change.getAttribute("aria-disabled")).toBe("true");
      fireEvent.click(change);
      fireEvent.click(screen.getByRole("button", { name: "Back" }));
      let handled = false;
      act(() => {
        handled = mocks.hardwareBack?.() ?? false;
      });
      // Handled (so Login isn't left) but the step didn't move.
      expect(handled).toBe(true);
      expect(screen.getByText("Step 2 of 2 · Enter code")).toBeTruthy();
      expect(screen.getByRole("textbox", { name: "Code" })).toBeTruthy();

      await act(async () => settle());
    });

    it("announces each real step change once, never on resend or a verify success", async () => {
      const announce = vi.mocked(AccessibilityInfo.announceForAccessibility);
      announce.mockClear();
      render(<Login navigation={NAV} route={undefined as never} />);
      openConnect();
      expect(announce).not.toHaveBeenCalled();

      await sendCodeFromEmailStep("me@example.com");
      expect(announce).toHaveBeenCalledTimes(1);
      expect(announce).toHaveBeenLastCalledWith(
        "Step 2 of 2. Enter the 4-digit code.",
      );

      fireEvent.click(screen.getByRole("button", { name: "Resend code" }));
      await waitFor(() =>
        expect(mocks.auth.requestEmailLoginCode).toHaveBeenCalledTimes(2),
      );
      expect(announce).toHaveBeenCalledTimes(1);

      fireEvent.click(
        screen.getByRole("button", { name: "Change email address" }),
      );
      expect(announce).toHaveBeenCalledTimes(2);
      expect(announce).toHaveBeenLastCalledWith(
        "Step 1 of 2. Enter your email address.",
      );

      // Verifying resets the form as the screen closes: not a step to read out.
      fireEvent.click(screen.getByRole("button", { name: "Send code" }));
      await waitFor(() => screen.getByRole("textbox", { name: "Code" }));
      announce.mockClear();
      fireEvent.change(screen.getByRole("textbox", { name: "Code" }), {
        target: { value: "1234" },
      });
      await waitFor(() => expect(mocks.navigation.goBack).toHaveBeenCalled());
      expect(announce).not.toHaveBeenCalled();
    });

    it("fades only the form body on a step change, not on arrival", async () => {
      const timing = vi.mocked(Animated.timing);
      render(<Login navigation={NAV} route={undefined as never} />);
      openConnect();
      timing.mockClear();
      await sendCodeFromEmailStep("me@example.com");
      expect(timing).toHaveBeenCalledTimes(1);
      expect(timing.mock.calls[0][1]).toMatchObject({
        toValue: 1,
        duration: 110,
        useNativeDriver: true,
      });
    });

    it("says a malformed address is not an email, staying on the form", async () => {
      mocks.auth.requestEmailLoginCode.mockRejectedValue(
        new AnimuApiError("invalid email", 400, {}, "invalid_request"),
      );
      render(<Login navigation={NAV} route={undefined as never} />);
      await sendCodeTo("nope");
      expect(screen.getByRole("alert").textContent).toContain("Not an email address");
      expect(mocks.haptics.error).toHaveBeenCalled();
      expect(screen.queryByText(CODE_INSTRUCTION)).toBeNull();
    });

    it("keeps the generic failure for any other request error", async () => {
      mocks.auth.requestEmailLoginCode.mockRejectedValue(new Error("offline"));
      render(<Login navigation={NAV} route={undefined as never} />);
      await sendCodeTo("me@example.com");
      expect(screen.getByRole("alert").textContent).toContain("Could not sign in");
    });
  });
});
