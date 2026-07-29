import type {
  SitePluginManifest,
  SitePluginRegistry,
} from "@link2obsidian/plugin-api";

export interface LoadedPage {
  html: string;
  finalUrl: string;
}

export interface ExtractedArticle {
  title: string;
  source: string;
  html: string;
}

export interface ClipResult {
  status: "saved" | "duplicate";
  title?: string;
  source?: string;
  url: string;
  file: string;
  plugin?: string;
  category?: string;
  tags?: string[];
  summary?: string;
  keywords?: string[];
  ai?: "enhanced" | "disabled" | "fallback";
  images?: {
    downloaded: number;
    failed: number;
  };
}

export interface PageLoader {
  load(url: string, plugin: SitePluginManifest): Promise<LoadedPage>;
  close(): Promise<void>;
}

export interface ArticleExtractor {
  extract(
    page: LoadedPage,
    plugin: SitePluginManifest,
  ): Promise<ExtractedArticle>;
}

export type PluginRegistry = SitePluginRegistry;

export interface LocalizedArticle {
  html: string;
  downloaded: number;
  failed: number;
}

export interface ImageLocalizer {
  localize(input: {
    html: string;
    pageUrl: string;
    noteBasename: string;
    useProxy?: boolean;
  }): Promise<LocalizedArticle>;
}

export interface MarkdownConverter {
  convert(html: string): string;
}

export interface ClassificationResult {
  category: string;
  tags: string[];
}

export interface ArticleClassifier {
  classify(input: {
    title: string;
    html: string;
    sourceTag?: string;
  }): ClassificationResult;
}
