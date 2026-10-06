import { DatabaseSync } from "node:sqlite";
import { mkdir, readdir, open } from "node:fs/promises";
import { resolve, relative, sep, isAbsolute } from "node:path";
import { randomUUID } from "node:crypto";
import type { AppConfig, DuplicatePolicy } from "../config/env.js";
import type { ClipResult } from "../domain/clip.js";

export interface Task {
  id: string;
  url: string;
  policy: DuplicatePolicy;
  status: "queued" | "processing" | "success" | "failed";
  createdAt: string;
  updatedAt: string;
  title?: string;
  category?: string;
  file?: string;
  error?: string;
  result?: ClipResult;
}

export class TaskStore {
  private constructor(private readonly db: DatabaseSync) {}

  static async open(config: AppConfig): Promise<TaskStore> {
    await mkdir(config.storage.dataPath, { recursive: true });
    const db = new DatabaseSync(resolve(config.storage.dataPath, "tasks.sqlite"));
    db.exec(`
      PRAGMA journal_mode=WAL;
      PRAGMA busy_timeout=5000;
      CREATE TABLE IF NOT EXISTS tasks (
        id TEXT PRIMARY KEY, url TEXT NOT NULL, policy TEXT NOT NULL,
        status TEXT NOT NULL, createdAt TEXT NOT NULL, updatedAt TEXT NOT NULL,
        title TEXT, category TEXT, file TEXT, error TEXT, result TEXT
      );
      CREATE INDEX IF NOT EXISTS tasks_recent ON tasks(createdAt DESC, id DESC);
      CREATE INDEX IF NOT EXISTS tasks_status ON tasks(status);
      CREATE TABLE IF NOT EXISTS notes (
        key TEXT PRIMARY KEY, file TEXT NOT NULL, title TEXT, category TEXT
      );
      CREATE TABLE IF NOT EXISTS migrations (name TEXT PRIMARY KEY);
    `);
    const store = new TaskStore(db);
    try {
      await store.importLegacy(config);
      db.prepare("UPDATE tasks SET status='failed', error='任务因服务重启中断，请重试', updatedAt=? WHERE status='processing'")
        .run(new Date().toISOString());
      return store;
    } catch (error) {
      db.close();
      throw error;
    }
  }

  create(url: string, policy: DuplicatePolicy): Task {
    const now = new Date().toISOString();
    const id = randomUUID();
    this.db.prepare("INSERT INTO tasks(id,url,policy,status,createdAt,updatedAt) VALUES(?,?,?,'queued',?,?)")
      .run(id, url, policy, now, now);
    return this.get(id)!;
  }

  get(id: string): Task | undefined {
    return this.decode(this.db.prepare("SELECT * FROM tasks WHERE id=?").get(id));
  }

  list(limit = 20, offset = 0): { tasks: Task[]; total: number } {
    const rows = this.db.prepare("SELECT * FROM tasks ORDER BY createdAt DESC,id DESC LIMIT ? OFFSET ?").all(limit, offset);
    return {
      tasks: rows.map(row => this.decode(row)!),
      total: Number(this.db.prepare("SELECT count(*) AS n FROM tasks").get()!.n),
    };
  }

  next(): Task | undefined {
    return this.decode(this.db.prepare("SELECT * FROM tasks WHERE status='queued' ORDER BY createdAt,id LIMIT 1").get());
  }

  processing(id: string): void {
    this.db.prepare("UPDATE tasks SET status='processing',updatedAt=? WHERE id=?").run(new Date().toISOString(), id);
  }

  finish(id: string, result: ClipResult): void {
    this.db.prepare("UPDATE tasks SET status='success',updatedAt=?,title=?,category=?,file=?,result=?,error=NULL WHERE id=?")
      .run(new Date().toISOString(), result.title ?? null, result.category ?? null, result.file, JSON.stringify(result), id);
  }

  fail(id: string, message: string): void {
    this.db.prepare("UPDATE tasks SET status='failed',updatedAt=?,error=? WHERE id=?")
      .run(new Date().toISOString(), message.slice(0, 2000), id);
  }

  note(key: string): { file: string; title?: string; category?: string } | undefined {
    return this.db.prepare("SELECT file,title,category FROM notes WHERE key=?").get(key) as
      { file: string; title?: string; category?: string } | undefined;
  }

  recordNote(key: string, result: Pick<ClipResult, "file" | "title" | "category">): void {
    this.db.prepare("INSERT INTO notes(key,file,title,category) VALUES(?,?,?,?) ON CONFLICT(key) DO UPDATE SET file=excluded.file,title=excluded.title,category=excluded.category")
      .run(key, result.file, result.title ?? null, result.category ?? null);
  }

  removeNote(key: string): void {
    this.db.prepare("DELETE FROM notes WHERE key=?").run(key);
  }

  close(): void { this.db.close(); }

  private decode(row: unknown): Task | undefined {
    if (!row) return undefined;
    const task = row as Omit<Task, "result"> & { result?: string };
    return { ...task, result: task.result ? JSON.parse(task.result) as ClipResult : undefined };
  }

  private async importLegacy(config: AppConfig): Promise<void> {
    const vault = resolve(config.storage.vaultPath);
    if (isAbsolute(config.storage.outputDir)) throw new Error("Output must be relative to Vault");
    const root = resolve(vault, config.storage.outputDir);
    const boundary = relative(vault, root);
    if (boundary === ".." || boundary.startsWith(`..${sep}`)) throw new Error("Output must stay inside Vault");
    const migration = `legacy-v1:${root}`;
    if (this.db.prepare("SELECT name FROM migrations WHERE name=?").get(migration)) return;
    const walk = async (directory: string): Promise<void> => {
      let entries;
      try { entries = await readdir(directory, { withFileTypes: true }); }
      catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") return;
        throw error;
      }
      for (const entry of entries) {
        const file = resolve(directory, entry.name);
        if (entry.isDirectory()) await walk(file);
        if (!entry.isFile() || !entry.name.endsWith(".md")) continue;
        const handle = await open(file, "r");
        let header: string;
        try {
          const buffer = Buffer.alloc(16384);
          const { bytesRead } = await handle.read(buffer, 0, buffer.length, 0);
          header = buffer.subarray(0, bytesRead).toString("utf8");
        } finally { await handle.close(); }
        let key = header.match(/<!-- link2obsidian-id: ([a-f0-9]{10}) -->/)?.[1]
          ?? entry.name.match(/--([a-f0-9]{10})\.md$/)?.[1];
        const rawUrl = header.match(/^(?:url|原文链接):\s*(.+)$/m)?.[1]?.trim();
        if (rawUrl) {
          try {
            const url = new URL(rawUrl.startsWith('"') ? JSON.parse(rawUrl) : rawUrl);
            if (!["http:", "https:"].includes(url.protocol)) continue;
            url.hash = "";
            key = url.toString();
          } catch { /* Fall back to a legacy clip marker if frontmatter is malformed. */ }
        }
        if (key) this.recordNote(key, {
          file: relative(vault, file).split(sep).join("/"),
          title: entry.name.replace(/\.md$/, ""),
          category: relative(root, file).split(sep).length > 1 ? relative(root, file).split(sep)[0] : undefined,
        });
      }
    };
    await walk(root);
    this.db.prepare("INSERT INTO migrations(name) VALUES(?)").run(migration);
  }
}
