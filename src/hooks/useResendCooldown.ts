import { useCallback, useEffect, useState } from "react";

/**
 * Counts down a resend lockout for the Animu Connect code step; `start`
 * re-arms it after a successful send. Shared by the Login screen and the
 * Account screen's add-email sheet so both versions of the flow behave the
 * same.
 */
export function useResendCooldown(seconds: number) {
  const [until, setUntil] = useState(0);
  const [remaining, setRemaining] = useState(0);

  useEffect(() => {
    if (!until) return undefined;
    const tick = () => {
      const left = Math.max(0, Math.ceil((until - Date.now()) / 1000));
      setRemaining(left);
      if (left === 0) setUntil(0);
    };
    tick();
    const timer = setInterval(tick, 500);
    return () => clearInterval(timer);
  }, [until]);

  const start = useCallback(() => {
    setUntil(Date.now() + seconds * 1000);
  }, [seconds]);

  return { remaining, start };
}
