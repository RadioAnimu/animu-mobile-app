type Task = {
  id: string;
  callback: () => Promise<void>;
  interval: number; // In milliseconds
};

/**
 * Interval-driven task runner for app-level polls (data refresh, progress
 * tick, session heartbeat).
 *
 * Scheduling is a self-rescheduling `setTimeout` re-armed only after the
 * previous run settles — a slow poll (weak network, long await) can never
 * overlap itself the way a raw `setInterval` would, and an in-flight run
 * survives a `startTask` restart without double-scheduling.
 *
 * Timers here are JS-level: the OS still throttles/pauses them in the
 * background (iOS freezes, Android Doze drifts) — that's acceptable
 * because foreground returns trigger an immediate refresh and the native
 * layer owns playback reliability (see `PlayerProvider` for the gates).
 */
class BackgroundService {
  private tasks: Map<string, Task> = new Map();
  private timeouts: Map<string, NodeJS.Timeout> = new Map();
  /** Ids whose callback is currently running (overlap + re-arm guard). */
  private running: Set<string> = new Set();

  startTask(task: Task): void {
    // Restart cleanly if the task is already running (e.g. effect re-runs,
    // StrictMode remounts)
    this.stopTask(task.id);

    console.info(`[BackgroundService] Starting task ${task.id}`);
    this.tasks.set(task.id, task);
    this.scheduleRun(task.id);
  }

  stopTask(taskId: string): void {
    const timeout = this.timeouts.get(taskId);
    if (timeout) {
      clearTimeout(timeout);
      this.timeouts.delete(taskId);
    }
    if (this.tasks.delete(taskId)) {
      console.info(`[BackgroundService] Stopping task ${taskId}`);
    }
  }

  stopAllTasks(): void {
    console.info("[BackgroundService] Stopping all tasks");
    for (const taskId of [...this.tasks.keys()]) {
      this.stopTask(taskId);
    }
  }

  /**
   * Arms one run of the CURRENT task registered under `taskId`. While a
   * run is in-flight, arming is skipped — its `finally` re-arms from the
   * map, which by then holds the newest task (a restart mid-run simply
   * continues with the new task, never doubling timers).
   */
  private scheduleRun(taskId: string): void {
    if (this.running.has(taskId)) return;

    const task = this.tasks.get(taskId);
    if (!task) return;

    const timeout = setTimeout(() => {
      // Stopped while the run was pending
      if (!this.tasks.has(taskId)) return;

      this.running.add(taskId);
      void (async () => {
        try {
          await task.callback();
        } catch (error) {
          console.error(`[BackgroundService] Task ${taskId} failed:`, error);
        } finally {
          this.running.delete(taskId);
          this.scheduleRun(taskId);
        }
      })();
    }, task.interval);

    this.timeouts.set(taskId, timeout);
  }
}

export const backgroundService = new BackgroundService();
