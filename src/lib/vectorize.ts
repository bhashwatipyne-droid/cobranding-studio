"use client";
/**
 * Logo pipeline (FR-S02 / S03 / S04):
 *  - detect SVG vs raster
 *  - raster → SVG tracing (ImageTracer), with background-plate removal
 *  - palette extraction from the vector fills (or pixels as a fallback)
 */
import ImageTracer from "imagetracerjs";

export interface LogoResult {
  /** SVG markup ready for the canvas (the traced SVG, or the user's own SVG) */
  svg: string;
  /** Raster source (data URL) if the input wasn't vector; null for native SVG */
  original: string | null;
  wasVector: boolean;
}

const MAX_TRACE_PX = 520;

export function isSvgDataUrl(url: string) {
  return /^data:image\/svg\+xml/i.test(url);
}

export function dataUrlToText(url: string): string {
  const comma = url.indexOf(",");
  const meta = url.slice(0, comma);
  const body = url.slice(comma + 1);
  return /;base64/i.test(meta) ? decodeURIComponent(escape(atob(body))) : decodeURIComponent(body);
}

export function svgToDataUrl(svg: string) {
  return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
}

export function fileToDataUrl(file: Blob): Promise<string> {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result as string);
    r.onerror = () => rej(r.error);
    r.readAsDataURL(file);
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => res(img);
    img.onerror = () => rej(new Error("Could not read that image"));
    img.src = src;
  });
}

/** Sanitise an uploaded SVG: strip scripts, event handlers and external refs. */
export function sanitizeSvg(svg: string): string {
  const doc = new DOMParser().parseFromString(svg, "image/svg+xml");
  if (doc.querySelector("parsererror") || doc.documentElement.nodeName.toLowerCase() !== "svg") {
    throw new Error("That SVG could not be parsed");
  }
  doc.querySelectorAll("script, foreignObject, iframe, object, embed").forEach((n) => n.remove());
  doc.querySelectorAll("*").forEach((el) => {
    [...el.attributes].forEach((a) => {
      const n = a.name.toLowerCase();
      const v = a.value.trim().toLowerCase();
      if (n.startsWith("on") || ((n === "href" || n === "xlink:href") && !v.startsWith("#") && !v.startsWith("data:image/"))) {
        el.removeAttribute(a.name);
      }
    });
  });
  const root = doc.documentElement;
  if (!root.getAttribute("viewBox")) {
    const w = parseFloat(root.getAttribute("width") || "");
    const h = parseFloat(root.getAttribute("height") || "");
    if (w > 0 && h > 0) root.setAttribute("viewBox", `0 0 ${w} ${h}`);
  }
  return new XMLSerializer().serializeToString(doc);
}

const nearWhite = (r: number, g: number, b: number) => r > 244 && g > 244 && b > 244;

function parseColor(c: string): [number, number, number] | null {
  c = c.trim().toLowerCase();
  let m = c.match(/^rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)/);
  if (m) return [+m[1], +m[2], +m[3]];
  m = c.match(/^#([0-9a-f]{3})$/);
  if (m) return [...m[1]].map((x) => parseInt(x + x, 16)) as [number, number, number];
  m = c.match(/^#([0-9a-f]{6})/);
  if (m) return [parseInt(m[1].slice(0, 2), 16), parseInt(m[1].slice(2, 4), 16), parseInt(m[1].slice(4, 6), 16)];
  return null;
}

/** Trace a raster logo into SVG. Drops the solid backing plate when the image has a white/transparent background. */
export async function vectorizeRaster(dataUrl: string): Promise<string> {
  const img = await loadImage(dataUrl);
  const scale = Math.min(1, MAX_TRACE_PX / Math.max(img.naturalWidth, img.naturalHeight));
  const w = Math.max(8, Math.round(img.naturalWidth * scale));
  const h = Math.max(8, Math.round(img.naturalHeight * scale));
  const cv = document.createElement("canvas");
  cv.width = w;
  cv.height = h;
  const ctx = cv.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(img, 0, 0, w, h);
  const data = ctx.getImageData(0, 0, w, h);

  // Does the artwork sit on a white / transparent plate? Sample the four corners.
  const px = (x: number, y: number) => {
    const i = (y * w + x) * 4;
    return [data.data[i], data.data[i + 1], data.data[i + 2], data.data[i + 3]] as const;
  };
  const corners = [px(0, 0), px(w - 1, 0), px(0, h - 1), px(w - 1, h - 1)];
  const plateIsBlank = corners.every(([r, g, b, a]) => a < 20 || nearWhite(r, g, b));

  // 1) server tracer (vtracer) — cleaner curves; 2) in-browser imagetracer if the API is unavailable
  let raw: string | null = null;
  try {
    const flat = document.createElement("canvas");
    flat.width = w; flat.height = h;
    const fctx = flat.getContext("2d")!;
    fctx.fillStyle = "#FFFFFF"; fctx.fillRect(0, 0, w, h); fctx.drawImage(img, 0, 0, w, h);
    const res = await fetch("/api/vectorize", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ dataUrl: flat.toDataURL("image/png") }) });
    if (res.ok) raw = ((await res.json()) as { svg?: string }).svg ?? null;
  } catch { /* fall back */ }
  if (!raw) raw = ImageTracer.imagedataToSVG(data, {
    numberofcolors: 10,
    colorsampling: 2,
    ltres: 1,
    qtres: 1,
    pathomit: 10,
    blurradius: 0,
    strokewidth: 0,
    roundcoords: 1,
    viewbox: true,
    scale: 1,
    desc: false,
  });

  const doc = new DOMParser().parseFromString(raw, "image/svg+xml");
  doc.querySelectorAll("path").forEach((p) => {
    const op = parseFloat(p.getAttribute("opacity") ?? "1");
    const fill = parseColor(p.getAttribute("fill") || "");
    if (op < 0.05) p.remove();
    else if (plateIsBlank && fill && nearWhite(...fill)) p.remove();
  });
  const root = doc.documentElement;
  root.removeAttribute("width");
  root.removeAttribute("height");
  if (!root.getAttribute("viewBox")) root.setAttribute("viewBox", `0 0 ${w} ${h}`);
  if (!doc.querySelector("path")) throw new Error("Tracing produced no shapes — try a higher-contrast logo");
  return new XMLSerializer().serializeToString(doc);
}

