import { loadEnvFile } from "node:process";
import { fileURLToPath } from "node:url";

export const root = fileURLToPath(new URL("../", import.meta.url));

export function loadEnvironment() {
  try {
    loadEnvFile(new URL("../.env", import.meta.url));
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
}

export function requireVariables(names) {
  const missing = names.filter((name) => {
    const value = process.env[name]?.trim();
    return !value || /replace_me|change-this|YOUR_/i.test(value);
  });
  if (missing.length) {
    throw new Error(`Fill these variables in .env: ${missing.join(", ")}. See README.md.`);
  }
}
