import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import NetInfo from "@react-native-community/netinfo";

import {
  checkForOtaUpdate,
  downloadOtaUpdate,
  isOtaSupported,
  restartForOtaUpdate,
  type OtaCheckResult,
} from "@/core/ota";

export type OtaStatus =
  | "idle"
  | "checking"
  | "downloading"
  | "ready"
  | "available"
  | "up-to-date"
  | "error"
  | "unsupported";

/** What a manual check resolved to — the Settings screen turns this into a toast. */
export type OtaOutcome =
  | "unsupported"
  | "up-to-date"
  | "available"
  | "downloaded"
  | "ready"
  | "error"
  /** A check/download is already running — the call was a no-op. */
  | "busy";

type OtaContextValue = {
  status: OtaStatus;
  /** Version of the last update seen (available, staged, or running). */
  version: number | null;
  checkNow: (auto?: boolean) => Promise<OtaOutcome>;
  applyNow: () => void;
};

const OtaContext = createContext<OtaContextValue>({
  status: "idle",
  version: null,
  checkNow: async () => "unsupported",
  applyNow: () => {},
});

export const OtaProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [status, setStatusState] = useState<OtaStatus>("idle");
  const [version, setVersion] = useState<number | null>(null);
  // Mirror `status` in a ref so `checkNow` stays referentially stable: it only
  // needs the current value, not to be re-created on every status change.
  const statusRef = useRef<OtaStatus>("idle");
  const setStatus = useCallback((next: OtaStatus) => {
    statusRef.current = next;
    setStatusState(next);
  }, []);

  const checkNow = useCallback(
    async (auto = false): Promise<OtaOutcome> => {
      if (!isOtaSupported()) {
        setStatus("unsupported");
        return "unsupported";
      }

      // A bundle already staged this session only needs a restart; re-checking
      // would report "up to date" (the native version already moved) and hide
      // the pending update from the user.
      if (statusRef.current === "ready") return "ready";

      // Re-entrancy guard: the Settings row stays tappable while a check or a
      // download runs, and a second `downloadBundleUri` would fetch the same
      // multi-MB bundle again (and double-stage it natively).
      if (
        statusRef.current === "checking" ||
        statusRef.current === "downloading"
      ) {
        return "busy";
      }

      setStatus("checking");
      const result: OtaCheckResult = await checkForOtaUpdate();

      if (result.status === "unsupported") {
        setStatus("unsupported");
        return "unsupported";
      }

      if (result.status === "error") {
        setStatus("error");
        return "error";
      }

      if (result.status === "incompatible") {
        // Deliberately not an error: the native binary is simply too old for
        // the published bundle. Nothing the user can fix in-app.
        setStatus("up-to-date");
        return "up-to-date";
      }

      if (result.status === "up-to-date") {
        setVersion(result.version);
        setStatus("up-to-date");
        return "up-to-date";
      }

      setVersion(result.version);

      // Background checks only auto-download on Wi-Fi — a ~6 MB bundle on
      // cellular is a real cost for a data-conscious radio app. A manual check
      // (from Settings) downloads on any connection.
      if (auto) {
        const net = await NetInfo.fetch().catch(() => null);
        if (net?.type !== "wifi") {
          setStatus("available");
          return "available";
        }
      }

      setStatus("downloading");
      const download = await downloadOtaUpdate(result.url, result.version);
      if (download.status === "installed") {
        setStatus("ready");
        return "downloaded";
      }

      setStatus("error");
      return "error";
    },
    [setStatus],
  );

  // Silent check on mount so updates land without the user asking. The bundle
  // is applied on the next cold start, never mid-session. `checkNow` is stable,
  // so this runs exactly once.
  useEffect(() => {
    void checkNow(true);
  }, [checkNow]);

  const applyNow = useCallback(() => {
    restartForOtaUpdate();
  }, []);

  const value = useMemo<OtaContextValue>(
    () => ({ status, version, checkNow, applyNow }),
    [status, version, checkNow, applyNow],
  );

  return <OtaContext.Provider value={value}>{children}</OtaContext.Provider>;
};

export const useOta = () => useContext(OtaContext);
