"use client";
import { create } from "zustand";
import type { CanvasController, ComplianceCard, HistoryEntry, SelInfo } from "@/lib/canvas-controller";
import { downloadDesign, renderThumb, type ExportFormat, type ResolutionTier } from "@/lib/export";
import { sizeById } from "@/lib/fabric-setup";
import type { BuildInput } from "@/lib/layouts";
import * as db from "@/lib/persistence";
import { BUILTIN_TEMPLATES, DEFAULT_KITS } from "@/lib/templates";
import type { BrandKit, CommentPin, ContentType, DesignDoc, LayoutId, TemplateDef } from "@/lib/types";
import { uid } from "@/lib/utils";

export type Screen = "gallery" | "type" | "editor";
export type PanelId = "brand" | "design" | "elements" | "text" | "uploads" | "layers" | "overlay" | "comments" | "history" | null;

interface Filters { type: string; topic: string; brand: string; date: string }

interface StudioState {
  ready: boolean;
  screen: Screen;
  persist: db.PersistMode;
  kits: Record<string, BrandKit>;
  activeKitKey: string;
  templates: TemplateDef[];
  recents: db.DesignListItem[];
  modalIndex: number | null;
  setupOpen: boolean;
  query: string;
  filters: Filters;
  listView: boolean;
  toastMsg: { id: number; msg: string } | null;
  pendingTemplate: TemplateDef | null;

  // editor
  doc: DesignDoc | null;
  pageIdx: number;
  controller: CanvasController | null;
  building: boolean;
  sel: SelInfo | null;
  layersVersion: number;
  history: { canUndo: boolean; canRedo: boolean; entries: HistoryEntry[]; index: number };
  compliance: ComplianceCard | null;
  panel: PanelId;
  userZoom: number;
  commentMode: boolean;
  comments: CommentPin[];
  thumbs: Record<string, string>;
  saveState: "saved" | "saving" | "error";
  overlayView: boolean;
  videoPreview: boolean;
  downloadOpen: boolean;
  shareOpen: boolean;
  uploads: string[];

  init(): Promise<void>;
  toast(msg: string): void;
  setActiveKit(key: string): void;
  saveKit(kit: BrandKit): Promise<void>;
  openModal(i: number | null): void;
  setSetupOpen(v: boolean): void;
  setQuery(q: string): void;
  setFilter(k: keyof Filters, v: string): void;
  toggleListView(): void;
  goto(s: Screen): void;
  chooseTemplate(): void;
  startEditor(type: ContentType): Promise<void>;
  openDesign(id: string): Promise<void>;
  leaveEditor(): void;
  attachController(c: CanvasController | null): void;
  setSel(s: SelInfo | null): void;
  bumpLayers(): void;
  setHistory(h: StudioState["history"]): void;
  setCompliance(c: ComplianceCard | null): void;
  setPanel(p: PanelId): void;
  setUserZoom(z: number): void;
  setCommentMode(v: boolean): void;
  addComment(c: Omit<CommentPin, "id">): string;
  updateComment(id: string, text: string): void;
  setOverlay(k: "header" | "footer", v: boolean): void;
  setOverlayView(v: boolean): void;
  setVideoPreview(v: boolean): void;
  setDownloadOpen(v: boolean): void;
  setShareOpen(v: boolean): void;
  addUpload(src: string): void;
  setTitle(t: string): void;

  buildInitial(): Promise<void>;
  buildInput(layout: LayoutId, palette: [string, string], content: BuildInput["content"], kit?: BrandKit): BuildInput;
  switchPage(i: number): Promise<void>;
  addPage(): Promise<void>;
  deletePage(i: number): Promise<void>;
  changeSize(sizeId: string): void;
  applyLayoutFrom(tpl: TemplateDef): Promise<void>;
  reapplySetup(): Promise<void>;
  applyKitAll(): Promise<void>;
  switchDocKit(key: string): Promise<void>;
  onChange(): void;
  flushSave(opts?: { library?: boolean }): Promise<void>;
  saveAsTemplate(name: string): Promise<void>;
  download(format: ExportFormat, tier: ResolutionTier, all: boolean): Promise<void>;
  toggleShare(on: boolean): Promise<void>;
}

