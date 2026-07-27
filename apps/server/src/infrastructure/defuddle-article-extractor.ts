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
    const html = (result.content ?? "").trim();
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
