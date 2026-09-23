import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import type {
  AuthProfile,
  AuthSession,
  AuthUser,
  MobileAuthRedirect,
  ProviderInfo,
} from "animu-api";

import { AuthFacade } from "@/core/auth/auth.facade";
import { AuthFlowCancelled } from "@/core/auth/errors";
import type {
  AuthApiPort,
  OAuthPort,
  OAuthResult,
  SessionStorePort,
  StoredSession,
} from "@/core/auth/ports";

// The real constants module loads `react-native` + `expo-auth-session`, which
// this vitest setup cannot transform (Flow source). The facade only consumes
// provider metadata from it, so we inject a controlled provider map and can
// then exercise every branch — server, native Apple, app-driven and
// non-linkable — deterministically.
const { PROVIDERS } = vi.hoisted(() => ({
  PROVIDERS: {
    discord: { name: "discord", label: "Discord", mode: "server", linkable: true },
    apple: {
      name: "apple",
      label: "Apple",
      mode: "server",
      native: "apple",
      linkable: true,
    },
    legacy: { name: "legacy", label: "Legacy", mode: "app", linkable: true },
    restricted: {
      name: "restricted",
      label: "Restricted",
      mode: "server",
      linkable: false,
    },
  } as Record<string, { name: string; label: string; mode: string; native?: string; linkable?: boolean; redirectUri?: string }>,
}));

vi.mock("@/constants/auth", () => ({
  AUTH_REDIRECT_URI: "animuapp://redirect",
  DEFAULT_PROVIDERS: [
    { name: "discord", label: "Discord" },
    { name: "google", label: "Google" },
    { name: "apple", label: "Apple" },
  ],
  getProviderConfig: (name: string) => PROVIDERS[name],
  redirectUriForProvider: (name: string) =>
    PROVIDERS[name]?.redirectUri ?? "animuapp://redirect",
}));

// The module builds a production singleton from the Expo-backed adapters at
// import time; the class under test takes its ports by injection, so the real
// adapters (which pull `expo-secure-store` / `expo-web-browser` / `expo/fetch`)
// are replaced with inert stubs.
vi.mock("@/core/auth/adapters/secure-session.adapter", () => ({
  SecureSessionStore: class {},
}));
vi.mock("@/core/auth/adapters/animu-auth.adapter", () => ({
  AnimuAuthAdapter: class {},
}));
vi.mock("@/core/auth/adapters/oauth.adapter", () => ({
  OAuthAdapter: class {},
}));

// ─── Fixtures ───

const authUser = (over: Partial<AuthUser> = {}): AuthUser => ({
  id: 1,
  username: "Ness",
  handle: "ness",
  email: "ness@example.com",
  avatarUrl: null,
  avatarCustom: false,
  verified: false,
  createdAt: null,
  ...over,
});

const session = (over: Partial<AuthSession> = {}): AuthSession => ({
  sessionToken: "tok-123",
  action: "login",
  user: authUser(),
  ...over,
});

const profile = (user = authUser()): AuthProfile =>
  ({
    user,
    banner: { url: null, color: null },
    linkedProviders: [],
    availableProviders: [],
    session: { sessionId: "s", loginProvider: "discord", lastActivity: 0 },
    links: { avatar: "", browserLogin: "" },
  }) as AuthProfile;

// ─── Fakes ───

/** Fresh-pending-marker slot, reset between tests (see beforeEach). */
let pendingServerAuthAt: number | null = null;

/** Every port method as a vitest mock, so tests can assert calls/returns. */
type Mocked<T> = { [K in keyof T]: Mock };
type ApiFake = Mocked<AuthApiPort>;
type OAuthFake = Mocked<OAuthPort>;
type StoreFake = Mocked<SessionStorePort>;

