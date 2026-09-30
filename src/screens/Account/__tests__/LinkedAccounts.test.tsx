// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import type { LinkedProvider, ProviderInfo } from "animu-api";
import { afterEach, describe, expect, it, vi } from "vitest";

import { LinkedAccounts } from "@/screens/Account/LinkedAccounts";

vi.mock("react-native", async () =>
  (await import("@/__tests__/react-native-mock")).createReactNativeMock(),
);
vi.mock("@react-native-vector-icons/material-icons/static", async () =>
  (await import("@/__tests__/react-native-mock")).createIconMock(),
);
vi.mock("@/hooks/useDict", () => ({
  useDict: () => ({
    ACCOUNT_LINKED_ACCOUNTS: "Linked accounts",
    ACCOUNT_UNLINK: "Unlink",
    ACCOUNT_LINK: "Link",
    ACCOUNT_LINKED: "Linked",
    ACCOUNT_NOT_LINKED: "Not linked",
    ACCOUNT_SHOW: "Show",
    ACCOUNT_HIDE: "Hide",
  }),
}));
vi.mock("@/components/SectionTitle", () => ({
  SectionTitle: ({ title }: { title: string }) => <h2>{title}</h2>,
}));
vi.mock("@/components/ProviderIcon", () => ({
  ProviderIcon: ({ provider }: { provider: string }) => (
    <i data-provider={provider} />
  ),
}));
vi.mock("@/components/MaskedValue", () => ({
  MaskedValue: ({ value, mask }: { value: string; mask: (v: string) => string }) => (
    <span data-testid="masked-value" data-real={value}>
      {mask(value)}
    </span>
  ),
}));
// Only google is configured+linkable, apple is configured but not linkable,
// "soon" is not configured at all (must not render).
vi.mock("@/constants/auth", () => ({
  isProviderConfigured: (name: string) => name !== "soon",
  isProviderLinkable: (name: string) => name === "google" || name === "discord",
}));

const provider = (name: string, label: string): ProviderInfo =>
  ({ name, label }) as ProviderInfo;

const PROVIDERS = [
  provider("google", "Google"),
  provider("apple", "Apple"),
  provider("discord", "Discord"),
  provider("soon", "Soon"),
];

const linked = (overrides: Partial<LinkedProvider>): LinkedProvider =>
  ({ provider: "google", ...overrides }) as LinkedProvider;

function setup(
  props: Partial<React.ComponentProps<typeof LinkedAccounts>> = {},
) {
  const onLink = vi.fn();
  const onUnlink = vi.fn();
  render(
    <LinkedAccounts
      providers={PROVIDERS}
      linkedProviders={[]}
      canUnlink
      busy={null}
      onLink={onLink}
      onUnlink={onUnlink}
      {...props}
    />,
  );
  return { onLink, onUnlink };
}

describe("LinkedAccounts", () => {
  afterEach(cleanup);

  it("omits unconfigured providers and shows the section title", () => {
    setup();
    expect(screen.getByText("Linked accounts")).toBeTruthy();
    expect(screen.getByText("Google")).toBeTruthy();
    expect(screen.getByText("Apple")).toBeTruthy();
    expect(screen.queryByText("Soon")).toBeNull();
  });

  it("shows 'Not linked' and a link button only for linkable providers", () => {
    const { onLink } = setup();
    expect(screen.getAllByText("Not linked")).toHaveLength(3);
    // Apple is configured but not linkable: no action at all.
    expect(screen.queryByRole("button", { name: "Link Apple" })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Link Google" }));
    expect(onLink).toHaveBeenCalledExactlyOnceWith("google");
  });

  it("linked provider shows its masked identity and an unlink action", () => {
    const { onUnlink } = setup({
      linkedProviders: [
        linked({ providerName: "Ana", providerEmail: "ana@example.com" }),
      ],
    });
    const masked = screen.getByTestId("masked-value");
    expect(masked.getAttribute("data-real")).toBe("Ana · ana@example.com");
    // The raw address must not be in the rendered text while masked.
    expect(masked.textContent).not.toContain("ana@example.com");
    expect(screen.queryByRole("button", { name: "Link Google" })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Unlink Google" }));
    expect(onUnlink).toHaveBeenCalledExactlyOnceWith("google");
  });

  it("falls back to the generic 'Linked' caption when there is no identity", () => {
    setup({ linkedProviders: [linked({ provider: "apple" })] });
    expect(screen.getByText("Linked")).toBeTruthy();
    expect(screen.queryByTestId("masked-value")).toBeNull();
  });

  it("disables unlink when it is the last social provider", () => {
    const { onUnlink } = setup({
      canUnlink: false,
      linkedProviders: [linked({ providerName: "Ana" })],
    });
    const button = screen.getByRole("button", { name: "Unlink Google" });
    expect(button.getAttribute("aria-disabled")).toBe("true");
    fireEvent.click(button);
    expect(onUnlink).not.toHaveBeenCalled();
  });

  it("swaps the row action for a spinner while that provider is linking", () => {
    setup({ busy: "link-google" });
    const row = screen.getByText("Google").closest("div")!.parentElement!.parentElement!;
    expect(within(row).getByRole("progressbar")).toBeTruthy();
    expect(within(row).queryByRole("button")).toBeNull();
  });

  it("disables every other action while one is in flight", () => {
    const { onLink, onUnlink } = setup({
      busy: "link-discord",
      linkedProviders: [linked({ providerName: "Ana" })],
    });
    const unlink = screen.getByRole("button", { name: "Unlink Google" });
    expect(unlink.getAttribute("aria-disabled")).toBe("true");
    fireEvent.click(unlink);
    expect(onUnlink).not.toHaveBeenCalled();

    // Discord is the spinner row; Apple isn't linkable. No link button left.
    expect(screen.queryByRole("button", { name: /^Link / })).toBeNull();
    expect(onLink).not.toHaveBeenCalled();
  });

  it("disables the link action while another action is busy", () => {
    const { onLink } = setup({ busy: "unlink-apple" });
    const link = screen.getByRole("button", { name: "Link Google" });
    expect(link.getAttribute("aria-disabled")).toBe("true");
    fireEvent.click(link);
    expect(onLink).not.toHaveBeenCalled();
  });
});
