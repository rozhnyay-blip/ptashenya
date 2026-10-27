import { useState } from "react";
import { Bot, Check, Copy, Download, ExternalLink, FileCode2, Gauge, Globe2, Map as MapIcon, Search, Share2, ShieldCheck, Sparkles, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { copyText, siteBase, tools } from "./seo-meta";

type Tool = { icon: LucideIcon; title: string; sub: string; href?: string; onClick?: () => void; tone: string; testId: string; download?: boolean };

export function SeoTools({ sitemapPath, sampleProductPath }: { sitemapPath: string; sampleProductPath: string | null }) {
  const base = siteBase();
  const home = base + "/";
  const sitemap = base + sitemapPath;
  const sample = sampleProductPath ? base + sampleProductPath : home;
  const [copied, setCopied] = useState(false);
  const list: Tool[] = [
    { icon: Search, title: "Google Search Console", sub: "Індексація, кліки, позиції", href: "https://search.google.com/search-console", tone: "from-[hsl(217_90%_60%)] to-[hsl(217_90%_48%)]", testId: "tool-search-console" },
    { icon: Globe2, title: "Що вже є в Google", sub: `Пошук site:${window.location.host}`, href: tools.googleIndex(window.location.host), tone: "from-[hsl(152_60%_45%)] to-[hsl(160_65%_34%)]", testId: "tool-google-index" },
    { icon: Gauge, title: "Швидкість сайту", sub: "PageSpeed Insights · головна", href: tools.pageSpeed(home), tone: "from-[hsl(36_95%_58%)] to-[hsl(22_90%_52%)]", testId: "tool-pagespeed" },
    { icon: Sparkles, title: "Розмітка товару", sub: "Rich Results Test · ціна, наявність", href: tools.richResults(sample), tone: "from-[hsl(275_70%_62%)] to-[hsl(265_60%_48%)]", testId: "tool-rich-results" },
    { icon: FileCode2, title: "Валідатор Schema.org", sub: "Перевірка структурованих даних", href: tools.schema(sample), tone: "from-[hsl(190_75%_45%)] to-[hsl(200_80%_38%)]", testId: "tool-schema" },
    { icon: Share2, title: "Прев'ю в соцмережах", sub: "Facebook / Viber / Telegram", href: tools.facebook(sample), tone: "from-[hsl(221_70%_55%)] to-[hsl(225_65%_42%)]", testId: "tool-facebook" },
    { icon: ShieldCheck, title: "Bing Webmaster", sub: "Індексація в Bing", href: "https://www.bing.com/webmasters", tone: "from-[hsl(174_70%_40%)] to-[hsl(184_75%_32%)]", testId: "tool-bing" },
    { icon: MapIcon, title: "Карта сайту", sub: "sitemap.xml — всі посилання", href: sitemap, tone: "from-[hsl(14_88%_58%)] to-[hsl(4_80%_50%)]", testId: "tool-sitemap" },
    { icon: Bot, title: "robots.txt", sub: "Правила для пошукових роботів", href: base + "/robots.txt", tone: "from-[hsl(285_20%_40%)] to-[hsl(285_25%_28%)]", testId: "tool-robots" },
    { icon: Download, title: "Excel усіх посилань", sub: "Посилання, заголовки, проблеми", href: `${import.meta.env.BASE_URL}api/admin/export/seo-links.csv`, download: true, tone: "from-[hsl(145_55%_40%)] to-[hsl(150_60%_30%)]", testId: "tool-export-links" },
  ];
  return (
    <section className="mb-4">
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2"><h2 className="font-display text-lg font-bold">Професійні інструменти</h2><span className="text-xs text-muted-foreground">Відкриваються в новій вкладці вже з вашим сайтом</span></div>
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-5">
        {list.map((t) => (
          <a key={t.testId} href={t.href} target={t.download ? undefined : "_blank"} rel="noreferrer" download={t.download || undefined} data-testid={t.testId}
            className="group relative flex min-w-0 flex-col gap-2.5 overflow-hidden rounded-2xl border border-card-border bg-card p-3.5 transition hover:-translate-y-0.5 hover:border-foreground/20 hover:shadow-[0_16px_30px_-18px_hsl(285_40%_20%/.5)]">
            <div className="flex items-start justify-between">
              <span className={cn("grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br text-white shadow-[inset_0_1px_0_hsl(0_0%_100%/.25)]", t.tone)}><t.icon className="h-5 w-5" /></span>
              {t.download ? <Download className="h-3.5 w-3.5 text-muted-foreground transition group-hover:text-foreground" /> : <ExternalLink className="h-3.5 w-3.5 text-muted-foreground transition group-hover:text-foreground" />}
            </div>
            <div className="min-w-0"><div className="text-[13px] font-bold leading-tight">{t.title}</div><div className="mt-0.5 line-clamp-2 text-[11px] leading-snug text-muted-foreground">{t.sub}</div></div>
          </a>
        ))}
      </div>
      <div className="mt-2.5 flex min-w-0 items-center gap-1.5 rounded-2xl border border-border bg-card p-1.5 pl-3">
        <MapIcon className="h-4 w-4 shrink-0 text-primary" />
        <code className="min-w-0 flex-1 truncate font-mono text-xs" data-testid="text-sitemap-url">{sitemap}</code>
        <button type="button" onClick={() => copyText(sitemap).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1600); })} data-testid="button-copy-sitemap" className="inline-flex h-8 shrink-0 items-center gap-1 rounded-xl bg-foreground px-3 text-xs font-semibold text-background">{copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}{copied ? "Скопійовано" : "Копіювати"}</button>
      </div>
    </section>
  );
}
