import AsyncStorage from "@react-native-async-storage/async-storage";
import * as WebBrowser from "expo-web-browser";
import * as Linking from "expo-linking";
import { authApiClient } from "../../data/http/auth.api";
import { UserMapper } from "../../data/mappers/user.mapper";
import { User } from "../domain/user";

const USER_STORAGE_KEY = "user";

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

  async login(): Promise<User> {
    try {
      const callbackUrl = Linking.createURL("redirect", { scheme: "animuapp" });
      const result = await WebBrowser.openAuthSessionAsync(
        "https://discord.com/api/oauth2/authorize?client_id=1159273876732256266&response_type=code&redirect_uri=https%3A%2F%2Fwww.animu.com.br%2Fteste%2Fprocess-oauth-mobile.php&scope=identify",
        callbackUrl
      );

      if (result.type !== "success") {
        throw new Error("Authentication cancelled");
      }

      const data = Linking.parse(result.url);
      if (!data.queryParams?.user) {
        throw new Error("Invalid authentication response");
      }

      const userDTO = JSON.parse(
        decodeURIComponent(data.queryParams.user.toString())
      );
      if (data.queryParams.PHPSESSID) {
        userDTO.PHPSESSID = data.queryParams.PHPSESSID;
      }

      const user = UserMapper.fromDTO(userDTO);
      await AsyncStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
      return user;
    } catch (error) {
      console.error("[AuthService] Login failed:", error);
      throw error;
    }
  }

  async logout(sessionId?: string): Promise<void> {
    try {
      if (sessionId) {
        await authApiClient.logout(sessionId);
      }
      await AsyncStorage.removeItem(USER_STORAGE_KEY);
    } catch (error) {
      console.error("[AuthService] Logout failed:", error);
      throw error;
    }
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
