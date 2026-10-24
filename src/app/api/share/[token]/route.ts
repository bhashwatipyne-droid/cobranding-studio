import { NextResponse } from "next/server";
import { requireDb } from "@/lib/server/owner";

export const dynamic = "force-dynamic";

/** Public, read-only: only returns a design whose owner switched sharing on. */
export async function GET(_req: Request, ctx: { params: Promise<{ token: string }> }) {
  const r = requireDb();
  if (r.response) return r.response;
  const { token } = await ctx.params;
  if (!/^[a-z0-9]{8,32}$/i.test(token)) return NextResponse.json({ error: "not found" }, { status: 404 });
  const { data, error } = await r.c
    .from("cobrand_designs")
    .select("title,content_type,size_id,pages,overlay,kit_key")
    .eq("share_token", token)
    .eq("is_shared", true)
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ design: { title: data.title, contentType: data.content_type, sizeId: data.size_id, pages: data.pages, overlay: data.overlay } });
}
