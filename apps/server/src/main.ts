import { buildApp } from "./app.js";
import { loadConfig } from "./config/env.js";

const config = loadConfig();
const app = await buildApp(config);

async function shutdown(signal: string): Promise<void> {
  app.log.info({ signal }, "Shutting down");
  await app.close();
  process.exit(0);
}

process.on("SIGINT", () => {
  void shutdown("SIGINT");
});

process.on("SIGTERM", () => {
  void shutdown("SIGTERM");
});

try {
  await app.listen({
    host: config.server.host,
    port: config.server.port,
  });
} catch (error) {
  app.log.error(error);
  process.exit(1);
}

