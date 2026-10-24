"use client";
/**
 * Persistence: Supabase via our /api routes. If the server isn't configured (no service key) or the
 * request fails, everything transparently falls back to localStorage so the studio stays usable.
 */
import type { BrandKit, DesignDoc, TemplateDef } from "./types";

export type PersistMode = "cloud" | "local" | "unknown";

class ApiError extends Error {
  constructor(public status: number, msg: string) { super(msg); }
}

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, { ...init, headers: { "content-type": "application/json", ...(init?.headers ?? {}) }, credentials: "same-origin" });
  if (!res.ok) {
    let m = res.statusText;
    try { m = (await res.json()).message ?? (await res.clone().json()).error ?? m; } catch { /* ignore */ }
    throw new ApiError(res.status, m);
  }
  return (await res.json()) as T;
}

const LS = {
  get<T>(k: string, d: T): T { try { const v = localStorage.getItem("cobrand:" + k); return v ? (JSON.parse(v) as T) : d; } catch { return d; } },
  set(k: string, v: unknown) { try { localStorage.setItem("cobrand:" + k, JSON.stringify(v)); } catch { /* quota */ } },
};

let mode: PersistMode = "unknown";
const listeners = new Set<(m: PersistMode) => void>();
export const getMode = () => mode;
export const onMode = (fn: (m: PersistMode) => void) => { listeners.add(fn); return () => { listeners.delete(fn); }; };
const setMode = (m: PersistMode) => { if (m !== mode) { mode = m; listeners.forEach((f) => f(m)); } };

async function tryCloud<T>(fn: () => Promise<T>): Promise<{ ok: true; v: T } | { ok: false }> {
  try { const v = await fn(); setMode("cloud"); return { ok: true, v }; }
  catch { setMode("local"); return { ok: false }; }
}

// ── brand kits ──
export async function loadKits(): Promise<BrandKit[]> {
  const r = await tryCloud(() => api<{ kits: BrandKit[] }>("/api/brand-kits"));
  if (r.ok) { LS.set("kits", r.v.kits); return r.v.kits; }
  return LS.get<BrandKit[]>("kits", []);
}
export async function saveKit(kit: BrandKit) {
  const all = LS.get<BrandKit[]>("kits", []).filter((k) => k.key !== kit.key);
  LS.set("kits", [...all, kit]);
  await tryCloud(() => api("/api/brand-kits", { method: "PUT", body: JSON.stringify({ kit }) }));
}

// ── designs ──
export interface DesignListItem { id: string; title: string; templateId: string; contentType: string; sizeId: string; kitKey: string; status: string; thumbnail?: string | null; updatedAt: string }

export async function listDesigns(): Promise<DesignListItem[]> {
  const r = await tryCloud(() => api<{ designs: DesignListItem[] }>("/api/designs"));
  if (r.ok) return r.v.designs;
  return LS.get<(DesignDoc & { thumbnail?: string })[]>("designs", [])
    .map((d) => ({ id: d.id, title: d.title, templateId: d.templateId, contentType: d.contentType, sizeId: d.sizeId, kitKey: d.kitKey, status: d.status, thumbnail: d.thumbnail, updatedAt: d.updatedAt ?? "" }))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}
export async function loadDesign(id: string): Promise<DesignDoc | null> {
  const r = await tryCloud(() => api<{ design: DesignDoc }>(`/api/designs?id=${encodeURIComponent(id)}`));
  if (r.ok) return r.v.design;
  return LS.get<DesignDoc[]>("designs", []).find((d) => d.id === id) ?? null;
}
const isUuid = (s: string) => /^[0-9a-f-]{36}$/i.test(s);

/** Returns the id the design is stored under (cloud assigns a uuid on first save). */
export async function saveDesign(doc: DesignDoc, thumbnail?: string | null): Promise<string> {
  const stamped = { ...doc, updatedAt: new Date().toISOString() };
  const r = await tryCloud(() => api<{ id: string }>("/api/designs", { method: "PUT", body: JSON.stringify({ doc: stamped, thumbnail }) }));
  const id = r.ok ? r.v.id : doc.id;
  const all = LS.get<(DesignDoc & { thumbnail?: string })[]>("designs", []).filter((d) => d.id !== doc.id && d.id !== id);
  // local copy keeps the page JSON only when we are offline (cloud holds the real copy)
  if (!r.ok) LS.set("designs", [{ ...stamped, id, thumbnail: thumbnail ?? undefined }, ...all].slice(0, 12));
  return id;
}
export async function deleteDesign(id: string) {
  LS.set("designs", LS.get<DesignDoc[]>("designs", []).filter((d) => d.id !== id));
  if (isUuid(id)) await tryCloud(() => api(`/api/designs?id=${id}`, { method: "DELETE" }));
}
export async function setShare(id: string, on: boolean): Promise<{ isShared: boolean; shareToken: string | null } | null> {
  if (!isUuid(id)) return null;
  const r = await tryCloud(() => api<{ isShared: boolean; shareToken: string | null }>("/api/designs", { method: "PATCH", body: JSON.stringify({ id, share: on }) }));
  return r.ok ? r.v : null;
}

// ── custom templates ──
export async function listCustomTemplates(): Promise<TemplateDef[]> {
  const r = await tryCloud(() => api<{ templates: TemplateDef[] }>("/api/templates"));
  if (r.ok) return r.v.templates;
  return LS.get<TemplateDef[]>("templates", []);
}
export async function saveCustomTemplate(t: Omit<TemplateDef, "id"> & { doc: DesignDoc }): Promise<TemplateDef> {
  const r = await tryCloud(() => api<{ id: string }>("/api/templates", { method: "POST", body: JSON.stringify(t) }));
  const saved: TemplateDef = { ...t, id: r.ok ? r.v.id : `local_${Date.now()}`, custom: true };
  if (!r.ok) LS.set("templates", [saved, ...LS.get<TemplateDef[]>("templates", [])].slice(0, 8));
  return saved;
}
