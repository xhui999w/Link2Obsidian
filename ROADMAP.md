# Link2Obsidian Roadmap

[简体中文](#简体中文) · [English](#english)

## 简体中文

Roadmap 只围绕“链接 → Markdown → Obsidian”。完成顺序会根据稳定性、用户反馈和维护成本调整。

### 已完成

- [x] Docker 和 Docker Compose 基础部署
- [x] Chromium 网页加载
- [x] Defuddle 正文提取
- [x] Obsidian Markdown 和 YAML Frontmatter
- [x] 中文文件名和 URL 防重复
- [x] 正文图片下载、重命名、路径替换和内容去重
- [x] 普通网页、Instagram、X（Twitter）插件
- [x] 十类主题目录和来源标签
- [x] Ollama 与 OpenAI-compatible AI 增强
- [x] AI 关闭和故障回退
- [x] 中英文 README、Docker/NAS 安装文档和 Issue 模板

### 下一阶段：发布稳定性

- [ ] API Token 鉴权
- [ ] SSRF 防护和重定向地址复检
- [ ] 任务持久化和有限重试
- [ ] 更明确的错误码和诊断日志
- [ ] amd64/arm64 镜像自动构建与 GHCR 发布
- [ ] 版本化配置迁移和发布说明
- [ ] 更多真实中文网页回归样例

### 后续候选

- [ ] 浏览器轻量提交扩展
- [ ] iOS 快捷指令和 Android 自动化示例
- [ ] Webhook、ntfy、Gotify 完成通知
- [ ] 更多站点插件
- [ ] 可配置分类规则和目录映射
- [ ] WebDAV/SFTP Vault Writer
- [ ] 文章更新策略和附件垃圾清理

### 明确不做

- 笔记编辑器
- 知识库搜索和问答
- 阅读列表和阅读进度
- 内容推荐
- 社交功能
- 通用网页或视频下载器

## English

The roadmap remains limited to “URL → Markdown → Obsidian”.

### Completed

- [x] Docker foundation
- [x] Chromium loading and Defuddle extraction
- [x] Obsidian Markdown, local images, and duplicate prevention
- [x] General web, Instagram, and X (Twitter) adapters
- [x] Topic folders and source tags
- [x] Optional Ollama and OpenAI-compatible AI enhancement
- [x] Non-AI and provider-failure fallbacks
- [x] Bilingual onboarding documentation

### Next: release hardening

- [ ] API token authentication
- [ ] SSRF protection
- [ ] Persistent jobs and bounded retries
- [ ] Improved diagnostics
- [ ] Automated amd64/arm64 GHCR images
- [ ] Versioned configuration migrations
- [ ] More real-world Chinese page fixtures

### Out of scope

No note editor, knowledge-base search, reading queue, recommendations, social
features, or general-purpose downloader.
