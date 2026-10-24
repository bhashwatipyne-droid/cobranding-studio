"use client";
import { FabricObject, Group, StaticCanvas, Textbox } from "fabric";
import JSZip from "jszip";
import { jsPDF } from "jspdf";
import { configureFabric, ensureFont } from "./fabric-setup";
import { makeLogo, logoBox } from "./layouts";
import { combineDetails } from "./templates";
import type { BrandKit, ContentType, DesignDoc } from "./types";

export type ExportFormat = "png" | "jpg" | "pdf";
export type ResolutionTier = "high" | "medium" | "low";
export const TIER_SCALE: Record<ResolutionTier, number> = { high: 1, medium: 0.67, low: 0.4 };

export interface OverlayOpts { header: boolean; footer: boolean; kit: BrandKit; palette: [string, string] }

/** Video branding bars (FR-22): logo + company details, pinned top and/or bottom. */
async function overlayBar(kit: BrandKit, w: number, h: number, where: "top" | "bottom", palette: [string, string]): Promise<FabricObject[]> {
  const sh = Math.max(Math.round(Math.min(w, h) * 0.085), 60);
  const top = where === "top" ? 0 : h - sh;
  const { Rect, Gradient } = await import("fabric");
  const bar = new Rect({
    left: 0, top, width: w, height: sh,
    fill: new Gradient({ type: "linear", gradientUnits: "pixels", coords: { x1: 0, y1: 0, x2: w, y2: 0 }, colorStops: [{ offset: 0, color: palette[0] }, { offset: 1, color: palette[1] }] }),
  });
  const lb = logoBox(w, h);
  const bh = Math.round(sh * 0.7);
  const bw = Math.round(lb.w * (bh / lb.h));
  const logo: Group = await makeLogo(kit, true, bw, bh);
  const m = Math.round(w * 0.04);
  logo.set({ left: m, top: top + (sh - bh) / 2 });
  await ensureFont(kit.fontBody);
  const fs = Math.max(16, Math.round(sh * 0.3));
  const details = new Textbox(combineDetails(kit) || kit.companyName, {
    left: m + bw + m * 0.6, top: top + (sh - fs * 1.2) / 2, width: w - (m * 2 + bw + m * 0.6), fontSize: fs,
    fill: "#FFFFFF", fontFamily: kit.fontBody, lineHeight: 1.2,
  });
  return [bar, logo, details];
}

export async function renderPage(
  json: unknown, w: number, h: number,
  opts: { format?: "png" | "jpeg"; multiplier?: number; quality?: number; overlay?: OverlayOpts | null } = {},
): Promise<string> {
  configureFabric();
  const fam = new Set<string>();
  const walk = (o: unknown) => {
    const r = o as { fontFamily?: string; objects?: unknown[] } | null;
    if (!r || typeof r !== "object") return;
    if (r.fontFamily) fam.add(r.fontFamily);
    r.objects?.forEach(walk);
  };
  walk(json);
  await Promise.all([...fam].map((f) => ensureFont(f)));

  const el = document.createElement("canvas");
  const sc = new StaticCanvas(el, { width: w, height: h, enableRetinaScaling: false });
  await sc.loadFromJSON(json as object);
  if (opts.overlay) {
    const { kit, palette } = opts.overlay;
    const objs: FabricObject[] = [];
    if (opts.overlay.header) objs.push(...(await overlayBar(kit, w, h, "top", palette)));
    if (opts.overlay.footer) objs.push(...(await overlayBar(kit, w, h, "bottom", palette)));
    sc.add(...objs);
  }
  sc.renderAll();
  const url = sc.toDataURL({ format: opts.format ?? "png", multiplier: opts.multiplier ?? 1, quality: opts.quality ?? 0.92, enableRetinaScaling: false });
  await sc.dispose();
  return url;
}

function triggerDownload(href: string, filename: string) {
  const a = document.createElement("a");
  a.href = href;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

const safeName = (s: string) => (s || "design").replace(/[^\w\-]+/g, "_").slice(0, 60);

export interface DownloadArgs {
  doc: DesignDoc;
  /** current page JSON from the live canvas (so unsaved edits are included) */
  currentJson: unknown;
  currentIndex: number;
  w: number;
  h: number;
  format: ExportFormat;
  tier: ResolutionTier;
  all: boolean;
  overlay: OverlayOpts | null;
}

export async function downloadDesign(a: DownloadArgs): Promise<void> {
  const pages = a.doc.pages.map((p, i) => ({ id: p.id, json: i === a.currentIndex ? a.currentJson : p.json }));
  const sel = a.all ? pages : [pages[a.currentIndex]];
  const mult = TIER_SCALE[a.tier];
  const base = safeName(a.doc.title);
  const names = (i: number) => {
    const n = pages.findIndex((p) => p.id === sel[i].id);
    if (a.doc.contentType === "video") return n === 0 ? "first-frame" : "last-frame";
    return sel.length > 1 || a.doc.contentType === "carousel" ? `slide-${n + 1}` : "";
  };

  if (a.format === "pdf") {
    const pw = Math.round(a.w * mult), ph = Math.round(a.h * mult);
    const orient = pw >= ph ? "landscape" : "portrait";
    const pdf = new jsPDF({ orientation: orient, unit: "px", format: [pw, ph], hotfixes: ["px_scaling"], compress: true });
    for (let i = 0; i < sel.length; i++) {
      const url = await renderPage(sel[i].json, a.w, a.h, { format: "jpeg", multiplier: mult, quality: 0.95, overlay: a.overlay });
      if (i > 0) pdf.addPage([pw, ph], orient);
      pdf.addImage(url, "JPEG", 0, 0, pw, ph);
    }
    pdf.save(`${base}.pdf`);
    return;
  }

  const fmt = a.format === "png" ? "png" : "jpeg";
  const ext = a.format === "png" ? "png" : "jpg";
  const urls: string[] = [];
  for (const p of sel) urls.push(await renderPage(p.json, a.w, a.h, { format: fmt, multiplier: mult, quality: 0.92, overlay: a.overlay }));
  if (urls.length === 1) {
    const n = names(0);
    triggerDownload(urls[0], `${base}${n ? "-" + n : ""}.${ext}`);
    return;
  }
  const zip = new JSZip();
  urls.forEach((u, i) => zip.file(`${base}-${names(i)}.${ext}`, u.split(",")[1], { base64: true }));
  const blob = await zip.generateAsync({ type: "blob" });
  const href = URL.createObjectURL(blob);
  triggerDownload(href, `${base}.zip`);
  setTimeout(() => URL.revokeObjectURL(href), 5000);
}

export async function renderThumb(json: unknown, w: number, h: number, targetW = 160): Promise<string> {
  return renderPage(json, w, h, { format: "jpeg", multiplier: targetW / w, quality: 0.6 });
}

export type { ContentType };
