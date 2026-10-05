<p align="center">
  <img src="assets/link2obsidian-icon-256.png" width="128" height="128" alt="Link2Obsidian icon">
</p>

# Link2Obsidian

[简体中文](README.md) · [Docker guide](docs/docker-deployment.md) · [Configuration](docs/configuration.md) · [Roadmap](ROADMAP.md)

Link2Obsidian is a lightweight automation service for NAS devices:

```text
Web URL → main content → local images → Markdown → Obsidian Vault
```

It is not a note-taking app, knowledge base, reader, or download manager. Its
only job is to convert links into durable Obsidian files.

> V0.2 adds a compact dashboard, persistent SQLite tasks, duplicate policies and API authentication. Set a unique token and preserve the data volume before deploying.

## Features

- Chromium loading for static and dynamic pages
- Defuddle-based title, source, and main-content extraction
- Automatic image downloads and Obsidian `![[attachment]]` embeds
- Durable tasks, history, manual retry, recapture and copy/view Vault paths
- Indexed duplicate detection with skip, overwrite and save-new-version policies
- API token authentication and SSRF protection for pages, redirects and images
- Unicode-safe filenames, including Chinese titles
- Topic-based Vault folders and Obsidian tags
- Built-in adapters for general pages, WeChat, Toutiao, Zhihu, Instagram, and X (Twitter)
- Optional summaries, keywords, category suggestions, and tags with AI
- Ollama and OpenAI-compatible local or cloud APIs
- Full non-AI fallback when AI is disabled or unavailable
- Single-container Docker deployment

## Preview

![Submit a URL and save an article](docs/assets/api-example.svg)

![Generated Obsidian Vault structure](docs/assets/vault-example.svg)

## Quick start

```bash
git clone https://github.com/xhui999w/Link2Obsidian.git
cd Link2Obsidian
cp .env.example .env
```

Edit `.env`:

```env
L2O_VAULT_HOST_PATH=/path/on/nas/MyVault
L2O_API_TOKEN=replace-with-your-own-long-random-token
```

Start:

```bash
docker compose up -d --build
curl http://NAS-IP:8080/health
```

Submit a URL:

```bash
curl -X POST http://NAS-IP:8080/api/clips \
  -H "Authorization: Bearer $L2O_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"url":"https://example.com/article"}'
```

See the [Docker deployment guide](docs/docker-deployment.md) for upgrades,
permissions, logs, health checks, and troubleshooting.

## Output

```text
MyVault/
├── Clippings/
│   └── AI人工智能/
│       └── Article title.md
└── Attachments/
    └── Article title--a1b2c3d4e5/
        └── image001.jpg
```

```markdown
---
原文链接: "https://example.com/article"
收藏时间: 2026-07-27T12:00:00.000Z
分类: "AI人工智能"
标签: ["AI","Research","Instagram"]
---

Article body…

![[Attachments/Article title--a1b2c3d4e5/image001.jpg]]
```

## Optional AI

AI is disabled by default. Enable Ollama with:

```env
L2O_AI_ENABLED=true
L2O_AI_PROVIDER=ollama
L2O_AI_BASE_URL=http://host.docker.internal:11434
L2O_AI_MODEL=qwen3:8b
```

LocalAI, LM Studio, vLLM, llama.cpp servers, and cloud providers can use the
`openai-compatible` provider. Provider errors automatically fall back to the
deterministic classifier and never stop the core clipping pipeline.

See [AI configuration](docs/ai.md).

## API

| Method | Endpoint | Description |
| --- | --- | --- |
| `GET` | `/` | Compact dashboard |
| `GET` | `/health` | Service and AI status |
| `GET` | `/api/plugins` | Loaded site adapters |
| `POST` | `/api/clips` | Clip one webpage |

Open the homepage and enter the API token. It is kept only in page memory.

| Method | Endpoint | Description |
| --- | --- | --- |
| `POST` | `/api/tasks` | Queue a task; 202 with task ID |
| `GET` | `/api/tasks?limit=20&offset=0` | Paginated history |
| `GET` | `/api/tasks/:id` | Task details |
| `POST` | `/api/tasks/:id/retry` | Retry or recapture as a new task |

Body: `{"url":"https://example.com/article","policy":"skip"}`. Policies: `skip`, `overwrite`, `suffix`. Omitted policy uses `L2O_DUPLICATE_POLICY`. Dashboard defaults to skip. A successful task has status `success`; result status `duplicate` means it was skipped. The synchronous `/api/clips` response remains compatible and also records history.

## Scope

The project deliberately excludes note editing, knowledge-base search, reading
queues, reading progress, recommendations, social features, and general-purpose
downloads.

## Documentation

- [Docker deployment](docs/docker-deployment.md)
- [Configuration](docs/configuration.md)
- [NAS installation in Chinese](docs/nas-installation.zh-CN.md)
- [AI enhancement](docs/ai.md)
- [Classification](docs/classification.md)
- [Plugin development](docs/plugin-development.md)
- [Architecture](docs/architecture.md)
- [Contributing](CONTRIBUTING.md)
- [Roadmap](ROADMAP.md)

## Development

Node.js 22.13 or newer is required (built-in SQLite):

```bash
npm install
npm run typecheck
npm test
npm run build
```

## License

[MIT](LICENSE)

## Upgrade and compatibility

Persist `L2O_DATA_PATH/tasks.sqlite`. SQLite stores metadata and note paths, never article bodies. On first startup, legacy notes are indexed once using their URL frontmatter, clip ID or legacy filename marker. Existing notes are retained; they do not generate historical tasks. Missing indexed notes are re-created. After manual moves or external additions, stop the service, back up and move aside the SQLite database and its WAL/SHM companions to rebuild the index (history resets).

Overwrite preserves the existing note path and folder and replaces the note only after successful extraction. Every capture uses a separate attachment directory, keeping earlier versions' images intact. Old attachments require manual cleanup. Back up both Vault and data volumes.

One durable worker runs per instance. Queued tasks resume on restart; interrupted processing tasks become failed and need explicit retry. Run only one instance per data directory. `L2O_WORKER_CONCURRENCY` remains reserved.

GHCR targets `linux/amd64,linux/arm64`. Upstream proxies must be HTTP/HTTPS and support CONNECT; SOCKS is no longer supported. All user page and image connections pin validated public DNS addresses, and redirects/final URLs are checked. Administrator-configured AI endpoints can still use LAN Ollama. Use HTTPS when transmitting the API token.

WeChat, Toutiao and Zhihu use site-specific plugin selectors; Instagram and X support posts and images. Login walls, CAPTCHA and changes in page structure can still affect extraction.
