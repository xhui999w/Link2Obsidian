# Plugins

This directory contains the built-in site-adaptation plugins.

Each subdirectory contains a declarative `plugin.json` manifest:

```text
plugins/
├── general/
├── toutiao/
├── zhihu/
└── wechat/
```

Plugins may declare URL matching, a page-ready selector, elements to remove,
and preferred content/title/source selectors. The `general` plugin is the
fallback and must always be present.

The manifest contract is defined by `@link2obsidian/plugin-api`. Site plugins
do not write files or download images; the shared pipeline continues to handle
Markdown, attachments, duplicate prevention, and Vault writes.
