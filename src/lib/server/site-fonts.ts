import * as cheerio from "cheerio";
import { safeFetch } from "./ssrf";

export interface SiteFonts { heading: string | null; body: string | null; custom: { family: string; url: string }[] }

const GENERIC = new Set(["serif", "sans-serif", "monospace", "cursive", "fantasy", "system-ui", "ui-sans-serif", "ui-serif", "ui-monospace", "inherit", "initial", "unset", "-apple-system", "blinkmacsystemfont", "arial", "helvetica", "helvetica neue", "times new roman", "times", "verdana", "tahoma", "segoe ui", "roboto condensed fallback"]);
const ICONY = /(icon|awesome|glyph|symbol|swiper|slick|fontello|material|emoji|dingbat)/i;

const clean = (s: string) => s.trim().replace(/^['"]|['"]$/g, "").trim();
/** First usable family in a font-family list, e.g. `"Lobster", cursive` → Lobster. */
function firstFamily(list: string): string | null {
  for (const part of list.split(",")) {
    const f = clean(part);
    if (!f || f.startsWith("var(") || GENERIC.has(f.toLowerCase()) || ICONY.test(f)) continue;
    return f.replace(/\s+(fallback|override)$/i, "");
  }
  return null;
}

/** Crawl inline + linked CSS of the page and work out the heading and body fonts. */
export async function detectSiteFonts(html: string, base: string): Promise<SiteFonts> {
  const $ = cheerio.load(html);
  let css = $("style").toArray().map((e) => $(e).text()).join("\n");
  const googleFamilies: string[] = [];

  const hrefs: string[] = [];
  $('link[rel~="stylesheet"], link[rel="preload"][as="style"]').each((_, e) => {
    const h = $(e).attr("href");
    if (!h) return;
    let abs: string; try { abs = new URL(h, base).toString(); } catch { return; }
    if (/fonts\.googleapis\.com/.test(abs)) {
      const u = new URL(abs);
      for (const p of u.searchParams.getAll("family")) {
        const name = p.split(":")[0].replace(/\+/g, " ").trim();
        if (name && !googleFamilies.includes(name)) googleFamilies.push(name);
      }
    } else hrefs.push(abs);
  });
  // theme stylesheets first (they usually carry the font rules); cap the work
  hrefs.sort((a, b) => Number(/theme|base|style|main|app/i.test(b)) - Number(/theme|base|style|main|app/i.test(a)));
  const sheets = await Promise.all(hrefs.slice(0, 5).map(async (h) => {
    try { return (await safeFetch(h, { maxBytes: 800_000, accept: "text/css,*/*" })).buffer.toString("utf8"); } catch { return ""; }
  }));
  css += "\n" + sheets.join("\n");
  css = css.replace(/\/\*[\s\S]*?\*\//g, "");

  // @font-face → family + best file url (woff2 > woff > ttf/otf)
  const faces = new Map<string, string>();
  for (const m of css.matchAll(/@font-face\s*\{([^}]*)\}/gi)) {
    const body = m[1];
    const fam = body.match(/font-family\s*:\s*([^;]+)/i)?.[1];
    if (!fam) continue;
    const name = clean(fam);
    if (ICONY.test(name)) continue;
    const urls = [...body.matchAll(/url\(\s*['"]?([^'")]+)['"]?\s*\)/gi)].map((u) => u[1]).filter((u) => /\.(woff2?|ttf|otf)(\?|#|$)/i.test(u));
    const pick = urls.find((u) => /\.woff2(\?|#|$)/i.test(u)) ?? urls.find((u) => /\.woff(\?|#|$)/i.test(u)) ?? urls[0];
    if (!pick) continue;
    let abs: string; try { abs = new URL(pick, base).toString(); } catch { continue; }
    if (!faces.has(name)) faces.set(name, abs);
  }

  const fromRules = (selRe: RegExp): string | null => {
    for (const m of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
      if (!selRe.test(m[1])) continue;
      const decl = m[2].match(/(?:^|;)\s*font-family\s*:\s*([^;]+)/i)?.[1];
      if (!decl) continue;
      const f = firstFamily(decl);
      if (f) return f;
    }
    return null;
  };
  const fromVar = (names: RegExp): string | null => {
    for (const m of css.matchAll(/(--[\w-]+)\s*:\s*([^;}]+)/g)) {
      if (!names.test(m[1])) continue;
      const f = firstFamily(m[2]);
      if (f) return f;
    }
    return null;
  };

  let heading =
    fromVar(/(font|type).*(head|title|display)|(head|title|display).*font/i) ??
    fromRules(/(^|[\s,])(h1|h2|\.h1|\.h2|\.heading|\.title|\.hero[\w-]*)(?![\w-])/i);
  let body =
    fromVar(/(font|type).*(body|text|base|paragraph)|(body|text|base).*font/i) ??
    fromRules(/(^|[\s,])(body|html|:root)(?![\w-])/i);

  const pool = [...faces.keys(), ...googleFamilies];
  heading = heading ?? pool[0] ?? null;
  body = body ?? pool.find((f) => f !== heading) ?? null;

  const custom = [heading, body]
    .filter((f, i, a): f is string => !!f && a.indexOf(f) === i && faces.has(f))
    .map((family) => ({ family, url: faces.get(family)! }));
  return { heading, body, custom };
}
