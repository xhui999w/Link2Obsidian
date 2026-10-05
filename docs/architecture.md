# Architecture

Link2Obsidian is a modular monolith deployed as a single container.

The V0.2 pipeline is:

```text
Authenticated API / compact dashboard
  → SQLite task queue and indexed URL lookup
  → public URL validation and IP-pinned egress
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

## Durable metadata

SQLite stores tasks (URL, policy, status, title, category, path, timestamps, error and result metadata) and a URL-keyed note index. Bodies and images live only in the Vault. Legacy notes are scanned once; indexed lookups replace recursive per-request scans. A single worker serializes writes and duplicate policies. Queued tasks resume on startup; processing tasks are marked interrupted for explicit retry.

The synchronous clips API is implemented on the same queue; the dashboard uses asynchronous task endpoints. Retries create independent records. Overwrite writes a temporary note beside the original, then renames it. Each capture has a separate attachment folder so previous versions remain readable.
