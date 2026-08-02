export function renderHomePage(): string {
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <meta name="theme-color" content="#f4f1ea">
  <title>Link2Obsidian</title>
  <style>
    :root {
      color-scheme: light;
      --paper: #f4f1ea;
      --card: rgba(255, 255, 255, 0.82);
      --ink: #20231f;
      --muted: #6d716a;
      --line: rgba(32, 35, 31, 0.12);
      --accent: #6750a4;
      --accent-dark: #543d91;
      --success: #287a4b;
      --error: #b33a3a;
      --shadow: 0 22px 60px rgba(48, 42, 32, 0.12);
    }

    * { box-sizing: border-box; }

    body {
      margin: 0;
      min-height: 100svh;
      color: var(--ink);
      background:
        radial-gradient(circle at 8% 0%, rgba(103, 80, 164, 0.14), transparent 34rem),
        radial-gradient(circle at 100% 88%, rgba(45, 122, 75, 0.10), transparent 30rem),
        var(--paper);
      font-family: Inter, "Noto Sans SC", "PingFang SC", "Microsoft YaHei", system-ui, sans-serif;
    }

    main {
      width: min(100% - 32px, 680px);
      margin: 0 auto;
      padding: max(52px, 9svh) 0 max(36px, env(safe-area-inset-bottom));
    }

    .brand {
      display: inline-flex;
      align-items: center;
      gap: 10px;
      margin-bottom: 24px;
      color: var(--muted);
      font-size: 14px;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }

    .mark {
      display: grid;
      width: 34px;
      height: 34px;
      place-items: center;
      border-radius: 11px;
      color: white;
      background: var(--accent);
      box-shadow: 0 8px 22px rgba(103, 80, 164, 0.28);
    }

    h1 {
      max-width: 590px;
      margin: 0;
      font-family: "Noto Serif SC", "Songti SC", "STSong", Georgia, serif;
      font-size: clamp(38px, 9vw, 64px);
      font-weight: 700;
      line-height: 1.08;
      letter-spacing: -0.035em;
    }

    .lead {
      margin: 18px 0 34px;
      color: var(--muted);
      font-size: clamp(16px, 4vw, 19px);
      line-height: 1.7;
    }

    .card {
      padding: clamp(20px, 5vw, 30px);
      border: 1px solid rgba(255, 255, 255, 0.72);
      border-radius: 26px;
      background: var(--card);
      box-shadow: var(--shadow);
      backdrop-filter: blur(18px);
    }

    label {
      display: block;
      margin-bottom: 10px;
      font-size: 14px;
      font-weight: 750;
    }

    textarea {
      width: 100%;
      min-height: 118px;
      padding: 15px 16px;
      border: 1px solid var(--line);
      border-radius: 15px;
      outline: none;
      color: var(--ink);
      background: rgba(255, 255, 255, 0.84);
      font: inherit;
      font-size: 16px;
      line-height: 1.55;
      resize: vertical;
      transition: border-color 160ms, box-shadow 160ms;
    }

    textarea:focus {
      border-color: rgba(103, 80, 164, 0.58);
      box-shadow: 0 0 0 4px rgba(103, 80, 164, 0.11);
    }

    button {
      width: 100%;
      min-height: 56px;
      margin-top: 14px;
      border: 0;
      border-radius: 15px;
      color: white;
      background: var(--accent);
      font: inherit;
      font-size: 16px;
      font-weight: 750;
      cursor: pointer;
      transition: transform 120ms, background 120ms, opacity 120ms;
    }

    button:hover { background: var(--accent-dark); }
    button:active { transform: translateY(1px); }
    button:disabled { cursor: wait; opacity: 0.64; }

    .hint {
      margin: 14px 2px 0;
      color: var(--muted);
      font-size: 13px;
      line-height: 1.55;
    }

    .result {
      display: none;
      margin-top: 18px;
      padding: 18px;
      border: 1px solid var(--line);
      border-radius: 17px;
      background: rgba(255, 255, 255, 0.66);
    }

    .result.visible { display: block; }
    .result.success { border-color: rgba(40, 122, 75, 0.28); }
    .result.error { border-color: rgba(179, 58, 58, 0.28); }

    .result-title {
      margin: 0 0 8px;
      font-size: 16px;
      font-weight: 800;
    }

    .success .result-title { color: var(--success); }
    .error .result-title { color: var(--error); }

    .result-message {
      margin: 0;
      color: var(--muted);
      font-size: 14px;
      line-height: 1.65;
      overflow-wrap: anywhere;
    }

    .meta {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 10px;
      margin-top: 14px;
    }

    .meta-item {
      padding: 12px;
      border-radius: 13px;
      background: rgba(103, 80, 164, 0.07);
    }

    .meta-label {
      display: block;
      margin-bottom: 4px;
      color: var(--muted);
      font-size: 12px;
    }

    .meta-value {
      display: block;
      font-size: 14px;
      font-weight: 700;
      overflow-wrap: anywhere;
    }

    footer {
      margin-top: 22px;
      color: var(--muted);
      text-align: center;
      font-size: 12px;
    }

    @media (max-width: 480px) {
      main {
        width: min(100% - 22px, 680px);
        padding-top: 34px;
      }

      .lead { margin-bottom: 24px; }
      .card { border-radius: 21px; }
      .meta { grid-template-columns: 1fr; }
    }

    @media (prefers-reduced-motion: reduce) {
      * { scroll-behavior: auto !important; transition: none !important; }
    }
  </style>
</head>
<body>
  <main>
    <div class="brand"><span class="mark">L2O</span> 纳知库</div>
    <h1>把网页，收进 Obsidian。</h1>
    <p class="lead">粘贴文章链接，系统会自动提取正文、下载图片并生成 Obsidian 兼容 Markdown。</p>

    <section class="card" aria-labelledby="clip-title">
      <form id="clip-form">
        <label id="clip-title" for="url">链接或分享口令</label>
        <textarea
          id="url"
          name="url"
          inputmode="url"
          autocapitalize="none"
          spellcheck="false"
          placeholder="粘贴网页链接，或直接粘贴平台的整段分享文字"
          required
        ></textarea>
        <button id="submit" type="submit">保存到 Obsidian</button>
        <p class="hint">保存通常需要几秒到几十秒。关闭 AI 不影响正文和图片采集。</p>
      </form>

      <div id="result" class="result" role="status" aria-live="polite">
        <p id="result-title" class="result-title"></p>
        <p id="result-message" class="result-message"></p>
        <div id="meta" class="meta"></div>
      </div>
    </section>

    <footer>Link2Obsidian · 链接 → Markdown → Obsidian</footer>
  </main>

  <script>
    const form = document.getElementById("clip-form");
    const urlInput = document.getElementById("url");
    const submitButton = document.getElementById("submit");
    const result = document.getElementById("result");
    const resultTitle = document.getElementById("result-title");
    const resultMessage = document.getElementById("result-message");
    const meta = document.getElementById("meta");

    function showResult(kind, title, message, items = []) {
      result.className = "result visible " + kind;
      resultTitle.textContent = title;
      resultMessage.textContent = message;
      meta.replaceChildren();

      for (const [label, value] of items) {
        if (value === undefined || value === null || value === "") continue;
        const item = document.createElement("div");
        item.className = "meta-item";
        const itemLabel = document.createElement("span");
        itemLabel.className = "meta-label";
        itemLabel.textContent = label;
        const itemValue = document.createElement("span");
        itemValue.className = "meta-value";
        itemValue.textContent = String(value);
        item.append(itemLabel, itemValue);
        meta.append(item);
      }
    }

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const url = urlInput.value.trim();
      if (!url) return;

      submitButton.disabled = true;
      submitButton.textContent = "正在解析并保存…";
      showResult("success", "正在处理", "正在读取网页正文和下载图片，请稍候。");

      try {
        const response = await fetch("/api/clips", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url }),
        });
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.message || "保存失败，请检查链接后重试。");
        }

        const duplicate = data.status === "duplicate";
        showResult(
          "success",
          duplicate ? "文章已存在" : "已保存到 Obsidian",
          data.title || data.url,
          [
            ["分类", data.category],
            ["文件", data.file],
            ["图片", data.images ? data.images.downloaded + " 张" : undefined],
            ["解析器", data.plugin],
          ],
        );
      } catch (error) {
        showResult(
          "error",
          "保存失败",
          error instanceof Error ? error.message : "发生未知错误，请稍后重试。",
        );
      } finally {
        submitButton.disabled = false;
        submitButton.textContent = "保存到 Obsidian";
      }
    });
  </script>
</body>
</html>`;
}
