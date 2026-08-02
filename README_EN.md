# Link2Obsidian

[简体中文](README.md) · [Docker guide](docs/docker-deployment.md) · [Configuration](docs/configuration.md) · [Roadmap](ROADMAP.md)

Link2Obsidian is a lightweight automation service for NAS devices:

```text
Web URL → main content → local images → Markdown → Obsidian Vault
```

It is not a note-taking app, knowledge base, reader, or download manager. Its
only job is to convert links into durable Obsidian files.

> Status: usable MVP. Run it on a trusted LAN; API authentication is still on
> the roadmap.

## Features

- Chromium loading for static and dynamic pages
- Defuddle-based title, source, and main-content extraction
- Automatic image downloads and Obsidian `![[attachment]]` embeds
- URL duplicate prevention and content-based image deduplication
- Unicode-safe filenames, including Chinese titles
- Topic-based Vault folders and Obsidian tags
- Built-in adapters for general pages, Instagram, and X (Twitter)
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
```

Start:

```bash
docker compose up -d --build
curl http://NAS-IP:8080/health
```

Submit a URL:

```bash
curl -X POST http://NAS-IP:8080/api/clips \
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
│       └── Article title--a1b2c3d4e5.md
└── Attachments/
    └── Article title--a1b2c3d4e5/
        └── image001.jpg
```

```markdown
---
title: "Article title"
source: "Example"
url: "https://example.com/article"
created: 2026-07-27T12:00:00.000Z
category: "AI人工智能"
tags: ["AI","Research","Instagram"]
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
| `GET` | `/` | Service information |
| `GET` | `/health` | Service and AI status |
| `GET` | `/api/plugins` | Loaded site adapters |
| `POST` | `/api/clips` | Clip one webpage |

There is currently no management UI. Call the API from curl, mobile shortcuts,
browser scripts, or another automation tool.

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

Node.js 22 or newer is required:

```bash
npm install
npm run typecheck
npm test
npm run build
```

## License

[MIT](LICENSE)
