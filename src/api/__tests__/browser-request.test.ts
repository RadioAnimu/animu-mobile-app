import { describe, expect, it } from "vitest";
import { asSimpleRequest } from "@/api/browser-request";

const headersOf = (init: { headers?: unknown } | undefined) =>
  Object.fromEntries(new Headers(init?.headers as HeadersInit).entries());

describe("asSimpleRequest", () => {
  it("drops User-Agent and a body-less Content-Type, keeping the rest", () => {
    const init = asSimpleRequest({
      method: "GET",
      headers: { "User-Agent": "RadioAnimu/4.0.1", "Content-Type": "application/json", Accept: "application/json" },
    });
    expect(headersOf(init)).toEqual({ accept: "application/json" });
    expect(init?.method).toBe("GET");
  });

  it("keeps the content type of a request with a body", () => {
    const init = asSimpleRequest({
      method: "POST",
      body: "a=1",
      headers: { "User-Agent": "RadioAnimu/4.0.1", "Content-Type": "application/x-www-form-urlencoded" },
    });
    expect(headersOf(init)).toEqual({ "content-type": "application/x-www-form-urlencoded" });
    expect(init?.body).toBe("a=1");
  });

  it("passes requests without headers through untouched", () => {
    const init: RequestInit = { method: "GET" };
    expect(asSimpleRequest(init)).toBe(init);
    expect(asSimpleRequest(undefined)).toBeUndefined();
  });
});
