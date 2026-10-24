"use client";
/**
 * Imperative Fabric wrapper. React components never touch Fabric directly: they call this controller
 * and receive derived state (selection info, layers, history, compliance) through the hooks.
 */
import {
  ActiveSelection, Canvas, Circle, FabricImage, FabricObject, Gradient, Group, Path, Point, Rect, Shadow, Textbox, Triangle, filters, util,
} from "fabric";
import { complianceSynonyms, computeFlagSpans, replaceTerm } from "./compliance";
import { configureFabric, ensureFont, CUSTOM_PROPS } from "./fabric-setup";
import { LAYOUT_ROLES, buildBrand, buildPage, fitImage, setImageSource, type BuildInput, type Grad, type PageContent } from "./layouts";
import type { BrandKit, LayoutId } from "./types";
import { uid } from "./utils";

export interface SelInfo {
  count: number;
  ids: string[];
  kind: string; // text | image | shape | icon | line | logo | group | multi
  role?: string;
  locked: boolean;
  opacity: number;
  isGroup: boolean;
  text?: {
    fontFamily: string; fontSize: number; bold: boolean; italic: boolean; underline: boolean; strike: boolean;
    align: string; fill: string; lineHeight: number; upper: boolean; bullets: boolean; shadow: boolean;
  };
  paint?: { fill: string; stroke: string; strokeWidth: number };
  image?: { brightness: number; contrast: number; saturation: number; whiteRemoved: boolean };
}

export interface LayerInfo { id: string; name: string; kind: string; visible: boolean; locked: boolean; selected: boolean }
export interface HistoryEntry { label: string; at: number }
export interface ComplianceCard {
  objId: string;
  editing: boolean;
  flags: { term: string; raw: string; alts: string[] }[];
}

export interface ControllerHooks {
  onSelection(info: SelInfo | null): void;
  onLayers(): void;
  onHistory(state: { canUndo: boolean; canRedo: boolean; entries: HistoryEntry[]; index: number }): void;
  /** fired after any committed change — drives autosave */
  onChange(): void;
  onCompliance(card: ComplianceCard | null): void;
  toast(msg: string): void;
}

const FLAG_STYLE = { underline: true, textBackgroundColor: "rgba(245,158,11,0.28)" };
const ICONS: Record<string, string> = {
  rupee: "M6 4h12M6 9h12M6 4c4 0 8 1 8 5s-4 5-8 5l8 6",
  bars: "M5 20V10M12 20V4M19 20v-7",
  pie: "M12 2v10l7 5A10 10 0 1012 2z",
  arrowup: "M12 20V4M5 11l7-7 7 7",
};

const isText = (o: FabricObject | undefined | null): o is Textbox => !!o && o.type?.toLowerCase() === "textbox";
const isImage = (o: FabricObject | undefined | null): o is FabricImage => !!o && o.kind === "image";

function paint(o: FabricObject, color: string) {
  if (o.role === "plate") return;
  if (o instanceof Group) {
    o.getObjects().forEach((c) => paint(c, color));
    return;
  }
  const f = o.fill;
  if (f && f !== "none" && f !== "transparent") o.set("fill", color);
  else if (o.stroke) o.set("stroke", color);
}

export class CanvasController {
  canvas: Canvas;
  W = 1080;
  H = 1080;
  scale = 0.5;
  brandColor = "#2B2BB5";
  private hooks: ControllerHooks;
  private restoring = false;
  private pageId = "";
  private histories = new Map<string, { stack: { json: string; label: string; at: number }[]; idx: number }>();
  private guides = { v: false, h: false };
  private flagTimer: ReturnType<typeof setTimeout> | null = null;
  private disposed = false;

  constructor(el: HTMLCanvasElement, hooks: ControllerHooks) {
    configureFabric();
    this.hooks = hooks;
    this.canvas = new Canvas(el, {
      width: this.W * this.scale, height: this.H * this.scale, backgroundColor: "#FFFFFF",
      preserveObjectStacking: true, selection: true, stopContextMenu: true, fireRightClick: false,
    });
    this.canvas.setZoom(this.scale);
    this.bind();
  }

  dispose() {
    this.disposed = true;
    if (this.flagTimer) clearTimeout(this.flagTimer);
    void this.canvas.dispose();
  }

