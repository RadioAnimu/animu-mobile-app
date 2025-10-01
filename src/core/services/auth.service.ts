import AsyncStorage from "@react-native-async-storage/async-storage";
import * as WebBrowser from "expo-web-browser";
import * as Linking from "expo-linking";
import { authApiClient } from "../../data/http/auth.api";
import { UserMapper } from "../../data/mappers/user.mapper";
import { User } from "../domain/user";

const USER_STORAGE_KEY = "user";

class AuthService {
  private currentUser: User | null = null;

  async initialize(): Promise<User | null> {
    try {
      const userData = await AsyncStorage.getItem(USER_STORAGE_KEY);
      if (!userData) return null;

      this.currentUser = JSON.parse(userData);
      return this.currentUser;
    } catch (error) {
      console.error("[AuthService] Failed to initialize:", error);
      return null;
    }
  }

  async login(): Promise<User | null> {
    try {
      const callbackUrl = Linking.createURL("redirect", { scheme: "animuapp" });
      const result = await WebBrowser.openAuthSessionAsync(
        "https://discord.com/api/oauth2/authorize?client_id=1159273876732256266&response_type=code&redirect_uri=https%3A%2F%2Fwww.animu.com.br%2Fteste%2Fprocess-oauth-mobile.php&scope=identify",
        callbackUrl
      );

      if (result.type !== "success") return null;

      const data = Linking.parse(result.url);
      if (!data.queryParams?.user) return null;

      const userDTO = JSON.parse(
        decodeURIComponent(data.queryParams.user.toString())
      );
      if (data.queryParams.PHPSESSID) {
        userDTO.PHPSESSID = data.queryParams.PHPSESSID;
      }

      this.currentUser = UserMapper.fromDTO(userDTO);
      await AsyncStorage.setItem(
        USER_STORAGE_KEY,
        JSON.stringify(this.currentUser)
      );

      return this.currentUser;
    } catch (error) {
      console.error("[AuthService] Login failed:", error);
      return null;
    }
  }

  async logout(): Promise<void> {
    try {
      if (this.currentUser) {
        await authApiClient.logout(this.currentUser.sessionId);
      }
      await AsyncStorage.removeItem(USER_STORAGE_KEY);
      this.currentUser = null;
    } catch (error) {
      console.error("[AuthService] Logout failed:", error);
    }
  }

  async validateSession(): Promise<boolean> {
    if (!this.currentUser) return false;

    try {
      return await authApiClient.validateSession(this.currentUser.sessionId);
    } catch (error) {
      console.error("[AuthService] Session validation failed:", error);
      return false;
    }
  }

  getCurrentUser(): User | null {
    return this.currentUser;
  }
}

export const authService = new AuthService();
