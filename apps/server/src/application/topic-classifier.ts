import { parseHTML } from "linkedom";

import type {
  ArticleClassifier,
  ClassificationResult,
} from "../domain/clip.js";

interface Topic {
  tag: string;
  keywords: readonly string[];
}

interface CategoryRule {
  category: string;
  categoryTag: string;
  topics: readonly Topic[];
}

export const DEFAULT_CATEGORIES = [
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
] as const;

const RULES: readonly CategoryRule[] = [
  rule("健康养生", "健康", [
    topic("睡眠", "睡眠", "失眠", "熬夜", "早睡", "睡觉"),
    topic("饮食", "饮食", "营养", "食疗", "养生", "维生素"),
    topic("疾病", "疾病", "症状", "治疗", "医生", "医院", "血压", "血糖"),
    topic("心理健康", "心理健康", "焦虑", "抑郁", "情绪", "心理"),
  ]),
  rule("运动健康", "运动", [
    topic("健身", "健身", "增肌", "减脂", "力量训练"),
    topic("跑步", "跑步", "马拉松", "配速"),
    topic("球类", "篮球", "足球", "羽毛球", "乒乓球", "网球"),
    topic("瑜伽", "瑜伽", "拉伸", "体态"),
  ]),
  rule("育儿教育", "育儿", [
    topic("教育", "教育", "学校", "老师", "学生", "考试", "课程"),
    topic("亲子", "育儿", "亲子", "孩子", "儿童", "宝宝", "父母"),
    topic("家庭教育", "家庭教育", "学习习惯", "青春期"),
  ]),
  rule("AI人工智能", "AI", [
    topic("大模型", "大模型", "LLM", "ChatGPT", "Claude", "Gemini"),
    topic("人工智能", "人工智能", "生成式AI", "AIGC", "智能体", "Agent"),
    topic("机器学习", "机器学习", "深度学习", "神经网络", "模型训练"),
    topic("提示词", "提示词", "Prompt", "RAG"),
  ]),
  rule("科技数码", "科技", [
    topic("手机", "手机", "安卓", "Android", "iPhone", "鸿蒙"),
    topic("电脑", "电脑", "笔记本", "CPU", "GPU", "显卡", "芯片"),
    topic("数码", "数码", "相机", "耳机", "路由器", "智能家居"),
    topic("互联网", "互联网", "操作系统", "软件", "硬件"),
  ]),
  rule("学习成长", "学习", [
    topic("方法论", "方法论", "学习方法", "思维方式", "认知"),
    topic("效率", "效率", "时间管理", "习惯", "复盘", "目标管理"),
    topic("职场成长", "职场", "工作方法", "职业规划", "沟通"),
    topic("阅读", "阅读", "读书", "书单"),
  ]),
  rule("编程开发", "编程", [
    topic("前端", "前端", "JavaScript", "TypeScript", "React", "Vue", "CSS"),
    topic("后端", "后端", "Node.js", "Java", "Go语言", "Python", "数据库"),
    topic("运维", "Docker", "Kubernetes", "Linux", "NAS", "部署", "DevOps"),
    topic("开发工具", "Git", "GitHub", "API", "开源", "代码"),
  ]),
  rule("商业财经", "财经", [
    topic("投资", "投资", "股票", "基金", "债券", "理财", "资产"),
    topic("经济", "经济", "金融", "货币", "利率", "通胀", "宏观"),
    topic("商业", "商业", "创业", "公司", "企业", "市场", "营销"),
    topic("消费", "消费", "价格", "收入", "成本"),
  ]),
  rule("生活经验", "生活", [
    topic("家居", "家居", "装修", "收纳", "清洁", "家务"),
    topic("美食", "美食", "菜谱", "做饭", "烹饪", "食材"),
    topic("旅行", "旅行", "旅游", "攻略", "酒店", "景点"),
    topic("办事经验", "经验", "指南", "技巧", "避坑", "流程"),
  ]),
  rule("兴趣爱好", "兴趣", [
    topic("摄影", "摄影", "拍照", "镜头"),
    topic("音乐", "音乐", "歌曲", "乐器"),
    topic("影视", "电影", "电视剧", "动漫", "综艺"),
    topic("游戏", "游戏", "电竞", "主机"),
    topic("手工", "手工", "绘画", "书法", "园艺", "钓鱼"),
  ]),
];

export class KeywordTopicClassifier implements ArticleClassifier {
  constructor(private readonly defaultCategory: string) {}

  classify(input: {
    title: string;
    html: string;
    sourceTag?: string;
  }): ClassificationResult {
    const { document } = parseHTML(`<html><body>${input.html}</body></html>`);
    const title = input.title.toLowerCase();
    const body = (document.body?.textContent ?? document.textContent ?? "").toLowerCase();
    const scored = RULES.map((category) => scoreCategory(category, title, body));
    scored.sort((left, right) => right.score - left.score);
    const fallbackRule = RULES.find(
      (ruleItem) => ruleItem.category === this.defaultCategory,
    ) ?? RULES.find(
      (ruleItem) => ruleItem.category === "生活经验",
    ) ?? RULES[0]!;
    const winner = scored[0]?.score
      ? scored[0]
      : scoreCategory(fallbackRule, title, body);
    const tags = [
      winner.rule.categoryTag,
      ...winner.topicScores
        .filter((item) => item.score > 0)
        .sort((left, right) => right.score - left.score)
        .map((item) => item.topic.tag),
      input.sourceTag,
    ].filter((tag): tag is string => Boolean(tag));

    return {
      category: winner.rule.category,
      tags: [...new Set(tags)].slice(0, 8),
    };
  }
}

function scoreCategory(ruleItem: CategoryRule, title: string, body: string): {
  rule: CategoryRule;
  score: number;
  topicScores: Array<{ topic: Topic; score: number }>;
} {
  const topicScores = ruleItem.topics.map((topicItem) => {
    const score = topicItem.keywords.reduce((total, keyword) => {
      const normalized = keyword.toLowerCase();
      return total
        + (title.includes(normalized) ? 3 : 0)
        + (body.includes(normalized) ? 1 : 0);
    }, 0);
    return { topic: topicItem, score };
  });

  return {
    rule: ruleItem,
    score: topicScores.reduce((total, item) => total + item.score, 0),
    topicScores,
  };
}

function rule(
  category: string,
  categoryTag: string,
  topics: readonly Topic[],
): CategoryRule {
  return { category, categoryTag, topics };
}

function topic(tag: string, ...keywords: string[]): Topic {
  return { tag, keywords };
}