  // ───────────────────────── events ─────────────────────────
  private bind() {
    const c = this.canvas;
    const sel = () => this.emitSelection();
    c.on("selection:created", sel);
    c.on("selection:updated", sel);
    c.on("selection:cleared", () => { this.hooks.onSelection(null); this.hooks.onCompliance(null); });
    c.on("object:added", (e) => {
      // Fabric 7 textboxes only get left/right handles. Add corner + top/bottom handles (scale the type, Canva-style).
      const t = e.target;
      if (t && isText(t)) {
        const base = FabricObject.createControls().controls;
        t.controls = { ...t.controls, tl: base.tl, tr: base.tr, bl: base.bl, br: base.br, mt: base.mt, mb: base.mb };
      }
      if (!this.restoring) this.hooks.onLayers();
    });
    c.on("object:removed", () => { if (!this.restoring) this.hooks.onLayers(); });

    c.on("object:moving", (e) => {
      const t = e.target;
      if (!t) return;
      const cp = t.getCenterPoint();
      const th = 6 / this.scale;
      let v = false, h = false;
      let nx = cp.x, ny = cp.y;
      if (Math.abs(cp.x - this.W / 2) < th) { nx = this.W / 2; v = true; }
      if (Math.abs(cp.y - this.H / 2) < th) { ny = this.H / 2; h = true; }
      if (v || h) t.setPositionByOrigin(new Point(nx, ny), "center", "center");
      this.guides = { v, h };
    });
    c.on("mouse:up", () => {
      if (this.guides.v || this.guides.h) { this.guides = { v: false, h: false }; c.requestRenderAll(); }
    });
    c.on("after:render", () => {
      if (!this.guides.v && !this.guides.h) return;
      const ctx = c.getContext();
      ctx.save();
      ctx.strokeStyle = "#FF3D8B";
      ctx.lineWidth = 1;
      ctx.beginPath();
      if (this.guides.v) { ctx.moveTo(this.W / 2 * this.scale, 0); ctx.lineTo(this.W / 2 * this.scale, this.H * this.scale); }
      if (this.guides.h) { ctx.moveTo(0, this.H / 2 * this.scale); ctx.lineTo(this.W * this.scale, this.H / 2 * this.scale); }
      ctx.stroke();
      ctx.restore();
    });

    c.on("object:modified", (e) => {
      const t = e.target;
      if (t && isText(t) && (Math.abs((t.scaleX ?? 1) - 1) > 0.001 || Math.abs((t.scaleY ?? 1) - 1) > 0.001)) {
        // bake the drag into real font size + box width so text stays crisp and the toolbar size is truthful
        const sx = t.scaleX ?? 1, sy = t.scaleY ?? 1;
        t.set({ fontSize: Math.max(8, Math.round((t.fontSize ?? 16) * sy)), width: Math.max(40, (t.width ?? 100) * sx), scaleX: 1, scaleY: 1 });
        t.initDimensions();
        t.setCoords();
      }
      if (t && isImage(t) && (Math.abs((t.scaleX ?? 1) - (t.scaleY ?? 1)) > 0.001 || t.slotW === undefined)) {
        this.normalizeImage(t);
      }
      this.emitSelection();
      this.commit("Edited");
    });

    c.on("text:editing:entered", (e) => {
      const t = e.target as FabricObject;
      if (isText(t) && t.templateText) {
        this.clearFlags(t);
        this.pushCompliance(t, true);
      }
    });
    c.on("text:changed", (e) => {
      const t = e.target as FabricObject;
      if (!isText(t) || !t.templateText) return;
      if (this.flagTimer) clearTimeout(this.flagTimer);
      this.flagTimer = setTimeout(() => this.pushCompliance(t, true), 300);
    });
    c.on("text:editing:exited", (e) => {
      const t = e.target as FabricObject;
      if (isText(t)) {
        if (t.upper) t.origText = t.text;
        let label = "Edited text";
        if (t.templateText) {
          const f = computeFlagSpans(t.text ?? "", t.sebiKept ?? []);
          label = f.length ? `Edited template text — flagged: ${[...new Set(f.map((x) => x.raw.toLowerCase()))].join(", ")}` : "Edited template text";
          this.applyFlags(t); this.pushCompliance(t, false);
        }
        c.requestRenderAll();
        this.commit(label);
      }
    });
  }

  private normalizeImage(img: FabricImage) {
    const w = img.width * (img.scaleX ?? 1);
    const h = img.height * (img.scaleY ?? 1);
    fitImage(img, Math.max(30, w), Math.max(20, h), img.focusX ?? 0.5, img.focusY ?? 0.5);
    this.canvas.requestRenderAll();
  }

  // ───────────────────────── display ─────────────────────────
  setLogicalSize(w: number, h: number) {
    this.W = w; this.H = h;
    this.applyScale();
  }
  setDisplayScale(s: number) {
    this.scale = Math.max(0.05, s);
    this.applyScale();
  }
  private applyScale() {
    this.canvas.setDimensions({ width: Math.round(this.W * this.scale), height: Math.round(this.H * this.scale) });
    this.canvas.setZoom(this.scale);
    this.canvas.requestRenderAll();
  }

  // ───────────────────────── load / save ─────────────────────────
  private async preloadFonts(json: unknown) {
    const fams = new Set<string>();
    const walk = (o: unknown) => {
      if (!o || typeof o !== "object") return;
      const r = o as Record<string, unknown>;
      if (typeof r.fontFamily === "string") fams.add(r.fontFamily);
      if (Array.isArray(r.objects)) r.objects.forEach(walk);
    };
    walk(json);
    await Promise.all([...fams].map((f) => ensureFont(f)));
  }

