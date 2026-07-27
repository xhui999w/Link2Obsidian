# Configuration

Copy the environment template before starting:

```bash
cp .env.example .env
```

Docker Compose reads `.env`. Apply changes with:

```bash
docker compose up -d
```

## Server

| Variable | Default | Description |
| --- | --- | --- |
| `L2O_HOST` | `0.0.0.0` | Listen address inside the container |
| `L2O_PORT` | `8080` | Host HTTP port |
| `L2O_LOG_LEVEL` | `info` | Structured log level |
| `L2O_API_TOKEN` | `change-me` | Reserved; authentication is not active yet |

Run the current release only on a trusted LAN or VPN.

## Storage

| Variable | Default | Description |
| --- | --- | --- |
| `L2O_VAULT_HOST_PATH` | `./vault` | Real Vault path on the NAS |
| `L2O_DATA_HOST_PATH` | `./data` | Persistent runtime data on the NAS |
| `L2O_TMP_HOST_PATH` | `./tmp` | Temporary working files on the NAS |
| `L2O_VAULT_PATH` | `/vault` | Vault path inside the container |
| `L2O_OUTPUT_DIR` | `Clippings` | Markdown root inside the Vault |
| `L2O_ATTACHMENTS_DIR` | `Attachments` | Attachment folder inside the Vault |
| `L2O_DATA_PATH` | `/app/data` | Data path inside the container |
| `L2O_TMP_PATH` | `/app/tmp` | Temporary path inside the container |
| `L2O_PLUGINS_PATH` | `/app/plugins` | Site plugin path inside the container |

Output and attachment paths must remain relative to the Vault.

## Page processing

| Variable | Default | Description |
| --- | --- | --- |
| `L2O_TIMEZONE` | `Asia/Shanghai` | Chromium timezone |
| `L2O_LANGUAGE` | `zh-CN` | Browser and extractor language |
| `L2O_WORKER_CONCURRENCY` | `1` | Reserved worker concurrency |
| `L2O_PAGE_TIMEOUT_MS` | `30000` | Page navigation timeout |
| `L2O_IMAGE_TIMEOUT_MS` | `15000` | Timeout per image |
| `L2O_MAX_IMAGES` | `100` | Maximum images per article |
| `L2O_MAX_IMAGE_BYTES` | `20971520` | Maximum bytes per image |
| `L2O_DUPLICATE_POLICY` | `skip` | Existing URLs are currently skipped |
| `L2O_DEFAULT_CATEGORY` | `生活经验` | Fallback topic folder |

## AI

| Variable | Default | Description |
| --- | --- | --- |
| `L2O_AI_ENABLED` | `false` | Enable optional AI enrichment |
| `L2O_AI_PROVIDER` | `ollama` | `ollama` or `openai-compatible` |
| `L2O_AI_BASE_URL` | Ollama host URL | Provider API base |
| `L2O_AI_MODEL` | `qwen3:8b` | Provider model name |
| `L2O_AI_API_KEY` | empty | Optional local or cloud API key |
| `L2O_AI_TIMEOUT_MS` | `60000` | AI request timeout |
| `L2O_AI_MAX_CONTENT_CHARS` | `12000` | Maximum article characters sent to AI |

AI is off by default. A cloud provider receives the title, source, and a
limited amount of article text. See [AI enhancement](ai.md).

