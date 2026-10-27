import { Copy as CopyIcon, FileWarning, History, ImageOff, Scissors, Type, AlignLeft, type LucideIcon } from "lucide-react";
import type { SeoIssue } from "@workspace/api-client-react";

export type Severity = "high" | "mid" | "low";

export const ISSUE_META: Record<SeoIssue, { label: string; short: string; hint: string; icon: LucideIcon; severity: Severity }> = {
  no_seo: { label: "Без SEO", short: "немає SEO", hint: "Товар ще не отримав заголовок і опис. Натисніть «Оновити SEO».", icon: FileWarning, severity: "high" },
  outdated: { label: "SEO застаріло", short: "застаріло", hint: "Ціна чи назва змінились після останнього оновлення SEO.", icon: History, severity: "high" },
  duplicate_title: { label: "Однакові заголовки", short: "повтор", hint: "Кілька товарів мають той самий заголовок — Google може показати лише один.", icon: CopyIcon, severity: "mid" },
  no_image: { label: "Без фото", short: "без фото", hint: "Без картинки товар гірше виглядає в Google і соцмережах.", icon: ImageOff, severity: "mid" },
  truncated_title: { label: "Обрізаний заголовок", short: "обрізано", hint: "Назва довга, тому кінець заголовка обрізано «…».", icon: Scissors, severity: "low" },
  short_title: { label: "Короткий заголовок", short: "короткий", hint: "Менше 30 символів — мало слів, за якими шукають.", icon: Type, severity: "low" },
  short_description: { label: "Короткий опис", short: "мало опису", hint: "Опис коротший за 70 символів.", icon: AlignLeft, severity: "low" },
};

export const SEVERITY_STYLE: Record<Severity, { dot: string; chip: string; text: string }> = {
  high: { dot: "bg-destructive", chip: "bg-destructive/10 text-destructive", text: "text-destructive" },
  mid: { dot: "bg-[hsl(32_95%_52%)]", chip: "bg-[hsl(38_95%_90%)] text-[hsl(28_80%_30%)]", text: "text-[hsl(28_85%_38%)]" },
  low: { dot: "bg-[hsl(210_70%_55%)]", chip: "bg-[hsl(210_80%_94%)] text-[hsl(215_60%_35%)]", text: "text-[hsl(215_60%_40%)]" },
};

/** Store root URL without trailing slash, e.g. https://ptashenia.com.ua */
export const siteBase = () => window.location.origin + import.meta.env.BASE_URL.replace(/\/$/, "");

const enc = encodeURIComponent;
export const tools = {
  googleIndex: (url: string) => `https://www.google.com/search?q=${enc("site:" + url)}`,
  pageSpeed: (url: string) => `https://pagespeed.web.dev/analysis?url=${enc(url)}`,
  richResults: (url: string) => `https://search.google.com/test/rich-results?url=${enc(url)}`,
  schema: (url: string) => `https://validator.schema.org/#url=${enc(url)}`,
  facebook: (url: string) => `https://developers.facebook.com/tools/debug/?q=${enc(url)}`,
};

export function copyText(text: string): Promise<void> {
  return navigator.clipboard.writeText(text);
}