  async loadPage(pageId: string, json: unknown | null) {
    this.pageId = pageId;
    this.restoring = true;
    this.canvas.discardActiveObject();
    if (json) {
      await this.preloadFonts(json);
      await this.canvas.loadFromJSON(json as object);
    } else {
      this.canvas.clear();
      this.canvas.setZoom(this.scale);
      this.canvas.backgroundColor = "#FFFFFF";
    }
    this.canvas.setZoom(this.scale);
    this.reflagAll();
    this.canvas.requestRenderAll();
    this.restoring = false;
    if (!this.histories.has(pageId)) {
      this.histories.set(pageId, { stack: [], idx: -1 });
      this.pushSnapshot("Opened");
    }
    this.emitHistory();
    this.hooks.onLayers();
    this.hooks.onSelection(null);
    this.hooks.onCompliance(null);
  }

  /** Canvas JSON with the (transient) SEBI highlight styling stripped out. */
  serialize(): unknown {
    const editing = this.canvas.getObjects().some((o) => isText(o) && o.isEditing);
    const texts = this.canvas.getObjects().filter((o): o is Textbox => isText(o) && !!o.templateText);
    // compliance highlights are never saved; the template's own emphasis (bold phrases etc.) is
    if (!editing) texts.forEach((t) => { t.styles = {}; this.applyRich(t); });
    const json = this.canvas.toObject(CUSTOM_PROPS);
    if (!editing) texts.forEach((t) => this.applyFlags(t));
    return JSON.parse(JSON.stringify(json));
  }

  // ───────────────────────── history ─────────────────────────
  private pushSnapshot(label: string) {
    const h = this.histories.get(this.pageId);
    if (!h) return;
    const json = JSON.stringify(this.serialize());
    if (h.stack[h.idx]?.json === json) return;
    h.stack = h.stack.slice(0, h.idx + 1);
    h.stack.push({ json, label, at: Date.now() });
    if (h.stack.length > 80) h.stack.shift();
    h.idx = h.stack.length - 1;
  }
  commit(label = "Edited") {
    if (this.restoring || this.disposed) return;
    this.pushSnapshot(label);
    this.emitHistory();
    this.hooks.onLayers();
    this.hooks.onChange();
  }
  private emitHistory() {
    const h = this.histories.get(this.pageId);
    this.hooks.onHistory({
      canUndo: !!h && h.idx > 0,
      canRedo: !!h && h.idx < h.stack.length - 1,
      entries: h ? h.stack.map((s) => ({ label: s.label, at: s.at })) : [],
      index: h?.idx ?? -1,
    });
  }
  private async restoreAt(i: number) {
    const h = this.histories.get(this.pageId);
    if (!h || i < 0 || i >= h.stack.length) return;
    h.idx = i;
    this.restoring = true;
    this.canvas.discardActiveObject();
    const json = JSON.parse(h.stack[i].json);
    await this.preloadFonts(json);
    await this.canvas.loadFromJSON(json);
    this.canvas.setZoom(this.scale);
    this.reflagAll();
    this.canvas.requestRenderAll();
    this.restoring = false;
    this.emitHistory();
    this.hooks.onLayers();
    this.hooks.onSelection(null);
    this.hooks.onCompliance(null);
    this.hooks.onChange();
  }
  undo() { const h = this.histories.get(this.pageId); if (h) void this.restoreAt(h.idx - 1); }
  redo() { const h = this.histories.get(this.pageId); if (h) void this.restoreAt(h.idx + 1); }
  restoreHistory(i: number) { void this.restoreAt(i); }

  // ───────────────────────── selection ─────────────────────────
  private targets(): FabricObject[] {
    const a = this.canvas.getActiveObject();
    if (!a) return [];
    return a instanceof ActiveSelection ? a.getObjects() : [a];
  }

