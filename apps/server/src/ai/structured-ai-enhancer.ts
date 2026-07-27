import type {
  AiChatProvider,
  AiEnhancement,
  AiEnhancer,
} from "./types.js";

const SYSTEM_PROMPT = [
  "你是文章整理助手，只负责摘要、关键词、主题分类和标签。",
  "必须只返回一个 JSON 对象，不要返回 Markdown 或解释。",
  "JSON 格式：",
  '{"summary":"不超过150字的中文摘要","keywords":["关键词"],"category":"分类","tags":["标签"]}',
  "category 必须来自用户提供的允许分类。",
  "keywords 和 tags 各不超过 8 个，不要包含 # 前缀。",
].join("\n");

export class StructuredAiEnhancer implements AiEnhancer {
  readonly enabled = true;

  constructor(private readonly provider: AiChatProvider) {}

  async enhance(input: {
    title: string;
    source: string;
    text: string;
    suggestedCategory: string;
    suggestedTags: string[];
    allowedCategories: readonly string[];
  }): Promise<AiEnhancement> {
    const userPrompt = [
      `允许分类：${input.allowedCategories.join("、")}`,
      `规则分类建议：${input.suggestedCategory}`,
      `规则标签建议：${input.suggestedTags.join("、")}`,
      `标题：${input.title}`,
      `来源：${input.source}`,
      "正文：",
      input.text,
    ].join("\n");
    const content = await this.provider.complete(SYSTEM_PROMPT, userPrompt);
    return parseEnhancement(content, input.allowedCategories);
  }
}

export function parseEnhancement(
  content: string,
  allowedCategories: readonly string[],
): AiEnhancement {
  const json = extractJson(content);
  const value = JSON.parse(json) as unknown;
  if (!isRecord(value)) {
    throw new Error("AI response must be a JSON object");
  }

  const summary = cleanText(value.summary, 500);
  const keywords = cleanList(value.keywords, 8);
  const tags = cleanList(value.tags, 8);
  const categoryValue = cleanText(value.category, 50);
  const category = allowedCategories.includes(categoryValue)
    ? categoryValue
    : undefined;

  if (!summary) {
    throw new Error("AI response is missing a summary");
  }

  return {
    summary,
    keywords,
    category,
    tags,
  };
}

function extractJson(content: string): string {
  const trimmed = content.trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "");
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start < 0 || end <= start) {
    throw new Error("AI response does not contain JSON");
  }
  return trimmed.slice(start, end + 1);
}

function cleanList(value: unknown, limit: number): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return [...new Set(
    value
      .filter((item): item is string => typeof item === "string")
      .map((item) => cleanText(item.replace(/^#+/, ""), 40))
      .filter(Boolean),
  )].slice(0, limit);
}

function cleanText(value: unknown, maxLength: number): string {
  return typeof value === "string"
    ? Array.from(value.replace(/\s+/g, " ").trim()).slice(0, maxLength).join("")
    : "";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

