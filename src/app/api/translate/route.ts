import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const LANGS = new Set(["hi", "en", "mr", "gu", "bn", "ta", "te", "kn", "ml", "pa"]);
/** Bodhan (FLORES-style) language codes. */
const BODHAN: Record<string, string> = { en: "eng_Latn", hi: "hin_Deva", mr: "mar_Deva", gu: "guj_Gujr", bn: "ben_Beng", ta: "tam_Taml", te: "tel_Telu", kn: "kan_Knda", ml: "mal_Mlym", pa: "pan_Guru" };

/**
 * Bodhan indic-translate (OpenAI-compatible chat endpoint). One text per request.
 * Translation goes through English, so we translate English → Indic, or Indic → English (source = the language the text is in).
 */
async function bodhan(texts: string[], target: string, source: string, key: string): Promise<string[]> {
  const base = (process.env.BODHAN_API_BASE || "https://api.bodhan.ai/v1").replace(/\/$/, "");
  const call = async (q: string, src: string, tgt: string) => {
    const r = await fetch(`${base}/chat/completions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: "indic-translate", messages: [{ role: "user", content: q }], source_language_code: src, target_language_code: tgt }),
    });
    const body = (await r.json().catch(() => ({}))) as { choices?: { message?: { content?: string } }[]; error?: { message?: string } | string };
    if (!r.ok) {
      const msg = typeof body.error === "string" ? body.error : body.error?.message;
      throw Object.assign(new Error(`Bodhan said ${r.status}${msg ? `: ${msg}` : ""}`), { status: r.status });
    }
    const out = body.choices?.[0]?.message?.content;
    if (typeof out !== "string" || !out.trim()) throw new Error("Bodhan returned no translation");
    return out.trim();
  };
  const src = BODHAN[source] ?? "eng_Latn", tgt = BODHAN[target];
  const out: string[] = new Array(texts.length);
  let next = 0;
  // small worker pool so a whole creative (~15 texts) doesn't hit the provider all at once
  await Promise.all(Array.from({ length: Math.min(4, texts.length) }, async () => {
    while (next < texts.length) {
      const i = next++;
      if (!texts[i].trim()) { out[i] = texts[i]; continue; }
      try { out[i] = await call(texts[i], src, tgt); }
      catch (e) {
        // if the API rejects FLORES-style codes, retry once with plain ISO codes (en / hi)
        const st = (e as { status?: number }).status;
        if (st === 400 || st === 422) out[i] = await call(texts[i], source, target); else throw e;
      }
    }
  }));
  return out;
}

async function cloud(texts: string[], target: string, key: string): Promise<string[]> {
  const r = await fetch(`https://translation.googleapis.com/language/translate/v2?key=${encodeURIComponent(key)}`, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ q: texts, target, format: "text" }),
  });
  if (!r.ok) throw new Error(`Translation service said ${r.status}`);
  const j = (await r.json()) as { data?: { translations?: { translatedText: string }[] } };
  const out = j.data?.translations?.map((t) => t.translatedText);
  if (!out || out.length !== texts.length) throw new Error("Unexpected translation response");
  return out;
}

async function keyless(texts: string[], target: string): Promise<string[]> {
  return Promise.all(texts.map(async (q) => {
    const u = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${target}&dt=t&q=${encodeURIComponent(q)}`;
    const r = await fetch(u);
    if (!r.ok) throw new Error(`Translation service said ${r.status}`);
    const j = (await r.json()) as unknown;
    const parts = Array.isArray(j) && Array.isArray(j[0]) ? (j[0] as unknown[][]).map((p) => String(p?.[0] ?? "")) : null;
    if (!parts) throw new Error("Unexpected translation response");
    return parts.join("");
  }));
}

export async function POST(req: Request) {
  try {
    const { texts, target, source } = (await req.json()) as { texts?: unknown; target?: unknown; source?: unknown };
    if (!Array.isArray(texts) || !texts.length || texts.length > 60 || texts.some((t) => typeof t !== "string")) {
      return NextResponse.json({ error: "texts[] required (max 60)" }, { status: 400 });
    }
    if (typeof target !== "string" || !LANGS.has(target)) return NextResponse.json({ error: "Unsupported language" }, { status: 400 });
    const list = texts as string[];
    if (list.join("").length > 12000) return NextResponse.json({ error: "Too much text" }, { status: 413 });
    const src = typeof source === "string" && LANGS.has(source) ? source : target === "en" ? "hi" : "en";
    const bk = process.env.BODHAN_API_KEY;
    const gk = process.env.GOOGLE_TRANSLATE_API_KEY;
    const out = bk ? await bodhan(list, target, src, bk) : gk ? await cloud(list, target, gk) : await keyless(list, target);
    return NextResponse.json({ texts: out, engine: bk ? "bodhan" : gk ? "google-cloud" : "google-web" });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Translation failed" }, { status: 502 });
  }
}
