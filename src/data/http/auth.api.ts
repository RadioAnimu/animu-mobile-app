import { CONFIG } from "../../utils/player.config";
import { HttpRequestError } from "../../core/errors/http.error";

const BASE_URL = "https://www.animu.com.br/teste";
const TIMEOUT = 10000;

async function authFetch(
  path: string,
  params: Record<string, string>,
): Promise<string> {
  const searchParams = new URLSearchParams(params);
  const url = `${BASE_URL}${path}?${searchParams.toString()}`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT);

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: { "User-Agent": CONFIG.USER_AGENT },
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new HttpRequestError(
        `HTTP error ${response.status}`,
        response.status,
        { method: "GET", url },
      );
    }

    return await response.text();
  } finally {
    clearTimeout(timeoutId);
  }
}

class AuthApiClient {
  async validateSession(sessionId: string): Promise<boolean> {
    try {
      const data = await authFetch("/chatIsThisReal.php", {
        PHPSESSID: sessionId,
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
      const data = await authFetch("/byeChat.php", { PHPSESSID: sessionId });
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
