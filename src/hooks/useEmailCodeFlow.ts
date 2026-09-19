import { useCallback, useState } from "react";
import { AnimuApiError } from "animu-api";

import type { Dict } from "@/i18n";
import { useDict } from "@/hooks/useDict";

export type EmailCodeStep = "email" | "code";

export interface UseEmailCodeFlowOptions {
  /** Step 1: request an emailed code. Bound to the caller's auth action. */
  requestCode: (email: string) => Promise<unknown>;
  /** Step 2: verify the code. Bound to the caller's auth action. */
  verifyCode: (email: string, code: string) => Promise<unknown>;
  /** Maps a step-1 failure to a user-facing message. */
  mapRequestError: (error: unknown) => string;
  /** Maps a step-2 failure to a user-facing message. */
  mapVerifyError: (error: unknown) => string;
  /** Called after a code is sent (e.g. a toast). */
  onCodeSent?: (email: string) => void;
  /** Called after a successful verification. */
  onVerified: () => void;
}

export interface EmailCodeFlow {
  step: EmailCodeStep;
  email: string;
  setEmail: (value: string) => void;
  code: string;
  setCode: (value: string) => void;
  busy: boolean;
  error: string | null;
  setError: (value: string | null) => void;
  sendCode: () => Promise<void>;
  verify: () => Promise<void>;
  /** Returns to the email step, keeping the address but clearing the code. */
  backToEmail: () => void;
  /** Clears the whole form and returns to the email step. */
  reset: () => void;
}

/**
 * Shared two-step "email → code" state machine for Animu Connect.
 *
 * Presentation-only: it never talks to the API itself. Callers hand it the
 * auth actions they already get from `useAuth()` (login for the Login screen,
 * add-email for the account sheet), keeping the view → `useAuth` → facade →
 * ports boundary intact. Error-code knowledge lives in {@link emailCodeError}.
 */
export function useEmailCodeFlow(
  options: UseEmailCodeFlowOptions,
): EmailCodeFlow {
  const {
    requestCode,
    verifyCode,
    mapRequestError,
    mapVerifyError,
    onCodeSent,
    onVerified,
  } = options;
  const dict = useDict();
  const [step, setStep] = useState<EmailCodeStep>("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = useCallback(() => {
    setStep("email");
    setEmail("");
    setCode("");
    setError(null);
  }, []);

  const backToEmail = useCallback(() => {
    setStep("email");
    setCode("");
    setError(null);
  }, []);

  const sendCode = useCallback(async () => {
    if (busy) return;
    const address = email.trim();
    if (!address) {
      setError(dict.LOGIN_MISSING_FIELDS);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await requestCode(address);
      setEmail(address);
      setStep("code");
      onCodeSent?.(address);
    } catch (err) {
      setError(mapRequestError(err));
    } finally {
      setBusy(false);
    }
  }, [
    busy,
    email,
    dict.LOGIN_MISSING_FIELDS,
    requestCode,
    mapRequestError,
    onCodeSent,
  ]);

  const verify = useCallback(async () => {
    if (busy) return;
    const value = code.trim();
    if (!value) {
      setError(dict.LOGIN_MISSING_FIELDS);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await verifyCode(email.trim(), value);
      reset();
      onVerified();
    } catch (err) {
      setError(mapVerifyError(err));
    } finally {
      setBusy(false);
    }
  }, [
    busy,
    code,
    email,
    dict.LOGIN_MISSING_FIELDS,
    verifyCode,
    mapVerifyError,
    onVerified,
    reset,
  ]);

  return {
    step,
    email,
    setEmail,
    code,
    setCode,
    busy,
    error,
    setError,
    sendCode,
    verify,
    backToEmail,
    reset,
  };
}

/**
 * Maps an Animu API error from an email-code step to an i18n message: an
 * invalid/expired code is always `LOGIN_CODE_INVALID`; a taken address
 * (add-email flow only) is the caller's `taken` message; anything else falls
 * back to the caller's message.
 */
export function emailCodeError(
  dict: Dict,
  error: unknown,
  fallback: string,
  options?: { taken?: string },
): string {
  if (error instanceof AnimuApiError) {
    if (error.code === "email_code_failed") return dict.LOGIN_CODE_INVALID;
    if (options?.taken && error.code === "email_taken") return options.taken;
  }
  return fallback;
}
