import type { FastifyInstance } from "fastify";

import type { ClipService } from "../application/clip-service.js";
import type { AppConfig } from "../config/env.js";
import type { PluginRegistry } from "../domain/clip.js";

export async function registerRoutes(
  app: FastifyInstance,
  config: AppConfig,
  clipService: ClipService,
  pluginRegistry: PluginRegistry,
): Promise<void> {
  app.get("/", async () => ({
    name: "Link2Obsidian",
    description: "Turn web links into Markdown files for an Obsidian vault.",
    version: "0.1.0",
    status: "mvp",
    health: "/health",
    clips: "POST /api/clips",
  }));

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
