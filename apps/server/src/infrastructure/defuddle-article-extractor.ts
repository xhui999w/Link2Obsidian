import { Defuddle } from "defuddle/node";
import type { SitePluginManifest } from "@link2obsidian/plugin-api";
import { parseHTML } from "linkedom";

import type {
  ArticleExtractor,
  ExtractedArticle,
  LoadedPage,
} from "../domain/clip.js";
import { ClipError } from "../domain/errors.js";

export class DefuddleArticleExtractor implements ArticleExtractor {
  constructor(private readonly language: string) {}

  async extract(
    page: LoadedPage,
    plugin: SitePluginManifest,
  ): Promise<ExtractedArticle> {
    const { document } = parseHTML(page.html);
    const result = await Defuddle(page.html, page.finalUrl, {
      contentSelector: plugin.extraction?.contentSelector,
      markdown: false,
      language: this.language,
      removeImages: false,
      removeHiddenElements: plugin.extraction?.removeHiddenElements,
      useAsync: false,
    });

    const title = firstSelectorValue(
      document,
      plugin.extraction?.titleSelectors,
    ) || (result.title ?? "").trim();
    const html = plugin.extraction?.openGraphContent
      ? openGraphContent(document)
      : (result.content ?? "").trim();
    const hostname = new URL(page.finalUrl).hostname.replace(/^www\./, "");
    const source = firstSelectorValue(
      document,
      plugin.extraction?.sourceSelectors,
    ) || (result.site ?? "").trim()
      || (result.domain ?? "").trim()
      || hostname;

    if (!title) {
      throw new ClipError("TITLE_NOT_FOUND", "Could not determine the page title", 422);
    }

    if (!html) {
      throw new ClipError("CONTENT_NOT_FOUND", "Could not extract page content", 422);
    }

    return {
      title,
      source,
      html,
    };
  }
}

function openGraphContent(document: Document): string {
  const description = document
    .querySelector('meta[property="og:description"]')
    ?.getAttribute("content")
    ?.trim();
  const imageUrls = carouselImageUrls(document);
  if (imageUrls.length === 0) {
    imageUrls.push(
      ...Array.from(document.querySelectorAll('meta[property="og:image"]'))
        .map((element) => element.getAttribute("content")?.trim())
        .filter((value): value is string => Boolean(value)),
    );
  }
  const container = document.createElement("div");

  for (const imageUrl of [...new Set(imageUrls)]) {
    const image = document.createElement("img");
    image.setAttribute("src", imageUrl);
    container.append(image);
  }

  if (description) {
    const paragraph = document.createElement("p");
    paragraph.textContent = description;
    container.append(paragraph);
  }

  return container.innerHTML.trim();
}

function carouselImageUrls(document: Document): string[] {
  const shortcode = document
    .querySelector('meta[property="og:url"]')
    ?.getAttribute("content")
    ?.match(/\/(?:p|reel|reels)\/([^/?#]+)/)?.[1];
  if (!shortcode) {
    return [];
  }

  for (const script of Array.from(document.querySelectorAll("script"))) {
    const text = script.textContent;
    if (!text?.includes(shortcode) || !text.includes("carousel_media")) {
      continue;
    }

    try {
      const media = findCarouselMedia(JSON.parse(text), shortcode);
      const urls = media
        .map((item) => imageUrl(item))
        .filter((value): value is string => Boolean(value));
      if (urls.length > 1) {
        return [...new Set(urls)];
      }
    } catch {
      // Instagram embeds several unrelated scripts. Invalid or changed
      // payloads simply fall back to the Open Graph cover image.
    }
  }

  return [];
}

function findCarouselMedia(value: unknown, shortcode: string): unknown[] {
  if (!value || typeof value !== "object") {
    return [];
  }

  const record = value as Record<string, unknown>;
  if (record.code === shortcode) {
    const direct = record.carousel_media;
    if (Array.isArray(direct)) {
      return direct;
    }

    const publicMedia = record.if_not_gated_logged_out;
    if (publicMedia && typeof publicMedia === "object") {
      const carousel = (publicMedia as Record<string, unknown>).carousel_media;
      if (Array.isArray(carousel)) {
        return carousel;
      }
    }
  }

  for (const child of Array.isArray(value) ? value : Object.values(record)) {
    const media = findCarouselMedia(child, shortcode);
    if (media.length > 0) {
      return media;
    }
  }

  return [];
}

function imageUrl(value: unknown): string | undefined {
  if (!value || typeof value !== "object") {
    return undefined;
  }

  const media = value as Record<string, unknown>;
  if (typeof media.display_uri === "string") {
    return media.display_uri;
  }

  const versions = media.image_versions2;
  if (!versions || typeof versions !== "object") {
    return undefined;
  }

  const candidates = (versions as Record<string, unknown>).candidates;
  if (!Array.isArray(candidates)) {
    return undefined;
  }

  for (const candidate of candidates) {
    if (
      candidate
      && typeof candidate === "object"
      && typeof (candidate as Record<string, unknown>).url === "string"
    ) {
      return (candidate as Record<string, string>).url;
    }
  }

  return undefined;
}

function firstSelectorValue(
  document: Document,
  selectors: readonly string[] | undefined,
): string {
  for (const selector of selectors ?? []) {
    const element = document.querySelector(selector);
    if (!element) {
      continue;
    }

    const value = element.getAttribute("content")?.trim()
      || element.textContent?.replace(/\s+/g, " ").trim();
    if (value) {
      return value;
    }
  }

  return "";
}