const makeApi = (over: Record<string, unknown> = {}): ApiFake => {
  let token: string | null = null;
  return {
    setSessionToken: vi.fn((next: string | null) => {
      token = next;
    }),
    getSessionToken: vi.fn(() => token),
    getProviders: vi.fn(async () => [] as ProviderInfo[]),
    mobileStartUrl: vi.fn(
      (provider: string, sid?: string) =>
        `https://auth.test/mobile/${provider}-start.php${sid ? `?sid=${sid}` : ""}`,
    ),
    completeMobileAuth: vi.fn(),
    exchangeToken: vi.fn(),
    requestEmailLoginCode: vi.fn(),
    verifyEmailLoginCode: vi.fn(),
    getSessionStatus: vi.fn(async () => ({
      authenticated: true,
      sessionToken: "tok-123",
    })),
    getProfile: vi.fn(async () => profile()),
    refreshProfile: vi.fn(),
    linkProvider: vi.fn(),
    unlinkProvider: vi.fn(),
    getEmails: vi.fn(),
    requestAddEmail: vi.fn(),
    verifyAddEmail: vi.fn(),
    removeEmail: vi.fn(),
    uploadAvatar: vi.fn(),
    resetAvatar: vi.fn(),
    logout: vi.fn(async () => {}),
    deleteAccount: vi.fn(async () => {}),
    ...over,
  } as unknown as ApiFake;
};

const makeOAuth = (over: Record<string, unknown> = {}): OAuthFake =>
  ({
    authorize: vi.fn(),
    openSession: vi.fn(async () => null),
    authorizeAppleNative: vi.fn(async () => null),
    ...over,
  }) as unknown as OAuthFake;

const makeStore = (over: Record<string, unknown> = {}): StoreFake =>
  ({
    load: vi.fn(async () => null),
    save: vi.fn(async () => {}),
    clear: vi.fn(async () => {}),
    // Marker state modeled with the same semantics as SecureSessionStore
    // (fresh marker adopts; after discard, nothing adopts).
    markServerAuthPending: vi.fn(() => {
      pendingServerAuthAt = Date.now();
    }),
    discardServerAuthPending: vi.fn(() => {
      pendingServerAuthAt = null;
    }),
    takeServerAuthPending: vi.fn(() => {
      const fresh = pendingServerAuthAt != null;
      pendingServerAuthAt = null;
      return fresh;
    }),
    ...over,
  }) as unknown as StoreFake;

const build = (
  deps: { api?: ApiFake; oauth?: OAuthFake; store?: StoreFake } = {},
) => {
  const api = deps.api ?? makeApi();
  const oauth = deps.oauth ?? makeOAuth();
  const store = deps.store ?? makeStore();
  return {
    api,
    oauth,
    store,
    facade: new AuthFacade(
      api as unknown as AuthApiPort,
      oauth as unknown as OAuthPort,
      store as unknown as SessionStorePort,
    ),
  };
};

const okRedirect = (token = "tok-123"): MobileAuthRedirect => ({
  ok: true,
  token,
  action: "login",
  userId: 1,
});

beforeEach(() => {
  vi.clearAllMocks();
  pendingServerAuthAt = null;
});

// ─── Session ───

describe("AuthFacade.restore", () => {
  it("returns null and adopts nothing when there is no stored session", async () => {
    const { api, facade } = build();

    await expect(facade.restore()).resolves.toBeNull();
    expect(api.setSessionToken).not.toHaveBeenCalled();
  });

  it("adopts the stored token and returns the persisted user", async () => {
    const stored: StoredSession = {
      sessionToken: "tok-123",
      user: { ...authUser(), sessionToken: "tok-123", nickname: "ness" },
    };
    const { api, facade } = build({ store: makeStore({ load: async () => stored }) });

    await expect(facade.restore()).resolves.toBe(stored.user);
    expect(api.setSessionToken).toHaveBeenCalledWith("tok-123");
  });
});

describe("AuthFacade.getProviders", () => {
  it("merges server providers with the known defaults, de-duplicated", async () => {
    const { facade } = build({
      api: makeApi({
        getProviders: vi.fn(async () => [
          { name: "discord", label: "Discord (server)" },
          { name: "fluxer", label: "Fluxer" },
        ]),
      }),
    });

    const providers = await facade.getProviders();

    expect(providers.map((p) => p.name)).toEqual([
      "discord",
      "fluxer",
      "google",
      "apple",
    ]);
    // The server's label wins over the local default.
    expect(providers[0].label).toBe("Discord (server)");
  });

  it("falls back to the known defaults when the server call fails", async () => {
    const { facade } = build({
      api: makeApi({
        getProviders: vi.fn(async () => {
          throw new Error("offline");
        }),
      }),
    });

    const providers = await facade.getProviders();

    expect(providers.map((p) => p.name)).toEqual(["discord", "google", "apple"]);
  });

  it("returns the defaults when the server returns an empty list", async () => {
    const { facade } = build();

    const providers = await facade.getProviders();

    expect(providers.map((p) => p.name)).toEqual(["discord", "google", "apple"]);
  });
});

