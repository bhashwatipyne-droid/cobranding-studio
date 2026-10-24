"use client";
/**
 * Template → live Fabric objects. Nothing here is a flattened image: every piece (logo, headline,
 * image slot, details strip) is its own selectable, restylable object (PRD §4.1).
 */
import {
  Circle, FabricImage, FabricObject, Gradient, Group, Rect, Textbox, loadSVGFromString, util,
} from "fabric";
import { isArtLayout, type BrandKit, type LayoutId, type LogoPos, type TemplateDef } from "./types";
import { combineDetails } from "./templates";
import { ensureFont } from "./fabric-setup";
import { initials, uid } from "./utils";
import { buildArt } from "./template-art";

export interface PageContent {
  headline: string;
  sub: string;
  stat?: string;
  /** data/URL of a user image for the image slot; null → placeholder */
  imageSrc?: string | null;
}

export interface BuildInput {
  kit: BrandKit;
  /** apply the saved kit (logo, fonts, details); false → neutral placeholders (auto-apply off / not set up) */
  applyKit: boolean;
  layout: LayoutId;
  palette: [string, string];
  content: PageContent;
  w: number;
  h: number;
  /** which frame of a video, etc. — only used for naming */
  label?: string;
}

export interface BuiltPage {
  objects: FabricObject[];
  background: string | Grad;
}

export type Grad = Gradient<"linear">;
const INK = "#0D1B3E";
const INK_SOFT = "#546490";

export const LAYOUT_ROLES = new Set(["headline", "sub", "stat", "image", "accent", "strip", "logo", "details", "decor", "art"]);

function gradient(p: [string, string], w: number, h: number, horizontal = false) {
  return new Gradient({
    type: "linear",
    gradientUnits: "pixels",
    coords: horizontal ? { x1: 0, y1: 0, x2: w, y2: 0 } : { x1: 0, y1: 0, x2: w, y2: h },
    colorStops: [{ offset: 0, color: p[0] }, { offset: 1, color: p[1] }],
  });
}

export function tag<T extends FabricObject>(o: T, role: string, kind: string, extra: Partial<FabricObject> = {}): T {
  o.set({ id: uid("el"), role, kind, ...extra });
  return o;
}

export interface TextOpts {
  left: number; top: number; width: number; size: number; weight?: number | string; color: string;
  font: string; align?: "left" | "center" | "right"; lineHeight?: number; italic?: boolean; opacity?: number; templateText?: boolean;
}
export function text(role: string, value: string, o: TextOpts) {
  const t = new Textbox(value, {
    left: o.left, top: o.top, width: o.width, fontSize: o.size, fontWeight: o.weight ?? 400,
    fill: o.color, fontFamily: o.font, textAlign: o.align ?? "left", lineHeight: o.lineHeight ?? 1.15,
    fontStyle: o.italic ? "italic" : "normal", opacity: o.opacity ?? 1, splitByGrapheme: false,
    editable: true, lockScalingFlip: true,
  });
  tag(t, role, "text", { templateText: o.templateText ?? false });
  t.setControlsVisibility({ mt: false, mb: false });
  return t;
}

export function rect(role: string, o: { left: number; top: number; width: number; height: number; fill: string | Grad; rx?: number; opacity?: number; kind?: string }) {
  const r = new Rect({ left: o.left, top: o.top, width: o.width, height: o.height, fill: o.fill, rx: o.rx ?? 0, ry: o.rx ?? 0, opacity: o.opacity ?? 1 });
  return tag(r, role, o.kind ?? "shape");
}

// ───────────────────────────── image slot ─────────────────────────────

export function placeholderSvg(w: number, h: number) {
  const fs = Math.max(14, Math.round(Math.min(w, h) / 14));
  return (
    "data:image/svg+xml;charset=utf-8," +
    encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" width="${Math.round(w)}" height="${Math.round(h)}" viewBox="0 0 ${Math.round(w)} ${Math.round(h)}">` +
        `<defs><pattern id="p" width="24" height="24" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="12" height="24" fill="#F4F6FB"/><rect x="12" width="12" height="24" fill="#E8ECF6"/></pattern></defs>` +
        `<rect width="100%" height="100%" fill="url(#p)"/>` +
        `<text x="50%" y="50%" text-anchor="middle" dominant-baseline="middle" font-family="Inter, Arial, sans-serif" font-size="${fs}" font-weight="600" fill="#8A97B5">Add an image</text></svg>`
    )
  );
}

