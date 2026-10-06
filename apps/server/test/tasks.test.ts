import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, mkdir, readFile, writeFile, rm, readdir, rename } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { buildApp } from "../src/app.js";
import { loadConfig } from "../src/config/env.js";
import { TaskStore } from "../src/infrastructure/task-store.js";
import type { FastifyInstance } from "fastify";

async function fixture(t: { after: (fn: () => Promise<void>) => void }) {
  const root = await mkdtemp(join(tmpdir(), "l2o-v02-"));
  const config = loadConfig();
  config.server.logLevel = "fatal";
  config.server.apiToken = undefined;
  config.storage = {
    ...config.storage, vaultPath: join(root, "vault"), dataPath: join(root, "data"),
    pluginsPath: fileURLToPath(new URL("../../../plugins", import.meta.url)),
  };
  config.runtime.duplicatePolicy = "skip";
  let calls = 0, fail = false, title = "测试文章", html = "<p>第一版正文</p>";
  const dependencies = {
    loader: { async load(url: string) {
      calls++; if (fail) throw new Error("模拟抓取失败");
      return { html: "", finalUrl: url };
    }, async close() {} },
    extractor: { async extract() { return { title, html, source: "示例网站" }; } },
    imageLocalizer: { async localize(input: { html: string }) { return { html: input.html, downloaded: 0, failed: 0 }; } },
    markdownConverter: { convert(input: string) { return input; } },
  };
  const apps: FastifyInstance[] = [];
  t.after(async () => { for (const app of apps) await app.close(); await rm(root, { recursive: true, force: true }); });
  return { root, config, dependencies, apps, get calls() { return calls; },
    set fail(value: boolean) { fail = value; }, set title(value: string) { title = value; }, set html(value: string) { html = value; },
    async app() { const app = await buildApp(config, dependencies); apps.push(app); return app; },
  };
}

async function settled(app: FastifyInstance, id: string, headers: Record<string, string> = {}) {
  for (let i = 0; i < 200; i++) {
    const task = (await app.inject({ url: "/api/tasks/" + id, headers })).json();
    if (task.status === "success" || task.status === "failed") return task;
    await new Promise(resolve => setTimeout(resolve, 10));
  }
  throw new Error("Task did not settle");
}

test("task submission, skip, atomic overwrite, suffix and restart persistence", async t => {
  const f = await fixture(t);
  let app = await f.app();
  const submit = async (policy = "skip") => {
    const response = await app.inject({ method: "POST", url: "/api/tasks", payload: { url: "https://example.com/article", policy } });
    assert.equal(response.statusCode, 202);
    return settled(app, response.json().id);
  };
  const first = await submit();
  assert.equal(first.status, "success");
  assert.match(await readFile(join(f.config.storage.vaultPath, first.file), "utf8"), /第一版正文/);
  const skipped = await submit();
  assert.equal(skipped.result.status, "duplicate"); assert.equal(f.calls, 1);
  f.html = "<p>第二版正文</p>"; f.title = "更新标题";
  const overwritten = await submit("overwrite");
  assert.equal(overwritten.file, first.file);
  assert.match(await readFile(join(f.config.storage.vaultPath, first.file), "utf8"), /第二版正文/);
  const newer = await submit("suffix");
  assert.notEqual(newer.file, first.file);
  await app.close();
  app = await f.app();
  const history = (await app.inject("/api/tasks?limit=2&offset=0")).json();
  assert.equal(history.total, 4); assert.equal(history.tasks.length, 2);
  assert.equal((await submit()).file, newer.file);
  assert.equal(f.calls, 3);
  // DB holds metadata, never the article body.
  const bytes = await readFile(join(f.config.storage.dataPath, "tasks.sqlite"));
  assert.equal(bytes.includes(Buffer.from("第二版正文")), false);
});

