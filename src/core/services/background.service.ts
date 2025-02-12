import BackgroundTimer from "react-native-background-timer";

type Task = {
  id: string;
  callback: () => Promise<void>;
  interval: number;
  backgroundTimer?: boolean;
};

class BackgroundService {
  private tasks: Map<string, ReturnType<typeof setInterval>> = new Map();
  private backgroundTaskIds: Set<string> = new Set();

  startTask(task: Task): void {
    if (this.tasks.has(task.id)) {
      console.warn(`[BackgroundService] Task ${task.id} is already running`);
      return;
    }

    console.info(`[BackgroundService] Starting task ${task.id}`);
    if (task.backgroundTimer) {
      BackgroundTimer.runBackgroundTimer(async () => {
        try {
          await task.callback();
        } catch (error) {
          console.error(`[BackgroundService] Task ${task.id} failed:`, error);
        }
      }, task.interval);

      // Track background tasks using a separate set
      this.backgroundTaskIds.add(task.id);
    } else {
      const timer = setInterval(async () => {
        try {
          await task.callback();
        } catch (error) {
          console.error(`[BackgroundService] Task ${task.id} failed:`, error);
        }
      }, task.interval);

      this.tasks.set(task.id, timer);
    }
  }
  stopTask(taskId: string): void {
    const timer = this.tasks.get(taskId);
    if (!timer && !this.backgroundTaskIds.has(taskId)) {
      console.warn(`[BackgroundService] Task ${taskId} is not running`);
      return;
    }

    console.info(`[BackgroundService] Stopping task ${taskId}`);

    if (this.backgroundTaskIds.has(taskId)) {
      BackgroundTimer.stopBackgroundTimer();
      this.backgroundTaskIds.delete(taskId);
    } else {
      clearInterval(timer);
      this.tasks.delete(taskId);
    }
  }

  stopAllTasks(): void {
    console.info("[BackgroundService] Stopping all tasks");

    this.tasks.forEach((_, taskId) => {
      this.stopTask(taskId);
    });
  }
}

export const backgroundService = new BackgroundService();
