import { useEffect, useState } from "react";
import { useIsBackgrounded } from "@/contexts/app-state/AppStateProvider";

/**
 * Ms left on the sleep timer (`sleepAt`, epoch ms), re-rendering each second
 * while the app is in the foreground; `null` without a timer. Display only:
 * the timer itself runs natively in RNAP. RNAP's `useSleepTimer` does the
 * same from a `Player`; the UI here reads the player store, never the player.
 */
export function useSleepCountdown(sleepAt: number | null | undefined): number | null {
  const backgrounded = useIsBackgrounded();
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (sleepAt == null || backgrounded) return undefined;
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 1_000);
    return () => clearInterval(timer);
  }, [sleepAt, backgrounded]);

  return sleepAt == null ? null : Math.max(0, sleepAt - now);
}