test("failed tasks retry independently, overwrite failure preserves original content", async t => {
  const f = await fixture(t), app = await f.app();
  const saved = (await app.inject({ method: "POST", url: "/api/clips", payload: { url: "https://example.com/fail" } })).json();
  const original = await readFile(join(f.config.storage.vaultPath, saved.file), "utf8");
  f.fail = true;
  const response = await app.inject({ method: "POST", url: "/api/tasks", payload: { url: saved.url, policy: "overwrite" } });
  const failed = await settled(app, response.json().id);
  assert.equal(failed.status, "failed"); assert.match(failed.error, /模拟抓取失败/);
  assert.equal(await readFile(join(f.config.storage.vaultPath, saved.file), "utf8"), original);
  f.fail = false;
  const retry = await app.inject({ method: "POST", url: "/api/tasks/" + failed.id + "/retry", payload: {} });
  assert.equal(retry.statusCode, 202); assert.notEqual(retry.json().id, failed.id);
  assert.equal((await settled(app, retry.json().id)).status, "success");
  assert.equal((await app.inject("/api/tasks/" + failed.id)).json().status, "failed");
});

test("imports legacy URL, clip-id and filename markers once, repairs deleted indexed notes", async t => {
  const f = await fixture(t), directory = join(f.config.storage.vaultPath, "Clippings", "旧分类");
  await mkdir(directory, { recursive: true });
  await writeFile(join(directory, "旧笔记.md"), '---\n原文链接: "https://example.com/legacy"\n---\n原有正文');
  await writeFile(join(directory, "marker.md"), '<!-- link2obsidian-id: 1234567890 -->\n正文');
  await writeFile(join(directory, "filename--abcdef1234.md"), "正文");
  let app = await f.app();
  const response = await app.inject({ method: "POST", url: "/api/clips", payload: { url: "https://example.com/legacy#fragment" } });
  assert.equal(response.json().status, "duplicate"); assert.equal(f.calls, 0);
  await app.close();
  // Rename the legacy directory after indexing: open no longer scans its files.
  await rename(directory, directory + "-renamed");
  app = await f.app();
  const missing = await app.inject({ method: "POST", url: "/api/clips", payload: { url: "https://example.com/legacy" } });
  assert.equal(missing.json().status, "saved"); assert.equal(f.calls, 1);
  assert.equal((await readdir(directory + "-renamed")).length, 3);
});

test("startup resumes queued tasks and marks interrupted work failed", async t => {
  const f = await fixture(t), store = await TaskStore.open(f.config);
  const queued = store.create("https://example.com/queued", "skip");
  const interrupted = store.create("https://example.com/interrupted", "suffix");
  store.processing(interrupted.id); store.close();
  const app = await f.app();
  assert.equal((await settled(app, queued.id)).status, "success");
  const result = await settled(app, interrupted.id);
  assert.equal(result.status, "failed"); assert.match(result.error, /重启中断/);
});

test("API token protects reads, writes and retries while health and homepage remain public", async t => {
  const f = await fixture(t); f.config.server.apiToken = "test-token";
  const app = await f.app(), headers = { authorization: "Bearer test-token" };
  for (const url of ["/api/tasks", "/api/plugins", "/api/tasks/missing"]) {
    assert.equal((await app.inject(url)).statusCode, 401);
  }
  assert.equal((await app.inject({ method: "POST", url: "/api/tasks", payload: { url: "https://example.com" } })).statusCode, 401);
  assert.equal((await app.inject({ url: "/api/tasks", headers: { authorization: "Bearer wrong" } })).statusCode, 401);
  assert.equal((await app.inject("/health")).statusCode, 200);
  assert.equal((await app.inject("/")).statusCode, 200);
  assert.equal((await app.inject("/health")).json().vaultPath, undefined);
  const submitted = await app.inject({ method: "POST", url: "/api/tasks", headers, payload: { url: "https://example.com/auth" } });
  assert.equal(submitted.statusCode, 202);
  await settled(app, submitted.json().id, headers);
  assert.equal((await app.inject({ method: "POST", url: "/api/tasks/" + submitted.json().id + "/retry", payload: {} })).statusCode, 401);
  assert.equal((await app.inject({ url: "/api/tasks?limit=101", headers })).statusCode, 400);
});
