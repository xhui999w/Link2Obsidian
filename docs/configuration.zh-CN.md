# 配置说明

复制模板：

```bash
cp .env.example .env
```

Docker Compose 会读取 `.env`。修改配置后运行：

```bash
docker compose up -d
```

## 服务

| 变量 | 默认值 | 说明 |
| --- | --- | --- |
| `L2O_HOST` | `0.0.0.0` | 容器内监听地址 |
| `L2O_PORT` | `8080` | NAS 对外服务端口 |
| `L2O_LOG_LEVEL` | `info` | 日志级别 |
| `L2O_API_TOKEN` | `change-me` | 预留；当前版本尚未启用鉴权 |

当前版本应只部署在可信局域网或 VPN 内。

## 存储

| 变量 | 默认值 | 说明 |
| --- | --- | --- |
| `L2O_VAULT_HOST_PATH` | `./vault` | NAS 上真实 Vault 路径 |
| `L2O_DATA_HOST_PATH` | `./data` | NAS 上持久运行数据 |
| `L2O_TMP_HOST_PATH` | `./tmp` | NAS 上临时目录 |
| `L2O_VAULT_PATH` | `/vault` | 容器内 Vault 路径，通常不改 |
| `L2O_OUTPUT_DIR` | `Clippings` | Vault 内 Markdown 根目录 |
| `L2O_ATTACHMENTS_DIR` | `Attachments` | Vault 内附件目录 |
| `L2O_DATA_PATH` | `/app/data` | 容器内数据目录 |
| `L2O_TMP_PATH` | `/app/tmp` | 容器内临时目录 |
| `L2O_PLUGINS_PATH` | `/app/plugins` | 容器内网站插件目录 |

`L2O_OUTPUT_DIR` 和 `L2O_ATTACHMENTS_DIR` 必须是 Vault 内的相对路径。

## 网页处理

| 变量 | 默认值 | 说明 |
| --- | --- | --- |
| `L2O_TIMEZONE` | `Asia/Shanghai` | Chromium 时区 |
| `L2O_LANGUAGE` | `zh-CN` | Chromium 和提取器语言 |
| `L2O_WORKER_CONCURRENCY` | `1` | 预留并发数 |
| `L2O_PAGE_TIMEOUT_MS` | `30000` | 页面加载超时 |
| `L2O_PROXY_SERVER` | 空 | 可选 HTTP/SOCKS 代理，仅供声明需要代理的网站插件使用 |
| `L2O_IMAGE_TIMEOUT_MS` | `15000` | 单张图片下载超时 |
| `L2O_MAX_IMAGES` | `100` | 单篇文章最大图片数量 |
| `L2O_MAX_IMAGE_BYTES` | `20971520` | 单张图片最大字节数，默认 20 MB |
| `L2O_DUPLICATE_POLICY` | `skip` | 当前版本发现重复 URL 时跳过 |
| `L2O_DEFAULT_CATEGORY` | `生活经验` | 无主题命中时的目录 |

## AI

| 变量 | 默认值 | 说明 |
| --- | --- | --- |
| `L2O_AI_ENABLED` | `false` | 是否启用 AI |
| `L2O_AI_PROVIDER` | `ollama` | `ollama` 或 `openai-compatible` |
| `L2O_AI_BASE_URL` | Ollama 宿主机地址 | API 基础地址 |
| `L2O_AI_MODEL` | `qwen3:8b` | 模型名 |
| `L2O_AI_API_KEY` | 空 | 云端或本地 API 密钥 |
| `L2O_AI_TIMEOUT_MS` | `60000` | AI 请求超时 |
| `L2O_AI_MAX_CONTENT_CHARS` | `12000` | 发送给模型的正文字符上限 |

AI 默认关闭。云端模式会把文章标题、来源和部分正文发送给配置的服务商。
详细说明见 [AI 模块](ai.md)。

## 最小配置

```env
L2O_PORT=8080
L2O_VAULT_HOST_PATH=/volume1/Obsidian/MyVault
L2O_DATA_HOST_PATH=/volume1/docker/link2obsidian/data
L2O_TMP_HOST_PATH=/volume1/docker/link2obsidian/tmp
L2O_AI_ENABLED=false
```

建议先用最小配置验证采集，再启用 AI 或调整超时。
