/**
 * Runs `task` once the JS thread is idle: `requestIdleCallback` where the
 * platform has it (React Native, Chromium), the next macrotask where it
 * doesn't (Safari). Returns the cancel, for an effect's cleanup.
 */
export function whenIdle(task: () => void): () => void {
  if (typeof requestIdleCallback === "function") {
    const handle = requestIdleCallback(task);
    return () => cancelIdleCallback(handle);
  }
  const timer = setTimeout(task, 0);
  return () => clearTimeout(timer);
}
