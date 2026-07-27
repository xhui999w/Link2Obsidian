import type { AppConfig } from "../config/env.js";
import { DisabledAiEnhancer } from "./disabled-ai-enhancer.js";
import {
  OllamaChatProvider,
  OpenAiCompatibleChatProvider,
} from "./http-chat-providers.js";
import { StructuredAiEnhancer } from "./structured-ai-enhancer.js";
import type { AiEnhancer } from "./types.js";

export function createAiEnhancer(config: AppConfig): AiEnhancer {
  if (!config.ai.enabled) {
    return new DisabledAiEnhancer();
  }

  const provider = config.ai.provider === "ollama"
    ? new OllamaChatProvider(config.ai)
    : new OpenAiCompatibleChatProvider(config.ai);
  return new StructuredAiEnhancer(provider);
}

