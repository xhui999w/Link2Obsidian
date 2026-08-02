# Topic classification

Link2Obsidian uses a lightweight, deterministic keyword classifier to suggest
where an article should be saved in the Vault. It does not create a knowledge
base and does not call an AI service.

## Default categories

- 健康养生
- 运动健康
- 育儿教育
- AI人工智能
- 科技数码
- 学习成长
- 编程开发
- 商业财经
- 生活经验
- 兴趣爱好

The title has a higher classification weight than the body. A rule match also
produces topic tags. If no rule matches, the article uses
`L2O_DEFAULT_CATEGORY`, which defaults to `生活经验`.

## Source handling

Source does not determine the category. Built-in site plugins may append a
source tag:

| Plugin | Source tag |
| --- | --- |
| Instagram | `Instagram` |
| X (Twitter) | `X` |

Obsidian frontmatter stores tag names without a leading `#`:

```yaml
tags: ["健康", "睡眠", "Instagram"]
```

Obsidian presents these as `#健康`, `#睡眠`, and `#Instagram`.

## Output

```text
Vault/
└── Clippings/
    └── 健康养生/
        └── 改善睡眠--a1b2c3d4e5.md
```

Classification rules are defined in
`apps/server/src/application/topic-classifier.ts`.
