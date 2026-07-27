import assert from "node:assert/strict";
import test from "node:test";

import {
  DEFAULT_CATEGORIES,
  KeywordTopicClassifier,
} from "../src/application/topic-classifier.js";

const classifier = new KeywordTopicClassifier("生活经验");

test("classifies health content and appends the source tag", () => {
  const result = classifier.classify({
    title: "改善睡眠和失眠的实用方法",
    html: "<p>医生介绍健康作息、早睡和饮食建议。</p>",
    sourceTag: "头条",
  });

  assert.equal(result.category, "健康养生");
  assert.deepEqual(result.tags.slice(0, 2), ["健康", "睡眠"]);
  assert.equal(result.tags.at(-1), "头条");
});

test("classifies AI and programming topics independently from source", () => {
  const ai = classifier.classify({
    title: "大模型智能体与 RAG 实践",
    html: "<p>介绍人工智能、LLM、提示词和模型训练。</p>",
    sourceTag: "知乎",
  });
  const development = classifier.classify({
    title: "使用 Docker 部署 Node.js API",
    html: "<p>这是一篇后端编程和 Linux 运维教程。</p>",
    sourceTag: "头条",
  });

  assert.equal(ai.category, "AI人工智能");
  assert.ok(ai.tags.includes("知乎"));
  assert.equal(development.category, "编程开发");
  assert.ok(development.tags.includes("头条"));
});

test("exposes exactly the ten default knowledge categories", () => {
  assert.deepEqual(DEFAULT_CATEGORIES, [
    "健康养生",
    "运动健康",
    "育儿教育",
    "AI人工智能",
    "科技数码",
    "学习成长",
    "编程开发",
    "商业财经",
    "生活经验",
    "兴趣爱好",
  ]);
});
