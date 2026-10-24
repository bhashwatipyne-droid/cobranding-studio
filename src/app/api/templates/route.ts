import { NextResponse } from "next/server";
import { getOwner, requireDb } from "@/lib/server/owner";

export const dynamic = "force-dynamic";

export async function GET() {
  const r = requireDb();
  if (r.response) return r.response;
  const owner = await getOwner();
  const { data, error } = await r.c.from("cobrand_templates").select("*").eq("owner_id", owner).order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({
    templates: (data ?? []).map((t) => ({
      id: t.id, name: t.name, category: t.category, topic: t.topic, layout: t.layout, palette: t.palette,
      doc: t.doc, thumbnail: t.thumbnail, custom: true, headline: "", sub: "",
    })),
  });
}

export async function POST(req: Request) {
  const r = requireDb();
  if (r.response) return r.response;
  const owner = await getOwner();
  const b = (await req.json()) as Record<string, unknown>;
  if (!b.name || !b.doc) return NextResponse.json({ error: "name and doc required" }, { status: 400 });
  const { data, error } = await r.c
    .from("cobrand_templates")
    .insert({ owner_id: owner, name: String(b.name).slice(0, 120), category: b.category ?? "Post", topic: b.topic ?? "Mutual Funds", layout: b.layout ?? "hero", palette: b.palette ?? ["#2B2BB5", "#0D0D5C"], doc: b.doc, thumbnail: b.thumbnail ?? null })
    .select("id")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ id: data.id });
}
