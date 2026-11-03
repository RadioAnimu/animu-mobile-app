import { describe, expect, it } from "vitest";

import { getSubmissionErrorMessage } from "@/screens/MakeRequest/submissionErrorMessage";

// Sentinel copy: the test asserts WHICH message key a code maps to.
const t = {
  REQUEST_ERROR_PEDIBLOCK: "PEDIBLOCK[{time}]",
  REQUEST_ERROR_PEDIBLOCK_RECENT: "PEDIBLOCK_RECENT",
  REQUEST_ERROR_BLOCK_90: "BLOCK_90[{detail}]",
  REQUEST_ERROR_HARUBLOCK: "HARUBLOCK",
  ERROR_STRIKE_AND_OUT: "STRIKE_AND_OUT",
  REQUEST_ERROR_ONAIR: "ONAIR",
  REQUEST_ERROR_BLOCOBLOCK: "BLOCOBLOCK",
  REQUEST_ERROR_NOLOGIN: "NOLOGIN",
  REQUEST_ERROR_NO2FA: "NO2FA",
  REQUEST_ERROR_PANEL: "PANEL",
  REQUEST_ERROR: "GENERIC",
};

describe("getSubmissionErrorMessage", () => {
  it("maps each server block code to its message", () => {
    expect(getSubmissionErrorMessage(t, "HARUBLOCK")).toBe("HARUBLOCK");
    expect(getSubmissionErrorMessage(t, "ONAIR")).toBe("ONAIR");
    expect(getSubmissionErrorMessage(t, "BLOCOBLOCK")).toBe("BLOCOBLOCK");
    expect(getSubmissionErrorMessage(t, "NOLOGIN")).toBe("NOLOGIN");
    expect(getSubmissionErrorMessage(t, "NO2FA")).toBe("NO2FA");
    expect(getSubmissionErrorMessage(t, "PANEL_UNAVAILABLE")).toBe("PANEL");
  });

  it("matches raw lowercase spellings the server sends", () => {
    expect(getSubmissionErrorMessage(t, "harublock")).toBe("HARUBLOCK");
    expect(getSubmissionErrorMessage(t, "pediblock")).toBe("PEDIBLOCK_RECENT");
  });

  it("treats ANIBLOCK and ARTISTBLOCK as the same 90-day block", () => {
    expect(getSubmissionErrorMessage(t, "ANIBLOCK", "Naruto")).toBe("BLOCK_90[Naruto]");
    expect(getSubmissionErrorMessage(t, "ARTISTBLOCK", "LiSA")).toBe("BLOCK_90[LiSA]");
  });

  it("interpolates the cooldown time for PEDIBLOCK", () => {
    const message = getSubmissionErrorMessage(t, "PEDIBLOCK", "2026-09-23 21:00:00");
    expect(message).toMatch(/^PEDIBLOCK\[.+\]$/);
    expect(message).not.toContain("{time}");
  });

  it("uses the recent variant of PEDIBLOCK without a readable time", () => {
    expect(getSubmissionErrorMessage(t, "PEDIBLOCK")).toBe("PEDIBLOCK_RECENT");
    expect(getSubmissionErrorMessage(t, "PEDIBLOCK", "soon")).toBe("PEDIBLOCK_RECENT");
  });

  it("accepts both spellings of STRIKE AND OUT", () => {
    expect(getSubmissionErrorMessage(t, "STRIKE AND OUT")).toBe("STRIKE_AND_OUT");
    expect(getSubmissionErrorMessage(t, "strike_and_out")).toBe("STRIKE_AND_OUT");
  });

  it("falls back to the generic message for unknown/absent codes", () => {
    expect(getSubmissionErrorMessage(t, "WHO_KNOWS")).toBe("GENERIC");
    expect(getSubmissionErrorMessage(t, undefined)).toBe("GENERIC");
  });
});
