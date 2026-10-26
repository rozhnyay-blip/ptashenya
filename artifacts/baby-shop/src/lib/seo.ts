import { useEffect } from "react";

const DEFAULT_TITLE = "Пташеня — товари для дітей з доставкою по Україні";
const DEFAULT_DESCRIPTION =
  "Іграшки, конструктори, книги, товари для догляду за малюком та творчості. Понад 20 000 товарів у наявності, щоденне оновлення складу, доставка Новою Поштою.";

interface SeoInput {
  title?: string | null;
  description?: string | null;
  image?: string | null;
  /** Path of the canonical page, e.g. "/product/12". */
  path?: string;
  /** schema.org object rendered as JSON-LD. */
  jsonLd?: Record<string, unknown> | null;
}

function setMeta(attr: "name" | "property", key: string, value: string | null) {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`);
  if (!value) {
    el?.remove();
    return;
  }
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.content = value;
}

function setLink(rel: string, href: string | null) {
  let el = document.head.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`);
  if (!href) {
    el?.remove();
    return;
  }
  if (!el) {
    el = document.createElement("link");
    el.rel = rel;
    document.head.appendChild(el);
  }
  el.href = href;
}

/** Sets page title, description, social tags, canonical URL and structured data for the current route. */
/** Organization + WebSite markup: gives Google the shop logo and the site search box. */
export function siteJsonLd(): Record<string, unknown> {
  const root = `${window.location.origin}${import.meta.env.BASE_URL.replace(/\/$/, "")}`;
  return {
    "@context": "https://schema.org",
    "@graph": [
      { "@type": "Organization", name: "Пташеня", url: `${root}/`, logo: `${root}/icon-512.png` },
      {
        "@type": "WebSite",
        name: "Пташеня",
        url: `${root}/`,
        potentialAction: {
          "@type": "SearchAction",
          target: `${root}/catalog?search={search_term_string}`,
          "query-input": "required name=search_term_string",
        },
      },
    ],
  };
}

export function useSeo({ title, description, image, path, jsonLd }: SeoInput) {
  const ld = jsonLd ? JSON.stringify(jsonLd) : null;
  useEffect(() => {
    const t = title || DEFAULT_TITLE;
    const d = description || DEFAULT_DESCRIPTION;
    document.title = t;
    setMeta("name", "description", d);
    setMeta("property", "og:title", t);
    setMeta("property", "og:description", d);
    const base = import.meta.env.BASE_URL.replace(/\/$/, "");
    const img = image || `${window.location.origin}${base}/og-image.jpg`;
    setMeta("property", "og:image", img);
    setMeta("name", "twitter:title", t);
    setMeta("name", "twitter:description", d);
    setMeta("name", "twitter:image", img);
    const url = path !== undefined ? `${window.location.origin}${base}${path}` : null;
    setMeta("property", "og:url", url);
    setLink("canonical", url);
    let script = document.getElementById("seo-jsonld");
    if (ld) {
      if (!script) {
        script = document.createElement("script");
        script.id = "seo-jsonld";
        script.setAttribute("type", "application/ld+json");
        document.head.appendChild(script);
      }
      script.textContent = ld;
    } else {
      script?.remove();
    }
  }, [title, description, image, path, ld]);
}
