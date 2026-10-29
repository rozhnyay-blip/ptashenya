/**
 * Words people actually type: Ukrainian, Russian and Transcarpathian/western dialect.
 * Product names come from the supplier in Ukrainian only, so the storefront search expands
 * every query word through these groups. The same list feeds the "як ще шукають" blocks
 * that put these words on pages for Google.
 *
 * stems: lower-case word beginnings without apostrophes; a query word matches a group when it
 * starts with one of them. The first stem must occur in Ukrainian product names.
 * Dialect words marked "dialect" come from the owner (коляска, памперси, цуцлик) or are
 * common western/Transcarpathian words.
 */
export type AliasKind = "ru" | "dialect";

export interface SynonymGroup {
  /** Ukrainian word as used in the catalog — what we search for. */
  uk: string;
  aliases: { word: string; kind: AliasKind }[];
  stems: string[];
}

const g = (uk: string, stems: string[], ru: string[], dialect: string[] = []): SynonymGroup => ({
  uk,
  stems,
  aliases: [...dialect.map((word) => ({ word, kind: "dialect" as const })), ...ru.map((word) => ({ word, kind: "ru" as const }))],
});

export const SYNONYM_GROUPS: SynonymGroup[] = [
  g("дитячий", ["дитяч", "детск", "детей", "дітей", "дитин", "малыш", "малюк"], ["детский", "для малышей"]),
  g("посуд", ["посуд"], ["посуда"]),
  g("підгузки", ["підгуз", "памперс", "пампер", "подгуз"], ["подгузники"], ["памперси"]),
  g("пустушка", ["пустушк", "соск", "цуцл", "цуцик", "смочк", "пустышк"], ["соска", "пустышка"], ["цуцлик", "смочок"]),
  g("візок", ["візок", "візк", "коляск", "колясоч"], ["коляска"], ["коляска"]),
  g("пляшечка", ["пляшеч", "бутилоч", "бутылоч"], ["бутылочка"]),
  g("горщик", ["горщик", "горшок", "горшк", "горшоч"], ["горшок"]),
  g("слинявчик", ["слинявч", "нагрудн", "слюнявч"], ["слюнявчик"]),
  g("іграшка", ["іграшк", "игрушк", "забавк", "бавк"], ["игрушка"], ["забавка"]),
  g("лялька", ["ляльк", "кукл", "куколк"], ["кукла"]),
  g("розмальовка", ["розмальовк", "раскраск"], ["раскраска"]),
  g("олівці", ["олів", "карандаш"], ["карандаши"]),
  g("зошит", ["зошит", "тетрад"], ["тетрадь"]),
  g("рюкзак", ["рюкзак", "ранец", "ранц", "портфел", "ранець"], ["ранец", "портфель"]),
  g("прорізувач", ["прорізувач", "прорезывател", "грызунок", "гризунок"], ["прорезыватель", "грызунок"]),
  g("термометр", ["термометр", "градусник"], ["градусник"]),
  g("серветки", ["серветк", "салфетк"], ["салфетки"]),
  g("мило", ["мило", "мыло"], ["мыло"]),
  g("пральний порошок", ["пральн", "стиральн"], ["стиральный порошок"]),
  g("м'яч", ["мяч", "мячик"], ["мяч"]),
  g("книжка", ["книжк", "книг", "книжечк"], ["книга"]),
  g("брязкальце", ["брязкальц", "погремушк", "погрем"], ["погремушка"]),
  g("рукавички", ["рукавич", "рукавиц", "варежк", "перчатк"], ["варежки", "перчатки"]),
  g("пелюшка", ["пелюшк", "пелюх", "пеленк", "пеленаль"], ["пеленка"]),
  g("велосипед", ["велосипед", "ровер", "лисапед"], ["велосипед"], ["ровер"]),
  g("пістолет", ["пістолет", "пистолет"], ["пистолет"]),
  g("літак", ["літак", "самолет", "самолёт"], ["самолет"]),
  g("гелікоптер", ["гелікоптер", "вертоліт", "вертольот", "вертолет"], ["вертолет"]),
  g("радіокерована", ["радіокер", "радиоуправ", "пульт"], ["на радиоуправлении"]),
  g("залізниця", ["залізниц", "железн"], ["железная дорога"]),
  g("ковдра", ["ковдр", "одеял"], ["одеяло"]),
  g("рушник", ["рушник", "полотенц"], ["полотенце"]),
  g("нічник", ["нічник", "ночник"], ["ночник"]),
  g("зубна щітка", ["щітк", "щетк", "щёт"], ["зубная щетка"]),
  g("ножиці", ["ножиц", "ножниц"], ["ножницы"]),
  g("гребінець", ["гребін", "гребен", "расческ", "гребешк"], ["расческа"]),
  g("фарби", ["фарб", "краск"], ["краски"]),
  g("пензлик", ["пензл", "кисточ", "кист"], ["кисточка"]),
  g("пластилін", ["пластилін", "пластилин"], ["пластилин"]),
  g("тісто для ліплення", ["тісто", "тесто"], ["тесто для лепки"]),
  g("наліпки", ["наліпк", "наклейк", "стікер", "стикер"], ["наклейки"]),
  g("поїльник", ["поїльник", "поильник", "непроливайк"], ["поильник", "непроливайка"]),
  g("тарілка", ["тарілк", "тарелк"], ["тарелка"]),
  g("ложечка", ["ложк", "ложеч"], ["ложка"]),
  g("мильні бульбашки", ["бульбашк", "пузыр", "пузир"], ["мыльные пузыри"]),
  g("повітряні кульки", ["кульк", "повітрян", "шарик", "воздушн"], ["воздушные шарики"]),
  g("гумка", ["гумк", "ластик", "стирачк"], ["ластик"]),
  g("лінійка", ["лінійк", "линейк"], ["линейка"]),
  g("точилка", ["точилк", "точил"], ["точилка"]),
  g("санки", ["санк", "санчат", "льодянк", "ледянк"], ["санки", "ледянка"]),
  g("ковзани", ["ковзан", "коньк"], ["коньки"]),
  g("басейн", ["басейн", "бассейн"], ["бассейн"]),
  g("парасолька", ["парасол", "зонт"], ["зонтик"]),
  g("дзига", ["дзиг", "юла", "волчок", "вовчок"], ["юла", "волчок"]),
  g("машинка", ["машинк", "машин", "автомобіл", "автомобил"], ["машинка"]),
  g("вологі серветки", ["вологі", "влажн"], ["влажные салфетки"]),
];

