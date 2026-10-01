import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useMemo,
  useRef,
} from "react";
import { AppState, Linking } from "react-native";
import type {
  AuthAccountEmail,
  AuthEmailRequestResult,
  AuthEmailsResult,
  AuthProfile,
  AuthRemoveEmailResult,
  ProviderInfo,
} from "animu-api";
import { User } from "@/core/domain/user";
import { authFacade } from "@/core/auth";
import {
  useProfileMedia,
  type ProfileMedia,
} from "@/contexts/auth/useProfileMedia";
import { clearProfileMedia } from "@/core/services/profile-media.service";
import { backgroundService } from "@/core/services/background.service";
import { DEFAULT_PROVIDERS } from "@/constants/auth";

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
  refreshProfile: () => Promise<void>;
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
const SESSION_CHECK_TASK_ID = "session-check";

interface AuthBootstrapDeps {
  userRef: React.RefObject<User | null>;
  setUser: (user: User | null) => void;
  setProviders: (providers: ProviderInfo[]) => void;
  setImageVersion: React.Dispatch<React.SetStateAction<number>>;
  clearSession: () => Promise<void>;
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
  clearSession,
  loadProfile,
  refreshEmails,
  startSessionCheck,
}: Pick<
  AuthBootstrapDeps,
  "clearSession" | "loadProfile" | "refreshEmails" | "startSessionCheck"
>): Promise<void> {
  try {
    if (await authFacade.getSessionStatus()) {
      startSessionCheck();
      void loadProfile();
      void refreshEmails();
    } else {
      await clearSession();
    }
  } catch {
    // Offline: keep the cached session, the next check re-validates.
    startSessionCheck();
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
    const launchUrl = await Linking.getInitialURL().catch(() => null);
    const resumedUser = await authFacade.resumeServerAuth(launchUrl);
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
    clearSession,
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
        clearSession,
        loadProfile,
        refreshEmails,
        startSessionCheck,
      },
      () => cancelled,
    );

    return () => {
      cancelled = true;
      backgroundService.stopTask(SESSION_CHECK_TASK_ID);
    };
  }, [
    userRef,
    setUser,
    setProviders,
    setImageVersion,
    clearSession,
    loadProfile,
    refreshEmails,
    startSessionCheck,
  ]);
}

interface AccountActionsDeps {
  loadProfile: () => Promise<void>;
  refreshEmails: () => Promise<void>;
  setEmails: (emails: AuthAccountEmail[]) => void;
  setImageVersion: React.Dispatch<React.SetStateAction<number>>;
  setIsAuthenticating: (value: boolean) => void;
}

/** Provider linking and Animu Connect email management for the signed-in account. */
function useAccountActions({
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
      const result = await authFacade.verifyAddEmail({ email, code });
      setEmails(result.emails);
      return result;
    },
    [setEmails],
  );

  const removeEmail = useCallback(
    async (emailId: number) => {
      const result = await authFacade.removeEmail(emailId);
      setEmails(result.emails);
      return result;
    },
    [setEmails],
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
  userRef: React.MutableRefObject<User | null>,
  clearSession: () => Promise<void>,
): () => void {
  const pausedRef = useRef(false);

  const runSessionCheck = useCallback(async () => {
    if (!userRef.current?.sessionToken) return;
    try {
      if (!(await authFacade.getSessionStatus())) {
        await clearSession();
      }
      // Network hiccups throw and are ignored below — they must not log
      // the listener out.
    } catch (error) {
      console.error("[AuthProvider] Session check failed:", error);
    }
  }, [clearSession, userRef]);

  const startSessionCheck = useCallback(() => {
    backgroundService.stopTask(SESSION_CHECK_TASK_ID);
    if (AppState.currentState === "background") {
      pausedRef.current = true;
      return;
    }
    backgroundService.startTask({
      id: SESSION_CHECK_TASK_ID,
      interval: SESSION_CHECK_INTERVAL,
      callback: runSessionCheck,
    });
  }, [runSessionCheck]);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (next) => {
      if (next === "background") {
        pausedRef.current = true;
        backgroundService.stopTask(SESSION_CHECK_TASK_ID);
        return;
      }
      if (next === "active" && pausedRef.current) {
        pausedRef.current = false;
        if (!userRef.current) return;
        void runSessionCheck();
        startSessionCheck();
      }
    });
    return () => subscription.remove();
  }, [runSessionCheck, startSessionCheck, userRef]);

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

  // Ref avoids stale closures in the background task callback
  const userRef = useRef<User | null>(null);

  useEffect(() => {
    userRef.current = user;
  }, [user]);

  const clearSession = useCallback(async () => {
    backgroundService.stopTask(SESSION_CHECK_TASK_ID);
    await authFacade.forget();
    userRef.current = null;
    clearProfileMedia();
    setUser(null);
    setProfile(null);
    setEmails([]);
  }, []);

  const loadProfile = useCallback(async () => {
    try {
      setProfile(await authFacade.getProfile());
    } catch (error) {
      console.error("[AuthProvider] Failed to load profile:", error);
    }
  }, []);

  const refreshEmails = useCallback(async () => {
    try {
      setEmails((await authFacade.getEmails()).emails);
    } catch (error) {
      console.error("[AuthProvider] Failed to load emails:", error);
    }
  }, []);

  const startSessionCheck = useSessionCheck(userRef, clearSession);

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
    if (!current) return;
    const result = await authFacade.refreshProfile(current);
    userRef.current = result.user;
    setUser(result.user);
    setProfile(result.profile);
    // The server refresh can replace the avatar/banner bytes behind the stable
    // authenticated URLs (e.g. a newly pulled Discord banner) — bust the image
    // cache so the fresh media is actually fetched instead of served stale.
    setImageVersion((version) => version + 1);
    // The provider refresh can rename/verify the auto-registered emails.
    await refreshEmails();
  }, [refreshEmails]);

  const logout = useCallback(async () => {
    try {
      await authFacade.logout();
    } catch (error) {
      console.error("[AuthProvider] Logout failed:", error);
    } finally {
      await clearSession();
    }
  }, [clearSession]);

  const deleteAccount = useCallback(async () => {
    try {
      await authFacade.deleteAccount();
    } finally {
      // The facade forgets the local session even when the API call fails;
      // clear the React state too, or the app looks signed in over a dead
      // token (every authenticated request would 401).
      await clearSession();
    }
  }, [clearSession]);

  useAuthBootstrap({
    userRef,
    setUser,
    setProviders,
    setImageVersion,
    clearSession,
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