  emitSelection() {
    const a = this.canvas.getActiveObject();
    if (!a) { this.hooks.onSelection(null); return; }
    const ts = this.targets();
    const first = ts[0];
    const multi = ts.length > 1;
    const info: SelInfo = {
      count: ts.length,
      ids: ts.map((t) => t.id ?? ""),
      kind: multi ? "multi" : first.kind ?? (first instanceof Group ? "group" : "shape"),
      role: multi ? undefined : first.role,
      locked: !multi && first.lockMovementX === true,
      opacity: first.opacity ?? 1,
      isGroup: !multi && first instanceof Group && first.kind !== "logo",
    };
    if (!multi && isText(first)) {
      info.text = {
        fontFamily: first.fontFamily ?? "Inter", fontSize: Math.round((first.fontSize ?? 16) * (first.scaleY ?? 1)),
        bold: Number(first.fontWeight) >= 700, italic: first.fontStyle === "italic", underline: !!first.underline,
        strike: !!first.linethrough, align: first.textAlign ?? "left", fill: typeof first.fill === "string" ? first.fill : "#0D1B3E",
        lineHeight: first.lineHeight ?? 1.15, upper: !!first.upper, bullets: !!first.bullets, shadow: !!first.shadow,
      };
      if (first.templateText) this.pushCompliance(first, !!first.isEditing);
    } else {
      this.hooks.onCompliance(null);
    }
    if (!multi && !isText(first)) {
      info.paint = {
        fill: typeof first.fill === "string" && first.fill ? first.fill : this.brandColor,
        stroke: typeof first.stroke === "string" && first.stroke ? first.stroke : "#000000",
        strokeWidth: first.strokeWidth ?? 0,
      };
    }
    if (!multi && isImage(first)) {
      const f = first.filters ?? [];
      const get = (T: unknown, key: string) => (f.find((x) => x instanceof (T as new () => object)) as unknown as Record<string, number> | undefined)?.[key] ?? 0;
      info.image = {
        brightness: Math.round(get(filters.Brightness, "brightness") * 100) + 100,
        contrast: Math.round(get(filters.Contrast, "contrast") * 100) + 100,
        saturation: Math.round(get(filters.Saturation, "saturation") * 100) + 100,
        whiteRemoved: f.some((x) => x instanceof filters.RemoveColor),
      };
    }
    this.hooks.onSelection(info);
  }

  select(id: string) {
    const o = this.canvas.getObjects().find((x) => x.id === id);
    if (!o || o.hidden) return;
    if (o.selectable === false) return;
    this.canvas.setActiveObject(o);
    this.canvas.requestRenderAll();
    this.emitSelection();
  }
  clearSelection() { this.canvas.discardActiveObject(); this.canvas.requestRenderAll(); }
  selectAll() {
    const objs = this.canvas.getObjects().filter((o) => o.selectable !== false && !o.hidden);
    if (objs.length < 2) return;
    this.canvas.setActiveObject(new ActiveSelection(objs, { canvas: this.canvas }));
    this.canvas.requestRenderAll();
    this.emitSelection();
  }
  isEditingText() { return this.canvas.getObjects().some((o) => isText(o) && o.isEditing); }

  // ───────────────────────── compliance (FR-09) ─────────────────────────
  /** Template-designed emphasis (e.g. a bold coloured phrase inside a light sentence). */
  private applyRich(t: Textbox) {
    const txt = t.text ?? "";
    (t.richPhrases ?? []).forEach((p) => {
      if (!p.text) return;
      const style: Record<string, unknown> = {};
      if (p.fontWeight) style.fontWeight = p.fontWeight;
      if (p.fill) style.fill = p.fill;
      let at = txt.indexOf(p.text);
      while (at >= 0) {
        t.setSelectionStyles(style, at, at + p.text.length);
        at = txt.indexOf(p.text, at + p.text.length);
      }
    });
  }
  private clearFlags(t: Textbox) { t.styles = {}; this.applyRich(t); t.dirty = true; }
  applyFlags(t: Textbox) {
    t.styles = {};
    this.applyRich(t);
    const spans = computeFlagSpans(t.text ?? "", t.sebiKept ?? []);
    spans.forEach((s) => t.setSelectionStyles(FLAG_STYLE, s.a, s.b));
    t.dirty = true;
  }
  private reflagAll() {
    this.canvas.getObjects().forEach((o) => { if (isText(o) && o.templateText) this.applyFlags(o); });
  }
  private pushCompliance(t: Textbox, editing: boolean) {
    const spans = computeFlagSpans(t.text ?? "", t.sebiKept ?? []);
    const seen = new Set<string>();
    const flags = spans
      .filter((s) => (seen.has(s.term) ? false : (seen.add(s.term), true)))
      .map((s) => ({ term: s.term, raw: s.raw, alts: (complianceSynonyms[s.term] ?? []).slice(0, 3) }));
    if (!editing && !flags.length) { this.hooks.onCompliance(null); return; }
    if (!editing) { this.applyFlags(t); }
    this.hooks.onCompliance({ objId: t.id ?? "", editing, flags });
    this.canvas.requestRenderAll();
  }
  replaceFlag(objId: string, term: string, suggestion: string) {
    const t = this.canvas.getObjects().find((o) => o.id === objId);
    if (!isText(t)) return;
    if (t.isEditing) t.exitEditing();
    t.set("text", replaceTerm(t.text ?? "", term, suggestion));
    if (t.upper) t.origText = t.text;
    this.applyFlags(t);
    this.pushCompliance(t, false);
    this.canvas.requestRenderAll();
    this.commit("Replaced flagged wording");
    this.hooks.toast(`Replaced with “${suggestion}”`);
  }
  keepFlag(objId: string, term: string) {
    const t = this.canvas.getObjects().find((o) => o.id === objId);
    if (!isText(t)) return;
    t.sebiKept = [...new Set([...(t.sebiKept ?? []), term.toLowerCase()])];
    if (t.isEditing) t.exitEditing();
    this.applyFlags(t);
    this.pushCompliance(t, false);
    this.canvas.requestRenderAll();
    this.commit("Kept flagged wording");
    this.hooks.toast("Kept as is — this wording is your call");
  }

