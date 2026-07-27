# Docker 部署教程

本教程适用于支持 Docker Compose v2 的 Linux、NAS 和家用服务器。

## 1. 准备

建议资源：

- 双核 CPU
- 2 GB 可用内存，构建镜像时建议 4 GB
- 2 GB 可用磁盘空间
- Docker Engine 24+ 和 Docker Compose v2
- 一个已经存在的 Obsidian Vault

首次构建会下载 Node.js、Chromium 和浏览器依赖，所需时间取决于网络。

## 2. 下载项目

在 GitHub 项目页点击 **Code**，复制仓库地址：

```bash
git clone https://github.com/xhui999w/Link2Obsidian.git
cd Link2Obsidian
cp .env.example .env
```

## 3. 配置目录

编辑 `.env`：

```env
L2O_PORT=8080
L2O_VAULT_HOST_PATH=/volume1/Obsidian/MyVault
L2O_DATA_HOST_PATH=/volume1/docker/link2obsidian/data
L2O_TMP_HOST_PATH=/volume1/docker/link2obsidian/tmp
```

说明：

- `L2O_VAULT_HOST_PATH` 必须指向真实 Vault，而不是 Vault 的父目录。
- `data` 用于持久运行数据。
- `tmp` 用于处理网页时的临时文件。
- 容器内路径 `/vault`、`/app/data`、`/app/tmp` 通常不需要修改。

先创建运行目录：

```bash
mkdir -p /volume1/docker/link2obsidian/data
mkdir -p /volume1/docker/link2obsidian/tmp
```

确保 Docker 容器对 Vault、data 和 tmp 目录具有读写权限。不同 NAS
的 ACL 设置方式不同，不要在不清楚影响范围时递归修改整个 Vault 的所有者。

## 4. 启动

```bash
docker compose up -d --build
```

查看状态：

```bash
docker compose ps
docker compose logs -f link2obsidian
```

看到 `Server listening` 表示服务已经启动。

## 5. 健康检查

```bash
curl http://127.0.0.1:8080/health
```

正常结果：

```json
{
  "status": "ok",
  "service": "link2obsidian",
  "vaultPath": "/vault",
  "ai": {
    "enabled": false,
    "provider": "ollama"
  }
}
```

从其他设备访问时，把 `127.0.0.1` 换成 NAS 的局域网 IP。

## 6. 保存测试文章

```bash
curl -X POST http://127.0.0.1:8080/api/clips \
  -H "Content-Type: application/json" \
  -d '{"url":"https://example.com/"}'
```

然后检查：

```text
MyVault/Clippings/生活经验/
```

如果响应成功但没有文件，优先检查 Vault 挂载路径和写权限。

## 7. 停止和重启

```bash
docker compose stop
docker compose start
docker compose restart
```

删除容器但保留 Vault 和运行数据：

```bash
docker compose down
```

## 8. 更新

```bash
git pull
docker compose up -d --build
```

更新前建议备份 `.env` 和 Vault。不要删除 `data` 目录，除非版本说明明确要求。

## 9. 启用 Ollama

如果 Ollama 运行在 NAS 宿主机：

```env
L2O_AI_ENABLED=true
L2O_AI_PROVIDER=ollama
L2O_AI_BASE_URL=http://host.docker.internal:11434
L2O_AI_MODEL=qwen3:8b
```

重建或重启：

```bash
docker compose up -d
```

如果 Ollama 是同一个 Compose 网络里的服务，使用：

```env
L2O_AI_BASE_URL=http://ollama:11434
```

AI 不是必需组件。建议先在关闭 AI 的情况下完成基础采集测试。

## 10. 常见问题

### 容器一直处于 unhealthy

```bash
docker compose logs --tail=200 link2obsidian
```

检查端口冲突、Node 启动错误和插件配置错误。

### `EACCES` 或 Vault 不可写

检查宿主机 Vault 路径是否正确，以及运行 Docker 的用户或容器用户是否具有写权限。

### Chromium 启动失败

- 确认 NAS 内存充足。
- 重新构建镜像，避免使用中断的构建缓存。
- 检查 CPU 架构和 Docker 日志。

### 网页可以打开但正文为空

在 GitHub 使用“网站适配请求”Issue 模板提交网页类型、脱敏 URL、日志和预期正文区域。

### 图片下载失败

文章仍会保存，失败图片会保留远程 URL。检查返回结果中的：

```json
{"images":{"downloaded":2,"failed":1}}
```

### AI 超时

API 返回的 `ai` 会是 `fallback`，文章仍会按本地规则分类并保存。可以增加
`L2O_AI_TIMEOUT_MS` 或关闭 AI。
