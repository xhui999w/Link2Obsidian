import { createHash } from "node:crypto";
import {
  access,
  mkdir,
  open,
  readdir,
  writeFile,
} from "node:fs/promises";
import { isAbsolute, relative, resolve, sep } from "node:path";

import { parseHTML } from "linkedom";

import type { AiEnhancer } from "../ai/types.js";
import { DEFAULT_CATEGORIES } from "./topic-classifier.js";
import type { AppConfig } from "../config/env.js";
import type {
  ArticleExtractor,
  ArticleClassifier,
  ClipResult,
  ImageLocalizer,
  MarkdownConverter,
  PageLoader,
  PluginRegistry,
} from "../domain/clip.js";
import { ClipError } from "../domain/errors.js";

export class ClipService {
  private readonly active = new Map<string, Promise<ClipResult>>();

  constructor(
    private readonly config: AppConfig,
    private readonly loader: PageLoader,
    private readonly extractor: ArticleExtractor,
    private readonly imageLocalizer: ImageLocalizer,
    private readonly markdownConverter: MarkdownConverter,
    private readonly pluginRegistry: PluginRegistry,
    private readonly classifier: ArticleClassifier,
    private readonly aiEnhancer: AiEnhancer,
  ) {}

  async clip(inputUrl: string): Promise<ClipResult> {
    const normalizedUrl = normalizeUrl(inputUrl);
    const key = urlHash(normalizedUrl);
    const current = this.active.get(key);

    if (current) {
      return current;
    }

    const task = this.execute(inputUrl, normalizedUrl, key).finally(() => {
      this.active.delete(key);
    });
    this.active.set(key, task);

    return task;
  }

  private async execute(
    originalUrl: string,
    normalizedUrl: string,
    key: string,
  ): Promise<ClipResult> {
    const outputRoot = resolveOutputDirectory(this.config);
    await mkdir(outputRoot, { recursive: true });
    const inputPlugin = this.pluginRegistry.select(normalizedUrl);

    const duplicate = await findExistingFile(outputRoot, key);
    if (duplicate) {
      return {
        status: "duplicate",
        url: originalUrl,
        file: vaultRelativePath(this.config.storage.vaultPath, duplicate),
        plugin: inputPlugin.id,
        category: categoryFromPath(outputRoot, duplicate),
      };
    }

    const page = await this.loader.load(normalizedUrl, inputPlugin);
    const extractionPlugin = this.pluginRegistry.select(page.finalUrl);
    const article = await this.extractor.extract(page, extractionPlugin);
    const baseline = this.classifier.classify({
      title: article.title,
      html: article.html,
      sourceTag: extractionPlugin.sourceTag,
    });
    let category = baseline.category;
    let tags = baseline.tags;
    let summary: string | undefined;
    let keywords: string[] | undefined;
    let aiStatus: ClipResult["ai"] = this.aiEnhancer.enabled
      ? "fallback"
      : "disabled";

    if (this.aiEnhancer.enabled) {
      try {
        const enhancement = await this.aiEnhancer.enhance({
          title: article.title,
          source: article.source,
          text: articlePlainText(
            article.html,
            this.config.ai.maxContentChars,
          ),
          suggestedCategory: baseline.category,
          suggestedTags: baseline.tags,
          allowedCategories: DEFAULT_CATEGORIES,
        });
        if (enhancement) {
          category = enhancement.category ?? baseline.category;
          tags = enhancement.tags.length
            ? uniqueTags(enhancement.tags, extractionPlugin.sourceTag)
            : baseline.tags;
          summary = enhancement.summary;
          keywords = enhancement.keywords;
          aiStatus = "enhanced";
        }
      } catch {
        // AI enhancement is deliberately best-effort. The deterministic
        // classifier and the complete article pipeline remain available.
        aiStatus = "fallback";
      }
    }
    const outputDirectory = resolveCategoryDirectory(
      outputRoot,
      category,
    );
    await mkdir(outputDirectory, { recursive: true });
    const visibleBasename = safeFilename(article.title);
    const attachmentBasename = `${visibleBasename}--${key}`;
    const destination = await availableNotePath(outputDirectory, visibleBasename);
    const localized = await this.imageLocalizer.localize({
      html: article.html,
      pageUrl: page.finalUrl,
      noteBasename: attachmentBasename,
      useProxy: extractionPlugin.page?.useProxy,
    });
    const body = this.markdownConverter.convert(localized.html);
    const markdown = renderMarkdown({
      title: article.title,
      source: article.source,
      url: originalUrl,
      created: new Date().toISOString(),
      category,
      tags,
      summary,
      keywords,
      body,
      key,
    });

    try {
      await writeFile(destination, markdown, {
        encoding: "utf8",
        flag: "wx",
      });
    } catch (error) {
      if (isAlreadyExists(error)) {
        return {
          status: "duplicate",
          title: article.title,
          source: article.source,
          url: originalUrl,
          file: vaultRelativePath(this.config.storage.vaultPath, destination),
          plugin: extractionPlugin.id,
          category,
          tags,
          summary,
          keywords,
          ai: aiStatus,
        };
      }
      throw error;
    }

    return {
      status: "saved",
      title: article.title,
      source: article.source,
      url: originalUrl,
      file: vaultRelativePath(this.config.storage.vaultPath, destination),
      plugin: extractionPlugin.id,
      category,
      tags,
      summary,
      keywords,
      ai: aiStatus,
      images: {
        downloaded: localized.downloaded,
        failed: localized.failed,
      },
    };
  }
}