/** Cover-fit an image into its slot using native Fabric cropping, so "nudge" is a real crop move. */
export function fitImage(img: FabricImage, slotW: number, slotH: number, fx = 0.5, fy = 0.5, radius = 18) {
  const el = img.getElement() as HTMLImageElement;
  const natW = el.naturalWidth || el.width || 1;
  const natH = el.naturalHeight || el.height || 1;
  const s = Math.max(slotW / natW, slotH / natH);
  const visW = slotW / s;
  const visH = slotH / s;
  img.set({
    cropX: (natW - visW) * Math.min(1, Math.max(0, fx)),
    cropY: (natH - visH) * Math.min(1, Math.max(0, fy)),
    width: visW, height: visH, scaleX: s, scaleY: s, slotW, slotH, focusX: fx, focusY: fy,
  });
  img.clipPath = new Rect({ width: visW, height: visH, rx: radius / s, ry: radius / s, originX: "center", originY: "center" });
  img.setCoords();
}

export async function makeImageSlot(o: { left: number; top: number; width: number; height: number; src?: string | null; radius?: number }) {
  const src = o.src || placeholderSvg(o.width, o.height);
  const img = await FabricImage.fromURL(src, { crossOrigin: "anonymous" });
  img.set({ left: o.left, top: o.top });
  tag(img, "image", "image", { isPlaceholder: !o.src });
  fitImage(img, o.width, o.height, 0.5, 0.5, o.radius ?? 18);
  return img;
}

export async function setImageSource(img: FabricImage, src: string) {
  const w = img.slotW ?? img.getScaledWidth();
  const h = img.slotH ?? img.getScaledHeight();
  await img.setSrc(src, { crossOrigin: "anonymous" });
  img.isPlaceholder = false;
  fitImage(img, w, h, 0.5, 0.5);
}

// ───────────────────────────── logo ─────────────────────────────

export async function makeLogo(kit: BrandKit, useKit: boolean, boxW: number, boxH: number): Promise<Group> {
  const pad = Math.round(Math.min(boxW, boxH) * 0.14);
  const plateFill = useKit && kit.logoSvg ? "#FFFFFF" : useKit ? kit.color : "#2B2BB5";
  const plate = new Rect({ width: boxW, height: boxH, rx: Math.round(boxH * 0.16), ry: Math.round(boxH * 0.16), fill: plateFill, originX: "left", originY: "top" });
  plate.set({ role: "plate", id: uid("el") });
  const parts: FabricObject[] = [plate];

  if (useKit && kit.logoSvg) {
    try {
      const { objects, options } = await loadSVGFromString(kit.logoSvg);
      const vec = util.groupSVGElements(objects.filter(Boolean) as FabricObject[], options) as FabricObject;
      const s = Math.min((boxW - pad * 2) / (vec.width || 1), (boxH - pad * 2) / (vec.height || 1));
      vec.set({ scaleX: s, scaleY: s, originX: "center", originY: "center", left: boxW / 2, top: boxH / 2 });
      vec.set({ role: "logoVector" });
      parts.push(vec);
    } catch {
      parts.push(fallbackLogoText(kit, useKit, boxW, boxH));
    }
  } else {
    parts.push(fallbackLogoText(kit, useKit, boxW, boxH));
  }
  const g = new Group(parts, { subTargetCheck: false });
  return tag(g, "logo", "logo");
}

function fallbackLogoText(kit: BrandKit, useKit: boolean, boxW: number, boxH: number) {
  const label = useKit ? initials(kit.logoName) : "LOGO";
  const t = new Textbox(label, {
    width: boxW, fontSize: Math.round(boxH * 0.4), fontWeight: 800, fill: "#FFFFFF", textAlign: "center",
    fontFamily: "Inter", originX: "left", originY: "center", left: 0, top: boxH / 2,
  });
  t.set({ role: "logoText" });
  return t;
}

