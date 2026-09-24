import { ValidationError } from "animu-api";

import type { RequestSubmitResult } from "@/core/domain/request-result";

/**
 * Shared re-entrancy latch for the two request flows (live + music). The
 * UI's idle check reads a closure, so double-tap / Enter-before-re-render
 * can reach the service twice inside one commit — both callers must share
 * this guard so a duplicate POST is refused (`IN_PROGRESS`) instead of
 * spending the user's server-side request window (the cooldown is
 * server-counted: a duplicate POST would surface as a PEDIBLOCK).
 *
 * The submit callback may return either a structured
 * {@link RequestSubmitResult} or a plain boolean (the live endpoint's
 * server-confirmed `"1"`) — a `false` boolean normalizes to
 * `REQUEST_ERROR`.
 */
export class RequestSubmitGuard {
  private isSubmitting = false;

  async run(
    submit: () => Promise<RequestSubmitResult | boolean>,
  ): Promise<RequestSubmitResult> {
    if (this.isSubmitting) {
      return { success: false, error: "IN_PROGRESS" };
    }
    try {
      this.isSubmitting = true;
      const outcome = await submit();
      if (typeof outcome === "boolean") {
        return outcome ? { success: true } : { success: false, error: "REQUEST_ERROR" };
      }
      return outcome;
    } catch (error) {
      // The package validates client-side (throws ValidationError before
      // any network call); every other failure is normalized to
      // `REQUEST_ERROR`.
      if (error instanceof ValidationError) {
        return { success: false, error: "VALIDATION", detail: error.message };
      }
      console.error("[RequestSubmitGuard] Submit failed:", error);
      return { success: false, error: "REQUEST_ERROR" };
    } finally {
      this.isSubmitting = false;
    }
  }
}
