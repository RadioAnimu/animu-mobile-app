import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
} from "react";
import { User } from "../../core/domain/user";
import { authService } from "../../core/services/auth.service";
import { backgroundService } from "../../core/services/background.service";

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

const SESSION_CHECK_INTERVAL = 60000; // 1 minute
const SESSION_CHECK_TASK_ID = "session-check";

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Ref avoids stale closures in the background task callback
  const userRef = useRef<User | null>(null);

  useEffect(() => {
    userRef.current = user;
  }, [user]);

  const clearSession = useCallback(async () => {
    backgroundService.stopTask(SESSION_CHECK_TASK_ID);
    await authService.clearStoredUser();
    userRef.current = null;
    setUser(null);
  }, []);

  const logout = useCallback(async () => {
    const sessionId = userRef.current?.sessionId;
    try {
      if (sessionId) {
        await authService.logoutFromServer(sessionId);
      }
    } catch (error) {
      console.error("[AuthProvider] Server logout failed:", error);
    } finally {
      await clearSession();
    }
  }, [clearSession]);

  const startSessionCheck = useCallback(() => {
    backgroundService.stopTask(SESSION_CHECK_TASK_ID);

    backgroundService.startTask({
      id: SESSION_CHECK_TASK_ID,
      interval: SESSION_CHECK_INTERVAL,
      callback: async () => {
        const currentUser = userRef.current;
        if (!currentUser?.sessionId) return;

        try {
          const isValid = await authService.validateSession(
            currentUser.sessionId,
          );
          if (!isValid) {
            await clearSession();
          }
        } catch (error) {
          console.error("[AuthProvider] Session check failed:", error);
          await clearSession();
        }
      },
    });
  }, [clearSession]);

  // Initialize auth on mount
  useEffect(() => {
    const initializeAuth = async () => {
      try {
        const storedUser = await authService.getStoredUser();

        if (storedUser) {
          const isValid = await authService.validateSession(
            storedUser.sessionId,
          );
          if (isValid) {
            userRef.current = storedUser;
            setUser(storedUser);
            startSessionCheck();
          } else {
            await authService.clearStoredUser();
          }
        }
      } catch (error) {
        console.error("[AuthProvider] Initialization failed:", error);
      } finally {
        setIsLoading(false);
      }
    };

    initializeAuth();

    // Proper cleanup — returned from the effect, not from the async fn
    return () => {
      backgroundService.stopTask(SESSION_CHECK_TASK_ID);
    };
  }, [startSessionCheck]);

  const login = useCallback(async () => {
    try {
      setIsLoading(true);
      const newUser = await authService.login();
      userRef.current = newUser;
      setUser(newUser);
      startSessionCheck();
    } catch (error) {
      console.error("[AuthProvider] Login failed:", error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [startSessionCheck]);

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        login,
        logout,
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
