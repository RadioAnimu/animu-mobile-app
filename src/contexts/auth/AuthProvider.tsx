import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useMemo,
  useRef,
} from "react";
import { Linking } from "react-native";
import type {
  AuthAccountEmail,
  AuthEmailRequestResult,
  AuthEmailsResult,
  AuthProfile,
  AuthRemoveEmailResult,
  ProviderInfo,
} from "animu-api";
import { User } from "@/core/domain/user";
import { authFacade, isRetryableRequestFailure } from "@/core/auth";
import {
  useProfileMedia,
  type ProfileMedia,
} from "@/contexts/auth/useProfileMedia";
import { clearProfileMedia } from "@/core/services/profile-media.service";
import { DEFAULT_PROVIDERS } from "@/constants/auth";
import { useAlert } from "@/contexts/alert/AlertProvider";
import { useIsBackgrounded } from "@/contexts/app-state/AppStateProvider";
import { useDict } from "@/hooks/useDict";
import { repeatEvery } from "@/utils/repeat";

interface AuthContextType {
  user: User | null;
  profile: AuthProfile | null;
  providers: ProviderInfo[];
  isAuthenticating: boolean;
  isAuthenticated: boolean;
  /**
   * Bumped whenever the avatar changes so image consumers can bust the
   * expo-image cache (the authenticated avatar endpoint keeps its URL).
   */
  imageVersion: number;
  /**
   * Locally saved copies of the user's avatar and banner. Prefer these over
   * the remote URLs; they are refreshed in the background and survive
   * restarts and offline use.
   */
  media: ProfileMedia;
  loginWithProvider: (provider: string) => Promise<void>;
  /** Animu Connect login, step 1: request the emailed 4-digit code. */
  requestEmailLoginCode: (email: string) => Promise<AuthEmailRequestResult>;
  /** Animu Connect login, step 2: verify the code and adopt the session. */
  loginWithEmailCode: (email: string, code: string) => Promise<void>;
  logout: () => Promise<void>;
  deleteAccount: () => Promise<void>;
  /** Resolves with the fresh profile (null while signed out). */
  refreshProfile: () => Promise<AuthProfile | null>;
  linkProvider: (provider: string) => Promise<void>;
  unlinkProvider: (provider: string) => Promise<void>;
  /**
   * The account's Animu Connect emails: provider emails (auto-registered at
   * login/link, never removable) plus the optional single extra
   * `source: "animu"` email.
   */
  emails: AuthAccountEmail[];
  refreshEmails: () => Promise<void>;
  requestAddEmail: (email: string) => Promise<AuthEmailRequestResult>;
  verifyAddEmail: (email: string, code: string) => Promise<AuthEmailsResult>;
  removeEmail: (emailId: number) => Promise<AuthRemoveEmailResult>;
}

const AuthContext = createContext<AuthContextType | null>(null);

const SESSION_CHECK_INTERVAL = 60000; // 1 minute

type UserRef = React.RefObject<User | null>;
type StopRef = React.RefObject<(() => void) | null>;

/**
 * The one guard for async auth work: an answer applies only while the session
 * it ran for is still the signed-in one (not signed out, nor replaced).
 */
const isCurrentSession = (userRef: UserRef, token: string | undefined): boolean =>
  token != null && userRef.current?.sessionToken === token;

const stopPoll = (stopRef: StopRef): void => {
  stopRef.current?.();
  stopRef.current = null;
};

interface AuthBootstrapDeps {
  userRef: UserRef;
  setUser: (user: User | null) => void;
  setProviders: (providers: ProviderInfo[]) => void;
  setImageVersion: React.Dispatch<React.SetStateAction<number>>;
  /** Signs out because the server rejected the token, and tells the user. */
  expireSession: () => Promise<void>;
  loadProfile: () => Promise<void>;
  refreshEmails: () => Promise<void>;
  startSessionCheck: () => void;
}

/**
 * Server-side validation still gates a restored/resumed session: a bounce
 * whose token the server does not recognize drops here instead of silently
 * living until the next launch. Offline (any throw) keeps the cached
 * session — the next periodic check re-validates.
 */
async function validateActiveSession({
  userRef,
  expireSession,
  loadProfile,
  refreshEmails,
  startSessionCheck,
}: Pick<
  AuthBootstrapDeps,
  "userRef" | "expireSession" | "loadProfile" | "refreshEmails" | "startSessionCheck"
>): Promise<void> {
  const token = userRef.current?.sessionToken;
  try {
    const alive = await authFacade.getSessionStatus();
    if (!isCurrentSession(userRef, token)) return;
    if (alive) {
      startSessionCheck();
      void loadProfile();
      void refreshEmails();
    } else {
      await expireSession();
    }
  } catch {
    // Offline: keep the cached session, the next check re-validates.
    if (isCurrentSession(userRef, token)) startSessionCheck();
  }
}

