import { fileURLToPath } from "node:url";

export type LogLevel = "fatal" | "error" | "warn" | "info" | "debug" | "trace";
export type DuplicatePolicy = "overwrite" | "skip" | "suffix";
export type AiProvider = "ollama" | "openai-compatible";

export interface AppConfig {
  server: {
    host: string;
    port: number;
    logLevel: LogLevel;
    apiToken?: string;
  };
  storage: {
    vaultPath: string;
    outputDir: string;
    attachmentsDir: string;
    dataPath: string;
    tmpPath: string;
    pluginsPath: string;
  };
  runtime: {
    timezone: string;
    language: string;
    workerConcurrency: number;
    pageTimeoutMs: number;
    imageTimeoutMs: number;
    maxImages: number;
    maxImageBytes: number;
    duplicatePolicy: DuplicatePolicy;
    defaultCategory: string;
    proxyServer?: string;
  };
  ai: {
    enabled: boolean;
    provider: AiProvider;
    baseUrl: string;
    apiKey?: string;
    model: string;
    timeoutMs: number;
    maxContentChars: number;
  };
}

function integer(name: string, fallback: number, minimum: number): number {
  const raw = process.env[name];
  const value = raw === undefined ? fallback : Number.parseInt(raw, 10);

  if (!Number.isInteger(value) || value < minimum) {
    throw new Error(`${name} must be an integer greater than or equal to ${minimum}`);
  }

  return value;
}

function enumValue<T extends string>(
  name: string,
  fallback: T,
  allowed: readonly T[],
): T {
  const value = (process.env[name] ?? fallback) as T;

  if (!allowed.includes(value)) {
    throw new Error(`${name} must be one of: ${allowed.join(", ")}`);
  }

  return value;
}

function booleanValue(name: string, fallback: boolean): boolean {
  const raw = process.env[name];
  if (raw === undefined) {
    return fallback;
  }
  if (raw === "true" || raw === "1") {
    return true;
  }
  if (raw === "false" || raw === "0") {
    return false;
  }
  throw new Error(`${name} must be true or false`);
}

export function loadConfig(): AppConfig {
  const aiProvider = enumValue(
    "L2O_AI_PROVIDER",
    "ollama",
    ["ollama", "openai-compatible"] as const,
  );

  return {
    server: {
      host: process.env.L2O_HOST ?? "0.0.0.0",
      port: integer("L2O_PORT", 8080, 1),
      logLevel: enumValue(
        "L2O_LOG_LEVEL",
        "info",
        ["fatal", "error", "warn", "info", "debug", "trace"] as const,
      ),
      apiToken: process.env.L2O_API_TOKEN,
    },
    storage: {
      vaultPath: process.env.L2O_VAULT_PATH ?? "/vault",
      outputDir: process.env.L2O_OUTPUT_DIR ?? "Clippings",
      attachmentsDir: process.env.L2O_ATTACHMENTS_DIR ?? "Attachments",
      dataPath: process.env.L2O_DATA_PATH ?? "/app/data",
      tmpPath: process.env.L2O_TMP_PATH ?? "/app/tmp",
      pluginsPath: process.env.L2O_PLUGINS_PATH
        ?? resolveDefaultPluginsPath(),
    },
    runtime: {
      timezone: process.env.L2O_TIMEZONE ?? "Asia/Shanghai",
      language: process.env.L2O_LANGUAGE ?? "zh-CN",
      workerConcurrency: integer("L2O_WORKER_CONCURRENCY", 1, 1),
      pageTimeoutMs: integer("L2O_PAGE_TIMEOUT_MS", 30_000, 1),
      imageTimeoutMs: integer("L2O_IMAGE_TIMEOUT_MS", 15_000, 1),
      maxImages: integer("L2O_MAX_IMAGES", 100, 0),
      maxImageBytes: integer("L2O_MAX_IMAGE_BYTES", 20 * 1024 * 1024, 1),
      duplicatePolicy: enumValue(
        "L2O_DUPLICATE_POLICY",
        "skip",
        ["overwrite", "skip", "suffix"] as const,
      ),
      proxyServer: process.env.L2O_PROXY_SERVER,
      defaultCategory: process.env.L2O_DEFAULT_CATEGORY ?? "生活经验",
    },
    ai: {
      enabled: booleanValue("L2O_AI_ENABLED", false),
      provider: aiProvider,
      baseUrl: process.env.L2O_AI_BASE_URL ?? (
        aiProvider === "ollama"
          ? "http://host.docker.internal:11434"
          : "https://api.openai.com/v1"
      ),
      apiKey: process.env.L2O_AI_API_KEY,
      model: process.env.L2O_AI_MODEL ?? "qwen3:8b",
      timeoutMs: integer("L2O_AI_TIMEOUT_MS", 60_000, 1),
      maxContentChars: integer("L2O_AI_MAX_CONTENT_CHARS", 12_000, 1),
    },
  };
}

function resolveDefaultPluginsPath(): string {
  return fileURLToPath(new URL("../../../../plugins", import.meta.url));
}
