import { useMemo } from "react";

import { useAuth } from "@/contexts/auth/AuthProvider";
import { useDict } from "@/hooks/useDict";

/**
 * Song requests need a verified account (Discord linked + 2FA), which Google,
 * Apple and Animu Connect sign-ins never are. Say so up front instead of
 * letting someone pick a song and write a message the server will refuse.
 * `profile` is null while loading: unknown counts as allowed and the server
 * decides.
 */
export function useRequestNotice() {
  const { user, profile } = useAuth();
  const dict = useDict();

  const hasSession = Boolean(user?.sessionToken);
  const unverified = hasSession && profile?.user.verified === false;
  const notice = useMemo(() => {
    if (!hasSession) {
      return {
        message: dict.REQUEST_NEEDS_SIGN_IN,
        actionLabel: dict.REQUEST_SIGN_IN_ACTION,
        route: "Login",
      } as const;
    }
    if (unverified) {
      return {
        message: dict.REQUEST_NEEDS_VERIFIED,
        actionLabel: dict.REQUEST_VERIFY_ACTION,
        route: "Account",
      } as const;
    }
    return null;
  }, [hasSession, unverified, dict]);

  return { notice, blockedMessage: notice?.message };
}
