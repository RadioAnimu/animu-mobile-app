import { Platform } from "react-native";
import * as AppleAuthentication from "expo-apple-authentication";
import * as WebBrowser from "expo-web-browser";
import { AuthFlowCancelled } from "@/core/auth/errors";
import type { AppleNativeCredential, OAuthPort } from "@/core/auth/ports";

// ─── Native Apple ───────────────────────────────────────────────────────

/** Maps the native `fullName` object to the API's flat name fields. */
function appleName(credential: AppleAuthentication.AppleAuthenticationCredential): {
  name?: string;
  firstName?: string;
  lastName?: string;
} {
  const firstName = credential.fullName?.givenName ?? undefined;
  const lastName = credential.fullName?.familyName ?? undefined;
  const name = [firstName, lastName].filter(Boolean).join(" ") || undefined;
  return { name, firstName, lastName };
}

/**
 * Client-side OAuth transports: `openSession` opens the backend's start URL
 * and returns the deep link the server bounces; Sign in with Apple also has
 * the native iOS sheet (`authorizeAppleNative`).
 */
export class OAuthAdapter implements OAuthPort {
  async openSession(url: string, redirectUri: string): Promise<string | null> {
    const result = await WebBrowser.openAuthSessionAsync(url, redirectUri);
    if (result.type === "success") return result.url;
    if (result.type === "cancel" || result.type === "dismiss") return null;
    throw new Error(`Browser session ended unexpectedly (${result.type})`);
  }

  async authorizeAppleNative(): Promise<AppleNativeCredential | null> {
    if (Platform.OS !== "ios") return null;
    if (!(await AppleAuthentication.isAvailableAsync())) return null;

    const credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
    }).catch((error: unknown) => {
      if (
        (error as { code?: string } | undefined)?.code ===
        "ERR_REQUEST_CANCELED"
      ) {
        throw new AuthFlowCancelled();
      }
      throw error;
    });

    if (!credential.identityToken) {
      throw new Error("Apple did not return an identity token");
    }

    return {
      identityToken: credential.identityToken,
      ...appleName(credential),
    };
  }
}
