// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { Linking } from "react-native";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { AuthProfile } from "@/core/domain/user";
import { RequestsStatus } from "@/screens/Account/RequestsStatus";

vi.mock("react-native", async () => ({
  ...(await import("@/__tests__/react-native-mock")).createReactNativeMock(),
  Linking: { openURL: vi.fn(() => Promise.resolve()) },
}));
vi.mock("@react-native-vector-icons/material-icons/static", async () =>
  (await import("@/__tests__/react-native-mock")).createIconMock(),
);
vi.mock("@/hooks/useDict", () => ({
  useDict: () => ({
    ACCOUNT_REQUESTS_TITLE: "Song requests",
    ACCOUNT_REQUESTS_READY: "Song requests are on",
    ACCOUNT_REQUESTS_READY_DESC: "Discord with 2FA verifies you.",
    ACCOUNT_REQUESTS_DISCORD: "Discord account",
    ACCOUNT_REQUESTS_2FA: "2FA on Discord",
    ACCOUNT_REQUESTS_2FA_OFF: "Not turned on yet",
    ACCOUNT_REQUESTS_LINK_FIRST: "Link Discord first",
    ACCOUNT_REQUESTS_LINK_DISCORD: "Link Discord",
    ACCOUNT_REQUESTS_2FA_HELP: "How to turn on 2FA",
    ACCOUNT_REQUESTS_2FA_HELP_DESC: "Opens Discord's help page",
    ACCOUNT_REQUESTS_REFRESH: "Check again",
    ACCOUNT_REQUESTS_REFRESH_DESC: "Turned on 2FA? Refresh.",
    ACCOUNT_LINKED: "Linked",
    ACCOUNT_NOT_LINKED: "Not linked",
  }),
}));
vi.mock("@/components/SectionTitle", () => ({
  SectionTitle: ({ title }: { title: string }) => <h2>{title}</h2>,
}));

const mocks = vi.hoisted(() => ({ discordLinkable: true }));
vi.mock("@/constants/auth", () => ({
  isProviderLinkable: () => mocks.discordLinkable,
}));

const profile = (verified: boolean, linked: string[] = []): AuthProfile =>
  ({
    user: { verified },
    linkedProviders: linked.map((provider) => ({ provider })),
  }) as unknown as AuthProfile;

function setup(
  value: AuthProfile | null,
  props: Partial<React.ComponentProps<typeof RequestsStatus>> = {},
) {
  const onLinkDiscord = vi.fn();
  const onRefresh = vi.fn();
  const view = render(
    <RequestsStatus
      profile={value}
      busy={null}
      onLinkDiscord={onLinkDiscord}
      onRefresh={onRefresh}
      {...props}
    />,
  );
  return { onLinkDiscord, onRefresh, view };
}

describe("RequestsStatus", () => {
  afterEach(() => {
    cleanup();
    mocks.discordLinkable = true;
    vi.clearAllMocks();
  });

  it("renders nothing until the profile has loaded", () => {
    const { view } = setup(null);
    expect(view.container.innerHTML).toBe("");
  });

  it("verified: one 'on' row and no actions", () => {
    setup(profile(true, ["discord"]));
    expect(screen.getByText("Song requests")).toBeTruthy();
    expect(screen.getByText("Song requests are on")).toBeTruthy();
    expect(screen.getByText("Discord with 2FA verifies you.")).toBeTruthy();
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("Discord not linked: a checklist, 2FA waiting, and a link action", () => {
    const { onLinkDiscord } = setup(profile(false, ["google"]));
    expect(screen.getByText("Discord account")).toBeTruthy();
    expect(screen.getByText("Not linked")).toBeTruthy();
    expect(screen.getByText("Link Discord first")).toBeTruthy();
    expect(screen.queryByText("Check again")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Link Discord" }));
    expect(onLinkDiscord).toHaveBeenCalledTimes(1);
  });

  it("hides the link action when Discord can't be linked on this build", () => {
    mocks.discordLinkable = false;
    setup(profile(false, ["google"]));
    expect(screen.getByText("Link Discord first")).toBeTruthy();
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("shows a busy link row while Discord is linking", () => {
    setup(profile(false), { busy: "link-discord" });
    const row = screen.getByRole("button", { name: "Link Discord" });
    expect(row.getAttribute("aria-busy")).toBe("true");
  });

  it("Discord linked: 2FA is off, with a help link and a refresh action", () => {
    const { onRefresh } = setup(profile(false, ["discord"]));
    expect(screen.getByText("Linked")).toBeTruthy();
    expect(screen.getByText("Not turned on yet")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Link Discord" })).toBeNull();

    fireEvent.click(
      screen.getByRole("button", {
        name: "How to turn on 2FA, Opens Discord's help page",
      }),
    );
    expect(Linking.openURL).toHaveBeenCalledWith(
      "https://support.discord.com/hc/en-us/articles/219576828",
    );

    fireEvent.click(
      screen.getByRole("button", {
        name: "Check again, Turned on 2FA? Refresh.",
      }),
    );
    expect(onRefresh).toHaveBeenCalledTimes(1);
  });

  it("marks the refresh row busy while it runs", () => {
    setup(profile(false, ["discord"]), { busy: "requests-refresh" });
    const row = screen.getByRole("button", { name: /^Check again/ });
    expect(row.getAttribute("aria-busy")).toBe("true");
  });

  it("survives the help page failing to open", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.mocked(Linking.openURL).mockRejectedValueOnce(new Error("nope"));
    setup(profile(false, ["discord"]));

    fireEvent.click(screen.getByRole("button", { name: /^How to turn on 2FA/ }));
    await vi.waitFor(() => expect(warn).toHaveBeenCalled());
    warn.mockRestore();
  });
});
