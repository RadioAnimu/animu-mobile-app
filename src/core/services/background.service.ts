import BackgroundTimer from "react-native-background-timer";
import { Platform } from "react-native";

type Task = {
  id: string;
  callback: () => Promise<void>;
  interval: number; // In milliseconds
};

class BackgroundService {
  private tasks: Map<string, NodeJS.Timeout> = new Map();

  startTask(task: Task): void {
    if (this.tasks.has(task.id)) {
      console.warn(`[BackgroundService] Task ${task.id} is already running`);
      return;
    }

    console.info(`[BackgroundService] Starting task ${task.id}`);

    if (Platform.OS === "android") {
      // On Android, use BackgroundTimer.setInterval to keep running in background
      const timer = BackgroundTimer.setInterval(async () => {
        try {
          await task.callback();
        } catch (error) {
          console.error(`[BackgroundService] Task ${task.id} failed:`, error);
        }
      }, task.interval);

      this.tasks.set(task.id, timer as unknown as NodeJS.Timeout);
    } else {
      // On iOS, use standard setInterval — BackgroundTimer.start() creates
      // iOS background tasks that get terminated after ~30s.
      // react-native-track-player already handles iOS background audio.
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
    if (!timer) {
      return;
    }

    console.info(`[BackgroundService] Stopping task ${taskId}`);
    if (Platform.OS === "android") {
      BackgroundTimer.clearInterval(timer as unknown as number);
    } else {
      clearInterval(timer);
    }
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
