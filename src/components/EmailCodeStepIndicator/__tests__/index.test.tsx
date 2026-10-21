// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { EmailCodeStepIndicator } from "@/components/EmailCodeStepIndicator";

vi.mock("react-native", async () =>
  (await import("@/__tests__/react-native-mock")).createReactNativeMock(),
);
vi.mock("@/hooks/useDict", () => ({
  useDict: () => ({
    EMAIL_CODE_STEP: "Step {step} of {total} · {label}",
    EMAIL_CODE_STEP_EMAIL: "Enter email",
    EMAIL_CODE_STEP_CODE: "Enter code",
  }),
}));

const BRAND = "#6BDB00";
const lit = (name: string) =>
  screen.getByTestId(`step-segment-${name}`).getAttribute("data-style")!.includes(BRAND);

describe("EmailCodeStepIndicator", () => {
  afterEach(cleanup);

  it("labels step 1 and lights only the first segment", () => {
    render(<EmailCodeStepIndicator step="email" />);
    expect(screen.getByText("Step 1 of 2 · Enter email")).toBeTruthy();
    expect(lit("email")).toBe(true);
    expect(lit("code")).toBe(false);
  });

  it("labels step 2 and keeps the finished segment lit", () => {
    render(<EmailCodeStepIndicator step="code" />);
    expect(screen.getByText("Step 2 of 2 · Enter code")).toBeTruthy();
    expect(lit("email")).toBe(true);
    expect(lit("code")).toBe(true);
  });

  it("keeps the decorative segments out of touch handling and accessibility", () => {
    const { container } = render(<EmailCodeStepIndicator step="email" />);
    // The label is the only thing exposed; the segments carry no role or label.
    for (const name of ["email", "code"]) {
      const segment = screen.getByTestId(`step-segment-${name}`);
      expect(segment.getAttribute("role")).toBeNull();
      expect(segment.getAttribute("aria-label")).toBeNull();
    }
    expect(container.querySelectorAll("[role=button]")).toHaveLength(0);
  });
});
