import assert from "node:assert/strict";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { DefuddleArticleExtractor } from "../src/infrastructure/defuddle-article-extractor.js";
import { FileSitePluginRegistry } from "../src/plugins/site-plugin-registry.js";

const pluginsPath = fileURLToPath(new URL("../../../plugins", import.meta.url));

test("selects Chinese site plugins and falls back to general", async () => {
  const registry = await FileSitePluginRegistry.load(pluginsPath);

  assert.equal(
    registry.select("https://www.toutiao.com/article/123").id,
    "toutiao",
  );
  assert.equal(
    registry.select("https://zhuanlan.zhihu.com/p/123").id,
    "zhihu",
  );
  assert.equal(
    registry.select("https://mp.weixin.qq.com/s/abc").id,
    "wechat",
  );
  assert.equal(
    registry.select("https://example.com/article").id,
    "general",
  );
  assert.deepEqual(
    registry.list().map((plugin) => plugin.id).sort(),
    ["general", "toutiao", "wechat", "zhihu"],
  );
});

test("wechat plugin uses site-specific title, source, and content selectors", async () => {
  const registry = await FileSitePluginRegistry.load(pluginsPath);
  const plugin = registry.select("https://mp.weixin.qq.com/s/example");
  assert.equal(plugin.page?.javaScriptEnabled, false);
  const extractor = new DefuddleArticleExtractor("zh-CN");
  const article = await extractor.extract(
    {
      finalUrl: "https://mp.weixin.qq.com/s/example",
      html: [
        "<!doctype html><html><head><title>页面标题</title></head><body>",
        '<h1 id="activity-name">微信公众号中文标题</h1>',
        '<div id="js_name">测试公众号</div>',
        '<div class="navigation">不应作为正文的导航信息</div>',
        '<div id="js_content">',
        "<p>这是微信公众号文章的第一段正文，包含足够的中文内容用于提取。</p>",
        "<p>这是文章的第二段正文，用来验证站点专用正文选择器。</p>",
        "</div>",
        "</body></html>",
      ].join(""),
    },
    plugin,
  );

  assert.equal(article.title, "微信公众号中文标题");
  assert.equal(article.source, "测试公众号");
  assert.match(article.html, /第一段正文/);
  assert.doesNotMatch(article.html, /不应作为正文的导航信息/);
});
