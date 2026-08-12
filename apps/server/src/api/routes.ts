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
): Promise<void> {
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
    vaultPath: config.storage.vaultPath,
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

  app.post<{ Body: { url: string } }>(
    "/api/clips",
    {
      schema: {
        body: {
          type: "object",
          additionalProperties: false,
          required: ["url"],
          properties: {
            url: {
              type: "string",
              minLength: 1,
              maxLength: 8_192,
            },
          },
        },
      },
    },
    async (request, reply) => {
      const result = await clipService.clip(request.body.url);
      return reply.code(result.status === "saved" ? 201 : 200).send(result);
    },
  );
}
