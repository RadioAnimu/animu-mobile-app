import AsyncStorage from "@react-native-async-storage/async-storage";
import * as AuthSession from "expo-auth-session";
import { animuApi } from "../../api/client";
import { User } from "../domain/user";

const USER_STORAGE_KEY = "user";
const CLIENT_ID = "1159273876732256266";

export const REDIRECT_URI = AuthSession.makeRedirectUri({
  scheme: "animuapp",
  path: "redirect",
});

const discovery = {
  authorizationEndpoint: "https://discord.com/api/oauth2/authorize",
};

class AuthService {
  async getStoredUser(): Promise<User | null> {
    try {
      const userData = await AsyncStorage.getItem(USER_STORAGE_KEY);
      if (!userData) return null;
      return JSON.parse(userData);
    } catch (error) {
      console.error("[AuthService] Failed to get stored user:", error);
      return null;
    }
  }

  async clearStoredUser(): Promise<void> {
    await AsyncStorage.removeItem(USER_STORAGE_KEY);
  }

  async login(): Promise<User> {
    const request = new AuthSession.AuthRequest({
      clientId: CLIENT_ID,
      scopes: ["identify"],
      redirectUri: REDIRECT_URI,
      responseType: AuthSession.ResponseType.Code,
    });

    const result = await request.promptAsync(discovery);

    if (result.type !== "success") {
      throw new Error("Authentication cancelled");
    }

    // PKCE exchange happens on the Animu server; the client validates the
    // payload and folds PHPSESSID into the returned user.
    const user = await animuApi.exchangeToken({
      code: result.params.code,
      redirectUri: REDIRECT_URI,
      codeVerifier: request.codeVerifier ?? "",
    });

    await AsyncStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
    return user;
  }

  async logoutFromServer(sessionId: string): Promise<void> {
    await animuApi.logout(sessionId);
  }

  async validateSession(sessionId: string): Promise<boolean> {
    try {
      return await animuApi.validateSession(sessionId);
    } catch (error) {
      console.error("[AuthService] Session validation failed:", error);
      return false;
    }
  }
}

export const authService = new AuthService();
