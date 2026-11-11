import app from "./app";
import { logger } from "./lib/logger";
import { initSync } from "./lib/sync";
import { startCrmSync } from "./lib/crm";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

const host = process.env.LOCAL_DEV === "true" ? "127.0.0.1" : undefined;
const onListening = (err?: Error) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");
  startCrmSync();
  initSync().catch((e: unknown) => logger.error({ err: e }, "Sync init failed"));
};

if (host) app.listen(port, host, onListening);
else app.listen(port, onListening);
