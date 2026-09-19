// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { act, cleanup, renderHook } from "@testing-library/react";

import { useLatestRequest } from "@/hooks/useLatestRequest";

afterEach(cleanup);

describe("useLatestRequest", () => {
  it("marks only the newest request as current", () => {
    const { result } = renderHook(() => useLatestRequest());

    let first = 0;
    act(() => {
      first = result.current.begin();
    });
    expect(result.current.isCurrent(first)).toBe(true);

    let second = 0;
    act(() => {
      second = result.current.begin();
    });
    expect(result.current.isCurrent(second)).toBe(true);
    expect(result.current.isCurrent(first)).toBe(false);
  });

  it("keeps stable handler references across renders", () => {
    const { result, rerender } = renderHook(() => useLatestRequest());
    const begin = result.current.begin;
    const isCurrent = result.current.isCurrent;

    rerender();

    expect(result.current.begin).toBe(begin);
    expect(result.current.isCurrent).toBe(isCurrent);
  });
});