  // ───────────────────────── page building ─────────────────────────
  async buildFromInput(input: BuildInput) {
    this.restoring = true;
    this.canvas.discardActiveObject();
    this.canvas.clear();
    this.canvas.setZoom(this.scale);
    const built = await buildPage(input);
    this.canvas.backgroundColor = built.background as string | Grad;
    this.canvas.add(...built.objects);
    this.restoring = false;
    this.reflagAll();
    this.canvas.requestRenderAll();
    this.hooks.onLayers();
  }

  readContent(): PageContent {
    const objs = this.canvas.getObjects();
    const byRole = (r: string) => objs.find((o) => o.role === r);
    const h = byRole("headline"), s = byRole("sub"), st = byRole("stat"), im = byRole("image");
    return {
      headline: isText(h) ? h.text : "",
      sub: isText(s) ? s.text : "",
      stat: isText(st) ? st.text : undefined,
      imageSrc: isImage(im) && !im.isPlaceholder ? im.getSrc() : null,
    };
  }

  /** FR-07A — swap the layout, keep the user's words, picture, logo and kit. */
  async switchLayout(layout: LayoutId, palette: [string, string], input: Omit<BuildInput, "content" | "layout" | "palette">) {
    const content = this.readContent();
    this.restoring = true;
    this.canvas.discardActiveObject();
    this.canvas.getObjects().filter((o) => o.role && LAYOUT_ROLES.has(o.role)).forEach((o) => this.canvas.remove(o));
    const built = await buildPage({ ...input, layout, palette, content });
    this.canvas.backgroundColor = built.background as string | Grad;
    built.objects.forEach((o, i) => this.canvas.insertAt(i, o));
    this.restoring = false;
    this.reflagAll();
    this.canvas.requestRenderAll();
    this.commit("Changed layout");
  }

  private roleObj(role: string) { return this.canvas.getObjects().find((o) => o.role === role); }

  /** Re-apply logo / details / fonts without regenerating the layout (FR-17). */
  async reapplyKit(kit: BrandKit, palette: [string, string], layout: LayoutId = "hero") {
    await Promise.all([ensureFont(kit.fontHeading), ensureFont(kit.fontBody)]);
    const objs = this.canvas.getObjects();
    const fresh = await buildBrand({ kit, applyKit: true, layout, palette, content: { headline: "", sub: "" }, w: this.W, h: this.H });
    const oldStrip = this.roleObj("strip");
    const stripFill = oldStrip?.fill;
    (["strip", "details", "logo"] as const).forEach((role, i) => {
      const old = this.roleObj(role);
      const idx = old ? objs.indexOf(old) : -1;
      if (old) this.canvas.remove(old);
      const n = fresh.find((f) => f.role === role)!;
      if (role === "strip" && stripFill) n.set("fill", stripFill);
      if (idx >= 0) this.canvas.insertAt(idx, n); else this.canvas.add(n);
      void i;
    });
    this.canvas.getObjects().forEach((o) => {
      if (!isText(o) || o.keepFont) return;
      if (o.role === "headline" || o.role === "stat") o.set("fontFamily", kit.fontHeading);
      else if (o.role === "sub") o.set("fontFamily", kit.fontBody);
    });
    this.canvas.requestRenderAll();
    this.commit("Reapplied cobranding setup");
  }

  /** Push the kit's colours + fonts through every themed element. */
  async applyKitToAll(kit: BrandKit, palette: [string, string], layout: LayoutId = "hero") {
    await this.reapplyKit(kit, palette, layout);
    this.canvas.getObjects().forEach((o) => {
      if (o.role === "accent" || o.role === "strip") {
        if (o.fill instanceof Gradient) {
          o.set("fill", new Gradient({ type: "linear", gradientUnits: "pixels", coords: { x1: 0, y1: 0, x2: o.width, y2: o.role === "strip" ? 0 : o.height }, colorStops: [{ offset: 0, color: kit.color }, { offset: 1, color: kit.secondary }] }));
        } else if (typeof o.fill === "string" && o.kind !== "text") o.set("fill", kit.color);
      }
      if (isText(o) && o.role === "stat") o.set("fill", kit.color);
    });
    this.canvas.requestRenderAll();
    this.commit("Applied brand kit");
  }

