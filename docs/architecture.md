# Architecture

Link2Obsidian is a modular monolith deployed as a single container.

The planned pipeline is:

```text
URL validation
  → Chromium page loading
  → main-content extraction
  → image localization
  → Markdown conversion
  → Obsidian formatting
  → atomic Vault write
```

The pipeline implements Chromium page loading, Defuddle content extraction,
topic classification, image localization with content-hash deduplication,
Obsidian Markdown generation, duplicate article detection across category
folders, and atomic Markdown writes.

Before page loading, the site plugin registry chooses the highest-priority
manifest matching the URL. Redirected URLs are matched again before extraction.
The built-in `general` plugin is the fallback, so site-specific adapters do not
replace or bypass the shared pipeline.

Topic classification uses article title and body keywords. Site source is added
only as a tag and is never used to choose the category.

The optional AI module runs after deterministic classification. It may enrich
or revise the suggestion, but exceptions are contained inside this step and
fall back to the deterministic result. No core pipeline component imports a
provider SDK.

## Boundaries

The project converts links into Markdown files and attachments. It is not a
note editor, knowledge base, reading manager, search engine, or general-purpose
downloader.
