export const pluginApiVersion = "1";

export interface SitePluginManifest {
  apiVersion: "1";
  id: string;
  name: string;
  priority: number;
  sourceTag?: string;
  match: {
    all?: boolean;
    hostnames?: string[];
    pathPrefixes?: string[];
  };
  page?: {
    javaScriptEnabled?: boolean;
    useProxy?: boolean;
    userAgent?: string;
    waitForSelector?: string;
    removeSelectors?: string[];
  };
  extraction?: {
    contentSelector?: string;
    openGraphContent?: boolean;
    titleSelectors?: string[];
    sourceSelectors?: string[];
    removeHiddenElements?: boolean;
  };
}

export interface SitePluginRegistry {
  select(url: string): SitePluginManifest;
  list(): readonly SitePluginManifest[];
}