/** Downscale a raster before it's stored, so brand kits stay small in the DB. */
export async function shrinkRaster(dataUrl: string, max = 600): Promise<string> {
  const img = await loadImage(dataUrl);
  const s = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
  if (s === 1 && dataUrl.length < 400_000) return dataUrl;
  const cv = document.createElement("canvas");
  cv.width = Math.round(img.naturalWidth * s);
  cv.height = Math.round(img.naturalHeight * s);
  cv.getContext("2d")!.drawImage(img, 0, 0, cv.width, cv.height);
  return cv.toDataURL("image/png");
}

/** Single entry point: file/data URL in, canvas-ready logo out. */
export async function processLogoDataUrl(dataUrl: string): Promise<LogoResult> {
  if (isSvgDataUrl(dataUrl)) {
    return { svg: sanitizeSvg(dataUrlToText(dataUrl)), original: null, wasVector: true };
  }
  const small = await shrinkRaster(dataUrl);
  const svg = await vectorizeRaster(small);
  return { svg, original: small, wasVector: false };
}

// ───────────────────────────── palette extraction (FR-S04) ─────────────────────────────

const toHex = (r: number, g: number, b: number) => "#" + [r, g, b].map((v) => Math.round(v).toString(16).padStart(2, "0")).join("");
const dist = (a: number[], b: number[]) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const sat = ([r, g, b]: number[]) => {
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
  return mx === 0 ? 0 : (mx - mn) / mx;
};

function pickTwo(weights: Map<string, { rgb: number[]; w: number }>): { primary: string; secondary: string } | null {
  const list = [...weights.values()].filter((c) => !nearWhite(c.rgb[0], c.rgb[1], c.rgb[2]));
  if (!list.length) return null;
  // Prefer saturated, heavy colours: weight × (0.4 + saturation)
  list.sort((a, b) => b.w * (0.4 + sat(b.rgb)) - a.w * (0.4 + sat(a.rgb)));
  const p = list[0].rgb;
  const s = list.find((c) => dist(c.rgb, p) > 70)?.rgb;
  const lighten = (c: number[]) => c.map((v) => v + (255 - v) * 0.35);
  return { primary: toHex(p[0], p[1], p[2]), secondary: s ? toHex(s[0], s[1], s[2]) : toHex(...(lighten(p) as [number, number, number])) };
}

export function paletteFromSvg(svg: string): { primary: string; secondary: string } | null {
  const doc = new DOMParser().parseFromString(svg, "image/svg+xml");
  const weights = new Map<string, { rgb: number[]; w: number }>();
  doc.querySelectorAll("path, rect, circle, ellipse, polygon, text").forEach((el) => {
    const rgb = parseColor(el.getAttribute("fill") || el.getAttribute("style")?.match(/fill:\s*([^;]+)/)?.[1] || "");
    if (!rgb) return;
    const size = (el.getAttribute("d") || el.getAttribute("points") || "x").length;
    const key = rgb.join(",");
    const cur = weights.get(key) ?? { rgb, w: 0 };
    cur.w += size;
    weights.set(key, cur);
  });
  return pickTwo(weights);
}

export async function paletteFromRaster(dataUrl: string): Promise<{ primary: string; secondary: string } | null> {
  const img = await loadImage(dataUrl);
  const s = Math.min(1, 96 / Math.max(img.naturalWidth, img.naturalHeight));
  const cv = document.createElement("canvas");
  cv.width = Math.max(1, Math.round(img.naturalWidth * s));
  cv.height = Math.max(1, Math.round(img.naturalHeight * s));
  const ctx = cv.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(img, 0, 0, cv.width, cv.height);
  const d = ctx.getImageData(0, 0, cv.width, cv.height).data;
  const weights = new Map<string, { rgb: number[]; w: number }>();
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] < 128) continue;
    const q = [d[i] >> 4 << 4, d[i + 1] >> 4 << 4, d[i + 2] >> 4 << 4];
    const key = q.join(",");
    const cur = weights.get(key) ?? { rgb: q, w: 0 };
    cur.w++;
    weights.set(key, cur);
  }
  return pickTwo(weights);
}

export async function detectPalette(svg: string | null, original: string | null) {
  return (svg && paletteFromSvg(svg)) || (original && (await paletteFromRaster(original))) || null;
}

/** Downscale user photos before embedding in a design (keeps saved designs small). */
export async function shrinkPhoto(dataUrl: string, max = 1600): Promise<string> {
  if (isSvgDataUrl(dataUrl)) return dataUrl;
  const img = await loadImage(dataUrl);
  const s = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
  if (s === 1 && dataUrl.length < 600_000) return dataUrl;
  const cv = document.createElement("canvas");
  cv.width = Math.round(img.naturalWidth * s);
  cv.height = Math.round(img.naturalHeight * s);
  const ctx = cv.getContext("2d")!;
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, cv.width, cv.height);
  ctx.drawImage(img, 0, 0, cv.width, cv.height);
  return cv.toDataURL("image/jpeg", 0.88);
}
