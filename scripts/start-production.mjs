import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { loadEnvironment, requireVariables, root } from "./production-common.mjs";

try {
  loadEnvironment();
  requireVariables(["DATABASE_URL", "CLERK_PUBLISHABLE_KEY", "CLERK_SECRET_KEY", "ADMIN_EMAIL"]);
  const port = Number(process.env.PORT || "8080");
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("PORT must be 1–65535.");
  const publicDir = join(root, "artifacts/baby-shop/dist/public");
  const serverFile = join(root, "artifacts/api-server/dist/index.mjs");
  if (![serverFile, join(publicDir, "index.html"), join(publicDir, "build-config.json")].every(existsSync)) {
    throw new Error("Production files are missing. Run pnpm build first.");
  }
  const build = JSON.parse(readFileSync(join(publicDir, "build-config.json"), "utf8"));
  if (build.standalone !== true) throw new Error("Run pnpm build to create the standalone storefront.");
  if (build.clerkPublishableKey !== process.env.CLERK_PUBLISHABLE_KEY ||
      (process.env.VITE_CLERK_PUBLISHABLE_KEY &&
       build.clerkPublishableKey !== process.env.VITE_CLERK_PUBLISHABLE_KEY)) {
    throw new Error("Clerk public keys must match the build. Set matching keys and run pnpm build again.");
  }
  process.env.NODE_ENV = "production";
  process.env.LOCAL_DEV = "false";
  process.env.PORT = String(port);
  process.env.HOST ||= "127.0.0.1";
  process.env.SERVE_STOREFRONT = "true";
  process.env.STOREFRONT_DIR = publicDir;
  await import(pathToFileURL(serverFile).href);
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