export function normalizeUrl(input: string): string {
  let url: URL;

  try {
    url = new URL(input);
  } catch {
    throw new ClipError("INVALID_URL", "A valid webpage URL is required", 400);
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new ClipError("INVALID_URL", "Only HTTP and HTTPS URLs are supported", 400);
  }

  url.hash = "";
  url.hostname = url.hostname.toLowerCase();

  if (
    (url.protocol === "http:" && url.port === "80")
    || (url.protocol === "https:" && url.port === "443")
  ) {
    url.port = "";
  }

  return url.toString();
}

export function safeFilename(title: string): string {
  const cleaned = title
    .normalize("NFC")
    .replace(/[<>:"/\\|?*#[\]^\u0000-\u001f]/g, "")
    .replace(/\s+/g, " ")
    .replace(/[.\s]+$/g, "")
    .trim();
  return truncateUtf8(cleaned || "Untitled", 180);
}

function truncateUtf8(value: string, maxBytes: number): string {
  let result = "";
  let bytes = 0;

  for (const character of value) {
    const characterBytes = Buffer.byteLength(character, "utf8");
    if (bytes + characterBytes > maxBytes) {
      break;
    }
    result += character;
    bytes += characterBytes;
  }

  return result;
}

function urlHash(url: string): string {
  return createHash("sha256").update(url).digest("hex").slice(0, 10);
}

function resolveOutputDirectory(config: AppConfig): string {
  if (isAbsolute(config.storage.outputDir)) {
    throw new ClipError(
      "OUTPUT_PATH_INVALID",
      "L2O_OUTPUT_DIR must be relative to the Vault",
      500,
    );
  }

  const vault = resolve(config.storage.vaultPath);
  const output = resolve(vault, config.storage.outputDir);
  const fromVault = relative(vault, output);

  if (fromVault === ".." || fromVault.startsWith(`..${sep}`)) {
    throw new ClipError(
      "OUTPUT_PATH_INVALID",
      "The output directory must stay inside the Vault",
      500,
    );
  }

  return output;
}

async function findExistingFile(
  outputDirectory: string,
  hash: string,
): Promise<string | undefined> {
  const suffix = `--${hash}.md`;
  const entries = await readdir(outputDirectory, { withFileTypes: true });
  for (const entry of entries) {
    const path = resolve(outputDirectory, entry.name);
    if (entry.isFile() && entry.name.endsWith(".md")) {
      if (entry.name.endsWith(suffix) || await fileContainsClipId(path, hash)) {
        return path;
      }
    }
    if (entry.isDirectory()) {
      const nested = await findExistingFile(path, hash);
      if (nested) {
        return nested;
      }
    }
  }
  return undefined;
}

async function fileContainsClipId(path: string, hash: string): Promise<boolean> {
  const handle = await open(path, "r");
  try {
    const buffer = Buffer.alloc(4_096);
    const { bytesRead } = await handle.read(buffer, 0, buffer.length, 0);
    const header = buffer.subarray(0, bytesRead).toString("utf8");
    if (header.includes(`<!-- link2obsidian-id: ${hash} -->`)) {
      return true;
    }

    const urlValue = header.match(/^url:\s*(.+)$/m)?.[1]?.trim();
    if (!urlValue) {
      return false;
    }

    try {
      const url = urlValue.startsWith('"')
        ? JSON.parse(urlValue) as string
        : urlValue;
      return urlHash(normalizeUrl(url)) === hash;
    } catch {
      return false;
    }
  } finally {
    await handle.close();
  }
}

async function availableNotePath(
  directory: string,
  basename: string,
): Promise<string> {
  for (let number = 1; number < 10_000; number += 1) {
    const suffix = number === 1 ? "" : ` (${number})`;
    const candidate = resolve(directory, `${basename}${suffix}.md`);
    try {
      await access(candidate);
    } catch {
      return candidate;
    }
  }

  throw new ClipError(
    "FILENAME_EXHAUSTED",
    "Could not find an available filename for this article",
    500,
  );
}

function renderMarkdown(input: {
  title: string;
  source: string;
  url: string;
  created: string;
  category: string;
  tags: string[];
  summary?: string;
  keywords?: string[];
  body: string;
  key: string;
}): string {
  return [
    "---",
    `title: ${yamlString(input.title)}`,
    `source: ${yamlString(input.source)}`,
    `url: ${yamlString(input.url)}`,
    `created: ${input.created}`,
    `category: ${yamlString(input.category)}`,
    ...(input.summary ? [`summary: ${yamlString(input.summary)}`] : []),
    ...(input.keywords?.length
      ? [`keywords: ${JSON.stringify(input.keywords)}`]
      : []),
    `tags: ${JSON.stringify(input.tags)}`,
    "---",
    `<!-- link2obsidian-id: ${input.key} -->`,
    "",
    input.body.trim(),
    "",
  ].join("\n");
}

function articlePlainText(html: string, maxLength: number): string {
  const { document } = parseHTML(`<html><body>${html}</body></html>`);
  const text = (document.body?.textContent ?? document.textContent ?? "")
    .replace(/\s+/g, " ")
    .trim();
  return Array.from(text).slice(0, maxLength).join("");
}

function uniqueTags(tags: readonly string[], sourceTag?: string): string[] {
  return [...new Set(
    [...tags, sourceTag]
      .filter((tag): tag is string => Boolean(tag))
      .map((tag) => tag.replace(/^#+/, "").trim())
      .filter(Boolean),
  )].slice(0, 12);
}

function resolveCategoryDirectory(outputRoot: string, category: string): string {
  const directory = resolve(outputRoot, safeFilename(category));
  const fromRoot = relative(outputRoot, directory);
  if (fromRoot === ".." || fromRoot.startsWith(`..${sep}`)) {
    throw new ClipError(
      "CATEGORY_PATH_INVALID",
      "The category directory must stay inside the output directory",
      500,
    );
  }
  return directory;
}

function categoryFromPath(outputRoot: string, filePath: string): string | undefined {
  const [category] = relative(outputRoot, filePath).split(sep);
  return category?.endsWith(".md") ? undefined : category;
}

function yamlString(value: string): string {
  return JSON.stringify(value);
}

function vaultRelativePath(vaultPath: string, filePath: string): string {
  return relative(resolve(vaultPath), filePath).split(sep).join("/");
}

function isAlreadyExists(error: unknown): boolean {
  return (
    typeof error === "object"
    && error !== null
    && "code" in error
    && error.code === "EEXIST"
  );
}