/**
 * A launch bounce that carries a failure (e.g. `error=oauth&msg=email already
 * taken`) must not take the cached session down with it: the flow is simply
 * over. The bounce doesn't name its provider and the user may have long left
 * the screen that started it, so unlike the in-app login nothing is surfaced.
 */
async function resumeLaunchFlow(
  launchUrl: string | null,
): Promise<User | null> {
  try {
    return await authFacade.resumeServerAuth(launchUrl);
  } catch (error) {
    console.warn("[AuthProvider] Launch auth bounce failed:", error);
    return null;
  }
}

async function runAuthBootstrap(
  deps: AuthBootstrapDeps,
  isCancelled: () => boolean,
): Promise<void> {
  try {
    void authFacade.getProviders().then((list) => {
      if (!isCancelled()) deps.setProviders(list);
    });
    const storedUser = await authFacade.restore();

    // Cold-start recovery: if the OS killed the app during a server
    // provider's browser flow, the `animuapp://redirect` bounce arrives as
    // the launch URL. The facade only adopts it when a pending-flow
    // marker proves the user started that flow (spoofed links and
    // SDK intents are ignored), and it still falls back to the cached
    // session otherwise.
    const launchUrl = (await Linking.getInitialURL().catch(() => null)) ?? null;
    const resumedUser = await resumeLaunchFlow(launchUrl);
    const activeUser = resumedUser ?? storedUser;

    if (isCancelled() || !activeUser) return;

    deps.userRef.current = activeUser;
    deps.setUser(activeUser);
    if (resumedUser) {
      // A fresh login can swap the account media: bust the image cache.
      deps.setImageVersion((version) => version + 1);
    }
    await validateActiveSession(deps);
  } catch (error) {
    console.error("[AuthProvider] Initialization failed:", error);
  }
}

/**
 * Cold-start initialization: loads the provider list, restores the cached
 * session, and recovers a session whose browser flow the OS killed.
 */
function useAuthBootstrap(deps: AuthBootstrapDeps): void {
  const {
    userRef,
    setUser,
    setProviders,
    setImageVersion,
    expireSession,
    loadProfile,
    refreshEmails,
    startSessionCheck,
  } = deps;

  useEffect(() => {
    // StrictMode/remount guard: a finished initialization must not set
    // state on a discarded provider instance.
    let cancelled = false;
    void runAuthBootstrap(
      {
        userRef,
        setUser,
        setProviders,
        setImageVersion,
        expireSession,
        loadProfile,
        refreshEmails,
        startSessionCheck,
      },
      () => cancelled,
    );

    return () => {
      cancelled = true;
    };
  }, [
    userRef,
    setUser,
    setProviders,
    setImageVersion,
    expireSession,
    loadProfile,
    refreshEmails,
    startSessionCheck,
  ]);
}

interface AccountActionsDeps {
  userRef: UserRef;
  loadProfile: () => Promise<void>;
  refreshEmails: () => Promise<void>;
  setEmails: (emails: AuthAccountEmail[]) => void;
  setImageVersion: React.Dispatch<React.SetStateAction<number>>;
  setIsAuthenticating: (value: boolean) => void;
}

/** Provider linking and Animu Connect email management for the signed-in account. */
function useAccountActions({
  userRef,
  loadProfile,
  refreshEmails,
  setEmails,
  setImageVersion,
  setIsAuthenticating,
}: AccountActionsDeps) {
  const linkProvider = useCallback(
    async (provider: string) => {
      setIsAuthenticating(true);
      try {
        await authFacade.linkProvider(provider);
        // Linking can change the identity source (and thus the avatar/banner).
        setImageVersion((version) => version + 1);
        await loadProfile();
        // Linking auto-registers the provider's email on Animu Connect.
        await refreshEmails();
      } finally {
        setIsAuthenticating(false);
      }
    },
    [loadProfile, refreshEmails, setImageVersion, setIsAuthenticating],
  );

  const unlinkProvider = useCallback(
    async (provider: string) => {
      await authFacade.unlinkProvider(provider);
      // Unlinking can change the identity source (and thus the avatar/banner).
      setImageVersion((version) => version + 1);
      await loadProfile();
      // Unlinking drops the provider's auto-registered email.
      await refreshEmails();
    },
    [loadProfile, refreshEmails, setImageVersion],
  );

  const requestAddEmail = useCallback(
    (email: string) => authFacade.requestAddEmail(email),
    [],
  );

  const verifyAddEmail = useCallback(
    async (email: string, code: string) => {
      const token = userRef.current?.sessionToken;
      const result = await authFacade.verifyAddEmail({ email, code });
      if (isCurrentSession(userRef, token)) setEmails(result.emails);
      return result;
    },
    [setEmails, userRef],
  );

  const removeEmail = useCallback(
    async (emailId: number) => {
      const token = userRef.current?.sessionToken;
      const result = await authFacade.removeEmail(emailId);
      if (isCurrentSession(userRef, token)) setEmails(result.emails);
      return result;
    },
    [setEmails, userRef],
  );

  return {
    linkProvider,
    unlinkProvider,
    requestAddEmail,
    verifyAddEmail,
    removeEmail,
  };
}

