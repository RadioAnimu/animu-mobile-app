import axios, { AxiosInstance } from "axios";
import { CONFIG } from "../../utils/player.config";
import { HttpRequestError } from "../../core/errors/http.error";

class AuthApiClient {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: "https://www.animu.com.br/teste",
      timeout: 10000,
      headers: {
        "User-Agent": CONFIG.USER_AGENT,
      },
    });

    // Add error handling interceptor
    this.client.interceptors.response.use(
      (response) => response,
      (error) => {
        if (axios.isAxiosError(error)) {
          const status = error.response?.status || 500;
          const message =
            error.message || `HTTP request failed with status ${status}`;

          return Promise.reject(
            new HttpRequestError(message, status, error.config, error.response)
          );
        }
        return Promise.reject(error);
      }
    );
  }

  async validateSession(sessionId: string): Promise<boolean> {
    try {
      const { data } = await this.client.get<string>("/chatIsThisReal.php", {
        params: { PHPSESSID: sessionId },
        transformResponse: [(data) => data], // Keep text response handling
      });
      return data === "1";
    } catch (error) {
      if (error instanceof HttpRequestError) {
        console.error(`[Auth] Session validation failed: ${error.message}`);
      } else {
        console.error("[Auth] Unknown error during session validation:", error);
      }
      return false;
    }
  }

  async logout(sessionId: string): Promise<boolean> {
    try {
      const { data } = await this.client.get<string>("/byeChat.php", {
        params: { PHPSESSID: sessionId },
        transformResponse: [(data) => data],
      });
      return data === "1";
    } catch (error) {
      if (error instanceof HttpRequestError) {
        console.error(`[Auth] Logout failed: ${error.message}`);
      } else {
        console.error("[Auth] Unknown error during logout:", error);
      }
      return false;
    }
  }
}

export const authApiClient = new AuthApiClient();