export function logoBox(w: number, h: number) {
  const land = h < w * 0.8;
  return { w: Math.round(w * (land ? 0.17 : 0.2)), h: Math.round(Math.min(w, h) * (land ? 0.13 : 0.09)) };
}

export function logoXY(pos: LogoPos, w: number, h: number, bw: number, bh: number, m: number) {
  const col = pos.endsWith("left") ? 0 : pos.endsWith("right") ? 2 : 1;
  const row = pos.startsWith("top") ? 0 : pos.startsWith("bottom") ? 2 : 1;
  return {
    left: col === 0 ? m : col === 2 ? w - m - bw : (w - bw) / 2,
    top: row === 0 ? m : row === 2 ? h - m - bh : (h - bh) / 2,
  };
}

// ───────────────────────────── brand strip (FR-28) ─────────────────────────────

export function stripHeight(w: number, h: number) {
  return Math.max(Math.round(Math.min(w, h) * 0.075), 56);
}

/** Default header/footer: template colours, kit logo + company details, applied without any manual step. */
export async function buildBrand(inp: BuildInput, kit = inp.kit): Promise<FabricObject[]> {
  const { w, h, palette, applyKit } = inp;
  // designed templates keep their artwork edge to edge, so their logo is a little smaller and tucked closer to the corner
  const compact = isArtLayout(inp.layout);
  const m = compact ? 28 : Math.round(w * 0.045);
  const sh = stripHeight(w, h);
  const top = (applyKit ? kit.detailsPosition : "bottom") === "top";
  const stripTop = top ? 0 : h - sh;
  const bodyFont = applyKit ? kit.fontBody : "Inter";

  const strip = rect("strip", { left: 0, top: stripTop, width: w, height: sh, fill: gradient(palette, w, sh, true) });
  strip.set({ layerName: top ? "Header strip" : "Footer strip" });

  const lb = compact ? { w: Math.round(w * 0.17), h: Math.round(Math.min(w, h) * 0.075) } : logoBox(w, h);
  const logo = await makeLogo(kit, applyKit, lb.w, lb.h);
  const pos = applyKit ? kit.position : "top-left";
  const xy = logoXY(pos, w, h, lb.w, lb.h, m);
  logo.set({ left: xy.left, top: xy.top });

  // keep the details line clear of the logo when they share the strip
  const detailsText = applyKit ? combineDetails(kit) || kit.companyName : "Your Company Name · www.yourcompany.com";
  const fs = Math.max(16, Math.round(sh * 0.3));
  let dLeft = m;
  let dWidth = w - m * 2;
  const overlaps = xy.top < stripTop + sh && xy.top + lb.h > stripTop;
  if (overlaps) {
    const cx = xy.left + lb.w / 2;
    if (cx < w / 2) { dLeft = xy.left + lb.w + m * 0.6; dWidth = w - dLeft - m; }
    else { dWidth = xy.left - m * 0.6 - m; }
  }
  const details = text("details", detailsText, {
    left: dLeft, top: stripTop + (sh - fs * 1.2) / 2, width: Math.max(120, dWidth), size: fs, color: "#FFFFFF",
    font: bodyFont, align: "left", lineHeight: 1.2, templateText: false,
  });
  details.set({ layerName: "Company details" });
  return [strip, details, logo];
}

// ───────────────────────────── layouts ─────────────────────────────

