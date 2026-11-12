import app from "./app";
import { logger } from "./lib/logger";
import { initSync } from "./lib/sync";
import { startCrmSync } from "./lib/crm";
import { pool } from "@workspace/db";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (!Number.isInteger(port) || port <= 0 || port > 65535) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

const host = process.env.HOST || (process.env.LOCAL_DEV === "true" ? "127.0.0.1" : undefined);
const onListening = () => {
  logger.info({ port }, "Server listening");
  startCrmSync();
  initSync().catch((e: unknown) => logger.error({ err: e }, "Sync init failed"));
};

const server = host ? app.listen(port, host, onListening) : app.listen(port, onListening);
server.on("error", (err) => {
  logger.error({ err }, "Error listening on port");
  process.exit(1);
});

let stopping = false;
for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    if (stopping) return;
    stopping = true;
    logger.info({ signal }, "Shutting down");
    setTimeout(() => process.exit(1), 10_000).unref();
    server.close(() => {
      pool.end().then(() => process.exit(0)).catch(() => process.exit(1));
    });
  });
}
