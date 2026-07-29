import assert from "node:assert/strict";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { buildApp } from "../src/app.js";
import { safeFilename } from "../src/application/clip-service.js";
import type { AppConfig } from "../src/config/env.js";
import type {
  ArticleClassifier,
  ArticleExtractor,
  ImageLocalizer,
  LoadedPage,
  MarkdownConverter,
  PageLoader,
} from "../src/domain/clip.js";
import type { SitePluginManifest } from "@link2obsidian/plugin-api";
import type { AiEnhancer } from "../src/ai/types.js";

test("safeFilename keeps UTF-8 filenames within NAS filesystem limits", () => {
  const filename = safeFilename("这是一个很长的中文标题".repeat(30));

  assert.ok(Buffer.byteLength(filename, "utf8") <= 180);
  assert.ok(filename.length > 0);
  assert.doesNotMatch(filename, /\uFFFD/);
});

class FakePageLoader implements PageLoader {
  calls = 0;
  pluginId?: string;

  async load(url: string, plugin: SitePluginManifest): Promise<LoadedPage> {
    this.calls += 1;
    this.pluginId = plugin.id;
    return {
      html: "<html></html>",
      finalUrl: url,
    };
  }

  async close(): Promise<void> {}
}

class FakeArticleExtractor implements ArticleExtractor {
  async extract(): Promise<{
    title: string;
    source: string;
    markdown: string;
  }> {
    return {
      title: "中文网页标题：测试",
      source: "示例网站",
      html: "这是正文。\n\n## 小节\n\n正文内容。",
    };
  }
}

class PassthroughImageLocalizer implements ImageLocalizer {
  async localize(input: { html: string }): Promise<{
    html: string;
    downloaded: number;
    failed: number;
  }> {
    return {
      html: input.html,
      downloaded: 0,
      failed: 0,
    };
  }
}

class PassthroughMarkdownConverter implements MarkdownConverter {
  convert(html: string): string {
    return html;
  }
}

class FakeClassifier implements ArticleClassifier {
  classify(): { category: string; tags: string[] } {
    return {
      category: "健康养生",
      tags: ["健康", "睡眠", "头条"],
    };
  }
}

class SuccessfulAiEnhancer implements AiEnhancer {
  readonly enabled = true;

  async enhance(): Promise<{
    summary: string;
    keywords: string[];
    category: string;
    tags: string[];
  }> {
    return {
      summary: "这是一段自动生成的摘要。",
      keywords: ["大模型", "知识整理"],
      category: "AI人工智能",
      tags: ["AI", "大模型"],
    };
  }
}

class FailingAiEnhancer implements AiEnhancer {
  readonly enabled = true;

  async enhance(): Promise<never> {
    throw new Error("AI is offline");
  }
}

