// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, renderHook } from "@testing-library/react";
import { AnimuApiError } from "animu-api";

import type { Dict } from "@/i18n";
import { emailCodeError, useEmailCodeFlow } from "@/hooks/useEmailCodeFlow";

// The hook only reads a few message keys; mocking the context keeps the test
// free of the React Native provider chain. (`vi.mock` is hoisted above imports.)
vi.mock("@/hooks/useDict", () => ({
  useDict: () => ({
    LOGIN_MISSING_FIELDS: "missing-fields",
    LOGIN_CODE_INVALID: "invalid-code",
    LOGIN_FAILED: "login-failed",
    ACCOUNT_ACTION_FAILED: "action-failed",
    ACCOUNT_EMAIL_TAKEN: "email-taken",
  }),
}));

afterEach(cleanup);

const apiError = (code: string) => new AnimuApiError("boom", 400, {}, code);

describe("emailCodeError", () => {
  const dict = {
    LOGIN_CODE_INVALID: "invalid-code",
  } as unknown as Dict;

  it("maps an invalid/expired code", () => {
    expect(emailCodeError(dict, apiError("email_code_failed"), "fallback")).toBe(
      "invalid-code",
    );
  });

  it("maps a taken email only when a taken message is provided", () => {
    expect(
      emailCodeError(dict, apiError("email_taken"), "fallback", {
        taken: "taken",
      }),
    ).toBe("taken");
    expect(emailCodeError(dict, apiError("email_taken"), "fallback")).toBe(
      "fallback",
    );
  });

  it("falls back for unknown or non-API errors", () => {
    expect(emailCodeError(dict, apiError("something_else"), "fallback")).toBe(
      "fallback",
    );
    expect(emailCodeError(dict, new Error("network"), "fallback")).toBe(
      "fallback",
    );
  });
});

const makeOptions = () => ({
  requestCode: vi.fn(async (): Promise<void> => {}),
  verifyCode: vi.fn(async (): Promise<void> => {}),
  mapRequestError: vi.fn(() => "request-error"),
  mapVerifyError: vi.fn(() => "verify-error"),
  onCodeSent: vi.fn(),
  onVerified: vi.fn(),
});

describe("useEmailCodeFlow", () => {
  it("rejects an empty email without calling the API", async () => {
    const options = makeOptions();
    const { result } = renderHook(() => useEmailCodeFlow(options));

    await act(async () => {
      await result.current.sendCode();
    });

    expect(options.requestCode).not.toHaveBeenCalled();
    expect(result.current.error).toBe("missing-fields");
    expect(result.current.step).toBe("email");
  });

  it("sends the trimmed email and advances to the code step", async () => {
    const options = makeOptions();
    const { result } = renderHook(() => useEmailCodeFlow(options));

    act(() => result.current.setEmail("  a@b.com  "));
    await act(async () => {
      await result.current.sendCode();
    });

    expect(options.requestCode).toHaveBeenCalledWith("a@b.com");
    expect(options.onCodeSent).toHaveBeenCalledWith("a@b.com");
    expect(result.current.step).toBe("code");
    expect(result.current.email).toBe("a@b.com");
  });

  it("surfaces a request failure via mapRequestError", async () => {
    const options = makeOptions();
    options.requestCode.mockRejectedValueOnce(new Error("nope"));
    const { result } = renderHook(() => useEmailCodeFlow(options));

    act(() => result.current.setEmail("a@b.com"));
    await act(async () => {
      await result.current.sendCode();
    });

    expect(options.mapRequestError).toHaveBeenCalled();
    expect(result.current.error).toBe("request-error");
    expect(result.current.step).toBe("email");
  });

  it("verifies the trimmed code, resets, and calls onVerified", async () => {
    const options = makeOptions();
    const { result } = renderHook(() => useEmailCodeFlow(options));

    act(() => result.current.setEmail("a@b.com"));
    await act(async () => {
      await result.current.sendCode();
    });
    act(() => result.current.setCode(" 1234 "));
    await act(async () => {
      await result.current.verify();
    });

    expect(options.verifyCode).toHaveBeenCalledWith("a@b.com", "1234");
    expect(options.onVerified).toHaveBeenCalledTimes(1);
    expect(result.current.step).toBe("email");
    expect(result.current.email).toBe("");
    expect(result.current.code).toBe("");
  });

  it("surfaces a verification failure and stays on the code step", async () => {
    const options = makeOptions();
    options.verifyCode.mockRejectedValueOnce(new Error("nope"));
    const { result } = renderHook(() => useEmailCodeFlow(options));

    act(() => result.current.setEmail("a@b.com"));
    await act(async () => {
      await result.current.sendCode();
    });
    act(() => result.current.setCode("1234"));
    await act(async () => {
      await result.current.verify();
    });

    expect(options.mapVerifyError).toHaveBeenCalled();
    expect(result.current.error).toBe("verify-error");
    expect(result.current.step).toBe("code");
    expect(options.onVerified).not.toHaveBeenCalled();
  });

  it("returns to the email step keeping the address", async () => {
    const options = makeOptions();
    const { result } = renderHook(() => useEmailCodeFlow(options));

    act(() => result.current.setEmail("a@b.com"));
    await act(async () => {
      await result.current.sendCode();
    });
    act(() => result.current.setCode("12"));
    act(() => result.current.backToEmail());

    expect(result.current.step).toBe("email");
    expect(result.current.email).toBe("a@b.com");
    expect(result.current.code).toBe("");
    expect(result.current.error).toBeNull();
  });

  it("ignores a concurrent send while one is in flight", async () => {
    let resolveRequest: (() => void) | undefined;
    const options = makeOptions();
    options.requestCode.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          resolveRequest = resolve;
        }),
    );
    const { result } = renderHook(() => useEmailCodeFlow(options));

    act(() => result.current.setEmail("a@b.com"));

    let first: Promise<void> | undefined;
    act(() => {
      first = result.current.sendCode();
    });
    expect(result.current.busy).toBe(true);

    await act(async () => {
      await result.current.sendCode();
    });
    expect(options.requestCode).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveRequest?.();
      await first;
    });
    expect(result.current.busy).toBe(false);
  });
});
