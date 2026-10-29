import { Link } from "wouter";
import { ArrowRight } from "lucide-react";
import { useListSearchAliases, getListSearchAliasesQueryKey, type SearchAliasGroup } from "@workspace/api-client-react";

/** Russian and Transcarpathian words the search understands (one list, kept on the server). */
export function useAliasGroups(): SearchAliasGroup[] {
  const { data } = useListSearchAliases({ query: { queryKey: getListSearchAliasesQueryKey(), staleTime: Infinity, gcTime: Infinity } });
  return data ?? [];
}

const norm = (t: string) => t.toLowerCase().replace(/ё/g, "е").replace(/['’ʼ`ʹ]/g, "");

/** Groups whose words occur in the text (word starts, same rule as the server search). */
export function aliasesFor(text: string | null | undefined, groups: SearchAliasGroup[], max = 6): string[] {
  if (!text || !groups.length) return [];
  const words = norm(text).split(/[^\p{L}]+/u).filter(Boolean);
  const out: string[] = [];
  for (const g of groups) {
    if (!words.some((w) => g.stems.some((s) => !s.includes(" ") && w.startsWith(s)))) continue;
    for (const a of g.aliases) if (!out.includes(a.word) && !words.includes(norm(a.word))) out.push(a.word);
  }
  return out.slice(0, max);
}

/** "Також шукають: …" — visible words for customers and search engines. */
export function AlsoSearched({ words, className }: { words: string[]; className?: string }) {
  if (!words.length) return null;
  return (
    <p className={className ?? "text-xs text-muted-foreground"} data-testid="text-also-searched">
      Також шукають:{" "}
      {words.map((w, i) => (
        <span key={w}>
          <Link href={`/catalog?search=${encodeURIComponent(w)}`} className="font-semibold underline-offset-4 hover:text-foreground hover:underline">{w}</Link>
          {i < words.length - 1 ? ", " : ""}
        </span>
      ))}
    </p>
  );
}

/** Home-page block: search works in Ukrainian, Russian and Transcarpathian. */
export function SpeakYourWay() {
  const groups = useAliasGroups();
  if (!groups.length) return null;
  const pairs = (kind: "dialect" | "ru") =>
    groups.flatMap((g) => g.aliases.filter((a) => a.kind === kind).map((a) => ({ word: a.word, uk: g.uk })));
  const dialect = pairs("dialect");
  const ru = pairs("ru").filter((p) => !dialect.some((d) => d.word === p.word)).slice(0, 18);
  const Chip = ({ word, uk }: { word: string; uk: string }) => (
    <Link href={`/catalog?search=${encodeURIComponent(word)}`} data-testid={`link-alias-${word}`}
      className="group inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3.5 py-2 text-sm transition hover:border-foreground">
      <span className="font-semibold">{word}</span>
      <ArrowRight className="h-3.5 w-3.5 text-muted-foreground transition group-hover:translate-x-0.5" />
      <span className="text-muted-foreground">{uk}</span>
    </Link>
  );
  return (
    <section className="mx-auto max-w-7xl px-4 pt-16" data-testid="section-speak-your-way">
      <div className="rounded-[2rem] border border-card-border bg-[hsl(40_60%_96%)] p-6 sm:p-10">
        <div className="mb-1 text-xs font-bold uppercase tracking-[0.2em] text-primary">пишіть, як звикли</div>
        <h2 className="max-w-3xl font-display text-2xl font-bold sm:text-3xl">Цуцлик, соска чи пустушка — ми зрозуміємо</h2>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground sm:text-base">
          Шукайте українською, російською чи по-закарпатськи: коляски, памперси, подгузники, бутылочки — пошук сам знайде потрібні товари.
        </p>
        <div className="mt-6 space-y-5">
          <div>
            <div className="mb-2 text-sm font-bold">По-закарпатськи й по-західному</div>
            <div className="flex flex-wrap gap-2">{dialect.map((p) => <Chip key={"d" + p.word + p.uk} {...p} />)}</div>
          </div>
          <div>
            <div className="mb-2 text-sm font-bold">Російською</div>
            <div className="flex flex-wrap gap-2">{ru.map((p) => <Chip key={"r" + p.word + p.uk} {...p} />)}</div>
          </div>
        </div>
      </div>
    </section>
  );
}
