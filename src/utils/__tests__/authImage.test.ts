import { describe, expect, it } from "vitest";
import { ENDPOINTS } from "animu-api";

import { buildAuthImageSource } from "@/utils/authImage";

const AUTH_URI = `${ENDPOINTS.auth}/me/avatar.php`;

describe("buildAuthImageSource", () => {
  it("returns undefined for a missing uri", () => {
    expect(buildAuthImageSource(null, "tok", 1)).toBeUndefined();
    expect(buildAuthImageSource(undefined, "tok", 1)).toBeUndefined();
    expect(buildAuthImageSource("", "tok", 1)).toBeUndefined();
  });

  it("passes provider CDN urls through untouched", () => {
    expect(
      buildAuthImageSource("https://cdn.example/a.png", "tok", 5),
    ).toEqual({ uri: "https://cdn.example/a.png" });
  });

  it("attaches the session header and a cache-buster to auth urls", () => {
    expect(buildAuthImageSource(AUTH_URI, "tok", 7)).toEqual({
      uri: `${AUTH_URI}?v=7`,
      headers: { "X-Session-Id": "tok" },
    });
  });

  it("uses & when the auth url already carries a query", () => {
    const uri = `${AUTH_URI}?x=1`;
    expect(buildAuthImageSource(uri, "tok", 7)).toEqual({
      uri: `${uri}&v=7`,
      headers: { "X-Session-Id": "tok" },
    });
  });

  it("omits the session header when there is no token", () => {
    expect(buildAuthImageSource(AUTH_URI, null, 3)).toEqual({
      uri: `${AUTH_URI}?v=3`,
      headers: undefined,
    });
  });
});
