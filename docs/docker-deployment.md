# Docker deployment

## Requirements

- Docker Engine with Docker Compose v2
- Approximately 2 GB of free disk space
- 2 GB available RAM; 4 GB is recommended while building
- An existing Obsidian Vault

## Install

```bash
git clone https://github.com/xhui999w/Link2Obsidian.git
cd Link2Obsidian
cp .env.example .env
```

Edit `.env`:

```env
L2O_PORT=8080
L2O_VAULT_HOST_PATH=/path/on/nas/MyVault
L2O_DATA_HOST_PATH=/path/on/nas/link2obsidian/data
L2O_TMP_HOST_PATH=/path/on/nas/link2obsidian/tmp
```

The Vault, data, and temporary directories must be writable by the container.

Build and start:

```bash
docker compose up -d --build
docker compose ps
docker compose logs -f link2obsidian
```

Check health:

```bash
curl http://127.0.0.1:8080/health
```

Clip a test page:

```bash
curl -X POST http://127.0.0.1:8080/api/clips \
  -H "Content-Type: application/json" \
  -d '{"url":"https://example.com/"}'
```

## Update

```bash
git pull
docker compose up -d --build
```

Back up `.env` and your Vault before an upgrade.

## Stop

```bash
docker compose down
```

This removes the container but not the host-mounted Vault and data folders.

## Troubleshooting

Inspect logs:

```bash
docker compose logs --tail=200 link2obsidian
```

Common causes are an unwritable Vault, insufficient RAM for Chromium, a port
conflict, or an invalid plugin manifest. AI provider failures do not stop the
core clipping pipeline; the response reports `"ai": "fallback"`.

See [configuration](configuration.md) and the
[Chinese NAS guide](nas-installation.zh-CN.md).
