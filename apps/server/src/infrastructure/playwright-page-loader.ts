import { chromium, type Browser } from "playwright";
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
        await page.evaluate((selectors) => {
          for (const selector of selectors) {
            document.querySelectorAll(selector).forEach((element) => element.remove());
          }
        }, plugin.page.removeSelectors);
      }

      return {
        html: await page.content(),
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
