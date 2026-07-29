import { chromium, type Browser, type Page } from "playwright";
import type { SitePluginManifest } from "@link2obsidian/plugin-api";

import type { AppConfig } from "../config/env.js";
import type { LoadedPage, PageLoader } from "../domain/clip.js";
import { ClipError } from "../domain/errors.js";

export class PlaywrightPageLoader implements PageLoader {
  private browser?: Browser;

  constructor(private readonly config: AppConfig) {}

  async load(url: string, plugin: SitePluginManifest): Promise<LoadedPage> {
    const browser = await this.getBrowser();
    const context = await browser.newContext({
      locale: this.config.runtime.language,
      timezoneId: this.config.runtime.timezone,
      javaScriptEnabled: plugin.page?.javaScriptEnabled ?? true,
      proxy: plugin.page?.useProxy && this.config.runtime.proxyServer
        ? { server: this.config.runtime.proxyServer }
        : undefined,
      userAgent: plugin.page?.userAgent,
    });

    try {
      const page = await context.newPage();
      const response = await page.goto(url, {
        waitUntil: "domcontentloaded",
        timeout: this.config.runtime.pageTimeoutMs,
      });

      if (response && response.status() >= 400) {
        throw new ClipError(
          "PAGE_LOAD_FAILED",
          `The page returned HTTP ${response.status()}`,
          422,
        );
      }

      await page.waitForLoadState("networkidle", {
        timeout: Math.min(this.config.runtime.pageTimeoutMs, 5_000),
      }).catch(() => undefined);

      if (plugin.page?.waitForSelector) {
        await page.waitForSelector(plugin.page.waitForSelector, {
          state: "attached",
          timeout: Math.min(this.config.runtime.pageTimeoutMs, 5_000),
        }).catch(() => undefined);
      }

      if (plugin.page?.removeSelectors?.length) {
        await withStablePage(page, async () => {
          await page.evaluate((selectors) => {
            for (const selector of selectors) {
              document.querySelectorAll(selector).forEach((element) => element.remove());
            }
          }, plugin.page?.removeSelectors ?? []);
        });
      }

      return {
        html: await withStablePage(page, () => page.content()),
        finalUrl: page.url(),
      };
    } catch (error) {
      if (error instanceof ClipError) {
        throw error;
      }

      const message = error instanceof Error ? error.message : "Unknown browser error";
      throw new ClipError("PAGE_LOAD_FAILED", message, 422);
    } finally {
      await context.close();
    }
  }

  async close(): Promise<void> {
    await this.browser?.close();
    this.browser = undefined;
  }

  private async getBrowser(): Promise<Browser> {
    if (!this.browser?.isConnected()) {
      this.browser = await chromium.launch({
        headless: true,
      });
    }

    return this.browser;
  }
}

export async function withStablePage<T>(
  page: Page,
  operation: () => Promise<T>,
): Promise<T> {
  const attempts = 3;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    await page.waitForLoadState("domcontentloaded", {
      timeout: 5_000,
    }).catch(() => undefined);

    try {
      return await operation();
    } catch (error) {
      if (!isNavigationRace(error) || attempt === attempts) {
        throw error;
      }
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
  }

  throw new Error("Page did not become stable");
}

function isNavigationRace(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  return (
    error.message.includes("Execution context was destroyed")
    || error.message.includes("Cannot find context with specified id")
    || error.message.includes("Target page, context or browser has been closed")
  );
}