describe("AuthFacade profile reads", () => {
  it("reports the session status from the API", async () => {
    const { facade } = build();

    await expect(facade.getSessionStatus()).resolves.toBe(true);
  });

  it("refreshProfile keeps the local token, derives the nickname and persists", async () => {
    const refreshed = authUser({ id: 9, handle: null, username: "Haruka" });
    const { api, store, facade } = build({
      api: makeApi({
        refreshProfile: vi.fn(async () => ({
          updated: true,
          verified: true,
          user: refreshed,
        })),
        getProfile: vi.fn(async () => profile(refreshed)),
      }),
    });

    const result = await facade.refreshProfile({
      ...authUser(),
      sessionToken: "existing-token",
      nickname: "old",
    });

    expect(result.user.sessionToken).toBe("existing-token");
    expect(result.user.nickname).toBe("");
    expect(store.save).toHaveBeenCalledWith({
      sessionToken: "existing-token",
      user: result.user,
    });
    expect(api.getProfile).toHaveBeenCalledTimes(1);
  });
});

// ─── Login ───

describe("AuthFacade.loginWithProvider", () => {
  it("rejects an unknown provider", async () => {
    const { facade } = build();

    await expect(facade.loginWithProvider("myspace")).rejects.toThrow(
      /Unknown provider/,
    );
  });

  it("uses the native Apple identity token when available", async () => {
    const credential = {
      identityToken: "id-token",
      name: "Ness",
      firstName: "Ness",
      lastName: "F",
    };
    const { api, oauth, store, facade } = build({
      oauth: makeOAuth({ authorizeAppleNative: vi.fn(async () => credential) }),
      api: makeApi({ exchangeToken: vi.fn(async () => session()) }),
    });

    const user = await facade.loginWithProvider("apple");

    expect(api.exchangeToken).toHaveBeenCalledWith({
      provider: "apple",
      identityToken: "id-token",
      name: "Ness",
      firstName: "Ness",
      lastName: "F",
    });
    expect(user.sessionToken).toBe("tok-123");
    expect(user.nickname).toBe("ness");
    expect(store.save).toHaveBeenCalledTimes(1);
    expect(oauth.openSession).not.toHaveBeenCalled();
  });

  it("falls back to the server flow when there is no native Apple sheet", async () => {
    const { api, oauth, facade } = build({
      oauth: makeOAuth({
        authorizeAppleNative: vi.fn(async () => null),
        openSession: vi.fn(async () => "animuapp://redirect?token=tok-123"),
      }),
      api: makeApi({
        completeMobileAuth: vi.fn(() => okRedirect()),
      }),
    });

    await facade.loginWithProvider("apple");

    expect(oauth.openSession).toHaveBeenCalledWith(
      "https://auth.test/mobile/apple-start.php",
      "animuapp://redirect",
    );
    expect(api.setSessionToken).toHaveBeenCalledWith("tok-123");
  });

  it("adopts the session token from the server bounce", async () => {
    const { api, facade } = build({
      oauth: makeOAuth({
        openSession: vi.fn(async () => "animuapp://redirect?token=tok-123"),
      }),
      api: makeApi({
        completeMobileAuth: vi.fn(() => okRedirect()),
        getProfile: vi.fn(async () => profile(authUser({ id: 7 }))),
      }),
    });

    const user = await facade.loginWithProvider("discord");

    expect(user.sessionToken).toBe("tok-123");
    expect(user.id).toBe(7);
    expect(api.setSessionToken).toHaveBeenCalledWith("tok-123");
  });

  it("arms a pending-flow marker before the browser opens and discards it after", async () => {
    const openSession = vi.fn(async () => null);
    const { store, facade } = build({
      oauth: makeOAuth({ openSession }),
    });

    await facade.loginWithProvider("discord").catch(() => {});

    expect(store.markServerAuthPending).toHaveBeenCalledTimes(1);
    expect(store.markServerAuthPending.mock.invocationCallOrder[0]).toBeLessThan(
      openSession.mock.invocationCallOrder[0],
    );
    expect(store.discardServerAuthPending).toHaveBeenCalledTimes(1);
    expect(store.discardServerAuthPending.mock.invocationCallOrder[0]).toBeGreaterThan(
      openSession.mock.invocationCallOrder[0],
    );
  });

  it("throws AuthFlowCancelled when the browser flow is dismissed", async () => {
    const { facade } = build({
      oauth: makeOAuth({ openSession: vi.fn(async () => null) }),
    });

    await expect(facade.loginWithProvider("discord")).rejects.toBeInstanceOf(
      AuthFlowCancelled,
    );
  });

  it("surfaces the server's error message on a failed bounce", async () => {
    const { facade } = build({
      oauth: makeOAuth({
        openSession: vi.fn(async () => "animuapp://redirect?error=oauth"),
      }),
      api: makeApi({
        completeMobileAuth: vi.fn(
          (): MobileAuthRedirect => ({
            ok: false,
            error: "oauth",
            message: "bad state",
          }),
        ),
      }),
    });

    await expect(facade.loginWithProvider("discord")).rejects.toThrow(
      "oauth: bad state",
    );
  });

  it("runs the app-driven OAuth redirect for non-server providers", async () => {
    const oauthResult: OAuthResult = {
      code: "code-1",
      codeVerifier: "verifier-1",
    };
    const { api, facade } = build({
      oauth: makeOAuth({ authorize: vi.fn(async () => oauthResult) }),
      api: makeApi({ exchangeToken: vi.fn(async () => session()) }),
    });

    await facade.loginWithProvider("legacy");

    expect(api.exchangeToken).toHaveBeenCalledWith({
      provider: "legacy",
      code: "code-1",
      redirectUri: "animuapp://redirect",
      codeVerifier: "verifier-1",
    });
  });

  it("omits the redirect URI when the provider says so", async () => {
    const { api, facade } = build({
      oauth: makeOAuth({
        authorize: vi.fn(async () => ({
          code: "code-1",
          omitRedirectUri: true,
        })),
      }),
      api: makeApi({ exchangeToken: vi.fn(async () => session()) }),
    });

    await facade.loginWithProvider("legacy");

    expect(api.exchangeToken).toHaveBeenCalledWith({
      provider: "legacy",
      code: "code-1",
      redirectUri: undefined,
      codeVerifier: undefined,
    });
  });
});

