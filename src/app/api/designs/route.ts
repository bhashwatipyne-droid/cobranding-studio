import { NextResponse } from "next/server";
import { getOwner, requireDb } from "@/lib/server/owner";

export const dynamic = "force-dynamic";

const toDoc = (r: Record<string, unknown>) => ({
  id: r.id, title: r.title, templateId: r.template_id, contentType: r.content_type, sizeId: r.size_id,
  kitKey: r.kit_key, pages: r.pages, overlay: r.overlay, status: r.status, isShared: r.is_shared,
  shareToken: r.share_token, updatedAt: r.updated_at, thumbnail: r.thumbnail,
});

export async function GET(req: Request) {
  const r = requireDb();
  if (r.response) return r.response;
  const owner = await getOwner();
  const id = new URL(req.url).searchParams.get("id");
  if (id) {
    const { data, error } = await r.c.from("cobrand_designs").select("*").eq("owner_id", owner).eq("id", id).maybeSingle();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return data ? NextResponse.json({ design: toDoc(data) }) : NextResponse.json({ error: "not found" }, { status: 404 });
  }
  // list view: no page JSON (can be large)
  const { data, error } = await r.c
    .from("cobrand_designs")
    .select("id,title,template_id,content_type,size_id,kit_key,status,thumbnail,updated_at")
    .eq("owner_id", owner)
    .order("updated_at", { ascending: false })
    .limit(60);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({
    designs: (data ?? []).map((d) => ({
      id: d.id, title: d.title, templateId: d.template_id, contentType: d.content_type, sizeId: d.size_id,
      kitKey: d.kit_key, status: d.status, thumbnail: d.thumbnail, updatedAt: d.updated_at,
    })),
  });
}

const isUuid = (s: unknown): s is string => typeof s === "string" && /^[0-9a-f-]{36}$/i.test(s);

export async function PUT(req: Request) {
  const r = requireDb();
  if (r.response) return r.response;
  const owner = await getOwner();
  const body = (await req.json()) as { doc?: Record<string, unknown>; thumbnail?: string | null };
  const d = body.doc;
  if (!d) return NextResponse.json({ error: "doc required" }, { status: 400 });
  const row = {
    owner_id: owner,
    title: String(d.title ?? "Untitled post").slice(0, 200),
    template_id: (d.templateId as string) ?? null,
    content_type: d.contentType ?? "single",
    size_id: d.sizeId ?? "post",
    kit_key: (d.kitKey as string) ?? null,
    pages: d.pages ?? [],
    overlay: d.overlay ?? { header: false, footer: false },
    status: d.status === "library" ? "library" : "draft",
    ...(body.thumbnail ? { thumbnail: body.thumbnail } : {}),
  };
  if (isUuid(d.id)) {
    const { data, error } = await r.c.from("cobrand_designs").update(row).eq("id", d.id).eq("owner_id", owner).select("id").maybeSingle();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (data) return NextResponse.json({ id: data.id });
  }
  const { data, error } = await r.c.from("cobrand_designs").insert(row).select("id").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ id: data.id });
}

/** PATCH { id, share: boolean } — turn the read-only share link on/off */
export async function PATCH(req: Request) {
  const r = requireDb();
  if (r.response) return r.response;
  const owner = await getOwner();
  const { id, share } = (await req.json()) as { id?: string; share?: boolean };
  if (!isUuid(id)) return NextResponse.json({ error: "valid id required" }, { status: 400 });
  const token = share ? crypto.randomUUID().replace(/-/g, "").slice(0, 16) : null;
  const { data: cur } = await r.c.from("cobrand_designs").select("share_token").eq("id", id).eq("owner_id", owner).maybeSingle();
  const keep = cur?.share_token ?? token;
  const { error } = await r.c
    .from("cobrand_designs")
    .update({ is_shared: !!share, share_token: share ? keep : cur?.share_token ?? null })
    .eq("id", id)
    .eq("owner_id", owner);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ isShared: !!share, shareToken: share ? keep : cur?.share_token ?? null });
}

export async function DELETE(req: Request) {
  const r = requireDb();
  if (r.response) return r.response;
  const owner = await getOwner();
  const id = new URL(req.url).searchParams.get("id");
  if (!isUuid(id)) return NextResponse.json({ error: "valid id required" }, { status: 400 });
  const { error } = await r.c.from("cobrand_designs").delete().eq("id", id).eq("owner_id", owner);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