/**
 * Polls the session while someone can see the result. Backgrounded (e.g.
 * listening with the screen off) the poll would wake the radio every minute
 * for nothing, so it pauses and re-checks once on return.
 */
function useSessionCheck(
  userRef: UserRef,
  expireSession: () => Promise<void>,
  stopRef: StopRef,
): () => void {
  const isBackgrounded = useIsBackgrounded();
  /** Read by `startSessionCheck`, which a login may call from the background. */
  const backgroundedRef = useRef(isBackgrounded);

  const runSessionCheck = useCallback(async () => {
    const token = userRef.current?.sessionToken;
    if (!token) return;
    try {
      const alive = await authFacade.getSessionStatus();
      // A dead answer for a session already replaced must not end the new one.
      if (!alive && isCurrentSession(userRef, token)) await expireSession();
      // Network hiccups throw and are ignored below — they must not log
      // the listener out.
    } catch (error) {
      console.error("[AuthProvider] Session check failed:", error);
    }
  }, [expireSession, userRef]);

  const startSessionCheck = useCallback(() => {
    stopPoll(stopRef);
    // Hidden: the return re-checks and starts the poll (below).
    if (backgroundedRef.current) return;
    stopRef.current = repeatEvery(SESSION_CHECK_INTERVAL, runSessionCheck);
  }, [runSessionCheck, stopRef]);

  useEffect(() => () => stopPoll(stopRef), [stopRef]);

  useEffect(() => {
    const returning = backgroundedRef.current && !isBackgrounded;
    backgroundedRef.current = isBackgrounded;
    if (isBackgrounded) {
      stopPoll(stopRef);
      return;
    }
    if (!returning || !userRef.current) return;
    void runSessionCheck();
    startSessionCheck();
  }, [isBackgrounded, runSessionCheck, startSessionCheck, stopRef, userRef]);

  return startSessionCheck;
}

/**
 * Owns all auth state and side effects. Kept separate from the provider so the
 * component stays a thin shell and this logic is testable in isolation.
 */
