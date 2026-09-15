import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
} from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Linking } from "react-native";
import type {
  AuthProfile,
  AuthSetCredentialsParams,
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
  /** `null` until we know, then whether Animu Connect is configured. */
  credentialsSet: boolean | null;
  /** Last known Animu Connect username (login credential), when available. */
  credentialsUsername: string | null;
  /**
   * Bumped whenever the avatar changes so image consumers can bust the
   * expo-image cache (the authenticated avatar endpoint keeps its URL).
   */
  imageVersion: number;
  loginWithProvider: (provider: string) => Promise<void>;
  loginWithAnimuConnect: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  deleteAccount: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  linkProvider: (provider: string) => Promise<void>;
  unlinkProvider: (provider: string) => Promise<void>;
  setCredentials: (params: AuthSetCredentialsParams) => Promise<void>;
  uploadAvatar: (avatar: Blob, filename?: string) => Promise<void>;
  resetAvatar: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

const SESSION_CHECK_INTERVAL = 60000; // 1 minute
const SESSION_CHECK_TASK_ID = "session-check";
/**
 * The profile payload has no read endpoint for Animu Connect credential
 * state, so the result of `setCredentials` is cached locally — otherwise
 * every relaunch renders the "Set up" state for an already-configured
 * account (and the update flow hides the current-password requirement).
 */
const CREDENTIALS_KEY = "animuConnectCredentials";

type StoredCredentials = { userId: number; username: string; setUp: boolean };

const readStoredCredentials = async (): Promise<StoredCredentials | null> => {
  try {
    const raw = await AsyncStorage.getItem(CREDENTIALS_KEY);
    return raw ? (JSON.parse(raw) as StoredCredentials) : null;
  } catch {
    return null;
  }
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<AuthProfile | null>(null);
  const [providers, setProviders] = useState<ProviderInfo[]>(
    DEFAULT_PROVIDERS,
  );
  const [credentialsSet, setCredentialsSet] = useState<boolean | null>(null);
  const [credentialsUsername, setCredentialsUsername] = useState<string | null>(
    null,
  );
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
    setCredentialsSet(null);
    setCredentialsUsername(null);
  }, []);

  const loadProfile = useCallback(async () => {
    try {
      setProfile(await authFacade.getProfile());
    } catch (error) {
      console.error("[AuthProvider] Failed to load profile:", error);
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
    },
    [loadProfile, startSessionCheck],
  );

  const refreshProfile = useCallback(async () => {
    const current = userRef.current;
    if (!current) return;
    const result = await authFacade.refreshProfile(current);
    userRef.current = result.user;
    setUser(result.user);
    setProfile(result.profile);
  }, []);

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
    const initializeAuth = async () => {
      try {
        void authFacade.getProviders().then(setProviders);
        const [storedCredentials, storedUser] = await Promise.all([
          readStoredCredentials(),
          authFacade.restore(),
        ]);

        // Cold-start recovery: if the OS killed the app during a server
        // provider's browser flow, the `animuapp://redirect` bounce arrives as
        // the launch URL. Adopt it before falling back to the cached session.
        const launchUrl = await Linking.getInitialURL().catch(() => null);
        const resumedUser = await authFacade.resumeServerAuth(launchUrl);
        if (resumedUser) {
          await adoptUser(resumedUser);
          return;
        }

        // Only surface cached credential state for the account it belongs to.
        if (storedCredentials && storedCredentials.userId === storedUser?.id) {
          setCredentialsSet(storedCredentials.setUp);
          setCredentialsUsername(storedCredentials.username || null);
        }
        if (storedUser) {
          userRef.current = storedUser;
          setUser(storedUser);
          try {
            if (await authFacade.getSessionStatus()) {
              startSessionCheck();
              void loadProfile();
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
        setIsLoading(false);
      }
    };

    initializeAuth();

    return () => {
      backgroundService.stopTask(SESSION_CHECK_TASK_ID);
    };
  }, [adoptUser, clearSession, loadProfile, startSessionCheck]);

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

  const loginWithAnimuConnect = useCallback(
    async (username: string, password: string) => {
      setIsAuthenticating(true);
      try {
        await adoptUser(
          await authFacade.loginWithAnimuConnect(username, password),
        );
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
      } finally {
        setIsAuthenticating(false);
      }
    },
    [loadProfile],
  );

  const unlinkProvider = useCallback(
    async (provider: string) => {
      await authFacade.unlinkProvider(provider);
      await loadProfile();
    },
    [loadProfile],
  );

  const setCredentials = useCallback(
    async (params: AuthSetCredentialsParams) => {
      const result = await authFacade.setCredentials(params);
      setCredentialsSet(result.setUp);
      if (result.username) setCredentialsUsername(result.username);
      const userId = userRef.current?.id;
      if (userId == null) return;
      try {
        await AsyncStorage.setItem(
          CREDENTIALS_KEY,
          JSON.stringify({
            userId,
            username: result.username,
            setUp: result.setUp,
          } satisfies StoredCredentials),
        );
      } catch (error) {
        console.warn("[AuthProvider] Failed to cache credentials state:", error);
      }
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
        credentialsSet,
        credentialsUsername,
        imageVersion,
        loginWithProvider,
        loginWithAnimuConnect,
        logout,
        deleteAccount,
        refreshProfile,
        linkProvider,
        unlinkProvider,
        setCredentials,
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
