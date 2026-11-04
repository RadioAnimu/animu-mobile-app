/**
 * Runs `task` every `intervalMs`. The next run is armed only once the previous
 * one settled, so a slow run (weak network) never overlaps itself. Returns the
 * stop function; a run in flight when it is called is never followed by another.
 */
export function repeatEvery(intervalMs: number, task: () => Promise<void>): () => void {
  let stopped = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const arm = () => {
    timer = setTimeout(() => {
      // Through a promise, so a synchronous throw cannot end the loop either.
      Promise.resolve()
        .then(task)
        .catch((error: unknown) => console.error("[repeatEvery] task failed:", error))
        .finally(() => {
          if (!stopped) arm();
        });
    }, intervalMs);
  };
  arm();
  return () => {
    stopped = true;
    clearTimeout(timer);
  };
}
