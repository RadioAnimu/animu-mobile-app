type Task = {
  id: string;
  callback: () => Promise<void>;
  interval: number; // In milliseconds
};

class BackgroundService {
  private tasks: Map<string, NodeJS.Timeout> = new Map();

  startTask(task: Task): void {
    // Restart cleanly if the task is already running (e.g. StrictMode remount)
    this.stopTask(task.id);

    console.info(`[BackgroundService] Starting task ${task.id}`);

    const timer = setInterval(async () => {
      try {
        await task.callback();
      } catch (error) {
        console.error(`[BackgroundService] Task ${task.id} failed:`, error);
      }
    }, task.interval);

    this.tasks.set(task.id, timer);
  }

  stopTask(taskId: string): void {
    const timer = this.tasks.get(taskId);
    if (!timer) {
      return;
    }

    console.info(`[BackgroundService] Stopping task ${taskId}`);
    clearInterval(timer);
    this.tasks.delete(taskId);
  }

  stopAllTasks(): void {
    console.info("[BackgroundService] Stopping all tasks");
    this.tasks.forEach((_, taskId) => {
      this.stopTask(taskId);
    });
  }
}

export const backgroundService = new BackgroundService();
