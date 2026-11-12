import { spawnSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { loadEnvironment, requireVariables, root } from "./production-common.mjs";

try {
  loadEnvironment();
  requireVariables(["VITE_CLERK_PUBLISHABLE_KEY"]);
  // The standalone storefront and API share the root origin, not artifact paths.
  const env = {
    ...process.env, NODE_ENV: "production", BASE_PATH: "/", LOCAL_DEV: "false",
    VITE_STANDALONE: "true",
  };
  for (const args of [
    ["run", "typecheck"],
    ["--filter", "@workspace/api-server", "run", "build"],
    ["--filter", "@workspace/baby-shop", "run", "build"],
  ]) {
    const result = spawnSync(process.execPath, [join(root, "scripts/run-pnpm.mjs"), ...args], {
      cwd: root, env, stdio: "inherit",
    });
    if (result.error) throw result.error;
    if (result.status !== 0) process.exit(result.status ?? 1);
  }
  // This is a PUBLIC key, never a secret. Detect stale builds after key changes.
  writeFileSync(join(root, "artifacts/baby-shop/dist/public/build-config.json"), JSON.stringify({
    clerkPublishableKey: process.env.VITE_CLERK_PUBLISHABLE_KEY,
    standalone: true,
  }));
  console.log("Production build complete. Run pnpm start.");
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
