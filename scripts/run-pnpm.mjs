import { spawnSync } from "node:child_process";

const args = process.argv.slice(2);
if (args.length === 0) {
  console.error("Pass a pnpm command after this script.");
  process.exit(2);
}

const command = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
const result = spawnSync(command, args, {
  cwd: process.cwd(),
  env: process.env,
  stdio: "inherit",
  shell: process.platform === "win32",
});

if (result.error) {
  console.error(`Could not start pnpm: ${result.error.message}`);
  process.exit(1);
}
process.exit(result.status ?? 1);
