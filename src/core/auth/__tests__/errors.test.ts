import { describe, expect, it } from "vitest";
import { AnimuApiError } from "animu-api";

import { ProviderEmailTaken, isRetryableRequestFailure } from "@/core/auth/errors";

describe("isRetryableRequestFailure", () => {
  it.each([0, 500, 503])("treats status %i as retryable", (statusCode) => {
    expect(isRetryableRequestFailure(new AnimuApiError("failed", statusCode))).toBe(
      true,
    );
  });

  it.each([400, 401, 403, 404, 409, 499])(
    "treats status %i as a final failure",
    (statusCode) => {
      expect(
        isRetryableRequestFailure(new AnimuApiError("failed", statusCode)),
      ).toBe(false);
    },
  );

  it("is false for anything that is not an AnimuApiError", () => {
    expect(isRetryableRequestFailure(new Error("offline"))).toBe(false);
    expect(isRetryableRequestFailure(new ProviderEmailTaken("discord"))).toBe(
      false,
    );
    expect(isRetryableRequestFailure(null)).toBe(false);
    expect(isRetryableRequestFailure(undefined)).toBe(false);
    expect(isRetryableRequestFailure("offline")).toBe(false);
  });
});
