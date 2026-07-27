# NAS 安装教程

Link2Obsidian 使用标准 Docker Compose。推荐通过 NAS 的 SSH 终端安装，
因为这样最容易查看日志、更新版本和排查目录权限。

## 通用准备

1. 在 NAS 中安装 Docker、Container Manager 或 Container Station。
2. 开启 SSH，完成安装后可以再关闭。
3. 找到 Obsidian Vault 的绝对路径。
4. 创建 Link2Obsidian 运行目录。
5. 确认 NAS 至少有约 2 GB 可用内存和磁盘空间。

建议目录：

```text
NAS数据卷/
├── Obsidian/MyVault/
└── docker/link2obsidian/
    ├── source/
    ├── data/
    └── tmp/
```

如果 NAS 没有安装 Git，可以在 GitHub 项目页下载 Source code ZIP，解压到
`source` 目录，再从该目录执行后续命令。

## 群晖 Synology DSM 7

### 安装环境

1. 在套件中心安装 **Container Manager**。
2. 控制面板 → 终端机和 SNMP → 临时启用 SSH。
3. SSH 登录 NAS。

常见路径：

```text
/volume1/Obsidian/MyVault
/volume1/docker/link2obsidian
```

安装：

```bash
cd /volume1/docker/link2obsidian
git clone https://github.com/xhui999w/Link2Obsidian.git source
cd source
cp .env.example .env
```

编辑 `.env`：

```env
L2O_VAULT_HOST_PATH=/volume1/Obsidian/MyVault
L2O_DATA_HOST_PATH=/volume1/docker/link2obsidian/data
L2O_TMP_HOST_PATH=/volume1/docker/link2obsidian/tmp
```

启动：

```bash
docker compose up -d --build
```

也可以在 Container Manager 的“项目”中导入项目目录，但首次排错仍建议使用终端。

### 权限

在 File Station 中确认 Docker 服务使用的账户能够读写：

- Vault
- `data`
- `tmp`

不要为了快速解决问题而把整个 Vault 设置成匿名公开写入。

## 威联通 QNAP QTS / QuTS hero

1. 在 App Center 安装 **Container Station**。
2. 控制台启用 SSH。
3. 通过 SSH 找到共享文件夹真实路径。

常见路径可能类似：

```text
/share/Obsidian/MyVault
/share/Container/link2obsidian
```

配置：

```env
L2O_VAULT_HOST_PATH=/share/Obsidian/MyVault
L2O_DATA_HOST_PATH=/share/Container/link2obsidian/data
L2O_TMP_HOST_PATH=/share/Container/link2obsidian/tmp
```

然后运行：

```bash
docker compose up -d --build
```

QNAP 的共享目录真实路径可能因存储池不同而变化，请以 SSH 中的绝对路径为准。

## TrueNAS SCALE

推荐把项目和数据放在独立 Dataset 中：

```text
/mnt/tank/apps/link2obsidian
/mnt/tank/obsidian/MyVault
```

通过 Shell：

```bash
cd /mnt/tank/apps/link2obsidian
git clone https://github.com/xhui999w/Link2Obsidian.git source
cd source
cp .env.example .env
```

配置：

```env
L2O_VAULT_HOST_PATH=/mnt/tank/obsidian/MyVault
L2O_DATA_HOST_PATH=/mnt/tank/apps/link2obsidian/data
L2O_TMP_HOST_PATH=/mnt/tank/apps/link2obsidian/tmp
```

确保 Dataset ACL 允许容器写入，然后用 Docker Compose 或系统支持的自定义应用方式启动。

## 其他 NAS

只要满足以下条件即可：

- 支持 Linux 容器
- 支持 bind mount
- 可以运行 Chromium
- 支持 Docker Compose v2 或等价编排

使用 [Docker 部署教程](docker-deployment.zh-CN.md) 中的通用步骤。

## 从电脑或手机调用

同一局域网中的电脑：

```bash
curl -X POST http://NAS-IP:8080/api/clips \
  -H "Content-Type: application/json" \
  -d '{"url":"https://example.com/article"}'
```

手机可以通过 iOS 快捷指令、Android 自动化工具或自建浏览器书签脚本发送相同的 HTTP 请求。

当前版本没有 API 鉴权，不要直接把端口映射到公网。远程访问建议使用可信 VPN。

## 安装后检查清单

- [ ] `docker compose ps` 显示 healthy
- [ ] `/health` 返回 `status: ok`
- [ ] 测试 URL 返回 `status: saved`
- [ ] Vault 中生成 Markdown
- [ ] Markdown 可以在 Obsidian 打开
- [ ] 图片位于 `Attachments`
- [ ] 再次提交相同 URL 返回 `duplicate`
- [ ] NAS 重启后容器自动启动
