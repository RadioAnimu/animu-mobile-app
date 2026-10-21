// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { EmailCodeEmailRow } from "@/components/EmailCodeEmailRow";

vi.mock("react-native", async () =>
  (await import("@/__tests__/react-native-mock")).createReactNativeMock(),
);
vi.mock("@/hooks/useDict", () => ({
  useDict: () => ({
    EMAIL_CODE_CHANGE: "Change",
    A11Y_EMAIL_CODE_CHANGE: "Change email address",
  }),
}));

describe("EmailCodeEmailRow", () => {
  afterEach(cleanup);

  it("shows the address read-only on one line, ellipsized in the middle", () => {
    render(<EmailCodeEmailRow email="me@example.com" busy={false} onChangeEmail={vi.fn()} />);
    expect(screen.getByText("me@example.com")).toBeTruthy();
    expect(screen.queryByRole("textbox")).toBeNull();
  });

  it("offers Change as a labelled button that calls back", () => {
    const onChangeEmail = vi.fn();
    render(<EmailCodeEmailRow email="me@example.com" busy={false} onChangeEmail={onChangeEmail} />);
    const change = screen.getByRole("button", { name: "Change email address" });
    expect(change.textContent).toBe("Change");
    fireEvent.click(change);
    expect(onChangeEmail).toHaveBeenCalledTimes(1);
  });

  it("locks Change while a request runs", () => {
    const onChangeEmail = vi.fn();
    render(<EmailCodeEmailRow email="me@example.com" busy onChangeEmail={onChangeEmail} />);
    const change = screen.getByRole("button", { name: "Change email address" });
    expect(change.getAttribute("aria-disabled")).toBe("true");
    fireEvent.click(change);
    expect(onChangeEmail).not.toHaveBeenCalled();
  });
});