let saveTimer: ReturnType<typeof setTimeout> | null = null;
let thumbTimer: ReturnType<typeof setTimeout> | null = null;
let toastId = 0;

const carouselHeads = ["Slide 1 — start with a hook", "Slide 2 — build the idea", "Slide 3 — add supporting detail", "Slide 4 — call to action"];

const applyKitFlag = (k: BrandKit) => k.setupComplete && k.autoApply;

export const useStudio = create<StudioState>((set, get) => ({
  ready: false, screen: "gallery", persist: "unknown",
  kits: structuredClone(DEFAULT_KITS), activeKitKey: "mine",
  templates: BUILTIN_TEMPLATES, recents: [], modalIndex: null, setupOpen: false,
  query: "", filters: { type: "All types", topic: "All categories", brand: "All brand kits", date: "Anytime" },
  listView: false, toastMsg: null, pendingTemplate: null,

  doc: null, pageIdx: 0, controller: null, building: false, sel: null, layersVersion: 0,
  history: { canUndo: false, canRedo: false, entries: [], index: -1 }, compliance: null,
  panel: "brand", userZoom: 1, commentMode: false, comments: [], thumbs: {}, saveState: "saved",
  overlayView: false, videoPreview: false, downloadOpen: false, shareOpen: false, uploads: [],

  async init() {
    if (get().ready) return;
    db.onMode((m) => set({ persist: m }));
    const [kits, custom, recents] = await Promise.all([db.loadKits(), db.listCustomTemplates(), db.listDesigns()]);
    const merged = structuredClone(DEFAULT_KITS);
    kits.forEach((k) => { merged[k.key] = { ...merged[k.key], ...k }; });
    set({ kits: merged, templates: [...custom, ...BUILTIN_TEMPLATES], recents, ready: true });
  },
  toast(msg) { const id = ++toastId; set({ toastMsg: { id, msg } }); },
  setActiveKit(key) { set({ activeKitKey: key }); get().toast(`Now posting as ${get().kits[key].label}`); },
  async saveKit(kit) { set((s) => ({ kits: { ...s.kits, [kit.key]: kit } })); await db.saveKit(kit); },
  openModal(i) { set({ modalIndex: i }); },
  setSetupOpen(v) { set({ setupOpen: v }); },
  setQuery(q) { set({ query: q }); },
  setFilter(k, v) { set((s) => ({ filters: { ...s.filters, [k]: v } })); },
  toggleListView() { set((s) => ({ listView: !s.listView })); },
  goto(s) { set({ screen: s }); },
  chooseTemplate() { const { modalIndex, templates } = get(); if (modalIndex === null) return; set({ pendingTemplate: templates[modalIndex], modalIndex: null, screen: "type" }); },

  async startEditor(type) {
    const { pendingTemplate: tpl, activeKitKey } = get();
    if (!tpl) return;
    const custom = tpl.doc;
    const ids = custom ? custom.pages.length : type === "carousel" ? 4 : type === "video" ? 2 : 1;
    const pages = custom
      ? custom.pages.map((p) => ({ id: uid("pg"), json: structuredClone(p.json) }))
      : Array.from({ length: ids }, () => ({ id: uid("pg"), json: null }));
    const doc: DesignDoc = {
      id: uid("local"), title: tpl.name, templateId: tpl.id, contentType: custom?.contentType ?? type,
      sizeId: custom?.sizeId ?? "post", kitKey: activeKitKey, pages, overlay: { header: false, footer: false },
      status: "draft", palette: tpl.palette, layout: tpl.layout,
    };
    set({ doc, pageIdx: 0, screen: "editor", panel: "brand", userZoom: 1, comments: [], thumbs: {}, uploads: [], sel: null, compliance: null, overlayView: false, commentMode: false, saveState: "saved" });
  },

  async openDesign(id) {
    const d = await db.loadDesign(id);
    if (!d) { get().toast("Could not open that design"); return; }
    const tpl = get().templates.find((t) => t.id === d.templateId) ?? BUILTIN_TEMPLATES[0];
    set({
      pendingTemplate: tpl, doc: { ...d, palette: d.palette ?? tpl.palette, layout: d.layout ?? tpl.layout }, pageIdx: 0, screen: "editor",
      activeKitKey: get().kits[d.kitKey] ? d.kitKey : get().activeKitKey, panel: "brand", userZoom: 1, comments: [], thumbs: {}, uploads: [], sel: null, compliance: null, overlayView: false, saveState: "saved",
    });
  },

  leaveEditor() {
    void get().flushSave();
    get().controller?.dispose();
    set({ screen: "gallery", controller: null, doc: null, downloadOpen: false, shareOpen: false, videoPreview: false });
    void db.listDesigns().then((recents) => set({ recents }));
  },

  attachController(c) { set({ controller: c }); },
  setSel(s) { set({ sel: s }); },
  bumpLayers() { set((s) => ({ layersVersion: s.layersVersion + 1 })); },
  setHistory(h) { set({ history: h }); },
  setCompliance(c) { set({ compliance: c }); },
  setPanel(p) { set({ panel: p }); },
  setUserZoom(z) { set({ userZoom: Math.max(0.5, Math.min(2, Math.round(z * 10) / 10)) }); },
  setCommentMode(v) { set({ commentMode: v }); if (v) get().controller?.clearSelection(); },
  addComment(c) { const id = uid("c"); set((s) => ({ comments: [...s.comments, { ...c, id }] })); return id; },
  updateComment(id, text) { set((s) => ({ comments: s.comments.map((c) => (c.id === id ? { ...c, text } : c)) })); },
  setOverlay(k, v) { set((s) => (s.doc ? { doc: { ...s.doc, overlay: { ...s.doc.overlay, [k]: v } } } : {})); get().onChange(); },
  setOverlayView(v) { set({ overlayView: v }); },
  setVideoPreview(v) { set({ videoPreview: v }); },
  setDownloadOpen(v) { set({ downloadOpen: v, shareOpen: v ? false : get().shareOpen }); },
  setShareOpen(v) { set({ shareOpen: v, downloadOpen: v ? false : get().downloadOpen }); },
  addUpload(src) { set((s) => ({ uploads: [src, ...s.uploads] })); },
  setTitle(t) { set((s) => (s.doc ? { doc: { ...s.doc, title: t } } : {})); get().onChange(); },

  buildInput(layout, palette, content, kit) {
    const { doc, activeKitKey, kits } = get();
    const k = kit ?? kits[doc?.kitKey ?? activeKitKey];
    const size = sizeById(doc?.sizeId ?? "post");
    return { kit: k, applyKit: applyKitFlag(k), layout, palette, content, w: size.w, h: size.h };
  },

  async buildInitial() {
    const { doc, controller, pendingTemplate: tpl } = get();
    if (!doc || !controller || !tpl) return;
    set({ building: true });
    const size = sizeById(doc.sizeId);
    controller.setLogicalSize(size.w, size.h);
    controller.brandColor = get().kits[doc.kitKey].color;
    const pages = [...doc.pages];
    if (pages.some((p) => p.json === null)) {
      for (let i = 0; i < pages.length; i++) {
        if (pages[i].json) continue;
        const content = {
          headline: doc.contentType === "carousel" ? (i === 0 ? tpl.headline : carouselHeads[i] ?? "New slide") : doc.contentType === "video" ? (i === 0 ? tpl.headline : "Thanks for watching!") : tpl.headline,
          sub: tpl.sub, stat: tpl.stat,
        };
        await controller.buildFromInput(get().buildInput(doc.layout ?? tpl.layout, doc.palette ?? tpl.palette, content));
        pages[i] = { ...pages[i], json: controller.serialize() };
      }
    }
    const newDoc = { ...doc, pages };
    set({ doc: newDoc, pageIdx: 0 });
    await controller.loadPage(pages[0].id, pages[0].json);
    set({ building: false });
    const kit = get().kits[doc.kitKey];
    if (applyKitFlag(kit)) get().toast(`Branded automatically with ${kit.label}`);
    void Promise.all(pages.map(async (p) => {
      const t = await renderThumb(p.json, size.w, size.h);
      set((s) => ({ thumbs: { ...s.thumbs, [p.id]: t } }));
    }));
  },

  async switchPage(i) {
    const { doc, controller, pageIdx } = get();
    if (!doc || !controller || i === pageIdx || i < 0 || i >= doc.pages.length) return;
    const pages = doc.pages.map((p, k) => (k === pageIdx ? { ...p, json: controller.serialize() } : p));
    set({ doc: { ...doc, pages }, pageIdx: i, overlayView: false });
    await controller.loadPage(pages[i].id, pages[i].json);
  },

  async addPage() {
    const { doc, controller, pageIdx, pendingTemplate: tpl } = get();
    if (!doc || !controller || !tpl) return;
    const cur = doc.pages.map((p, k) => (k === pageIdx ? { ...p, json: controller.serialize() } : p));
    const id = uid("pg");
    await controller.buildFromInput(get().buildInput(doc.layout ?? tpl.layout, doc.palette ?? tpl.palette, { headline: "New slide", sub: tpl.sub, stat: tpl.stat }));
    const json = controller.serialize();
    const pages = [...cur, { id, json }];
    set({ doc: { ...doc, pages }, pageIdx: pages.length - 1 });
    await controller.loadPage(id, json);
    get().toast(`Slide ${pages.length} added`);
    get().onChange();
  },

  async deletePage(i) {
    const { doc, controller, pageIdx } = get();
    if (!doc || !controller || doc.pages.length <= 1) return;
    const cur = doc.pages.map((p, k) => (k === pageIdx ? { ...p, json: controller.serialize() } : p));
    const pages = cur.filter((_, k) => k !== i);
    const next = Math.min(pageIdx > i ? pageIdx - 1 : pageIdx === i ? Math.min(i, pages.length - 1) : pageIdx, pages.length - 1);
    set({ doc: { ...doc, pages }, pageIdx: next });
    await controller.loadPage(pages[next].id, pages[next].json);
    get().onChange();
  },

  changeSize(sizeId) {
    const { doc, controller } = get();
    if (!doc || !controller) return;
    const s = sizeById(sizeId);
    set({ doc: { ...doc, sizeId } });
    controller.setLogicalSize(s.w, s.h);
    controller.commitSoft("Resized canvas");
    get().toast("Canvas resized — reposition elements as needed");
  },

  async applyLayoutFrom(tpl) {
    const { doc, controller } = get();
    if (!doc || !controller) return;
    const input = get().buildInput(tpl.layout, tpl.palette, { headline: "", sub: "" });
    await controller.switchLayout(tpl.layout, tpl.palette, { kit: input.kit, applyKit: input.applyKit, w: input.w, h: input.h });
    set({ doc: { ...doc, layout: tpl.layout, palette: tpl.palette } });
    get().toast(`Layout: ${tpl.name} — your text, image and logo carried over`);
  },

  async reapplySetup() {
    const { doc, controller } = get();
    if (!doc || !controller) return;
    const kit = get().kits[doc.kitKey];
    if (!kit.setupComplete) { get().toast("Set up cobranding first — opening setup"); set({ setupOpen: true }); return; }
    await controller.reapplyKit(kit, doc.palette ?? BUILTIN_TEMPLATES[0].palette);
    get().toast(`Applied ${kit.label} branding to this post`);
  },
  async applyKitAll() {
    const { doc, controller } = get();
    if (!doc || !controller) return;
    const kit = get().kits[doc.kitKey];
    controller.brandColor = kit.color;
    await controller.applyKitToAll(kit, doc.palette ?? BUILTIN_TEMPLATES[0].palette);
    get().toast("Brand kit applied to all elements");
  },

  async switchDocKit(key) {
    const { doc, kits } = get();
    if (!doc || !kits[key]) return;
    set({ doc: { ...doc, kitKey: key }, activeKitKey: key });
    if (!kits[key].setupComplete) { get().toast(`${kits[key].label} isn't set up yet — opening setup`); set({ setupOpen: true }); return; }
    await get().applyKitAll();
    get().onChange();
  },

  onChange() {
    const { doc, controller } = get();
    if (!doc) return;
    set({ saveState: "saving" });
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(() => void get().flushSave(), 2000);
    if (thumbTimer) clearTimeout(thumbTimer);
    thumbTimer = setTimeout(() => {
      const { doc: d, controller: c, pageIdx } = get();
      if (!d || !c) return;
      const id = d.pages[pageIdx]?.id;
      if (!id) return;
      const s = sizeById(d.sizeId);
      try { set((st) => ({ thumbs: { ...st.thumbs, [id]: c.toDataURL({ format: "jpeg", multiplier: 160 / s.w, quality: 0.6 }) } })); } catch { /* canvas busy */ }
    }, 500);
    void controller;
  },

  async flushSave(opts) {
    if (saveTimer) { clearTimeout(saveTimer); saveTimer = null; }
    const { doc, controller, pageIdx } = get();
    if (!doc || !controller || get().building) return;
    const pages = doc.pages.map((p, k) => (k === pageIdx ? { ...p, json: controller.serialize() } : p));
    const next: DesignDoc = { ...doc, pages, status: opts?.library ? "library" : doc.status };
    try {
      const s = sizeById(doc.sizeId);
      const thumb = await renderThumb(pages[0].json, s.w, s.h, 240);
      const id = await db.saveDesign(next, thumb);
      set((st) => (st.doc ? { doc: { ...st.doc, id, pages: st.doc.pages.map((p, k) => (k === pageIdx ? { ...p, json: pages[pageIdx].json } : p)), status: next.status }, saveState: "saved" } : {}));
    } catch {
      set({ saveState: "error" });
    }
  },

  async saveAsTemplate(name) {
    const { doc, controller, pageIdx, pendingTemplate: tpl } = get();
    if (!doc || !controller) return;
    const pages = doc.pages.map((p, k) => (k === pageIdx ? { ...p, json: controller.serialize() } : p));
    const s = sizeById(doc.sizeId);
    const thumbnail = await renderThumb(pages[0].json, s.w, s.h, 320);
    const saved = await db.saveCustomTemplate({
      name, category: "Custom", topic: tpl?.topic ?? "Mutual Funds", layout: doc.layout ?? "hero",
      palette: doc.palette ?? ["#2B2BB5", "#0D0D5C"], headline: "", sub: "", custom: true, thumbnail,
      doc: { ...doc, pages: pages.map((p) => ({ id: p.id, json: p.json })), id: "template", status: "draft" },
    });
    set((st) => ({ templates: [saved, ...st.templates] }));
    get().toast(`Saved “${name}” as a template`);
  },

  async download(format, tier, all) {
    const { doc, controller, pageIdx } = get();
    if (!doc || !controller) return;
    const s = sizeById(doc.sizeId);
    const kit = get().kits[doc.kitKey];
    const overlay = doc.contentType === "video" && (doc.overlay.header || doc.overlay.footer)
      ? { header: doc.overlay.header, footer: doc.overlay.footer, kit, palette: doc.palette ?? BUILTIN_TEMPLATES[0].palette }
      : null;
    await downloadDesign({ doc, currentJson: controller.serialize(), currentIndex: pageIdx, w: s.w, h: s.h, format, tier, all, overlay });
  },

  async toggleShare(on) {
    const { doc } = get();
    if (!doc) return;
    await get().flushSave();
    const id = get().doc!.id;
    const r = await db.setShare(id, on);
    if (!r) { get().toast("Sharing needs cloud storage — set SUPABASE_SERVICE_ROLE_KEY"); return; }
    set((st) => (st.doc ? { doc: { ...st.doc, isShared: r.isShared, shareToken: r.shareToken } } : {}));
  },
}));