describe("AuthFacade.resumeServerAuth", () => {
  it("ignores launch URLs that are not the auth redirect", async () => {
    const { api, facade, store } = build();

    await expect(facade.resumeServerAuth("animuapp://other")).resolves.toBeNull();
    await expect(facade.resumeServerAuth(null)).resolves.toBeNull();
    expect(api.completeMobileAuth).not.toHaveBeenCalled();
    // Non-redirect URLs must not consume the pending marker either.
    expect(store.takeServerAuthPending).not.toHaveBeenCalled();
  });

  it("ignores a redirect bounce when no server flow is pending (spoof protection)", async () => {
    const { api, store, facade } = build({
      api: makeApi({ completeMobileAuth: vi.fn(() => okRedirect("attacker")) }),
    });
    // No user-initiated flow: the marker was never armed.

    await expect(
      facade.resumeServerAuth("animuapp://redirect?token=attacker"),
    ).resolves.toBeNull();
    expect(api.completeMobileAuth).not.toHaveBeenCalled();
    expect(api.setSessionToken).not.toHaveBeenCalled();
    expect(store.save).not.toHaveBeenCalled();
  });

  it("adopts the session from a cold-start auth bounce armed by the user's flow", async () => {
    const { api, facade, store } = build({
      api: makeApi({ completeMobileAuth: vi.fn(() => okRedirect("cold-token")) }),
    });
    // The OS killed the app mid-flow: the listener's promise died, only the
    // marker and the launch URL remain.
    store.markServerAuthPending();

    const user = await facade.resumeServerAuth(
      "animuapp://redirect?token=cold-token",
    );

    expect(user?.sessionToken).toBe("cold-token");
    expect(api.setSessionToken).toHaveBeenCalledWith("cold-token");
    // One bounce, one marker: a second bounce cannot adopt without another flow.
    await expect(
      facade.resumeServerAuth("animuapp://redirect?token=cold-token"),
    ).resolves.toBeNull();
  });
});