  // ───────────────────────── adding elements ─────────────────────────
  private place(o: FabricObject, kind: string, role?: string) {
    o.set({ id: uid("el"), kind, role });
    o.set({ left: this.W / 2 - (o.getScaledWidth() || 0) / 2, top: this.H / 2 - (o.getScaledHeight() || 0) / 2 });
    this.canvas.add(o);
    this.canvas.setActiveObject(o);
    this.canvas.requestRenderAll();
    this.commit("Added element");
    this.emitSelection();
  }

  async addText(kind: "heading" | "subhead" | "body") {
    const spec = {
      heading: { t: "New heading", size: 84, w: 800 },
      subhead: { t: "New subheading", size: 52, w: 700 },
      body: { t: "New body text goes here", size: 34, w: 400 },
    }[kind];
    await ensureFont("Inter");
    const tb = new Textbox(spec.t, { width: this.W * 0.7, fontSize: Math.round(spec.size * (this.W / 1080)), fontWeight: spec.w, fill: "#0D1B3E", fontFamily: "Inter", lineHeight: 1.15 });
    this.place(tb, "text");
    tb.set("top", this.H * 0.3);
    this.canvas.requestRenderAll();
  }
  addShape(kind: "rect" | "circle" | "triangle") {
    const fill = this.brandColor;
    const s = Math.round(this.W * 0.22);
    const o = kind === "rect" ? new Rect({ width: s, height: s, fill, rx: 0 })
      : kind === "circle" ? new Circle({ radius: s / 2, fill })
      : new Triangle({ width: s, height: s * 0.9, fill });
    this.place(o, "shape");
  }
  addLine(arrow: boolean) {
    const len = Math.round(this.W * 0.3);
    const col = "#546490";
    const shaft = new Rect({ width: len, height: 8, fill: col, rx: 3, left: 0, top: 0 });
    if (!arrow) { this.place(shaft, "line"); return; }
    const head = new Triangle({ width: 36, height: 30, fill: col, angle: 90, left: len + 26, top: -11 });
    this.place(new Group([shaft, head]), "line");
  }
  addIcon(name: keyof typeof ICONS) {
    const p = new Path(ICONS[name], { fill: "", stroke: this.brandColor, strokeWidth: 2, strokeLineCap: "round", strokeLineJoin: "round" });
    const s = (this.W * 0.12) / 24;
    p.set({ scaleX: s, scaleY: s });
    this.place(p, "icon");
  }

  async setImageOnSelection(src: string) {
    const a = this.canvas.getActiveObject();
    let target: FabricImage | undefined = isImage(a) ? a : undefined;
    if (!target) target = this.canvas.getObjects().find((o): o is FabricImage => o.role === "image" && isImage(o));
    if (!target) {
      // no slot on the canvas — insert a fresh image element
      const img = await FabricImage.fromURL(src, { crossOrigin: "anonymous" });
      const s = Math.round(this.W * 0.5);
      img.set({ id: uid("el"), kind: "image", role: "image", left: this.W * 0.25, top: this.H * 0.25 });
      fitImage(img, s, s * 0.7);
      this.canvas.add(img);
      this.canvas.setActiveObject(img);
    } else {
      await setImageSource(target, src);
      this.canvas.setActiveObject(target);
    }
    this.canvas.requestRenderAll();
    this.commit("Set image");
    this.emitSelection();
  }

  nudgeImage(dx: number, dy: number) {
    const a = this.canvas.getActiveObject();
    if (!isImage(a)) return;
    fitImage(a, a.slotW ?? a.getScaledWidth(), a.slotH ?? a.getScaledHeight(), (a.focusX ?? 0.5) + dx, (a.focusY ?? 0.5) + dy);
    this.canvas.requestRenderAll();
    this.commit("Moved crop");
  }
  setImageFilter(kind: "brightness" | "contrast" | "saturation", value: number) {
    const a = this.canvas.getActiveObject();
    if (!isImage(a)) return;
    const v = (value - 100) / 100;
    const T = { brightness: filters.Brightness, contrast: filters.Contrast, saturation: filters.Saturation }[kind];
    const rest = (a.filters ?? []).filter((f) => !(f instanceof T));
    a.filters = v === 0 ? rest : [...rest, new T({ [kind]: v })];
    a.applyFilters();
    this.canvas.requestRenderAll();
  }
  toggleWhiteRemoval() {
    const a = this.canvas.getActiveObject();
    if (!isImage(a)) return;
    const has = (a.filters ?? []).some((f) => f instanceof filters.RemoveColor);
    a.filters = has ? a.filters.filter((f) => !(f instanceof filters.RemoveColor)) : [...(a.filters ?? []), new filters.RemoveColor({ color: "#ffffff", distance: 0.22 })];
    a.applyFilters();
    this.canvas.requestRenderAll();
    this.commit("Toggled white removal");
    this.emitSelection();
  }

