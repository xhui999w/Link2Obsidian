import type { ClipService } from "./clip-service.js";
import type { Task, TaskStore } from "../infrastructure/task-store.js";
import type { DuplicatePolicy } from "../config/env.js";
import { extractUrlFromText, normalizeUrl } from "./clip-service.js";
import { ClipError } from "../domain/errors.js";

// A single durable worker preserves ordering for repeated URLs and file writes.
export class TaskQueue {
  private running?: Promise<void>;
  private closing = false;
  constructor(private readonly store: TaskStore, private readonly clips: ClipService) {}

  submit(input: string, policy: DuplicatePolicy): Task {
    if (this.closing) throw new ClipError("SHUTTING_DOWN", "Service is shutting down", 503);
    const url = extractUrlFromText(input);
    normalizeUrl(url);
    const task = this.store.create(url, policy);
    this.start();
    return task;
  }

  start(): void {
    if (this.running || this.closing) return;
    this.running = this.work().finally(() => {
      this.running = undefined;
      if (!this.closing && this.store.next()) this.start();
    });
  }

  async close(): Promise<void> {
    this.closing = true;
    await this.running;
  }

  private async work(): Promise<void> {
    while (!this.closing) {
      const task = this.store.next();
      if (!task) return;
      this.store.processing(task.id);
      try { this.store.finish(task.id, await this.clips.clip(task.url, task.policy)); }
      catch (error) {
        this.store.fail(task.id, error instanceof Error ? error.message : "任务失败");
      }
    }
  }
}
