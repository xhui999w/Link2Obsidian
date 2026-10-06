import assert from "node:assert/strict";
import test from "node:test";
import { loadConfig } from "../src/config/env.js";
import { HttpImageLocalizer } from "../src/infrastructure/image-localizer.js";

test("image redirect to private IP is blocked before the second request", async () => {
  const calls: string[] = [];
  const localizer = new HttpImageLocalizer(loadConfig(), async url => {
    calls.push(url);
    return new Response(null, { status: 302, headers: { location: "http://169.254.169.254/secret" } });
  }, undefined, async () => [{ address: "8.8.8.8", family: 4 }]);
  try {
    const result = await localizer.localize({
      html: '<img src="https://example.com/redirect.png">', pageUrl: "https://example.com/article", noteBasename: "test",
    });
    assert.equal(result.failed, 1);
    assert.deepEqual(calls, ["https://example.com/redirect.png"]);
  } finally { await localizer.close(); }
});

test("image requests with private DNS answers never reach the transport", async () => {
  let calls = 0;
  const localizer = new HttpImageLocalizer(loadConfig(), async () => {
    calls++; return new Response(null);
  }, undefined, async () => [{ address: "10.0.0.1", family: 4 }]);
  try {
    const result = await localizer.localize({
      html: '<img src="https://evil.example/image.png">', pageUrl: "https://example.com/article", noteBasename: "test",
    });
    assert.equal(result.failed, 1); assert.equal(calls, 0);
  } finally { await localizer.close(); }
});