  async setBackground(v: string | { from: string; to: string }) {
    this.canvas.backgroundImage = undefined;
    this.canvas.backgroundColor = typeof v === "string"
      ? v
      : new Gradient({ type: "linear", gradientUnits: "pixels", coords: { x1: 0, y1: 0, x2: this.W, y2: this.H }, colorStops: [{ offset: 0, color: v.from }, { offset: 1, color: v.to }] });
    this.canvas.requestRenderAll();
    this.commit("Changed background");
  }
  async setBackgroundImage(src: string) {
    const img = await FabricImage.fromURL(src, { crossOrigin: "anonymous" });
    const s = Math.max(this.W / img.width, this.H / img.height);
    img.set({ scaleX: s, scaleY: s, left: (this.W - img.width * s) / 2, top: (this.H - img.height * s) / 2, originX: "left", originY: "top" });
    this.canvas.backgroundImage = img;
    this.canvas.requestRenderAll();
    this.commit("Changed background");
  }

  // ───────────────────────── styling ─────────────────────────
  private texts() { return this.targets().filter(isText); }
  private done(label: string) { this.canvas.requestRenderAll(); this.emitSelection(); this.commit(label); }

  setFont(family: string) { void ensureFont(family).then(() => { this.texts().forEach((t) => { t.set("fontFamily", family); t.initDimensions(); }); this.done("Changed font"); }); }
  stepFont(d: number) { this.texts().forEach((t) => t.set("fontSize", Math.max(8, Math.round((t.fontSize ?? 16) + d)))); this.done("Changed size"); }
  toggleBold() { this.texts().forEach((t) => t.set("fontWeight", Number(t.fontWeight) >= 700 ? 400 : 800)); this.done("Bold"); }
  toggleItalic() { this.texts().forEach((t) => t.set("fontStyle", t.fontStyle === "italic" ? "normal" : "italic")); this.done("Italic"); }
  toggleUnderline() { this.texts().forEach((t) => t.set("underline", !t.underline)); this.done("Underline"); }
  toggleStrike() { this.texts().forEach((t) => t.set("linethrough", !t.linethrough)); this.done("Strikethrough"); }
  setAlign(a: "left" | "center" | "right") { this.texts().forEach((t) => t.set("textAlign", a)); this.done("Aligned"); }
  toggleUpper() {
    this.texts().forEach((t) => {
      if (!t.upper) { t.origText = t.text; t.set({ text: t.text.toUpperCase(), upper: true }); }
      else { t.set({ text: t.origText ?? t.text, upper: false }); }
      if (t.templateText) this.applyFlags(t);
    });
    this.done("Uppercase");
  }
  toggleBullets() {
    this.texts().forEach((t) => {
      const lines = t.text.split("\n");
      if (!t.bullets) t.set({ text: lines.map((l) => (l.startsWith("• ") ? l : "• " + l)).join("\n"), bullets: true });
      else t.set({ text: lines.map((l) => l.replace(/^•\s?/, "")).join("\n"), bullets: false });
      if (t.templateText) this.applyFlags(t);
    });
    this.done("Bullets");
  }
  toggleShadow() { this.texts().forEach((t) => t.set("shadow", t.shadow ? null : new Shadow({ color: "rgba(0,0,0,0.35)", blur: 8, offsetX: 2, offsetY: 3 }))); this.done("Shadow"); }
  setLineHeight(v: number) { this.texts().forEach((t) => t.set("lineHeight", v)); this.canvas.requestRenderAll(); }
  setOpacity(v: number) { this.targets().forEach((t) => t.set("opacity", v)); this.canvas.requestRenderAll(); }
  commitSoft(label: string) { this.commit(label); }

  setColor(color: string) {
    this.targets().forEach((t) => (isText(t) ? t.set("fill", color) : paint(t, color)));
    this.done("Changed colour");
  }
  stepBorder(d: number) {
    this.targets().forEach((t) => {
      const w = Math.max(0, (t.strokeWidth ?? 0) + d);
      t.set({ strokeWidth: w, stroke: typeof t.stroke === "string" && t.stroke ? t.stroke : "#000000" });
    });
    this.done("Changed border");
  }
  setBorderColor(c: string) { this.targets().forEach((t) => t.set("stroke", c)); this.done("Changed border colour"); }

