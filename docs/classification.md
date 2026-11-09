# Topic classification

New notes are archived by platform (头条, 微信, 知乎, X, Instagram, 网页), with a collection timestamp in each filename. Topic classification only enriches tags; it does not select the archive directory. AI cannot override platform folders.

## Topic categories (for tag suggestions only)

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

Source determines the archive folder. Built-in site plugins also append a source tag:

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
    └── 头条/
        └── 2026-11-08 203000 - 改善睡眠.md
```

Classification rules are defined in
`apps/server/src/application/topic-classifier.ts`.
