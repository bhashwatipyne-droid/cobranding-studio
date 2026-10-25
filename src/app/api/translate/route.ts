import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const LANGS = new Set(["hi", "en", "mr", "gu", "bn", "ta", "te", "kn", "ml", "pa"]);

/** Google Cloud Translation when GOOGLE_TRANSLATE_API_KEY is set; otherwise Google's keyless web endpoint (fine for trials, not for production volume). */
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
    const { texts, target } = (await req.json()) as { texts?: unknown; target?: unknown };
    if (!Array.isArray(texts) || !texts.length || texts.length > 60 || texts.some((t) => typeof t !== "string")) {
      return NextResponse.json({ error: "texts[] required (max 60)" }, { status: 400 });
    }
    if (typeof target !== "string" || !LANGS.has(target)) return NextResponse.json({ error: "Unsupported language" }, { status: 400 });
    const list = texts as string[];
    if (list.join("").length > 12000) return NextResponse.json({ error: "Too much text" }, { status: 413 });
    const key = process.env.GOOGLE_TRANSLATE_API_KEY;
    const out = key ? await cloud(list, target, key) : await keyless(list, target);
    return NextResponse.json({ texts: out, engine: key ? "google-cloud" : "google-web" });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Translation failed" }, { status: 502 });
  }
}
