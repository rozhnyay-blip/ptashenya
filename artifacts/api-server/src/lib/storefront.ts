import express, { type Express } from "express";
import { existsSync } from "node:fs";
import path from "node:path";

/** Standalone hosting only; managed artifact routing stays unchanged. */
export function configureStorefront(app: Express): void {
  if (process.env.SERVE_STOREFRONT !== "true") return;
  const directory = process.env.STOREFRONT_DIR;
  if (!directory || !path.isAbsolute(directory) || !existsSync(path.join(directory, "index.html"))) {
    throw new Error("STOREFRONT_DIR must point to the built storefront. Use pnpm build and pnpm start.");
  }
  app.use("/api", (_req, res) => {
    res.status(404).json({ error: "API route not found" });
  });
  app.use((req, res, next) => {
    if (req.path.split("/").some((part) => part.startsWith("."))) {
      res.sendStatus(404);
      return;
    }
    next();
  });
  app.use(express.static(directory, {
    index: false,
    dotfiles: "deny",
    setHeaders(res, filename) {
      res.setHeader("X-Content-Type-Options", "nosniff");
      res.setHeader("Cache-Control",
        filename.includes(`${path.sep}assets${path.sep}`) ? "public, max-age=31536000, immutable" : "no-cache");
    },
  }));
  // Deep links must load the SPA, but missing assets and API calls must stay 404.
  app.get("/{*storefrontPath}", (req, res) => {
    if (path.extname(req.path) || !req.accepts("html")) {
      res.sendStatus(404);
      return;
    }
    res.setHeader("Cache-Control", "no-cache");
    res.sendFile(path.join(directory, "index.html"));
  });
}
