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
  const imageUrls = Array.from(
    document.querySelectorAll('meta[property="og:image"]'),
  ).map((element) => element.getAttribute("content")?.trim())
    .filter((value): value is string => Boolean(value));
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
