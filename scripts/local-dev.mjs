import { spawn } from "node:child_process";

const apiPort = process.env.API_PORT || "8080";
const webPort = process.env.VITE_PORT || "5173";
const command = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
const shell = process.platform === "win32";
const children = [];
let stopping = false;

function start(label, args, extraEnv) {
  const child = spawn(command, args, {
    cwd: process.cwd(),
    env: {
      ...process.env,
      ...extraEnv,
      LOCAL_DEV: "true",
    },
    stdio: "inherit",
    shell,
  });
  children.push(child);
  child.on("error", (error) => {
    console.error(`${label} failed to start: ${error.message}`);
    stop(1);
  });
  child.on("exit", (code) => {
    if (!stopping) {
      console.error(`${label} stopped${code === 0 ? "" : ` with exit code ${code}`}.`);
      stop(code || 1);
    }
  });
  return child;
}

function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  for (const child of children) {
    if (child.exitCode === null) child.kill("SIGTERM");
  }
  process.exitCode = code;
}

process.on("SIGINT", () => stop(0));
process.on("SIGTERM", () => stop(0));

console.log(`Starting the local shop. Open http://localhost:${webPort}`);
console.log("Supplier synchronization is disabled in local mode.");

start(
  "API server",
  ["--filter", "@workspace/api-server", "run", "local"],
  {
    PORT: apiPort,
    API_PORT: apiPort,
    NODE_ENV: "development",
    DISABLE_SUPPLIER_SYNC: "true",
  },
);

start(
  "Storefront",
  ["--filter", "@workspace/baby-shop", "run", "local"],
  {
    PORT: webPort,
    VITE_PORT: webPort,
    API_PORT: apiPort,
    BASE_PATH: "/",
    NODE_ENV: "development",
  },
);
