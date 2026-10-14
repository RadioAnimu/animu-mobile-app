import { describe, expect, it } from "vitest";
import { safeErrorDetails } from "@/utils/error-details";

describe("safeErrorDetails", () => {
  it("retains the status while excluding credentials from every error field", () => {
    const error = Object.assign(new Error("session=private-session"), {
      status: 401,
      url: "https://example.com/?token=private-token",
      body: { email: "private@example.com" },
      cause: new Error("private-cause"),
    });
    expect(safeErrorDetails(error)).toEqual({ type: "Error", status: 401 });
    expect(JSON.stringify(safeErrorDetails(error))).not.toContain("private");
  });

  it("does not stringify arbitrary thrown values or expose custom error names", () => {
    const error = new Error("private-message");
    error.name = "private-name";
    expect(safeErrorDetails(error)).toEqual({ type: "Error" });
    for (const value of [null, undefined, "private-token", { toString: () => { throw new Error("never call"); } }]) {
      expect(safeErrorDetails(value)).toEqual({ type: "Error" });
    }
  });

  it("recognizes cancellation and rejects invalid HTTP statuses", () => {
    const error = new Error();
    error.name = "AbortError";
    expect(safeErrorDetails(error)).toEqual({ type: "AbortError" });
    for (const status of [NaN, Infinity, 99, 600, 200.5, "401"]) {
      expect(safeErrorDetails({ status })).toEqual({ type: "Error" });
    }
  });
});
