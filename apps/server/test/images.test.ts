import assert from "node:assert/strict";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import type { AppConfig } from "../src/config/env.js";
import { HttpImageLocalizer } from "../src/infrastructure/image-localizer.js";
import { TurndownMarkdownConverter } from "../src/infrastructure/turndown-markdown-converter.js";

test("localizes images, reuses duplicate content, and keeps failed images remote", async () => {
  const vaultPath = await mkdtemp(join(tmpdir(), "link2obsidian-images-"));
  const imageBytes = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
  const fetchImage = (async (input: string | URL | Request) => {
    const url = input.toString();
    if (url.endsWith("missing.jpg")) {
      return new Response("missing", { status: 404 });
    }

    return new Response(imageBytes, {
      status: 200,
      headers: {
        "content-type": "image/png",
      },
    });
  }) as typeof fetch;
  const localizer = new HttpImageLocalizer(
    createConfig(vaultPath),
    fetchImage,
  );

  try {
    const result = await localizer.localize({
      html: [
        "<article>",
        '<img src="/first.png" alt="first">',
        '<img src="https://cdn.example.com/copy.png" alt="copy">',
        '<img src="/missing.jpg" alt="missing">',
        "</article>",
      ].join(""),
      pageUrl: "https://example.com/article",
      noteBasename: "中文文章--abc123",
    });

    assert.equal(result.downloaded, 1);
    assert.equal(result.failed, 1);

    const files = await readdir(
      join(vaultPath, "Attachments", "中文文章--abc123"),
    );
    assert.deepEqual(files, ["image001.png"]);
    assert.deepEqual(
      new Uint8Array(
        await readFile(
          join(
            vaultPath,
            "Attachments",
            "中文文章--abc123",
            "image001.png",
          ),
        ),
      ),
      imageBytes,
    );

    const markdown = new TurndownMarkdownConverter().convert(result.html);
    const localEmbeds = markdown.match(
      /!\[\[Attachments\/中文文章--abc123\/image001\.png\]\]/g,
    );
    assert.equal(localEmbeds?.length, 2);
    assert.match(markdown, /!\[missing\]\(https:\/\/example\.com\/missing\.jpg\)/);
  } finally {
    await rm(vaultPath, { recursive: true, force: true });
  }
});

function createConfig(vaultPath: string): AppConfig {
  return {
    server: {
      host: "127.0.0.1",
      port: 8080,
      logLevel: "fatal",
    },
    storage: {
      vaultPath,
      outputDir: "文章",
      attachmentsDir: "Attachments",
      dataPath: join(vaultPath, ".data"),
      tmpPath: join(vaultPath, ".tmp"),
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
      duplicatePolicy: "skip",
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
}
