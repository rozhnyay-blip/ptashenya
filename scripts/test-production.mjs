import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { once } from "node:events";
import { join } from "node:path";
import { loadEnvironment, root } from "./production-common.mjs";

// Test the actual standalone entry point, not the Replit artifact proxy.
// No checkout, supplier sync or CRM writes are performed.
loadEnvironment();
const socket = createServer();
socket.listen(0, "127.0.0.1");
await once(socket, "listening");
const port = socket.address().port;
await new Promise((resolve) => socket.close(resolve));
const env = { ...process.env };
for (const name of Object.keys(env)) {
  if (/^REPL/.test(name)) delete env[name];
}
Object.assign(env, {
  PORT: String(port), HOST: "127.0.0.1",
  DISABLE_SUPPLIER_SYNC: "true", MOIE_URL: "", MOIE_WEBHOOK_TOKEN: "",
});
const child = spawn(process.execPath, [join(root, "scripts/start-production.mjs")], {
  cwd: root, env, stdio: ["ignore", "ignore", "ignore"],
});
let exit;
child.once("exit", (code) => { exit = code; });
let spawnError;
child.once("error", (error) => { spawnError = error; });
const origin = `http://127.0.0.1:${port}`;
try {
  let ready = false;
  for (let i = 0; i < 100; i++) {
    if (spawnError) throw spawnError;
    if (exit !== undefined) throw new Error("Standalone server exited. Check .env with pnpm start.");
    try {
      const response = await fetch(`${origin}/api/healthz`, { signal: AbortSignal.timeout(1000) });
      if (response.ok) { ready = true; break; }
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  assert(ready, "Standalone server did not become ready");
  for (const route of ["/", "/catalog", "/sign-in", "/admin"]) {
    const response = await fetch(`${origin}${route}`);
    assert.equal(response.status, 200, route);
    assert.match(response.headers.get("content-type"), /text\/html/, route);
    assert.match(await response.text(), /<div id="root">/, route);
  }
  const html = await (await fetch(origin)).text();
  const script = html.match(/src="([^"]+\.js)"/)?.[1];
  assert(script?.startsWith("/assets/"), "Built JS uses root-relative standalone asset URL");
  const asset = await fetch(`${origin}${script}`);
  assert.equal(asset.status, 200);
  assert.match(asset.headers.get("cache-control"), /immutable/);
  for (const route of ["/api/not-found", "/assets/missing.js", "/.env", "/package.json"]) {
    assert.equal((await fetch(`${origin}${route}`)).status, 404, route);
  }
  if (process.argv.includes("--database")) {
    assert.equal((await fetch(`${origin}/api/categories`)).status, 200, "Database-backed categories");
  }
  console.log("PASS: production startup without REPLIT_*; HTML/deep links; API health; assets; private-file and missing-route protection.");
  if (process.argv.includes("--database")) console.log("PASS: database-backed categories.");
} finally {
  if (child.exitCode === null) {
    const closed = once(child, "exit");
    child.kill("SIGTERM");
    const timer = setTimeout(() => child.kill("SIGKILL"), 5000);
    await closed;
    clearTimeout(timer);
  }
}
