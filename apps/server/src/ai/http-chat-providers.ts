import type { AppConfig } from "../config/env.js";
import type { AiChatProvider } from "./types.js";

abstract class HttpChatProvider implements AiChatProvider {
  constructor(
    protected readonly config: AppConfig["ai"],
    protected readonly request: typeof fetch = globalThis.fetch,
  ) {}

  abstract complete(systemPrompt: string, userPrompt: string): Promise<string>;

  protected async post(path: string, body: unknown): Promise<unknown> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (this.config.apiKey) {
      headers.Authorization = `Bearer ${this.config.apiKey}`;
    }

    const response = await this.request(joinUrl(this.config.baseUrl, path), {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(this.config.timeoutMs),
    });

    if (!response.ok) {
      throw new Error(`AI provider returned HTTP ${response.status}`);
    }

    return response.json();
  }
}

export class OllamaChatProvider extends HttpChatProvider {
  async complete(systemPrompt: string, userPrompt: string): Promise<string> {
    const response = await this.post("/api/chat", {
      model: this.config.model,
      stream: false,
      format: "json",
      options: {
        temperature: 0.2,
      },
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    });

    return readString(response, ["message", "content"]);
  }
}

export class OpenAiCompatibleChatProvider extends HttpChatProvider {
  async complete(systemPrompt: string, userPrompt: string): Promise<string> {
    const response = await this.post("/chat/completions", {
      model: this.config.model,
      temperature: 0.2,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    });

    return readString(response, ["choices", "0", "message", "content"]);
  }
}

function joinUrl(baseUrl: string, path: string): string {
  return `${baseUrl.replace(/\/+$/, "")}/${path.replace(/^\/+/, "")}`;
}

function readString(input: unknown, path: readonly string[]): string {
  let value = input;
  for (const key of path) {
    if (Array.isArray(value) && /^\d+$/.test(key)) {
      value = value[Number.parseInt(key, 10)];
    } else if (isRecord(value)) {
      value = value[key];
    } else {
      throw new Error("AI provider returned an unexpected response");
    }
  }

  if (typeof value !== "string" || !value.trim()) {
    throw new Error("AI provider returned empty content");
  }
  return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

