import React, { createContext, useContext, useEffect, useState } from "react";
import { User } from "../../core/domain/user";
import { authService } from "../../core/services/auth.service";

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  isLoading: true,
  login: async () => {},
  logout: async () => {},
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const initializeAuth = async () => {
      try {
        const user = await authService.initialize();
        if (user) {
          const isValid = await authService.validateSession();
          if (!isValid) {
            await authService.logout();
            setUser(null);
          } else {
            setUser(user);
          }
        }
      } catch (error) {
        console.error("[AuthProvider] Initialization failed:", error);
      } finally {
        setIsLoading(false);
      }
    };

    initializeAuth();
  }, []);

  const login = async () => {
    try {
      const user = await authService.login();
      setUser(user);
    } catch (error) {
      console.error("[AuthProvider] Login failed:", error);
    }
  };

  const logout = async () => {
    try {
      await authService.logout();
      setUser(null);
    } catch (error) {
      console.error("[AuthProvider] Logout failed:", error);
    }
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
