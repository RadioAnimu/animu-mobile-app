import AsyncStorage from "@react-native-async-storage/async-storage";
import * as WebBrowser from "expo-web-browser";
import * as Linking from "expo-linking";
import { authApiClient } from "../../data/http/auth.api";
import { UserMapper } from "../../data/mappers/user.mapper";
import { User } from "../domain/user";

const USER_STORAGE_KEY = "user";

const DISCORD_OAUTH_URL =
  "https://discord.com/api/oauth2/authorize?client_id=1159273876732256266&response_type=code&redirect_uri=https%3A%2F%2Fwww.animu.com.br%2Fteste%2Fprocess-oauth-mobile.php&scope=identify";

export const REDIRECT_URL = Linking.createURL("redirect");

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

  async openLoginBrowser(): Promise<void> {
    await WebBrowser.openBrowserAsync(DISCORD_OAUTH_URL);
  }

  async processLoginUrl(url: string): Promise<User> {
    const data = Linking.parse(url);

    if (!data.queryParams?.user) {
      throw new Error("Invalid authentication response");
    }

    const userDTO = JSON.parse(
      decodeURIComponent(data.queryParams.user.toString()),
    );

    if (data.queryParams.PHPSESSID) {
      userDTO.PHPSESSID = data.queryParams.PHPSESSID;
    }

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
