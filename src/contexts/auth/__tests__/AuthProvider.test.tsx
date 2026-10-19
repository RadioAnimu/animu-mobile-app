// @vitest-environment jsdom
import React from "react";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AnimuApiError } from "animu-api";

import { AuthProvider, useAuth } from "@/contexts/auth/AuthProvider";
import type { User } from "@/core/domain/user";

const mocks = vi.hoisted(() => ({
  facade: {
    restore: vi.fn(),
    resumeServerAuth: vi.fn(),
    getProviders: vi.fn(),
    getSessionStatus: vi.fn(),
    getProfile: vi.fn(),
    refreshProfile: vi.fn(),
    getEmails: vi.fn(),
    forget: vi.fn(),
    logout: vi.fn(),
    deleteAccount: vi.fn(),
    loginWithProvider: vi.fn(),
    loginWithEmailCode: vi.fn(),
    requestEmailLoginCode: vi.fn(),
    linkProvider: vi.fn(),
    unlinkProvider: vi.fn(),
    requestAddEmail: vi.fn(),
    verifyAddEmail: vi.fn(),
    removeEmail: vi.fn(),
  },
  background: { startTask: vi.fn(), stopTask: vi.fn() },
  getInitialURL: vi.fn(),
  appStateListen: vi.fn(),
  toast: vi.fn(),
}));

vi.mock("@/core/auth/auth.facade", () => ({ authFacade: mocks.facade }));
vi.mock("@/core/services/profile-media.service", () => ({
  getCachedProfileMedia: () => null,
  syncProfileMedia: () => Promise.resolve(null),
  clearProfileMedia: vi.fn(),
}));
vi.mock("@/core/services/background.service", () => ({
  backgroundService: mocks.background,
}));
vi.mock("react-native", () => ({
  Linking: { getInitialURL: mocks.getInitialURL },
  AppState: {
    currentState: "active",
    addEventListener: mocks.appStateListen,
  },
}));
vi.mock("@/contexts/alert/AlertProvider", () => ({
  useAlert: () => ({ toast: mocks.toast }),
}));
vi.mock("@/hooks/useDict", () => ({
  useDict: () => ({ SESSION_EXPIRED: "Signed out" }),
}));
vi.mock("@/constants/auth", () => ({
  DEFAULT_PROVIDERS: [{ id: "default", name: "Default" }],
}));

const user = (token: string): User =>
  ({
    id: 1,
    username: `user-${token}`,
    handle: null,
    nickname: `nick-${token}`,
    sessionToken: token,
  }) as unknown as User;

const CACHED = user("cached");
const FRESH = user("fresh");
const PROFILE = { id: 1, username: "profile" };
const EMAILS = [{ id: 7, email: "a@b.c", source: "animu" }];

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <AuthProvider>{children}</AuthProvider>
);

const mountAuth = () => renderHook(() => useAuth(), { wrapper });

/** Lets the fire-and-forget bootstrap promise chain settle. */
const settle = () => act(async () => {});

const sessionTask = () =>
  mocks.background.startTask.mock.calls.at(-1)?.[0] as {
    id: string;
    interval: number;
    callback: () => Promise<void>;
  };

