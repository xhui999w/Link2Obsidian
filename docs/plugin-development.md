# Site plugin development

Site plugins adapt page loading and content extraction without replacing the
shared Markdown, image, duplicate-detection, or Vault-writing pipeline.

## Directory

Create one directory under `plugins/`:

```text
plugins/
└── example/
    └── plugin.json
```

Restart Link2Obsidian after adding or changing a manifest.

## Manifest

```json
{
  "apiVersion": "1",
  "id": "example",
  "name": "Example site",
  "priority": 100,
  "sourceTag": "示例来源",
  "match": {
    "hostnames": ["example.com", "*.example.com"],
    "pathPrefixes": ["/article/"]
  },
  "page": {
    "waitForSelector": "article",
    "removeSelectors": [".comments", ".recommendations"]
  },
  "extraction": {
    "contentSelector": "article",
    "titleSelectors": ["h1", "meta[property=\"og:title\"]"],
    "sourceSelectors": [".author", "meta[name=\"author\"]"],
    "removeHiddenElements": true
  }
}
```

## Selection

- Higher `priority` values are evaluated first.
- Exact hostnames and `*.example.com` wildcards are supported.
- `pathPrefixes` are optional.
- `general` is the required match-all fallback.
- Redirected pages are matched again before extraction.

## Responsibilities

A site plugin may:

- wait briefly for a page element;
- remove known comments, recommendations, or overlays;
- identify preferred content, title, and source elements;
- override hidden-element removal for sites that hide article content until
  client-side initialization completes.
- append a source tag through `sourceTag`.

The source tag is metadata only. It does not affect topic classification.

A site plugin must not:

- write directly to the Vault;
- generate the final Markdown file;
- download attachments;
- implement article libraries, reading state, or knowledge-base features.

The TypeScript manifest contract lives in
`packages/plugin-api/src/index.ts`.
