import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { extname, isAbsolute, relative, resolve, sep } from "node:path";

import convertHeic from "heic-convert";
import { parseHTML } from "linkedom";

import type { AppConfig } from "../config/env.js";
import type { ImageLocalizer, LocalizedArticle } from "../domain/clip.js";
import { ClipError } from "../domain/errors.js";

const CONTENT_TYPE_EXTENSIONS: Readonly<Record<string, string>> = {
  "image/avif": ".avif",
  "image/gif": ".gif",
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/svg+xml": ".svg",
  "image/webp": ".webp",
};

const URL_EXTENSIONS = new Set([
  ".avif",
  ".gif",
  ".jpeg",
  ".jpg",
  ".png",
  ".svg",
  ".webp",
]);

type HeicConverter = (input: {
  buffer: Buffer;
  format: "JPEG";
  quality: number;
}) => Promise<Buffer>;

export class HttpImageLocalizer implements ImageLocalizer {
  constructor(
    private readonly config: AppConfig,
    private readonly fetchImage: typeof fetch = globalThis.fetch,
    private readonly heicConverter: HeicConverter = convertHeic,
  ) {}

  async localize(input: {
    html: string;
    pageUrl: string;
    noteBasename: string;
  }): Promise<LocalizedArticle> {
    const { document } = parseHTML(`<html><body>${input.html}</body></html>`);
    const images = Array.from(document.querySelectorAll("img"))
      .slice(0, this.config.runtime.maxImages);
    const attachmentRoot = resolveVaultDirectory(
      this.config.storage.vaultPath,
      this.config.storage.attachmentsDir,
    );
    const attachmentDirectory = resolve(attachmentRoot, input.noteBasename);
    const vaultFolder = [
      this.config.storage.attachmentsDir.replaceAll("\\", "/").replace(/^\/+|\/+$/g, ""),
      input.noteBasename,
    ].filter(Boolean).join("/");
    const sourcePaths = new Map<string, string>();
    const contentPaths = new Map<string, string>();
    let downloaded = 0;
    let failed = 0;

    for (const image of images) {
      const source = resolveImageSource(image, input.pageUrl);
      if (!source) {
        continue;
      }

      const existingPath = sourcePaths.get(source);
      if (existingPath) {
        markLocalized(image, existingPath);
        continue;
      }

      try {
        const asset = await this.download(source, input.pageUrl);
        const contentHash = createHash("sha256").update(asset.bytes).digest("hex");
        const duplicatePath = contentPaths.get(contentHash);

        if (duplicatePath) {
          sourcePaths.set(source, duplicatePath);
          markLocalized(image, duplicatePath);
          continue;
        }

        const filename = `image${String(downloaded + 1).padStart(3, "0")}${asset.extension}`;
        const vaultPath = `${vaultFolder}/${filename}`;
        await mkdir(attachmentDirectory, { recursive: true });
        await writeFile(resolve(attachmentDirectory, filename), asset.bytes);
        downloaded += 1;
        sourcePaths.set(source, vaultPath);
        contentPaths.set(contentHash, vaultPath);
        markLocalized(image, vaultPath);
      } catch {
        failed += 1;
        image.setAttribute("src", source);
      }
    }

    return {
      html: document.toString(),
      downloaded,
      failed,
    };
  }

  private async download(
    url: string,
    pageUrl: string,
  ): Promise<{ bytes: Uint8Array; extension: string }> {
    const response = await this.fetchImage(url, {
      headers: {
        Accept: "image/avif,image/webp,image/png,image/jpeg,image/gif,image/svg+xml,image/*;q=0.8",
        Referer: pageUrl,
      },
      redirect: "follow",
      signal: AbortSignal.timeout(this.config.runtime.imageTimeoutMs),
    });

    if (!response.ok) {
      throw new Error(`Image returned HTTP ${response.status}`);
    }

    const announcedSize = Number.parseInt(
      response.headers.get("content-length") ?? "0",
      10,
    );
    if (
      Number.isFinite(announcedSize)
      && announcedSize > this.config.runtime.maxImageBytes
    ) {
      throw new Error("Image exceeds the configured size limit");
    }

    const contentType = response.headers.get("content-type")
      ?.split(";", 1)[0]
      ?.trim()
      .toLowerCase();
    let bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.byteLength > this.config.runtime.maxImageBytes) {
      throw new Error("Image exceeds the configured size limit");
    }

    if (contentType === "image/heic" || contentType === "image/heif") {
      bytes = new Uint8Array(await this.heicConverter({
        buffer: Buffer.from(bytes),
        format: "JPEG",
        quality: 0.9,
      }));
      if (bytes.byteLength > this.config.runtime.maxImageBytes) {
        throw new Error("Converted image exceeds the configured size limit");
      }
      return { bytes, extension: ".jpg" };
    }

    const extension = extensionFor(contentType, response.url || url);
    if (!extension) {
      throw new Error("Response is not a supported image");
    }

    return { bytes, extension };
  }
}

function resolveImageSource(image: Element, pageUrl: string): string | undefined {
  const srcset = image.getAttribute("srcset") ?? image.getAttribute("data-srcset");
  const srcsetCandidate = srcset
    ?.split(",")
    .map((candidate) => candidate.trim().split(/\s+/, 1)[0])
    .filter((candidate): candidate is string => Boolean(candidate))
    .at(-1);
  const candidate = srcsetCandidate
    ?? image.getAttribute("data-src")
    ?? image.getAttribute("data-original")
    ?? image.getAttribute("data-lazy-src")
    ?? image.getAttribute("src");

  if (!candidate || candidate.startsWith("data:") || candidate.startsWith("blob:")) {
    return undefined;
  }

  try {
    const resolved = new URL(candidate, pageUrl);
    return resolved.protocol === "http:" || resolved.protocol === "https:"
      ? resolved.toString()
      : undefined;
  } catch {
    return undefined;
  }
}

function markLocalized(image: Element, vaultPath: string): void {
  image.setAttribute("data-l2o-local-path", vaultPath);
  image.setAttribute("src", vaultPath);
  image.removeAttribute("srcset");
  image.removeAttribute("data-srcset");
}

function extensionFor(
  contentType: string | undefined,
  url: string,
): string | undefined {
  if (contentType && CONTENT_TYPE_EXTENSIONS[contentType]) {
    return CONTENT_TYPE_EXTENSIONS[contentType];
  }

  if (
    contentType
    && contentType !== "application/octet-stream"
    && !contentType.startsWith("image/")
  ) {
    return undefined;
  }

  try {
    const extension = extname(new URL(url).pathname).toLowerCase();
    if (URL_EXTENSIONS.has(extension)) {
      return extension === ".jpeg" ? ".jpg" : extension;
    }
  } catch {
    return undefined;
  }

  return undefined;
}

function resolveVaultDirectory(vaultPath: string, configuredPath: string): string {
  if (isAbsolute(configuredPath)) {
    throw new ClipError(
      "ATTACHMENT_PATH_INVALID",
      "L2O_ATTACHMENTS_DIR must be relative to the Vault",
      500,
    );
  }

  const vault = resolve(vaultPath);
  const directory = resolve(vault, configuredPath);
  const fromVault = relative(vault, directory);
  if (fromVault === ".." || fromVault.startsWith(`..${sep}`)) {
    throw new ClipError(
      "ATTACHMENT_PATH_INVALID",
      "The attachment directory must stay inside the Vault",
      500,
    );
  }

  return directory;
}