describe("AuthProvider", () => {
  let consoleError: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.appStateListen.mockReturnValue({ remove: vi.fn() });
    mocks.facade.restore.mockResolvedValue(null);
    mocks.facade.resumeServerAuth.mockResolvedValue(null);
    mocks.facade.getProviders.mockResolvedValue([
      { id: "server", name: "Server" },
    ]);
    mocks.facade.getSessionStatus.mockResolvedValue(true);
    mocks.facade.getProfile.mockResolvedValue(PROFILE);
    mocks.facade.getEmails.mockResolvedValue({ emails: EMAILS });
    mocks.facade.forget.mockResolvedValue(undefined);
    mocks.getInitialURL.mockResolvedValue(null);
  });

  afterEach(() => {
    cleanup();
    consoleError.mockRestore();
    // clearMocks keeps implementations, so reset the one-off rejections.
    for (const fn of Object.values(mocks.facade)) fn.mockReset();
    mocks.getInitialURL.mockReset();
    mocks.toast.mockReset();
  });

  describe("cold-start bootstrap", () => {
    it("starts signed out with the default providers, then adopts the server list", async () => {
      const { result } = mountAuth();
      expect(result.current.providers).toEqual([
        { id: "default", name: "Default" },
      ]);

      await waitFor(() =>
        expect(result.current.providers).toEqual([
          { id: "server", name: "Server" },
        ]),
      );
      expect(result.current.isAuthenticated).toBe(false);
      expect(mocks.background.startTask).not.toHaveBeenCalled();
      expect(mocks.facade.getSessionStatus).not.toHaveBeenCalled();
    });

    it("restores the cached session, validates it and loads profile + emails", async () => {
      mocks.facade.restore.mockResolvedValue(CACHED);

      const { result } = mountAuth();
      await waitFor(() => expect(result.current.profile).toEqual(PROFILE));

      expect(result.current.user).toBe(CACHED);
      expect(result.current.isAuthenticated).toBe(true);
      expect(result.current.emails).toEqual(EMAILS);
      // A plain restore is not a fresh login: the image cache is untouched.
      expect(result.current.imageVersion).toBe(0);
      expect(sessionTask()).toMatchObject({
        id: "session-check",
        interval: 60_000,
      });
    });

    it("passes the launch URL to resumeServerAuth and prefers the resumed user", async () => {
      mocks.getInitialURL.mockResolvedValue("animuapp://redirect?code=abc");
      mocks.facade.restore.mockResolvedValue(CACHED);
      mocks.facade.resumeServerAuth.mockResolvedValue(FRESH);

      const { result } = mountAuth();
      await waitFor(() => expect(result.current.profile).toEqual(PROFILE));

      expect(mocks.facade.resumeServerAuth).toHaveBeenCalledWith(
        "animuapp://redirect?code=abc",
      );
      expect(result.current.user).toBe(FRESH);
      // A resumed login can swap the account media: image cache is busted.
      expect(result.current.imageVersion).toBe(1);
    });

    it("signs in from a resumed flow even with no cached session", async () => {
      mocks.facade.resumeServerAuth.mockResolvedValue(FRESH);

      const { result } = mountAuth();
      await waitFor(() => expect(result.current.isAuthenticated).toBe(true));

      expect(result.current.user).toBe(FRESH);
      expect(mocks.facade.getSessionStatus).toHaveBeenCalled();
    });

    it("keeps the cached session when the launch bounce carries a failure", async () => {
      const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
      mocks.getInitialURL.mockResolvedValue(
        "animuapp://redirect?error=oauth&msg=email%20already%20taken",
      );
      mocks.facade.restore.mockResolvedValue(CACHED);
      mocks.facade.resumeServerAuth.mockRejectedValue(
        new Error("oauth: email already taken"),
      );

      const { result } = mountAuth();
      await waitFor(() => expect(result.current.isAuthenticated).toBe(true));

      expect(result.current.user).toBe(CACHED);
      expect(result.current.imageVersion).toBe(0);
      expect(mocks.toast).not.toHaveBeenCalled();
      expect(consoleError).not.toHaveBeenCalled();
      expect(warn).toHaveBeenCalled();
      warn.mockRestore();
    });

    it("treats a failing Linking.getInitialURL as no launch URL", async () => {
      mocks.getInitialURL.mockRejectedValue(new Error("no activity"));
      mocks.facade.restore.mockResolvedValue(CACHED);

      const { result } = mountAuth();
      await waitFor(() => expect(result.current.isAuthenticated).toBe(true));

      expect(mocks.facade.resumeServerAuth).toHaveBeenCalledWith(null);
      expect(result.current.user).toBe(CACHED);
    });

    it("drops the session when the server no longer recognizes the token", async () => {
      mocks.facade.restore.mockResolvedValue(CACHED);
      mocks.facade.getSessionStatus.mockResolvedValue(false);

      const { result } = mountAuth();
      await waitFor(() => expect(mocks.facade.forget).toHaveBeenCalledTimes(1));
      await settle();

      expect(result.current.user).toBeNull();
      expect(result.current.isAuthenticated).toBe(false);
      expect(result.current.profile).toBeNull();
      expect(mocks.facade.getProfile).not.toHaveBeenCalled();
      expect(mocks.background.startTask).not.toHaveBeenCalled();
      expect(mocks.background.stopTask).toHaveBeenCalledWith("session-check");
      expect(mocks.toast).toHaveBeenCalledExactlyOnceWith("Signed out", "error");
    });

    it("keeps the cached session and keeps checking when offline", async () => {
      mocks.facade.restore.mockResolvedValue(CACHED);
      mocks.facade.getSessionStatus.mockRejectedValue(new Error("offline"));

      const { result } = mountAuth();
      await waitFor(() =>
        expect(mocks.background.startTask).toHaveBeenCalledTimes(1),
      );
      await settle();

      expect(result.current.user).toBe(CACHED);
      expect(mocks.facade.forget).not.toHaveBeenCalled();
      expect(mocks.facade.getProfile).not.toHaveBeenCalled();
      expect(mocks.toast).not.toHaveBeenCalled();
    });

    it("stays quiet at cold start when there was no stored session", async () => {
      mocks.facade.getSessionStatus.mockResolvedValue(false);

      mountAuth();
      await settle();

      expect(mocks.facade.getSessionStatus).not.toHaveBeenCalled();
      expect(mocks.toast).not.toHaveBeenCalled();
    });

    it("logs an initialization failure instead of throwing", async () => {
      const failure = new Error("storage broke");
      mocks.facade.restore.mockRejectedValue(failure);

      const { result } = mountAuth();
      await waitFor(() =>
        expect(consoleError).toHaveBeenCalledWith(
          "[AuthProvider] Initialization failed:",
          failure,
        ),
      );

      expect(result.current.isAuthenticated).toBe(false);
    });

    it("does nothing after the provider unmounts mid-initialization", async () => {
      let resolveRestore: (value: User | null) => void = () => {};
      mocks.facade.restore.mockReturnValue(
        new Promise<User | null>((resolve) => {
          resolveRestore = resolve;
        }),
      );

      const { unmount } = mountAuth();
      unmount();
      expect(mocks.background.stopTask).toHaveBeenCalledWith("session-check");

      await act(async () => {
        resolveRestore(CACHED);
      });
      await settle();

      // The cancelled run bails before validating or starting the checker.
      expect(mocks.facade.getSessionStatus).not.toHaveBeenCalled();
      expect(mocks.background.startTask).not.toHaveBeenCalled();
      expect(mocks.facade.getProfile).not.toHaveBeenCalled();
    });
  });

  describe("periodic session check", () => {
    const mountSignedIn = async () => {
      mocks.facade.restore.mockResolvedValue(CACHED);
      const hook = mountAuth();
      await waitFor(() => expect(hook.result.current.profile).toEqual(PROFILE));
      return hook;
    };

    it("signs out when the server reports the session dead", async () => {
      const { result } = await mountSignedIn();
      mocks.facade.getSessionStatus.mockResolvedValue(false);

      await act(async () => {
        await sessionTask().callback();
      });

      expect(mocks.facade.forget).toHaveBeenCalledTimes(1);
      expect(result.current.user).toBeNull();
      expect(result.current.emails).toEqual([]);
      expect(mocks.toast).toHaveBeenCalledExactlyOnceWith("Signed out", "error");
    });

    it("tells the user once per expiry, not on every later poll", async () => {
      await mountSignedIn();
      mocks.facade.getSessionStatus.mockResolvedValue(false);
      const { callback } = sessionTask();

      await act(async () => {
        await callback();
      });
      await act(async () => {
        await callback();
      });

      expect(mocks.facade.forget).toHaveBeenCalledTimes(1);
      expect(mocks.toast).toHaveBeenCalledTimes(1);
    });

    it("tells the user once when two checks overlap", async () => {
      await mountSignedIn();
      mocks.facade.getSessionStatus.mockResolvedValue(false);
      const { callback } = sessionTask();

      await act(async () => {
        await Promise.all([callback(), callback()]);
      });

      expect(mocks.toast).toHaveBeenCalledTimes(1);
    });

    it("stays signed in and logs when the check hits a network error", async () => {
      const { result } = await mountSignedIn();
      const failure = new Error("timeout");
      mocks.facade.getSessionStatus.mockRejectedValue(failure);

      await act(async () => {
        await sessionTask().callback();
      });

      expect(result.current.user).toBe(CACHED);
      expect(mocks.facade.forget).not.toHaveBeenCalled();
      expect(mocks.toast).not.toHaveBeenCalled();
      expect(consoleError).toHaveBeenCalledWith(
        "[AuthProvider] Session check failed:",
        failure,
      );
    });

    it("leaves a healthy session alone", async () => {
      const { result } = await mountSignedIn();

      await act(async () => {
        await sessionTask().callback();
      });

      expect(result.current.user).toBe(CACHED);
      expect(mocks.facade.forget).not.toHaveBeenCalled();
      expect(mocks.toast).not.toHaveBeenCalled();
    });
  });

  describe("session check vs app state", () => {
    const emitAppState = (state: string) =>
      act(async () => {
        const handler = mocks.appStateListen.mock.calls.at(-1)?.[1] as (
          next: string,
        ) => void;
        handler(state);
      });

    const mountSignedIn = async () => {
      mocks.facade.restore.mockResolvedValue(CACHED);
      const hook = mountAuth();
      await waitFor(() => expect(hook.result.current.profile).toEqual(PROFILE));
      return hook;
    };

    it("stops the poll in the background and re-checks once on return", async () => {
      await mountSignedIn();
      const startsBefore = mocks.background.startTask.mock.calls.length;
      const checksBefore = mocks.facade.getSessionStatus.mock.calls.length;
      mocks.background.stopTask.mockClear();

      await emitAppState("background");
      expect(mocks.background.stopTask).toHaveBeenCalledWith("session-check");

      await emitAppState("active");
      expect(mocks.facade.getSessionStatus.mock.calls).toHaveLength(checksBefore + 1);
      expect(mocks.background.startTask.mock.calls).toHaveLength(startsBefore + 1);
    });

    it("ignores transient inactive -> active flips that never backgrounded", async () => {
      await mountSignedIn();
      const checksBefore = mocks.facade.getSessionStatus.mock.calls.length;

      await emitAppState("inactive");
      await emitAppState("active");

      expect(mocks.facade.getSessionStatus.mock.calls).toHaveLength(checksBefore);
    });
  });

  describe("sign-in and sign-out", () => {
    it("loginWithProvider adopts the user, bumps the image version and loads account data", async () => {
      const { result } = mountAuth();
      await settle();
      mocks.facade.loginWithProvider.mockResolvedValue(FRESH);

      await act(async () => {
        await result.current.loginWithProvider("discord");
      });

      expect(mocks.facade.loginWithProvider).toHaveBeenCalledWith("discord");
      expect(result.current.user).toBe(FRESH);
      expect(result.current.imageVersion).toBe(1);
      expect(result.current.isAuthenticating).toBe(false);
      await waitFor(() => expect(result.current.profile).toEqual(PROFILE));
      expect(result.current.emails).toEqual(EMAILS);
      expect(sessionTask().id).toBe("session-check");
    });

    it("resets isAuthenticating and propagates the error when login fails", async () => {
      const { result } = mountAuth();
      await settle();
      mocks.facade.loginWithProvider.mockRejectedValue(new Error("cancelled"));

      await act(async () => {
        await expect(
          result.current.loginWithProvider("discord"),
        ).rejects.toThrow("cancelled");
      });

      expect(result.current.isAuthenticating).toBe(false);
      expect(result.current.isAuthenticated).toBe(false);
    });

    it("loginWithEmailCode verifies the code and adopts the session", async () => {
      const { result } = mountAuth();
      await settle();
      mocks.facade.loginWithEmailCode.mockResolvedValue(FRESH);

      await act(async () => {
        await result.current.loginWithEmailCode("a@b.c", "1234");
      });

      expect(mocks.facade.loginWithEmailCode).toHaveBeenCalledWith(
        "a@b.c",
        "1234",
      );
      expect(result.current.user).toBe(FRESH);
    });

    it("requestEmailLoginCode forwards to the facade", async () => {
      const { result } = mountAuth();
      await settle();
      mocks.facade.requestEmailLoginCode.mockResolvedValue({ ok: true });

      await expect(
        result.current.requestEmailLoginCode("a@b.c"),
      ).resolves.toEqual({
        ok: true,
      });
      expect(mocks.facade.requestEmailLoginCode).toHaveBeenCalledWith("a@b.c");
    });

    it("logout clears local state even when the server call fails", async () => {
      mocks.facade.restore.mockResolvedValue(CACHED);
      const { result } = mountAuth();
      await waitFor(() => expect(result.current.profile).toEqual(PROFILE));
      mocks.facade.logout.mockRejectedValue(new Error("offline"));

      await act(async () => {
        await result.current.logout();
      });

      expect(mocks.facade.forget).toHaveBeenCalledTimes(1);
      expect(result.current.user).toBeNull();
      expect(result.current.profile).toBeNull();
      expect(consoleError).toHaveBeenCalledWith(
        "[AuthProvider] Logout failed:",
        expect.any(Error),
      );
      // A deliberate sign-out is not an expiry.
      expect(mocks.toast).not.toHaveBeenCalled();
    });

    it("does not announce an expiry when a manual sign-out beat the check", async () => {
      mocks.facade.restore.mockResolvedValue(CACHED);
      const { result } = mountAuth();
      await waitFor(() => expect(result.current.profile).toEqual(PROFILE));
      let resolveStatus: (alive: boolean) => void = () => {};
      mocks.facade.getSessionStatus.mockReturnValue(
        new Promise<boolean>((resolve) => {
          resolveStatus = resolve;
        }),
      );
      const check = sessionTask().callback();

      await act(async () => {
        await result.current.logout();
      });
      await act(async () => {
        resolveStatus(false);
        await check;
      });

      expect(mocks.facade.forget).toHaveBeenCalledTimes(1);
      expect(mocks.toast).not.toHaveBeenCalled();
    });

    it("does not announce an expiry when the check lands mid sign-out", async () => {
      mocks.facade.restore.mockResolvedValue(CACHED);
      const { result } = mountAuth();
      await waitFor(() => expect(result.current.profile).toEqual(PROFILE));
      mocks.facade.getSessionStatus.mockResolvedValue(false);
      let finishLogout: () => void = () => {};
      mocks.facade.logout.mockReturnValue(
        new Promise<void>((resolve) => {
          finishLogout = resolve;
        }),
      );

      let signingOut: Promise<void> = Promise.resolve();
      act(() => {
        signingOut = result.current.logout();
      });
      // The poll answers "invalid" while the logout call is still out.
      await act(async () => {
        await sessionTask().callback();
      });
      await act(async () => {
        finishLogout();
        await signingOut;
      });

      expect(mocks.toast).not.toHaveBeenCalled();
    });

    it("deleteAccount clears local state even when the API call fails", async () => {
      mocks.facade.restore.mockResolvedValue(CACHED);
      const { result } = mountAuth();
      await waitFor(() => expect(result.current.profile).toEqual(PROFILE));
      mocks.facade.deleteAccount.mockRejectedValue(new Error("500"));

      await act(async () => {
        await expect(result.current.deleteAccount()).rejects.toThrow("500");
      });

      expect(result.current.user).toBeNull();
      expect(mocks.facade.forget).toHaveBeenCalledTimes(1);
      expect(mocks.toast).not.toHaveBeenCalled();
    });

    it("deleteAccount signs the user out when the server rejects the deletion", async () => {
      mocks.facade.restore.mockResolvedValue(CACHED);
      const { result } = mountAuth();
      await waitFor(() => expect(result.current.profile).toEqual(PROFILE));
      mocks.facade.deleteAccount.mockRejectedValue(
        new AnimuApiError("unauthorized", 401),
      );

      await act(async () => {
        await expect(result.current.deleteAccount()).rejects.toThrow(
          "unauthorized",
        );
      });

      expect(result.current.user).toBeNull();
      expect(result.current.profile).toBeNull();
      expect(mocks.facade.forget).toHaveBeenCalledTimes(1);
      expect(mocks.toast).not.toHaveBeenCalled();
    });

    it("deleteAccount keeps the user signed in when the failure is retryable", async () => {
      mocks.facade.restore.mockResolvedValue(CACHED);
      const { result } = mountAuth();
      await waitFor(() => expect(result.current.profile).toEqual(PROFILE));
      mocks.facade.deleteAccount.mockRejectedValue(
        new AnimuApiError("offline", 0),
      );

      await act(async () => {
        await expect(result.current.deleteAccount()).rejects.toThrow("offline");
      });

      expect(result.current.user).toBe(CACHED);
      expect(result.current.profile).toEqual(PROFILE);
      expect(mocks.facade.forget).not.toHaveBeenCalled();
      expect(mocks.toast).not.toHaveBeenCalled();

      // The ref was restored too, so account actions still reach the session.
      mocks.facade.refreshProfile.mockResolvedValue({
        user: FRESH,
        profile: PROFILE,
      });
      await act(async () => {
        await result.current.refreshProfile();
      });
      expect(mocks.facade.refreshProfile).toHaveBeenCalledWith(CACHED);
      expect(result.current.user).toBe(FRESH);
    });
  });

  describe("account actions", () => {
    const mountSignedIn = async () => {
      mocks.facade.restore.mockResolvedValue(CACHED);
      const hook = mountAuth();
      await waitFor(() => expect(hook.result.current.emails).toEqual(EMAILS));
      return hook;
    };

    it("linkProvider reloads emails, bumps the image version and ends not-authenticating", async () => {
      const { result } = await mountSignedIn();
      const NEW_EMAILS = [
        ...EMAILS,
        { id: 8, email: "d@e.f", source: "discord" },
      ];
      mocks.facade.getEmails.mockResolvedValue({ emails: NEW_EMAILS });
      mocks.facade.linkProvider.mockResolvedValue(undefined);

      await act(async () => {
        await result.current.linkProvider("discord");
      });

      expect(mocks.facade.linkProvider).toHaveBeenCalledWith("discord");
      expect(result.current.imageVersion).toBe(1);
      expect(result.current.emails).toEqual(NEW_EMAILS);
      expect(result.current.isAuthenticating).toBe(false);
    });

    it("linkProvider resets isAuthenticating when linking fails", async () => {
      const { result } = await mountSignedIn();
      mocks.facade.linkProvider.mockRejectedValue(new Error("denied"));

      await act(async () => {
        await expect(result.current.linkProvider("discord")).rejects.toThrow(
          "denied",
        );
      });

      expect(result.current.isAuthenticating).toBe(false);
      expect(result.current.imageVersion).toBe(0);
    });

    it("unlinkProvider refreshes profile and emails and bumps the image version", async () => {
      const { result } = await mountSignedIn();
      mocks.facade.unlinkProvider.mockResolvedValue({});
      mocks.facade.getEmails.mockResolvedValue({ emails: [] });

      await act(async () => {
        await result.current.unlinkProvider("discord");
      });

      expect(mocks.facade.unlinkProvider).toHaveBeenCalledWith("discord");
      expect(result.current.imageVersion).toBe(1);
      expect(result.current.emails).toEqual([]);
    });

    it("verifyAddEmail and removeEmail replace the email list with the server's", async () => {
      const { result } = await mountSignedIn();
      const added = [...EMAILS, { id: 9, email: "x@y.z", source: "animu" }];
      mocks.facade.verifyAddEmail.mockResolvedValue({ emails: added });
      mocks.facade.removeEmail.mockResolvedValue({ emails: EMAILS });

      await act(async () => {
        await result.current.verifyAddEmail("x@y.z", "1234");
      });
      expect(mocks.facade.verifyAddEmail).toHaveBeenCalledWith({
        email: "x@y.z",
        code: "1234",
      });
      expect(result.current.emails).toEqual(added);

      await act(async () => {
        await result.current.removeEmail(9);
      });
      expect(mocks.facade.removeEmail).toHaveBeenCalledWith(9);
      expect(result.current.emails).toEqual(EMAILS);
    });

    it("requestAddEmail forwards to the facade", async () => {
      const { result } = await mountSignedIn();
      mocks.facade.requestAddEmail.mockResolvedValue({ ok: true });

      await expect(result.current.requestAddEmail("x@y.z")).resolves.toEqual({
        ok: true,
      });
      expect(mocks.facade.requestAddEmail).toHaveBeenCalledWith("x@y.z");
    });

    it("refreshProfile swaps in the refreshed user/profile and bumps the image version", async () => {
      const { result } = await mountSignedIn();
      const refreshedProfile = { id: 1, username: "renamed" };
      mocks.facade.refreshProfile.mockResolvedValue({
        user: FRESH,
        profile: refreshedProfile,
      });

      let returned: unknown;
      await act(async () => {
        returned = await result.current.refreshProfile();
      });

      expect(returned).toBe(refreshedProfile);
      expect(mocks.facade.refreshProfile).toHaveBeenCalledWith(CACHED);
      expect(result.current.user).toBe(FRESH);
      expect(result.current.profile).toEqual(refreshedProfile);
      expect(result.current.imageVersion).toBe(1);
    });

    it("refreshProfile is a no-op while signed out", async () => {
      const { result } = mountAuth();
      await settle();

      let returned: unknown;
      await act(async () => {
        returned = await result.current.refreshProfile();
      });

      expect(returned).toBeNull();
      expect(mocks.facade.refreshProfile).not.toHaveBeenCalled();
    });

    it("logs, but survives, a failing profile or email load", async () => {
      mocks.facade.restore.mockResolvedValue(CACHED);
      mocks.facade.getProfile.mockRejectedValue(new Error("p"));
      mocks.facade.getEmails.mockRejectedValue(new Error("e"));

      const { result } = mountAuth();
      await waitFor(() => expect(consoleError).toHaveBeenCalledTimes(2));

      expect(result.current.user).toBe(CACHED);
      expect(result.current.profile).toBeNull();
      expect(result.current.emails).toEqual([]);
    });
  });

  it("useAuth throws outside the provider", () => {
    const silence = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => renderHook(() => useAuth())).toThrow(
      "useAuth must be used within AuthProvider",
    );
    silence.mockRestore();
  });
});
