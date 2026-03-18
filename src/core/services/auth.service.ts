import AsyncStorage from "@react-native-async-storage/async-storage";
import * as AuthSession from "expo-auth-session";
import { authApiClient } from "../../data/http/auth.api";
import { UserMapper } from "../../data/mappers/user.mapper";
import { User } from "../domain/user";

const USER_STORAGE_KEY = "user";
const CLIENT_ID = "1159273876732256266";
const TOKEN_EXCHANGE_URL = "https://www.animu.com.br/teste/exchange-token.php";

export const REDIRECT_URI = AuthSession.makeRedirectUri({ scheme: "animuapp" });

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

    const response = await fetch(TOKEN_EXCHANGE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code: result.params.code,
        redirect_uri: REDIRECT_URI,
        code_verifier: request.codeVerifier ?? "",
      }).toString(),
    });

    const rawText = await response.text();

    let data: any;
    try {
      data = JSON.parse(rawText);
    } catch (e) {
      throw new Error(`Exchange response is not valid JSON: ${rawText}`);
    }

    if (data.error) {
      console.error("[Auth] Exchange error details:", JSON.stringify(data));
      throw new Error(`Token exchange failed: ${data.error}`);
    }

    const userDTO = { ...data.user, PHPSESSID: data.PHPSESSID };

    const user = UserMapper.fromDTO(userDTO);
    await AsyncStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
    return user;
  }

  async logoutFromServer(sessionId: string): Promise<void> {
    await authApiClient.logout(sessionId);
  }

  async validateSession(sessionId: string): Promise<boolean> {
    try {
      return await authApiClient.validateSession(sessionId);
    } catch (error) {
      console.error("[AuthService] Session validation failed:", error);
      return false;
    }
  }
}

export const authService = new AuthService();