/** Lower-case, unify Russian-only letters and drop apostrophes so "м'яч", "мʼяч" and "мяч" match. */
export function normalizeWord(w: string): string {
  return w
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/['’ʼ`ʹ]/g, "")
    .replace(/[^\p{L}\p{N}\s-]/gu, " ")
    .trim();
}

export interface WordMatch {
  /** Substrings taken from what the customer typed (matched anywhere in the name). */
  typed: string[];
  /** Dictionary stems (matched only at the start of a word, so "соск" doesn't hit "присосках"). */
  stems: string[];
}

/** For one query word: the typed form (+ Russian-spelling variants) and the stems of matching groups. */
export function expandWord(word: string): WordMatch {
  const w = normalizeWord(word);
  const typed = new Set<string>([w]);
  const stems = new Set<string>();
  for (const grp of SYNONYM_GROUPS) {
    if (grp.stems.some((s) => w.startsWith(s) || (w.length >= 4 && s.startsWith(w)))) {
      for (const s of grp.stems) stems.add(s);
    }
  }
  // Russian spelling of words not in the list: ы/э → и/е, и → і ("пистолет" → "пістолет").
  const ru = w.replace(/ы/g, "и").replace(/э/g, "е").replace(/ъ/g, "");
  typed.add(ru);
  if (ru.includes("и")) typed.add(ru.replace(/и/g, "і"));
  // Crude stem for inflected Russian/Ukrainian words: "мыльные" → "мильн" (matches "мильні").
  if (w.length >= 6 && /[ыэъ]|(ые|ая|ое|ий|ой)$/.test(w)) typed.add(ru.slice(0, -2));
  return { typed: [...typed].filter((x) => x.length >= 2), stems: [...stems].filter((x) => /^[\p{L} ]+$/u.test(x)) };
}

/** Query → one WordMatch per word (max 6 words). */
export function expandQuery(q: string): WordMatch[] {
  return normalizeWord(q)
    .split(/\s+/)
    .filter((w) => w.length >= 2)
    .slice(0, 6)
    .map(expandWord)
    .filter((m) => m.typed.length > 0);
}
