import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
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
  validateAndRefreshSession: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

const SESSION_CHECK_INTERVAL = 60000; // 1 minute

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const logout = useCallback(async () => {
    try {
      await authService.logout(user?.sessionId);
    } catch (error) {
      console.error("[AuthProvider] Logout failed:", error);
    } finally {
      setUser(null);
    }
  }, [user]);

  const validateAndRefreshSession = useCallback(async () => {
    console.log("[AuthProvider] Validating session...");

    if (!user?.sessionId) return;

    try {
      const isValid = await authService.validateSession(user.sessionId);
      if (!isValid) {
        console.log("[AuthProvider] Session invalid, logging out");
        await logout();
      }
    } catch (error) {
      console.error("[AuthProvider] Session validation failed:", error);
      await logout();
    }
  }, [user, logout]);

  // Initialize auth on mount
  useEffect(() => {
    const initializeAuth = async () => {
      try {
        const storedUser = await authService.getStoredUser();

        if (storedUser) {
          const isValid = await authService.validateSession(
            storedUser.sessionId
          );
          if (isValid) {
            setUser(storedUser);
          } else {
            await authService.logout();
          }
        }
      } catch (error) {
        console.error("[AuthProvider] Initialization failed:", error);
      } finally {
        setIsLoading(false);

        await backgroundService.startTask({
          id: "session-check",
          callback: validateAndRefreshSession,
          interval: SESSION_CHECK_INTERVAL,
          backgroundTask: false,
        });
      }

      return () => {
        backgroundService.stopTask("session-check");
      };
    };

    initializeAuth();
  }, []);

  const login = async () => {
    try {
      setIsLoading(true);
      const newUser = await authService.login();
      setUser(newUser);
    } catch (error) {
      console.error("[AuthProvider] Login failed:", error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        login,
        logout,
        validateAndRefreshSession,
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
