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
| `L2O_API_TOKEN` | 空 | 所有 `/api/*` 请求的 Bearer Token，Docker Compose 必填 |

部署前生成一个长随机 Token。在首页输入，或发送 `Authorization: Bearer <token>`。首页、静态资源及 `/health` 公开；独立 Node 运行时留空可保持旧版无鉴权兼容，只用于可信网络。远程访问需 HTTPS；更换 Token 后重启服务。

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
| `L2O_WORKER_CONCURRENCY` | `1` | 预留；V0.2 使用单个持久化工作线程 |
| `L2O_PAGE_TIMEOUT_MS` | `30000` | 页面加载超时 |
| `L2O_PROXY_SERVER` | 空 | 可选支持 CONNECT 的 HTTP/HTTPS 代理，仅供声明需要代理的网站插件使用；不支持 SOCKS |
| `L2O_IMAGE_TIMEOUT_MS` | `15000` | 单张图片下载超时 |
| `L2O_MAX_IMAGES` | `100` | 单篇文章最大图片数量 |
| `L2O_MAX_IMAGE_BYTES` | `20971520` | 单张图片最大字节数，默认 20 MB |
| `L2O_DUPLICATE_POLICY` | `skip` | `skip` 跳过（默认）、`overwrite` 覆盖、`suffix` 另存；请求 `policy` 可覆盖 |
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
L2O_API_TOKEN=替换成你自己生成的长随机字符串
L2O_VAULT_HOST_PATH=/volume1/Obsidian/MyVault
L2O_DATA_HOST_PATH=/volume1/docker/link2obsidian/data
L2O_TMP_HOST_PATH=/volume1/docker/link2obsidian/tmp
L2O_AI_ENABLED=false
```

建议先用最小配置验证采集，再启用 AI 或调整超时。

## V0.2 任务与迁移

需要 Node 22.13+，使用内置 SQLite，不需额外数据库服务。`L2O_DATA_PATH` 下保存 `tasks.sqlite`、WAL 和 SHM 文件，只保存任务元数据与 URL/文件索引，正文始终在 Vault。data 目录需可写且持久挂载，停服务后一起备份 Vault 和 data。

首次启动扫描旧笔记建立索引，不改变旧文件；后续查重直接查数据库，只检查索引文件是否存在。外部新增、移动或修改笔记后，停服务、备份并移走数据库及 WAL/SHM 文件，再重启重建（历史重置）。一个 data 目录只供一个实例使用；更换 Vault 挂载时使用新的 data 目录。

待处理任务重启继续，处理中任务标记失败并允许手动重试。重试创建独立历史。覆盖保留原路径和分类目录，完成提取后替换原文件；每次抓取使用独立附件目录，不自动清理旧附件。

用户网页、浏览器子资源和图片跳转均限制为公网 IP；本机、局域网、链路本地、保留地址及混合 DNS 结果会被拒绝。出站代理连接到校验后的 IP，防止 DNS 重绑定；最终页面地址再次校验。管理员设置的 AI 地址不受网页 SSRF 规则限制，可继续使用局域网 Ollama。
