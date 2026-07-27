import sensible from "@fastify/sensible";
import Fastify, { type FastifyInstance } from "fastify";

import { registerRoutes } from "./api/routes.js";
import { createAiEnhancer } from "./ai/create-ai-enhancer.js";
import type { AiEnhancer } from "./ai/types.js";
import { ClipService } from "./application/clip-service.js";
import { KeywordTopicClassifier } from "./application/topic-classifier.js";
import type { AppConfig } from "./config/env.js";
import type {
  ArticleExtractor,
  ArticleClassifier,
  ImageLocalizer,
  MarkdownConverter,
  PageLoader,
  PluginRegistry,
} from "./domain/clip.js";
import { ClipError } from "./domain/errors.js";
import { DefuddleArticleExtractor } from "./infrastructure/defuddle-article-extractor.js";
import { HttpImageLocalizer } from "./infrastructure/image-localizer.js";
import { PlaywrightPageLoader } from "./infrastructure/playwright-page-loader.js";
import { TurndownMarkdownConverter } from "./infrastructure/turndown-markdown-converter.js";
import { FileSitePluginRegistry } from "./plugins/site-plugin-registry.js";

export interface AppDependencies {
  loader?: PageLoader;
  extractor?: ArticleExtractor;
  imageLocalizer?: ImageLocalizer;
  markdownConverter?: MarkdownConverter;
  pluginRegistry?: PluginRegistry;
  classifier?: ArticleClassifier;
  aiEnhancer?: AiEnhancer;
}

export async function buildApp(
  config: AppConfig,
  dependencies: AppDependencies = {},
): Promise<FastifyInstance> {
  const app = Fastify({
    logger: {
      level: config.server.logLevel,
    },
  });

  await app.register(sensible);

  const loader = dependencies.loader ?? new PlaywrightPageLoader(config);
  const extractor = dependencies.extractor
    ?? new DefuddleArticleExtractor(config.runtime.language);
  const imageLocalizer = dependencies.imageLocalizer
    ?? new HttpImageLocalizer(config);
  const markdownConverter = dependencies.markdownConverter
    ?? new TurndownMarkdownConverter();
  const pluginRegistry = dependencies.pluginRegistry
    ?? await FileSitePluginRegistry.load(config.storage.pluginsPath);
  const classifier = dependencies.classifier
    ?? new KeywordTopicClassifier(config.runtime.defaultCategory);
  const aiEnhancer = dependencies.aiEnhancer ?? createAiEnhancer(config);
  const clipService = new ClipService(
    config,
    loader,
    extractor,
    imageLocalizer,
    markdownConverter,
    pluginRegistry,
    classifier,
    aiEnhancer,
  );

  app.addHook("onClose", async () => {
    await loader.close();
  });

  app.setErrorHandler((error, request, reply) => {
    if (error instanceof ClipError) {
      request.log.warn({ code: error.code, err: error }, error.message);
      return reply.code(error.statusCode).send({
        error: error.code,
        message: error.message,
      });
    }

    request.log.error(error);
    const statusCode = (
      typeof error === "object"
      && error !== null
      && "statusCode" in error
      && typeof error.statusCode === "number"
    )
      ? error.statusCode
      : 500;
    const message = error instanceof Error ? error.message : "Invalid request";

    return reply.code(statusCode).send({
      error: "INTERNAL_ERROR",
      message: statusCode < 500
        ? message
        : "An unexpected error occurred",
    });
  });

  await registerRoutes(app, config, clipService, pluginRegistry);

  return app;
}
