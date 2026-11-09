import assert from "node:assert/strict";
import test from "node:test";
import { platformFolder, collectionPrefix } from "../src/application/archive-layout.js";

test("archive folders depend on the platform rather than content topics", () => {
  for (const [plugin, folder] of Object.entries({ toutiao: "头条", wechat: "微信", zhihu: "知乎", x: "X", instagram: "Instagram", general: "网页", custom: "网页" })) {
    assert.equal(platformFolder(plugin), folder);
  }
});

test("collection filename prefixes sort chronologically across local midnight", () => {
  const before = collectionPrefix(new Date("2026-11-08T15:59:59Z"), "Asia/Shanghai");
  const after = collectionPrefix(new Date("2026-11-08T16:00:00Z"), "Asia/Shanghai");
  assert.equal(before, "2026-11-08 235959");
  assert.equal(after, "2026-11-09 000000");
  assert.ok(before < after);
  assert.equal(collectionPrefix(new Date("2026-11-08T16:00:00Z"), "UTC"), "2026-11-08 160000");
});
