import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
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
import { User } from "../../core/domain/user";
import { authFacade } from "../../core/auth";
import { backgroundService } from "../../core/services/background.service";
import { DEFAULT_PROVIDERS } from "../../constants/auth";

interface AuthContextType {
  user: User | null;
  profile: AuthProfile | null;
  providers: ProviderInfo[];
  isLoading: boolean;
  isAuthenticating: boolean;
  isAuthenticated: boolean;
  /**
   * Bumped whenever the avatar changes so image consumers can bust the
   * expo-image cache (the authenticated avatar endpoint keeps its URL).
   */
  imageVersion: number;
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
  uploadAvatar: (avatar: Blob, filename?: string) => Promise<void>;
  resetAvatar: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

const SESSION_CHECK_INTERVAL = 60000; // 1 minute
const SESSION_CHECK_TASK_ID = "session-check";

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<AuthProfile | null>(null);
  const [providers, setProviders] = useState<ProviderInfo[]>(
    DEFAULT_PROVIDERS,
  );
  const [emails, setEmails] = useState<AuthAccountEmail[]>([]);
  const [imageVersion, setImageVersion] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
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

  const startSessionCheck = useCallback(() => {
    backgroundService.stopTask(SESSION_CHECK_TASK_ID);
    backgroundService.startTask({
      id: SESSION_CHECK_TASK_ID,
      interval: SESSION_CHECK_INTERVAL,
      callback: async () => {
        const currentUser = userRef.current;
        if (!currentUser?.sessionToken) return;
        try {
          if (!(await authFacade.getSessionStatus())) {
            await clearSession();
          }
          // Network hiccups throw and are ignored below — they must not log
          // the listener out.
        } catch (error) {
          console.error("[AuthProvider] Session check failed:", error);
        }
      },
    });
  }, [clearSession]);

  const adoptUser = useCallback(
    async (nextUser: User) => {
      userRef.current = nextUser;
      setUser(nextUser);
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

  useEffect(() => {
    // StrictMode/remount guard: a finished initialization must not set
    // state on a discarded provider instance.
    let cancelled = false;
    const initializeAuth = async () => {
      try {
        void authFacade.getProviders().then((list) => {
          if (!cancelled) setProviders(list);
        });
        const storedUser = await authFacade.restore();

        // Cold-start recovery: if the OS killed the app during a server
        // provider's browser flow, the `animuapp://redirect` bounce arrives as
        // the launch URL. Adopt it before falling back to the cached session.
        const launchUrl = await Linking.getInitialURL().catch(() => null);
        const resumedUser = await authFacade.resumeServerAuth(launchUrl);
        if (resumedUser) {
          if (!cancelled) await adoptUser(resumedUser);
          return;
        }

        if (cancelled) return;

        if (storedUser) {
          userRef.current = storedUser;
          setUser(storedUser);
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
      } catch (error) {
        console.error("[AuthProvider] Initialization failed:", error);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    initializeAuth();

    return () => {
      cancelled = true;
      backgroundService.stopTask(SESSION_CHECK_TASK_ID);
    };
  }, [
    adoptUser,
    clearSession,
    loadProfile,
    refreshEmails,
    startSessionCheck,
  ]);

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

  const linkProvider = useCallback(
    async (provider: string) => {
      setIsAuthenticating(true);
      try {
        await authFacade.linkProvider(provider);
        await loadProfile();
        // Linking auto-registers the provider's email on Animu Connect.
        await refreshEmails();
      } finally {
        setIsAuthenticating(false);
      }
    },
    [loadProfile, refreshEmails],
  );

  const unlinkProvider = useCallback(
    async (provider: string) => {
      await authFacade.unlinkProvider(provider);
      await loadProfile();
      // Unlinking drops the provider's auto-registered email.
      await refreshEmails();
    },
    [loadProfile, refreshEmails],
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
    [],
  );

  const removeEmail = useCallback(
    async (emailId: number) => {
      const result = await authFacade.removeEmail(emailId);
      setEmails(result.emails);
      return result;
    },
    [],
  );

  const uploadAvatar = useCallback(
    async (avatar: Blob, filename?: string) => {
      await authFacade.uploadAvatar(avatar, filename);
      setImageVersion((version) => version + 1);
      await loadProfile();
    },
    [loadProfile],
  );

  const resetAvatar = useCallback(async () => {
    await authFacade.resetAvatar();
    setImageVersion((version) => version + 1);
    await loadProfile();
  }, [loadProfile]);

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        providers,
        isLoading,
        isAuthenticating,
        isAuthenticated: !!user,
        imageVersion,
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
        uploadAvatar,
        resetAvatar,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
};