export async function buildPage(inp: BuildInput): Promise<BuiltPage> {
  if (isArtLayout(inp.layout)) {
    const art = await buildArt(inp);
    return { objects: [...art.objects, ...(await buildBrand(inp))], background: art.background };
  }
  const { w, h, palette, content, applyKit, kit, layout } = inp;
  const headFont = applyKit ? kit.fontHeading : "Sora";
  const bodyFont = applyKit ? kit.fontBody : "Inter";
  await Promise.all([ensureFont(headFont), ensureFont(bodyFont)]);

  const u = Math.min(w, h * 1.25) / 1080; // type scale
  const m = Math.round(w * 0.07);
  const sh = stripHeight(w, h);
  const stripTop = (applyKit ? kit.detailsPosition : "bottom") === "top";
  let y0 = (stripTop ? sh : 0) + m * 0.9; // usable area
  let y1 = h - (stripTop ? 0 : sh) - m * 0.9;
  // keep copy clear of a logo that sits in the content band (top-/bottom-row positions)
  {
    const lb = logoBox(w, h);
    const lp = applyKit ? kit.position : "top-left";
    const xy = logoXY(lp, w, h, lb.w, lb.h, Math.round(w * 0.045));
    if (lp.startsWith("top") && !(stripTop && xy.top < sh)) y0 = Math.max(y0, xy.top + lb.h + m * 0.45);
    else if (lp.startsWith("bottom") && !(!stripTop && xy.top + lb.h > h - sh)) y1 = Math.min(y1, xy.top - m * 0.45);
  }
  const ah = y1 - y0;
  const land = h < w * 0.8;
  const textW = land ? w * 0.5 - m : w - m * 2;
  const objs: FabricObject[] = [];
  let background: string | Grad = "#FFFFFF";

  const head = (color: string, o: Partial<TextOpts> & { top: number }) =>
    text("headline", content.headline, { left: m, width: textW, size: Math.round(64 * u), weight: 800, color, font: headFont, lineHeight: 1.12, templateText: true, ...o });
  const sub = (color: string, o: Partial<TextOpts> & { top: number }) =>
    text("sub", content.sub, { left: m, width: textW, size: Math.round(30 * u), weight: 500, color, font: bodyFont, lineHeight: 1.3, templateText: true, ...o });

  // image slot geometry: below the copy in portrait, right-hand column in landscape
  const slot = (top: number, hFrac: number, radius = 24) =>
    land
      ? { left: w * 0.56, top: y0, width: w * 0.44 - m, height: ah, radius }
      : { left: m, top, width: w - m * 2, height: Math.max(120, ah * hFrac), radius };

  switch (layout) {
    case "hero": {
      background = gradient(palette, w, h);
      objs.push(tag(new Circle({ radius: w * 0.38, left: w * 0.55, top: -w * 0.18, fill: "#FFFFFF", opacity: 0.07 }), "decor", "shape"));
      objs.push(head("#FFFFFF", { top: y0 }));
      objs.push(sub("#FFFFFF", { top: y0 + (land ? h * 0.42 : ah * 0.3), opacity: 0.86 }));
      const s = slot(y1 - ah * 0.36, 0.36);
      objs.push(await makeImageSlot({ ...s, src: content.imageSrc, top: land ? s.top : y1 - s.height }));
      break;
    }
    case "split": {
      background = "#FFFFFF";
      const half = land ? w * 0.52 : w * 0.5;
      objs.push(rect("accent", { left: 0, top: 0, width: half, height: h, fill: gradient(palette, half, h) }));
      objs.push(head("#FFFFFF", { top: y0 + ah * 0.18, width: half - m * 1.4, size: Math.round(58 * u) }));
      objs.push(sub("#FFFFFF", { top: y0 + ah * 0.18 + 330 * u, width: half - m * 1.4, size: Math.round(28 * u), opacity: 0.86 }));
      objs.push(await makeImageSlot({ left: half + m * 0.4, top: y0, width: w - half - m * 1.4, height: ah, src: content.imageSrc, radius: 28 }));
      break;
    }
    case "card": {
      background = "#F7F9FC";
      const imgH = land ? ah : ah * 0.46;
      objs.push(await makeImageSlot(slot(y0, 0.46)));
      const ty = land ? y0 : y0 + imgH + m * 0.5;
      objs.push(rect("accent", { left: m, top: ty, width: 120 * u, height: 10 * u, fill: palette[0], rx: 5 }));
      objs.push(head(INK, { top: ty + 36 * u, size: Math.round(58 * u) }));
      objs.push(sub(INK_SOFT, { top: ty + 36 * u + Math.round(58 * u * 1.12 * 3) + 24 * u }));
      break;
    }
    case "stat": {
      background = "#FFFFFF";
      objs.push(tag(new Circle({ radius: Math.min(w, h) * 0.34, left: w / 2 - Math.min(w, h) * 0.34, top: y0 + ah * 0.04, fill: palette[0], opacity: 0.09 }), "decor", "shape"));
      objs.push(text("stat", content.stat ?? "12.4%", { left: m, top: y0 + ah * 0.12, width: w - m * 2, size: Math.round(230 * u), weight: 800, color: palette[0], font: headFont, align: "center", templateText: true, lineHeight: 1 }));
      objs.push(head(INK, { top: y0 + ah * 0.55, width: w - m * 2, align: "center", size: Math.round(46 * u) }));
      objs.push(sub(INK_SOFT, { top: y0 + ah * 0.55 + 240 * u, width: w - m * 2, align: "center", size: Math.round(26 * u) }));
      break;
    }
    case "quote": {
      background = gradient(palette, w, h);
      objs.push(text("decor", "“", { left: m, top: y0 - 40 * u, width: 400 * u, size: Math.round(380 * u), weight: 800, color: "#FFFFFF", font: "Georgia", opacity: 0.28, lineHeight: 1 }));
      objs[objs.length - 1].set({ kind: "text" });
      objs.push(head("#FFFFFF", { top: y0 + ah * 0.28, width: w - m * 2, size: Math.round(60 * u), italic: true, weight: 700 }));
      objs.push(sub("#FFFFFF", { top: y1 - 70 * u, width: w - m * 2, size: Math.round(28 * u), opacity: 0.85 }));
      break;
    }
    case "minimal": {
      background = "#FFFFFF";
      objs.push(rect("accent", { left: m * 0.45, top: y0, width: 12 * u, height: ah, fill: palette[0], rx: 6 }));
      objs.push(head(INK, { top: y0 + ah * 0.04, left: m + 14 * u, size: Math.round(76 * u), width: (land ? w * 0.5 : w - m * 2) - m }));
      objs.push(sub(INK_SOFT, { top: y0 + ah * 0.04 + Math.round(76 * u * 1.12 * 3) + 24 * u, left: m + 14 * u }));
      const iw = land ? w * 0.36 : w * 0.46;
      const ih = land ? ah * 0.7 : ah * 0.38;
      objs.push(await makeImageSlot({ left: w - m - iw, top: y1 - ih, width: iw, height: ih, src: content.imageSrc, radius: 28 }));
      break;
    }
    case "banner": {
      background = "#FFFFFF";
      const bh = land ? h : ah * 0.4 + y0;
      const bw = land ? w * 0.56 : w;
      objs.push(rect("accent", { left: 0, top: 0, width: bw, height: bh, fill: gradient(palette, bw, bh) }));
      objs.push(head("#FFFFFF", { top: y0 + (land ? ah * 0.2 : 0), width: bw - m * 2, size: Math.round(60 * u) }));
      if (land) {
        objs.push(sub("#FFFFFF", { top: y0 + ah * 0.2 + 300 * u, width: bw - m * 2, opacity: 0.86 }));
        objs.push(await makeImageSlot({ left: bw + m * 0.5, top: y0, width: w - bw - m * 1.5, height: ah, src: content.imageSrc }));
      } else {
        objs.push(await makeImageSlot({ left: m, top: bh + m * 0.4, width: w - m * 2, height: ah * 0.34, src: content.imageSrc }));
        objs.push(sub(INK_SOFT, { top: bh + m * 0.4 + ah * 0.34 + 28 * u, width: w - m * 2 }));
      }
      break;
    }
    case "badge": {
      background = "#F0F0FD";
      const r = 62 * u;
      objs.push(tag(new Circle({ radius: r, left: m, top: y0, fill: palette[0] }), "accent", "shape"));
      objs.push(text("accent", "NEW", { left: m, top: y0 + r - 17 * u, width: r * 2, size: Math.round(32 * u), weight: 800, color: "#FFFFFF", font: headFont, align: "center" }));
      objs[objs.length - 1].set({ kind: "text" });
      objs.push(head(INK, { top: y0 + r * 2 + 36 * u, size: Math.round(62 * u) }));
      objs.push(sub(INK_SOFT, { top: y0 + r * 2 + 36 * u + Math.round(62 * u * 1.12 * 3) + 22 * u }));
      const s = slot(y1 - ah * 0.3, 0.3, 28);
      objs.push(await makeImageSlot({ ...s, src: content.imageSrc, top: land ? s.top : y1 - s.height }));
      break;
    }
  }

  const brand = await buildBrand(inp);
  return { objects: [...objs, ...brand], background };
}

export function layoutForTemplate(t: TemplateDef): LayoutId {
  return t.layout;
}
