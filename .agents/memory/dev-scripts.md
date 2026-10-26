---
name: Running server code ad-hoc
description: How to execute api-server TypeScript (e.g. runSeo, routes with auth bypassed) outside the workflow
---
- `tsx` is not on PATH. Run from inside artifacts/api-server: `node --import $(ls -d /home/runner/workspace/node_modules/.pnpm/tsx@*/node_modules/tsx | head -1)/dist/loader.mjs file.tmp.ts` (file must live in the package so `@workspace/*` imports resolve).
- To hit admin routes without a Clerk session: mount the routers in a throwaway express app and replace stack layers whose `handle.name === "requireAdmin"` with a pass-through.
**Why:** admin endpoints are behind Clerk and the screenshot tool can't sign in; this was the fastest reliable way to verify them.
**How to apply:** delete the temp file afterwards; never commit the bypass.
