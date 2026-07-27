# AI enhancement

AI enhancement is an optional, best-effort module. It adds:

- a short summary;
- keywords;
- a category suggestion;
- Obsidian tags.

The module is disabled by default. The normal browser, extraction, image,
rule-based classification, Markdown, duplicate-detection, and Vault pipeline
does not depend on AI.

If AI is disabled, unavailable, times out, returns invalid JSON, or suggests an
unknown category, Link2Obsidian falls back to deterministic topic
classification and still saves the article.

## Ollama

When Ollama runs on the NAS host:

```env
L2O_AI_ENABLED=true
L2O_AI_PROVIDER=ollama
L2O_AI_BASE_URL=http://host.docker.internal:11434
L2O_AI_MODEL=qwen3:8b
```

When Ollama is another Compose service, use its service name instead:

```env
L2O_AI_BASE_URL=http://ollama:11434
```

The integration uses Ollama's native `/api/chat` endpoint with non-streaming
JSON output.

## Local OpenAI-compatible model

LM Studio, LocalAI, vLLM, llama.cpp servers, and similar software can use:

```env
L2O_AI_ENABLED=true
L2O_AI_PROVIDER=openai-compatible
L2O_AI_BASE_URL=http://192.168.1.10:1234/v1
L2O_AI_MODEL=your-local-model
```

An API key is optional for local servers.

## Cloud API

Any service exposing an OpenAI-compatible chat-completions endpoint can use:

```env
L2O_AI_ENABLED=true
L2O_AI_PROVIDER=openai-compatible
L2O_AI_BASE_URL=https://provider.example/v1
L2O_AI_MODEL=provider-model-name
L2O_AI_API_KEY=secret
```

Article title, source, and up to `L2O_AI_MAX_CONTENT_CHARS` characters of plain
article text are sent to the configured provider. Do not enable a cloud
provider for private content unless that data transfer is acceptable.

## Output

AI metadata is stored in frontmatter without changing the original article
body:

```yaml
summary: "文章摘要"
keywords: ["关键词一", "关键词二"]
category: "AI人工智能"
tags: ["AI", "大模型", "知乎"]
```

The API result reports:

- `ai: "enhanced"` — AI metadata was applied;
- `ai: "disabled"` — AI was turned off;
- `ai: "fallback"` — AI failed and rule-based classification was used.

