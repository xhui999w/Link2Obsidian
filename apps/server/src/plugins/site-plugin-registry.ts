import { readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";

import type {
  SitePluginManifest,
  SitePluginRegistry,
} from "@link2obsidian/plugin-api";

import { ClipError } from "../domain/errors.js";

export class FileSitePluginRegistry implements SitePluginRegistry {
  private constructor(private readonly plugins: readonly SitePluginManifest[]) {}

  static async load(directory: string): Promise<FileSitePluginRegistry> {
    const root = resolve(directory);
    const entries = await readdir(root, { withFileTypes: true });
    const plugins: SitePluginManifest[] = [];

    for (const entry of entries) {
      if (!entry.isDirectory()) {
        continue;
      }

      const manifestPath = resolve(root, entry.name, "plugin.json");
      try {
        const raw = JSON.parse(await readFile(manifestPath, "utf8")) as unknown;
        plugins.push(validateManifest(raw, manifestPath));
      } catch (error) {
        if (isMissingFile(error)) {
          continue;
        }
        throw error;
      }
    }

    plugins.sort((left, right) => right.priority - left.priority);
    if (!plugins.some((plugin) => plugin.id === "general" && plugin.match.all)) {
      throw new ClipError(
        "PLUGIN_CONFIG_INVALID",
        "A match-all general plugin is required",
        500,
      );
    }

    return new FileSitePluginRegistry(plugins);
  }

  select(url: string): SitePluginManifest {
    const parsed = new URL(url);
    const match = this.plugins.find((plugin) => matches(plugin, parsed));
    if (!match) {
      throw new ClipError(
        "PLUGIN_NOT_FOUND",
        `No site plugin matched ${parsed.hostname}`,
        500,
      );
    }
    return match;
  }

  list(): readonly SitePluginManifest[] {
    return this.plugins;
  }
}

function matches(plugin: SitePluginManifest, url: URL): boolean {
  if (plugin.match.all) {
    return true;
  }

  const hostMatches = plugin.match.hostnames?.some((pattern) => (
    matchHostname(pattern, url.hostname)
  )) ?? false;
  if (!hostMatches) {
    return false;
  }

  return !plugin.match.pathPrefixes?.length
    || plugin.match.pathPrefixes.some((prefix) => url.pathname.startsWith(prefix));
}

function matchHostname(pattern: string, hostname: string): boolean {
  const normalizedPattern = pattern.toLowerCase();
  const normalizedHostname = hostname.toLowerCase();

  if (normalizedPattern.startsWith("*.")) {
    const base = normalizedPattern.slice(2);
    return normalizedHostname === base || normalizedHostname.endsWith(`.${base}`);
  }

  return normalizedHostname === normalizedPattern;
}

function validateManifest(
  input: unknown,
  manifestPath: string,
): SitePluginManifest {
  if (!isRecord(input)) {
    throw invalid(manifestPath, "manifest must be an object");
  }
  if (input.apiVersion !== "1") {
    throw invalid(manifestPath, "apiVersion must be \"1\"");
  }
  if (!isNonEmptyString(input.id) || !/^[a-z0-9-]+$/.test(input.id)) {
    throw invalid(manifestPath, "id must contain lowercase letters, numbers, or hyphens");
  }
  if (!isNonEmptyString(input.name)) {
    throw invalid(manifestPath, "name is required");
  }
  if (!Number.isInteger(input.priority)) {
    throw invalid(manifestPath, "priority must be an integer");
  }
  if (!isRecord(input.match)) {
    throw invalid(manifestPath, "match is required");
  }

  return input as unknown as SitePluginManifest;
}

function invalid(path: string, message: string): ClipError {
  return new ClipError(
    "PLUGIN_CONFIG_INVALID",
    `${path}: ${message}`,
    500,
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isMissingFile(error: unknown): boolean {
  return (
    typeof error === "object"
    && error !== null
    && "code" in error
    && error.code === "ENOENT"
  );
}

