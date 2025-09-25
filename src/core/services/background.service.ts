import * as BackgroundTask from "expo-background-task";
import * as TaskManager from "expo-task-manager";
import { Platform } from "react-native";

type Task = {
  id: string;
  callback: () => Promise<void>;
  interval?: number; // interval in milliseconds
  backgroundTask?: boolean;
};

type TaskCallback = {
  id: string;
  callback: () => Promise<void>;
};

class BackgroundService {
  private tasks: Map<string, ReturnType<typeof setInterval>> = new Map();
  private backgroundTasks: Map<string, TaskCallback> = new Map();
  private registeredBackgroundTasks: Set<string> = new Set();
  private isInitialized: boolean = false;
  private backgroundTasksSupported: boolean = false;

  constructor() {
    // Defer initialization to avoid blocking app startup
    this.deferredInitialize();
  }

  private async deferredInitialize(): Promise<void> {
    // Use setTimeout to avoid blocking the main thread during app startup
    setTimeout(async () => {
      await this.initializeBackgroundTasks();
    }, 1000); // Delay by 1 second
  }

  private async initializeBackgroundTasks(): Promise<void> {
    if (this.isInitialized) return;

    try {
      // Skip initialization on web or if already restricted
      if (Platform.OS === "web") {
        console.info(
          "[BackgroundService] Skipping background tasks on web platform"
        );
        this.isInitialized = true;
        return;
      }

      const status = await BackgroundTask.getStatusAsync();

      if (status === BackgroundTask.BackgroundTaskStatus.Restricted) {
        console.info(
          "[BackgroundService] Background tasks not available - using foreground tasks only"
        );
        this.backgroundTasksSupported = false;
      } else {
        console.info("[BackgroundService] Background tasks available");
        this.backgroundTasksSupported = true;
      }
    } catch (error) {
      console.warn(
        "[BackgroundService] Background task initialization failed, falling back to foreground tasks:",
        error
      );
      this.backgroundTasksSupported = false;
    } finally {
      this.isInitialized = true;
    }
  }

  private async ensureInitialized(): Promise<void> {
    if (!this.isInitialized) {
      await this.initializeBackgroundTasks();
    }
  }

  private defineBackgroundTask(
    taskId: string,
    callback: () => Promise<void>
  ): void {
    TaskManager.defineTask(taskId, async () => {
      try {
        console.info(
          `[BackgroundService] Executing background task: ${taskId}`
        );
        await callback();
        return BackgroundTask.BackgroundTaskResult.Success;
      } catch (error) {
        console.error(
          `[BackgroundService] Background task ${taskId} failed:`,
          error
        );
        return BackgroundTask.BackgroundTaskResult.Failed;
      }
    });
  }

  async startTask(task: Task): Promise<void> {
    await this.ensureInitialized();

    if (task.backgroundTask && this.backgroundTasksSupported) {
      // Handle background tasks using Expo BackgroundTask
      if (this.registeredBackgroundTasks.has(task.id)) {
        console.warn(
          `[BackgroundService] Background task ${task.id} is already registered`
        );
        return;
      }

      try {
        this.defineBackgroundTask(task.id, task.callback);

        const intervalMinutes = Math.max(
          15,
          Math.ceil((task.interval || 43200000) / 60000)
        );

        await BackgroundTask.registerTaskAsync(task.id, {
          minimumInterval: intervalMinutes,
        });

        this.backgroundTasks.set(task.id, {
          id: task.id,
          callback: task.callback,
        });
        this.registeredBackgroundTasks.add(task.id);

        console.info(
          `[BackgroundService] Background task ${task.id} registered with ${intervalMinutes}min interval`
        );
      } catch (error) {
        console.error(
          `[BackgroundService] Failed to register background task ${task.id}, falling back to foreground:`,
          error
        );
        // Fallback to foreground task
        await this.startForegroundTask(task);
      }
    } else {
      // Handle regular foreground tasks or fallback
      await this.startForegroundTask(task);
    }
  }

  private async startForegroundTask(task: Task): Promise<void> {
    if (this.tasks.has(task.id)) {
      console.warn(`[BackgroundService] Task ${task.id} is already running`);
      return;
    }

    console.info(`[BackgroundService] Starting foreground task ${task.id}`);
    const intervalMs = task.interval || 60000;

    const timer = setInterval(async () => {
      try {
        await task.callback();
      } catch (error) {
        console.error(`[BackgroundService] Task ${task.id} failed:`, error);
      }
    }, intervalMs);

    this.tasks.set(task.id, timer);
  }

  async stopTask(taskId: string): Promise<void> {
    // Check if it's a background task
    if (this.registeredBackgroundTasks.has(taskId)) {
      try {
        await BackgroundTask.unregisterTaskAsync(taskId);
        this.backgroundTasks.delete(taskId);
        this.registeredBackgroundTasks.delete(taskId);
        console.info(
          `[BackgroundService] Background task ${taskId} unregistered successfully`
        );
      } catch (error) {
        console.error(
          `[BackgroundService] Failed to unregister background task ${taskId}:`,
          error
        );
      }
      return;
    }

    // Handle regular foreground tasks
    const timer = this.tasks.get(taskId);
    if (!timer) {
      console.warn(`[BackgroundService] Task ${taskId} is not running`);
      return;
    }

    console.info(`[BackgroundService] Stopping foreground task ${taskId}`);
    clearInterval(timer);
    this.tasks.delete(taskId);
  }

  async stopAllTasks(): Promise<void> {
    console.info("[BackgroundService] Stopping all tasks");

    for (const [taskId] of this.tasks) {
      await this.stopTask(taskId);
    }

    for (const taskId of this.registeredBackgroundTasks) {
      await this.stopTask(taskId);
    }
  }

  async getBackgroundTaskStatus(): Promise<BackgroundTask.BackgroundTaskStatus> {
    await this.ensureInitialized();
    return await BackgroundTask.getStatusAsync();
  }

  async isBackgroundTaskRegistered(taskId: string): Promise<boolean> {
    return await TaskManager.isTaskRegisteredAsync(taskId);
  }

  getTaskInfo() {
    return {
      foregroundTasks: Array.from(this.tasks.keys()),
      backgroundTasks: Array.from(this.backgroundTasks.keys()),
      registeredBackgroundTasks: Array.from(this.registeredBackgroundTasks),
      backgroundTasksSupported: this.backgroundTasksSupported,
      isInitialized: this.isInitialized,
    };
  }

  static readonly INTERVALS = {
    SECOND: 1000,
    MINUTE: 60000,
    HOUR: 3600000,
    DAY: 86400000,
    WEEK: 604800000,
  } as const;
}

export const backgroundService = new BackgroundService();
