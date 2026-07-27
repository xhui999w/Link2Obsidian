import assert from "node:assert/strict";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { buildApp } from "../src/app.js";
import type { AppConfig } from "../src/config/env.js";

const config: AppConfig = {
  server: {
    host: "127.0.0.1",
    port: 8080,
    logLevel: "fatal",
  },
  storage: {
    vaultPath: "/vault",
    outputDir: "Clippings",
    attachmentsDir: "Attachments",
    dataPath: "/app/data",
    tmpPath: "/app/tmp",
    pluginsPath: fileURLToPath(new URL("../../../plugins", import.meta.url)),
  },
  runtime: {
    timezone: "Asia/Shanghai",
    language: "zh-CN",
    workerConcurrency: 1,
    pageTimeoutMs: 30_000,
    imageTimeoutMs: 15_000,
    maxImages: 100,
    maxImageBytes: 20 * 1024 * 1024,
    duplicatePolicy: "overwrite",
    defaultCategory: "生活经验",
  },
  ai: {
    enabled: false,
    provider: "ollama",
    baseUrl: "http://localhost:11434",
    model: "test",
    timeoutMs: 1_000,
    maxContentChars: 12_000,
  },
};

test("GET /health reports service health", async () => {
  const app = await buildApp(config);
  const response = await app.inject({
    method: "GET",
    url: "/health",
  });

  assert.equal(response.statusCode, 200);
  assert.equal(response.json().status, "ok");
  await app.close();
});

test("GET / serves the mobile-friendly clipping page", async () => {
  const app = await buildApp(config);
  const response = await app.inject({
    method: "GET",
    url: "/",
  });

  assert.equal(response.statusCode, 200);
  assert.match(response.headers["content-type"] ?? "", /^text\/html/);
  assert.match(response.body, /<meta name="viewport"/);
  assert.match(response.body, /保存到 Obsidian/);
  assert.match(response.body, /fetch\("\/api\/clips"/);
  await app.close();
});