test("POST /api/clips saves Obsidian Markdown and skips duplicate URLs", async () => {
  const vaultPath = await mkdtemp(join(tmpdir(), "link2obsidian-test-"));
  const loader = new FakePageLoader();
  const config = createConfig(vaultPath);
  const app = await buildApp(config, {
    loader,
    extractor: new FakeArticleExtractor(),
    imageLocalizer: new PassthroughImageLocalizer(),
    markdownConverter: new PassthroughMarkdownConverter(),
    classifier: new FakeClassifier(),
  });

  try {
    const first = await app.inject({
      method: "POST",
      url: "/api/clips",
      payload: {
        url: "https://example.com/中文?id=1#section",
      },
    });

    assert.equal(first.statusCode, 201);
    assert.equal(first.json().status, "saved");
    assert.equal(first.json().plugin, "general");
    assert.equal(first.json().category, "健康养生");
    assert.deepEqual(first.json().tags, ["健康", "睡眠", "头条"]);
    assert.equal(first.json().ai, "disabled");
    assert.equal(loader.pluginId, "general");

    const files = await readdir(join(vaultPath, "Clippings", "健康养生"));
    assert.equal(files.length, 1);
    assert.equal(files[0], "中文网页标题：测试.md");

    const markdown = await readFile(
      join(vaultPath, "Clippings", "健康养生", files[0] ?? ""),
      "utf8",
    );
    assert.match(markdown, /^---\n/);
    assert.match(markdown, /title: "中文网页标题：测试"/);
    assert.match(markdown, /source: "示例网站"/);
    assert.match(markdown, /url: "https:\/\/example\.com\/中文\?id=1#section"/);
    assert.match(markdown, /created: \d{4}-\d{2}-\d{2}T/);
    assert.match(markdown, /category: "健康养生"/);
    assert.match(markdown, /tags: \["健康","睡眠","头条"\]/);
    assert.match(markdown, /<!-- link2obsidian-id: [a-f0-9]{10} -->/);
    assert.match(markdown, /这是正文。/);

    const duplicate = await app.inject({
      method: "POST",
      url: "/api/clips",
      payload: {
        url: "https://example.com/中文?id=1#another-fragment",
      },
    });

    assert.equal(duplicate.statusCode, 200);
    assert.equal(duplicate.json().status, "duplicate");
    assert.equal(loader.calls, 1);

    const sameTitle = await app.inject({
      method: "POST",
      url: "/api/clips",
      payload: {
        url: "https://example.com/另一篇文章?id=2",
      },
    });

    assert.equal(sameTitle.statusCode, 201);
    assert.equal(sameTitle.json().status, "saved");
    assert.match(sameTitle.json().file, /中文网页标题：测试 \(2\)\.md$/);
  } finally {
    await app.close();
    await rm(vaultPath, { recursive: true, force: true });
  }
});

test("AI enhancement can override suggestions without changing article content", async () => {
  const vaultPath = await mkdtemp(join(tmpdir(), "link2obsidian-ai-"));
  const app = await buildApp(createConfig(vaultPath), {
    loader: new FakePageLoader(),
    extractor: new FakeArticleExtractor(),
    imageLocalizer: new PassthroughImageLocalizer(),
    markdownConverter: new PassthroughMarkdownConverter(),
    classifier: new FakeClassifier(),
    aiEnhancer: new SuccessfulAiEnhancer(),
  });

  try {
    const response = await app.inject({
      method: "POST",
      url: "/api/clips",
      payload: { url: "https://example.com/ai-article" },
    });
    const result = response.json();

    assert.equal(response.statusCode, 201);
    assert.equal(result.ai, "enhanced");
    assert.equal(result.category, "AI人工智能");
    assert.deepEqual(result.keywords, ["大模型", "知识整理"]);
    assert.match(result.file, /^Clippings\/AI人工智能\//);

    const markdown = await readFile(join(vaultPath, result.file), "utf8");
    assert.match(markdown, /summary: "这是一段自动生成的摘要。"/);
    assert.match(markdown, /keywords: \["大模型","知识整理"\]/);
    assert.match(markdown, /这是正文。/);
  } finally {
    await app.close();
    await rm(vaultPath, { recursive: true, force: true });
  }
});

test("AI failure falls back to deterministic classification and still saves", async () => {
  const vaultPath = await mkdtemp(join(tmpdir(), "link2obsidian-ai-fallback-"));
  const app = await buildApp(createConfig(vaultPath), {
    loader: new FakePageLoader(),
    extractor: new FakeArticleExtractor(),
    imageLocalizer: new PassthroughImageLocalizer(),
    markdownConverter: new PassthroughMarkdownConverter(),
    classifier: new FakeClassifier(),
    aiEnhancer: new FailingAiEnhancer(),
  });

  try {
    const response = await app.inject({
      method: "POST",
      url: "/api/clips",
      payload: { url: "https://example.com/offline-ai" },
    });
    const result = response.json();

    assert.equal(response.statusCode, 201);
    assert.equal(result.ai, "fallback");
    assert.equal(result.category, "健康养生");
    assert.match(result.file, /^Clippings\/健康养生\//);
  } finally {
    await app.close();
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
      outputDir: "Clippings",
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
}
