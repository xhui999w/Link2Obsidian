import assert from "node:assert/strict";
import test from "node:test";

import type { AppConfig } from "../src/config/env.js";
import {
  OllamaChatProvider,
  OpenAiCompatibleChatProvider,
} from "../src/ai/http-chat-providers.js";
import { parseEnhancement } from "../src/ai/structured-ai-enhancer.js";

test("parses structured AI output and rejects unknown categories", () => {
  const result = parseEnhancement(
    [
      "```json",
      JSON.stringify({
        summary: "  一段摘要  ",
        keywords: ["大模型", "大模型", "#RAG"],
        category: "不存在的分类",
        tags: ["#AI", "知识整理"],
      }),
      "```",
    ].join("\n"),
    ["AI人工智能", "编程开发"],
  );

  assert.equal(result.summary, "一段摘要");
  assert.deepEqual(result.keywords, ["大模型", "RAG"]);
  assert.equal(result.category, undefined);
  assert.deepEqual(result.tags, ["AI", "知识整理"]);
});

test("supports Ollama native chat API", async () => {
  let requestUrl = "";
  let requestBody: Record<string, unknown> | undefined;
  const provider = new OllamaChatProvider(
    aiConfig("ollama", "http://ollama:11434"),
    (async (input, init) => {
      requestUrl = input.toString();
      requestBody = JSON.parse(init?.body as string) as Record<string, unknown>;
      return jsonResponse({
        message: {
          content: '{"summary":"摘要","keywords":[],"category":"生活经验","tags":[]}',
        },
      });
    }) as typeof fetch,
  );

  const content = await provider.complete("system", "user");
  assert.equal(requestUrl, "http://ollama:11434/api/chat");
  assert.equal(requestBody?.model, "test-model");
  assert.match(content, /"summary":"摘要"/);
});

test("supports local and cloud OpenAI-compatible APIs", async () => {
  let requestUrl = "";
  let authorization = "";
  const config = aiConfig(
    "openai-compatible",
    "https://cloud.example/v1/",
  );
  config.apiKey = "secret";
  const provider = new OpenAiCompatibleChatProvider(
    config,
    (async (input, init) => {
      requestUrl = input.toString();
      authorization = new Headers(init?.headers).get("Authorization") ?? "";
      return jsonResponse({
        choices: [
          {
            message: {
              content: '{"summary":"摘要","keywords":[],"category":"生活经验","tags":[]}',
            },
          },
        ],
      });
    }) as typeof fetch,
  );

  await provider.complete("system", "user");
  assert.equal(requestUrl, "https://cloud.example/v1/chat/completions");
  assert.equal(authorization, "Bearer secret");
});

function aiConfig(
  provider: AppConfig["ai"]["provider"],
  baseUrl: string,
): AppConfig["ai"] {
  return {
    enabled: true,
    provider,
    baseUrl,
    model: "test-model",
    timeoutMs: 1_000,
    maxContentChars: 12_000,
  };
}

function jsonResponse(value: unknown): Response {
  return new Response(JSON.stringify(value), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
    },
  });
}
