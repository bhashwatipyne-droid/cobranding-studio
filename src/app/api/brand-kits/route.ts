import { NextResponse } from "next/server";
import { getOwner, requireDb } from "@/lib/server/owner";

export const dynamic = "force-dynamic";

export async function GET() {
  const r = requireDb();
  if (r.response) return r.response;
  const owner = await getOwner();
  const { data, error } = await r.c.from("cobrand_brand_kits").select("kit_key,data").eq("owner_id", owner);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ kits: (data ?? []).map((d) => d.data) });
}

export async function PUT(req: Request) {
  const r = requireDb();
  if (r.response) return r.response;
  const owner = await getOwner();
  const { kit } = (await req.json()) as { kit?: { key?: string; label?: string } };
  if (!kit?.key || typeof kit.key !== "string") return NextResponse.json({ error: "kit.key required" }, { status: 400 });
  const { error } = await r.c
    .from("cobrand_brand_kits")
    .upsert({ owner_id: owner, kit_key: kit.key, label: kit.label ?? kit.key, data: kit }, { onConflict: "owner_id,kit_key" });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
