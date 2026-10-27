import { seoAudit, seoLinks } from "./src/lib/seo-audit";
const t0 = Date.now();
const a = await seoAudit();
console.log(JSON.stringify(a), Date.now() - t0, "ms");
for (const q of [{}, { kind: "category" as const }, { issue: "outdated" as const, limit: 3 }, { issue: "duplicate_title" as const, limit: 2 }, { q: "BEAR", limit: 2 }, { page: 2, limit: 3 }]) {
  const t1 = Date.now();
  const r = await seoLinks({ limit: 3, ...q });
  console.log(JSON.stringify(q), r.total, Date.now() - t1, "ms", JSON.stringify(r.items.map((i) => [i.kind, i.path, i.title.slice(0, 60), i.issues])));
}
const t2 = Date.now(); const all = await seoLinks({ limit: 0 }); console.log("all", all.items.length, Date.now() - t2, "ms");
process.exit(0);
