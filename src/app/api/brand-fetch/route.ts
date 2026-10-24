import * as cheerio from "cheerio";
import { NextResponse } from "next/server";
import { safeFetch } from "@/lib/server/ssrf";
import { detectSiteFonts } from "@/lib/server/site-fonts";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

function abs(href: string | undefined, base: string) {
  if (!href) return null;
  try { return new URL(href, base).toString(); } catch { return null; }
}

/**
 * Quick setup from website (FR-S01): crawl the real page, find the logo, theme colour and contact details.
 * The client then vectorizes the logo and extracts the palette, and shows everything for review before saving.
 */
export async function POST(req: Request) {
  try {
    const { url: raw } = (await req.json()) as { url?: string };
    if (!raw || typeof raw !== "string") return NextResponse.json({ error: "url required" }, { status: 400 });
    const input = /^https?:\/\//i.test(raw.trim()) ? raw.trim() : `https://${raw.trim()}`;

    const page = await safeFetch(input, { maxBytes: 2_000_000, accept: "text/html,application/xhtml+xml" });
    const $ = cheerio.load(page.buffer.toString("utf8"));
    const base = page.url;

    const siteName = $('meta[property="og:site_name"]').attr("content")?.trim();
    const title = $("title").first().text().trim().split(/\s[|\-–—·]\s/)[0]?.trim();
    const themeColor = $('meta[name="theme-color"]').attr("content") || $('meta[name="msapplication-TileColor"]').attr("content") || null;

    const cands: string[] = [];
    const push = (u: string | null) => { if (u && !cands.includes(u)) cands.push(u); };
    $('link[rel~="icon"][type="image/svg+xml"], link[rel~="icon"][href$=".svg"]').each((_, e) => push(abs($(e).attr("href"), base)));
    $("header img, nav img, a[href='/'] img, img").each((_, e) => {
      const el = $(e);
      const sig = `${el.attr("class") ?? ""} ${el.attr("id") ?? ""} ${el.attr("alt") ?? ""} ${el.attr("src") ?? ""}`.toLowerCase();
      if (sig.includes("logo")) push(abs(el.attr("src") || el.attr("data-src"), base));
    });
    const touch = $('link[rel="apple-touch-icon"], link[rel="apple-touch-icon-precomposed"]').toArray()
      .sort((a, b) => parseInt($(b).attr("sizes") ?? "0") - parseInt($(a).attr("sizes") ?? "0"));
    touch.forEach((e) => push(abs($(e).attr("href"), base)));
    $('link[rel~="icon"]').each((_, e) => push(abs($(e).attr("href"), base)));
    push(abs($('meta[property="og:image"]').attr("content"), base));

    let logoDataUrl: string | null = null;
    for (const c of cands.slice(0, 6)) {
      try {
        const img = await safeFetch(c, { maxBytes: 1_500_000, accept: "image/*" });
        let ct = img.contentType.split(";")[0].trim().toLowerCase();
        if (!ct.startsWith("image/")) {
          if (/\.svg(\?|$)/i.test(c)) ct = "image/svg+xml"; else continue;
        }
        logoDataUrl = `data:${ct};base64,${img.buffer.toString("base64")}`;
        break;
      } catch { /* try the next candidate */ }
    }

    const email = $('a[href^="mailto:"]').first().attr("href")?.replace(/^mailto:/i, "").split("?")[0] ?? "";
    const mobile = $('a[href^="tel:"]').first().attr("href")?.replace(/^tel:/i, "") ?? "";
    const host = new URL(base).hostname.replace(/^www\./, "");

    const fonts = await detectSiteFonts(page.buffer.toString("utf8"), base).catch(() => ({ heading: null, body: null, custom: [] }));

    return NextResponse.json({
      fonts,
      domain: host,
      name: siteName || title || host.split(".")[0],
      themeColor: /^#[0-9a-f]{3,8}$/i.test(themeColor ?? "") ? themeColor : null,
      email, mobile, website: host,
      logoDataUrl,
      logoFound: !!logoDataUrl,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Fetch failed";
    return NextResponse.json({ error: msg }, { status: 422 });
  }
}
