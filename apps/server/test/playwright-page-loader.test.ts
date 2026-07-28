import assert from "node:assert/strict";
import test from "node:test";

import type { Page } from "playwright";

import { withStablePage } from "../src/infrastructure/playwright-page-loader.js";

test("withStablePage retries when a late navigation destroys the execution context", async () => {
  let attempts = 0;
  const page = {
    waitForLoadState: async () => undefined,
  } as unknown as Page;

  const result = await withStablePage(page, async () => {
    attempts += 1;
    if (attempts === 1) {
      throw new Error(
        "page.evaluate: Execution context was destroyed, most likely because of a navigation",
      );
    }
    return "article html";
  });

  assert.equal(result, "article html");
  assert.equal(attempts, 2);
});

test("withStablePage does not retry unrelated failures", async () => {
  let attempts = 0;
  const page = {
    waitForLoadState: async () => undefined,
  } as unknown as Page;

  await assert.rejects(
    withStablePage(page, async () => {
      attempts += 1;
      throw new Error("selector is invalid");
    }),
    /selector is invalid/,
  );

  assert.equal(attempts, 1);
});