describe("AuthFacade email-code login", () => {
  it("requests the login code", async () => {
    const { facade } = build({
      api: makeApi({
        requestEmailLoginCode: vi.fn(async () => ({ sent: true })),
      }),
    });

    await expect(facade.requestEmailLoginCode("a@b.c")).resolves.toEqual({
      sent: true,
    });
  });

  it("verifies the code and adopts the session", async () => {
    const { api, facade } = build({
      api: makeApi({ verifyEmailLoginCode: vi.fn(async () => session()) }),
    });

    const user = await facade.loginWithEmailCode("a@b.c", "1234");

    expect(api.verifyEmailLoginCode).toHaveBeenCalledWith({
      email: "a@b.c",
      code: "1234",
    });
    expect(user.sessionToken).toBe("tok-123");
  });
});

// ─── Account management ───

describe("AuthFacade.linkProvider", () => {
  it("rejects a provider that cannot be linked", async () => {
    const { facade } = build();

    await expect(facade.linkProvider("restricted")).rejects.toThrow(
      /cannot be linked/,
    );
  });

  it("links Apple through the native identity token", async () => {
    const { api, facade } = build({
      oauth: makeOAuth({
        authorizeAppleNative: vi.fn(async () => ({ identityToken: "id" })),
      }),
      api: makeApi({ linkProvider: vi.fn(async () => ({})) }),
    });

    await facade.linkProvider("apple");

    expect(api.linkProvider).toHaveBeenCalledWith({
      provider: "apple",
      identityToken: "id",
      name: undefined,
      firstName: undefined,
      lastName: undefined,
    });
  });

  it("requires an authenticated session for the server link flow", async () => {
    const { facade } = build();

    await expect(facade.linkProvider("discord")).rejects.toThrow(
      "Not authenticated",
    );
  });

  it("appends the session id and adopts the server bounce", async () => {
    const api = makeApi();
     api.getSessionToken.mockReturnValue("sid-1");
    api.completeMobileAuth.mockReturnValue(okRedirect());
    const oauth = makeOAuth({
      openSession: vi.fn(async () => "animuapp://redirect"),
    });
    const { facade } = build({ api, oauth });

    await facade.linkProvider("discord");

    expect(oauth.openSession).toHaveBeenCalledWith(
      "https://auth.test/mobile/discord-start.php?sid=sid-1",
      "animuapp://redirect",
    );
    expect(api.completeMobileAuth).toHaveBeenCalledWith("animuapp://redirect");
  });

  it("throws AuthFlowCancelled when the link browser is dismissed", async () => {
    const api = makeApi();
     api.getSessionToken.mockReturnValue("sid-1");
    const { facade } = build({ api });

    await expect(facade.linkProvider("discord")).rejects.toBeInstanceOf(
      AuthFlowCancelled,
    );
  });

  it("surfaces a failed link bounce", async () => {
    const api = makeApi();
     api.getSessionToken.mockReturnValue("sid-1");
    api.completeMobileAuth.mockReturnValue({
      ok: false,
      error: "link_conflict",
      message: null,
    } satisfies MobileAuthRedirect);
    const { facade } = build({
      api,
      oauth: makeOAuth({ openSession: vi.fn(async () => "animuapp://redirect") }),
    });

    await expect(facade.linkProvider("discord")).rejects.toThrow("link_conflict");
  });
});

describe("AuthFacade teardown", () => {
  it("logs out server-side, then forgets locally", async () => {
    const { api, store, facade } = build();

    await facade.logout();

    expect(api.logout).toHaveBeenCalledTimes(1);
    expect(api.setSessionToken).toHaveBeenCalledWith(null);
    expect(store.clear).toHaveBeenCalledTimes(1);
  });

  it("still forgets locally when the logout call fails", async () => {
    const api = makeApi({
      logout: vi.fn(async () => {
        throw new Error("network");
      }),
    });
    const { store, facade } = build({ api });

    await expect(facade.logout()).rejects.toThrow("network");
    expect(api.setSessionToken).toHaveBeenCalledWith(null);
    expect(store.clear).toHaveBeenCalledTimes(1);
  });

  it("deletes the account then forgets locally", async () => {
    const { api, store, facade } = build();

    await facade.deleteAccount();

    expect(api.deleteAccount).toHaveBeenCalledTimes(1);
    expect(store.clear).toHaveBeenCalledTimes(1);
  });

  it("forget clears the token without touching the server", async () => {
    const { api, store, facade } = build();

    await facade.forget();

    expect(api.setSessionToken).toHaveBeenCalledWith(null);
    expect(store.clear).toHaveBeenCalledTimes(1);
    expect(api.logout).not.toHaveBeenCalled();
  });
});