function useAuthProviderValue(): AuthContextType {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<AuthProfile | null>(null);
  const [providers, setProviders] = useState<ProviderInfo[]>(DEFAULT_PROVIDERS);
  const [emails, setEmails] = useState<AuthAccountEmail[]>([]);
  const [imageVersion, setImageVersion] = useState(0);
  const [isAuthenticating, setIsAuthenticating] = useState(false);

  // Ref avoids stale closures in the poll's callback
  const userRef = useRef<User | null>(null);
  /** Stops the session poll (owned by useSessionCheck, ended here too). */
  const stopPollRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    userRef.current = user;
  }, [user]);

  const clearSession = useCallback(async () => {
    stopPoll(stopPollRef);
    await authFacade.forget();
    userRef.current = null;
    clearProfileMedia();
    setUser(null);
    setProfile(null);
    setEmails([]);
  }, []);

  // Read through a ref (like `userRef`) so the stable `expireSession` below,
  // captured by the poll's background task, never speaks a stale language.
  const noticeRef = useRef<() => void>(() => {});
  const { toast } = useAlert();
  const dict = useDict();

  useEffect(() => {
    noticeRef.current = () => toast(dict.SESSION_EXPIRED, "error");
  }, [toast, dict]);

  // Only the two server-rejected paths come through here; logout, account
  // deletion and offline errors keep their own silent handling. Skipping when
  // nobody is signed in any more means a check that loses a race with a
  // manual sign-out cannot toast, and claiming the ref before the first
  // await keeps a second in-flight check to a single toast per expiry.
  const expireSession = useCallback(async () => {
    if (!userRef.current) return;
    userRef.current = null;
    await clearSession();
    noticeRef.current();
  }, [clearSession]);

  const loadProfile = useCallback(async () => {
    const token = userRef.current?.sessionToken;
    try {
      const next = await authFacade.getProfile();
      if (isCurrentSession(userRef, token)) setProfile(next);
    } catch (error) {
      console.error("[AuthProvider] Failed to load profile:", error);
    }
  }, []);

  const refreshEmails = useCallback(async () => {
    const token = userRef.current?.sessionToken;
    try {
      const { emails: next } = await authFacade.getEmails();
      if (isCurrentSession(userRef, token)) setEmails(next);
    } catch (error) {
      console.error("[AuthProvider] Failed to load emails:", error);
    }
  }, []);

  const startSessionCheck = useSessionCheck(userRef, expireSession, stopPollRef);

  const adoptUser = useCallback(
    async (nextUser: User) => {
      userRef.current = nextUser;
      setUser(nextUser);
      // A fresh login can carry different avatar/banner media than whatever is
      // cached for this device (the authenticated media endpoints keep their
      // URL), so bust the image cache or the previous account's banner sticks.
      setImageVersion((version) => version + 1);
      startSessionCheck();
      void loadProfile();
      void refreshEmails();
    },
    [loadProfile, refreshEmails, startSessionCheck],
  );

  const refreshProfile = useCallback(async () => {
    const current = userRef.current;
    if (!current) return null;
    const result = await authFacade.refreshProfile(current);
    if (!result || !isCurrentSession(userRef, current.sessionToken)) return null;
    userRef.current = result.user;
    setUser(result.user);
    setProfile(result.profile);
    // The server refresh can replace the avatar/banner bytes behind the stable
    // authenticated URLs (e.g. a newly pulled Discord banner) — bust the image
    // cache so the fresh media is actually fetched instead of served stale.
    setImageVersion((version) => version + 1);
    // The provider refresh can rename/verify the auto-registered emails.
    await refreshEmails();
    return result.profile;
  }, [refreshEmails]);

  const logout = useCallback(async () => {
    // Leaving on purpose: drop the ref before the network call so a session
    // poll already in flight can't read this as an expiry and toast it.
    userRef.current = null;
    try {
      await authFacade.logout();
    } catch (error) {
      console.error("[AuthProvider] Logout failed:", error);
    } finally {
      await clearSession();
    }
  }, [clearSession]);

  const deleteAccount = useCallback(async () => {
    const previous = userRef.current;
    // Same as logout: an in-flight poll must not toast this as an expiry.
    userRef.current = null;
    try {
      await authFacade.deleteAccount();
    } catch (error) {
      // A retryable failure (offline, timeout, 5xx) left the account and its
      // session alive server-side, so the user stays signed in and can retry:
      // put the ref back so the poll keeps watching this session. Any other
      // failure killed the session (401, another 4xx, unconfirmed deletion), so
      // clear the local state too or the app looks signed in over a dead token.
      if (isRetryableRequestFailure(error)) {
        userRef.current = previous;
      } else {
        await clearSession();
      }
      throw error;
    }
    await clearSession();
  }, [clearSession]);

  useAuthBootstrap({
    userRef,
    setUser,
    setProviders,
    setImageVersion,
    expireSession,
    loadProfile,
    refreshEmails,
    startSessionCheck,
  });

  const loginWithProvider = useCallback(
    async (provider: string) => {
      setIsAuthenticating(true);
      try {
        await adoptUser(await authFacade.loginWithProvider(provider));
      } finally {
        setIsAuthenticating(false);
      }
    },
    [adoptUser],
  );

  const requestEmailLoginCode = useCallback(
    (email: string) => authFacade.requestEmailLoginCode(email),
    [],
  );

  const loginWithEmailCode = useCallback(
    async (email: string, code: string) => {
      setIsAuthenticating(true);
      try {
        await adoptUser(await authFacade.loginWithEmailCode(email, code));
      } finally {
        setIsAuthenticating(false);
      }
    },
    [adoptUser],
  );

  const {
    linkProvider,
    unlinkProvider,
    requestAddEmail,
    verifyAddEmail,
    removeEmail,
  } = useAccountActions({
    userRef,
    loadProfile,
    refreshEmails,
    setEmails,
    setImageVersion,
    setIsAuthenticating,
  });

  const media = useProfileMedia(user, profile, imageVersion);

  return useMemo<AuthContextType>(
    () => ({
      user,
      profile,
      providers,
      isAuthenticating,
      isAuthenticated: !!user,
      imageVersion,
      media,
      loginWithProvider,
      requestEmailLoginCode,
      loginWithEmailCode,
      logout,
      deleteAccount,
      refreshProfile,
      linkProvider,
      unlinkProvider,
      emails,
      refreshEmails,
      requestAddEmail,
      verifyAddEmail,
      removeEmail,
    }),
    [
      user,
      profile,
      providers,
      isAuthenticating,
      imageVersion,
      media,
      loginWithProvider,
      requestEmailLoginCode,
      loginWithEmailCode,
      logout,
      deleteAccount,
      refreshProfile,
      linkProvider,
      unlinkProvider,
      emails,
      refreshEmails,
      requestAddEmail,
      verifyAddEmail,
      removeEmail,
    ],
  );
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const value = useAuthProviderValue();
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
};
