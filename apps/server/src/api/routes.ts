import { timingSafeEqual } from "node:crypto";
import type { TaskStore } from "../infrastructure/task-store.js";
import type { TaskQueue } from "../application/task-queue.js";
import type { DuplicatePolicy } from "../config/env.js";
import type { FastifyInstance } from "fastify";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

import type { ClipService } from "../application/clip-service.js";
import type { AppConfig } from "../config/env.js";
import type { PluginRegistry } from "../domain/clip.js";
import { renderHomePage } from "../web/home-page.js";

export async function registerRoutes(
  app: FastifyInstance,
  config: AppConfig,
  clipService: ClipService,
  pluginRegistry: PluginRegistry,
  store: TaskStore,
  queue: TaskQueue,
): Promise<void> {
  app.addHook("onRequest", async (request, reply) => {
    if (!request.url.split("?")[0]?.startsWith("/api/") || !config.server.apiToken) return;
    const authorization = request.headers.authorization;
    const provided = authorization?.startsWith("Bearer ") ? authorization.slice(7) : "";
    const expected = Buffer.from(config.server.apiToken);
    const actual = Buffer.from(provided);
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
      return reply.code(401).header("WWW-Authenticate", "Bearer").send({
        error: "UNAUTHORIZED", message: "请输入有效的 API Token",
      });
    }
  });
  app.get("/assets/link2obsidian-icon.png", async (_request, reply) => {
    const icon = await readFile(join(process.cwd(), "assets", "link2obsidian-icon-256.png"));
    return reply
      .header("Cache-Control", "public, max-age=604800, immutable")
      .type("image/png")
      .send(icon);
  });

  app.get("/favicon.png", async (_request, reply) => {
    const icon = await readFile(join(process.cwd(), "assets", "link2obsidian-favicon.png"));
    return reply
      .header("Cache-Control", "public, max-age=604800, immutable")
      .type("image/png")
      .send(icon);
  });

  app.get("/", async (_request, reply) => {
    return reply
      .header("Cache-Control", "no-store, max-age=0")
      .header("Pragma", "no-cache")
      .header("Expires", "0")
      .type("text/html; charset=utf-8")
      .send(renderHomePage());
  });

  app.get("/health", async () => ({
    status: "ok",
    service: "link2obsidian",
    timestamp: new Date().toISOString(),
    ai: {
      enabled: config.ai.enabled,
      provider: config.ai.provider,
      model: config.ai.enabled ? config.ai.model : undefined,
    },
  }));

  app.get("/api/plugins", async () => ({
    plugins: pluginRegistry.list().map((plugin) => ({
      id: plugin.id,
      name: plugin.name,
      priority: plugin.priority,
      match: plugin.match,
    })),
  }));

  const bodySchema = {
    type: "object", additionalProperties: false, required: ["url"],
    properties: {
      url: { type: "string", minLength: 1, maxLength: 8192 },
      policy: { type: "string", enum: ["skip", "overwrite", "suffix"] },
    },
  };
  // Preserve the existing synchronous API; dashboard clients use /api/tasks.
  app.post<{ Body: { url: string; policy?: DuplicatePolicy } }>(
    "/api/clips", { schema: { body: bodySchema } },
    async (request, reply) => {
      const task = queue.submit(request.body.url, request.body.policy ?? config.runtime.duplicatePolicy);
      while (true) {
        const latest = store.get(task.id)!;
        if (latest.status === "success") {
          return reply.code(latest.result!.status === "saved" ? 201 : 200).send(latest.result);
        }
        if (latest.status === "failed") {
          return reply.code(422).send({ error: "CLIP_FAILED", message: latest.error, taskId: task.id });
        }
        await new Promise(resolve => setTimeout(resolve, 25));
      }
    },
  );
  app.post<{ Body: { url: string; policy?: DuplicatePolicy } }>(
    "/api/tasks", { schema: { body: bodySchema } },
    async (request, reply) => reply.code(202).send(
      queue.submit(request.body.url, request.body.policy ?? config.runtime.duplicatePolicy),
    ),
  );
  app.get<{ Querystring: { limit?: number; offset?: number } }>(
    "/api/tasks",
    { schema: { querystring: {
      type: "object", additionalProperties: false,
      properties: {
        limit: { type: "integer", minimum: 1, maximum: 100, default: 20 },
        offset: { type: "integer", minimum: 0, default: 0 },
      },
    } } },
    async request => store.list(request.query.limit, request.query.offset),
  );
  app.get<{ Params: { id: string } }>("/api/tasks/:id", async (request, reply) => {
    const task = store.get(request.params.id);
    return task ?? reply.code(404).send({ message: "任务不存在" });
  });
  app.post<{ Params: { id: string }; Body: { policy?: DuplicatePolicy } }>(
    "/api/tasks/:id/retry",
    { schema: { body: {
      type: "object", additionalProperties: false,
      properties: { policy: { type: "string", enum: ["skip", "overwrite", "suffix"] } },
    } } },
    async (request, reply) => {
      const task = store.get(request.params.id);
      if (!task) return reply.code(404).send({ message: "任务不存在" });
      if (task.status === "queued" || task.status === "processing") {
        return reply.code(409).send({ message: "任务仍在处理中" });
      }
      return reply.code(202).send(queue.submit(task.url, request.body.policy ?? task.policy));
    },
  );
}