  // ───────────────────────── arrange ─────────────────────────
  reorder(dir: "front" | "back") {
    this.targets().forEach((t) => (dir === "front" ? this.canvas.bringObjectToFront(t) : this.canvas.sendObjectToBack(t)));
    this.done("Reordered");
  }
  moveLayer(id: string, dir: "up" | "down") {
    const o = this.canvas.getObjects().find((x) => x.id === id);
    if (!o) return;
    if (dir === "up") this.canvas.bringObjectForward(o); else this.canvas.sendObjectBackwards(o);
    this.canvas.requestRenderAll();
    this.commit("Reordered");
  }
  private setLocked(o: FabricObject, locked: boolean) {
    o.set({
      lockMovementX: locked, lockMovementY: locked, lockRotation: locked, lockScalingX: locked, lockScalingY: locked,
      hasControls: !locked, selectable: !locked, evented: !locked,
    });
  }
  toggleLock(id?: string) {
    const objs = id ? this.canvas.getObjects().filter((o) => o.id === id) : this.targets();
    objs.forEach((o) => this.setLocked(o, !(o.lockMovementX === true)));
    this.canvas.discardActiveObject();
    this.canvas.requestRenderAll();
    this.hooks.onSelection(null);
    this.commit("Toggled lock");
  }
  toggleVisible(id: string) {
    const o = this.canvas.getObjects().find((x) => x.id === id);
    if (!o) return;
    o.hidden = !o.hidden;
    o.set("visible", !o.hidden);
    this.canvas.discardActiveObject();
    this.canvas.requestRenderAll();
    this.commit("Toggled visibility");
  }
  async duplicate() {
    const ts = this.targets();
    if (!ts.length) return;
    this.canvas.discardActiveObject();
    const clones: FabricObject[] = [];
    for (const t of ts) {
      const c = await t.clone(CUSTOM_PROPS);
      c.set({ id: uid("el"), left: (t.left ?? 0) + 24, top: (t.top ?? 0) + 24 });
      if (c.role === "headline" || c.role === "sub" || c.role === "logo" || c.role === "details" || c.role === "strip") c.set("role", undefined);
      this.canvas.add(c);
      clones.push(c);
    }
    this.canvas.setActiveObject(clones.length > 1 ? new ActiveSelection(clones, { canvas: this.canvas }) : clones[0]);
    this.canvas.requestRenderAll();
    this.commit("Duplicated");
    this.emitSelection();
  }
  deleteSelected() {
    const ts = this.targets();
    if (!ts.length) return;
    this.canvas.discardActiveObject();
    ts.forEach((t) => this.canvas.remove(t));
    this.canvas.requestRenderAll();
    this.hooks.onSelection(null);
    this.hooks.onCompliance(null);
    this.commit("Deleted");
  }
  group() {
    const a = this.canvas.getActiveObject();
    if (!(a instanceof ActiveSelection)) return;
    const objs = a.getObjects();
    this.canvas.discardActiveObject();
    objs.forEach((o) => this.canvas.remove(o));
    const g = new Group(objs);
    g.set({ id: uid("grp"), kind: "group" });
    this.canvas.add(g);
    this.canvas.setActiveObject(g);
    this.canvas.requestRenderAll();
    this.commit("Grouped");
    this.emitSelection();
  }
  ungroup() {
    const g = this.canvas.getActiveObject();
    if (!(g instanceof Group) || g instanceof ActiveSelection || g.kind === "logo") return;
    const children = g.removeAll();
    const m = g.calcTransformMatrix();
    this.canvas.discardActiveObject();
    this.canvas.remove(g);
    children.forEach((c) => { util.addTransformToObject(c, m); c.setCoords(); this.canvas.add(c); });
    this.canvas.requestRenderAll();
    this.commit("Ungrouped");
    this.hooks.onSelection(null);
  }
  nudge(dx: number, dy: number) {
    const ts = this.targets().filter((t) => t.lockMovementX !== true);
    if (!ts.length) return;
    const a = this.canvas.getActiveObject()!;
    a.set({ left: (a.left ?? 0) + dx, top: (a.top ?? 0) + dy });
    a.setCoords();
    this.canvas.requestRenderAll();
  }

  getLayers(): LayerInfo[] {
    const active = new Set(this.targets().map((t) => t.id));
    return [...this.canvas.getObjects()].reverse().map((o) => ({
      id: o.id ?? "",
      kind: o.kind ?? "shape",
      name: o.layerName || (isText(o) ? (o.text || "Text").slice(0, 22) : (o.role ?? o.kind ?? "Layer").replace(/^./, (c) => c.toUpperCase())),
      visible: !o.hidden,
      locked: o.lockMovementX === true,
      selected: active.has(o.id),
    }));
  }

  // ───────────────────────── export helpers ─────────────────────────
  toDataURL(opts: { format: "png" | "jpeg"; multiplier: number; quality?: number }) {
    const prev = this.canvas.getActiveObject();
    this.canvas.discardActiveObject();
    const texts = this.canvas.getObjects().filter((o): o is Textbox => isText(o) && !!o.templateText);
    texts.forEach((t) => { t.styles = {}; t.dirty = true; });
    const url = this.canvas.toDataURL({ format: opts.format, multiplier: opts.multiplier / this.scale, quality: opts.quality ?? 0.92, enableRetinaScaling: false });
    texts.forEach((t) => this.applyFlags(t));
    if (prev) this.canvas.setActiveObject(prev);
    this.canvas.requestRenderAll();
    return url;
  }
}
