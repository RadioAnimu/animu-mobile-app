import { describe, expect, it } from "vitest";

import { maskEmail, maskHandle, maskIdentifier } from "../mask";

describe("maskEmail", () => {
  it("keeps the first two local chars and the full domain", () => {
    expect(maskEmail("ricardo@gmail.com")).toBe("ri•••@gmail.com");
    expect(maskEmail("haruka@animu.com.br")).toBe("ha•••@animu.com.br");
  });

  it("reveals at most one char for one- and two-char locals", () => {
    expect(maskEmail("a@gmail.com")).toBe("a•••@gmail.com");
    expect(maskEmail("ab@gmail.com")).toBe("a•••@gmail.com");
  });

  it("never leaks the hidden length", () => {
    expect(maskEmail("verylongname@gmail.com")).toBe("ve•••@gmail.com");
  });

  it("falls back to identifier masking for non-emails", () => {
    expect(maskEmail("123456789")).toBe("12•••89");
    expect(maskEmail("")).toBe("•••");
  });
});

describe("maskHandle", () => {
  it("keeps the @ and the first two username chars", () => {
    expect(maskHandle("@haruka_yuki")).toBe("@ha•••");
    expect(maskHandle("haruka")).toBe("@ha•••");
  });

  it("handles single-character and empty handles", () => {
    expect(maskHandle("@h")).toBe("@h•••");
    expect(maskHandle("@")).toBe("@•••");
  });
});

describe("maskIdentifier", () => {
  it("keeps first and last two of long ids", () => {
    expect(maskIdentifier("123456789")).toBe("12•••89");
  });

  it("fully masks short values", () => {
    expect(maskIdentifier("1234")).toBe("•••");
    expect(maskIdentifier("")).toBe("•••");
  });
});
