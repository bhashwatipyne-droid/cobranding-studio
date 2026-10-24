"use client";
import {
  ArrowLeft, Check, CloudOff, Download, Film, History, Image as ImageIcon, Layers, Loader2, LayoutTemplate, MessageSquare, Palette, Plus, Redo2, Share2, Shapes, Trash2, Type, Undo2, Upload, ZoomIn, ZoomOut,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Tip } from "@/components/ui/tooltip";
import { CanvasController } from "@/lib/canvas-controller";
import { sizeById } from "@/lib/fabric-setup";
import { cn } from "@/lib/utils";
import { type PanelId, useStudio } from "@/store/studio-store";
import { ContextToolbar } from "./ContextToolbar";
import { Panels } from "./Panels";
import { CommentsLayer, CompliancePopover, DownloadPopover, SharePopover, VideoPreview } from "./Popovers";

const RAIL: { id: Exclude<PanelId, null>; label: string; icon: React.ReactNode; videoOnly?: boolean }[] = [
  { id: "brand", label: "Brand", icon: <Palette /> },
  { id: "design", label: "Design", icon: <LayoutTemplate /> },
  { id: "elements", label: "Elements", icon: <Shapes /> },
  { id: "text", label: "Text", icon: <Type /> },
  { id: "uploads", label: "Uploads", icon: <Upload /> },
  { id: "layers", label: "Layers", icon: <Layers /> },
  { id: "overlay", label: "Overlay", icon: <Film />, videoOnly: true },
  { id: "comments", label: "Comments", icon: <MessageSquare /> },
  { id: "history", label: "History", icon: <History /> },
];

export function EditorScreen() {
  const s = useStudio();
  const { doc, panel, history, saveState, userZoom, controller, building } = s;
  const hostRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.5);

  // ── mount controller
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const el = document.createElement("canvas");
    host.appendChild(el);
    const st = useStudio.getState;
    const c = new CanvasController(el, {
      onSelection: (i) => st().setSel(i),
      onLayers: () => st().bumpLayers(),
      onHistory: (h) => st().setHistory(h),
      onChange: () => st().onChange(),
      onCompliance: (card) => st().setCompliance(card),
      toast: (m) => st().toast(m),
    });
    st().attachController(c);
    void st().buildInitial();
    return () => {
      st().attachController(null);
      try { c.dispose(); } catch { /* already disposed */ }
      host.innerHTML = "";
    };
  }, []);

  // ── fit to stage
  const fit = useCallback(() => {
    const stage = stageRef.current, c = useStudio.getState().controller, d = useStudio.getState().doc;
    if (!stage || !c || !d) return;
    const z = sizeById(d.sizeId);
    const pad = 48;
    const f = Math.min((stage.clientWidth - pad) / z.w, (stage.clientHeight - pad) / z.h);
    const sc = Math.max(0.05, f * useStudio.getState().userZoom);
    c.setLogicalSize(z.w, z.h);
    c.setDisplayScale(sc);
    setScale(sc);
  }, []);
  useEffect(() => {
    const ro = new ResizeObserver(fit);
    if (stageRef.current) ro.observe(stageRef.current);
    return () => ro.disconnect();
  }, [fit]);
  useEffect(() => { fit(); }, [fit, controller, userZoom, doc?.sizeId, panel, building]);

  // ── keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const c = useStudio.getState().controller;
      const tgt = e.target as HTMLElement;
      if (!c || /^(INPUT|TEXTAREA|SELECT)$/.test(tgt.tagName) || c.isEditingText()) return;
      const mod = e.ctrlKey || e.metaKey;
      const k = e.key.toLowerCase();
      if (mod && k === "z") { e.preventDefault(); e.shiftKey ? c.redo() : c.undo(); }
      else if (mod && k === "y") { e.preventDefault(); c.redo(); }
      else if (mod && k === "d") { e.preventDefault(); void c.duplicate(); }
      else if (mod && k === "a") { e.preventDefault(); c.selectAll(); }
      else if (mod && k === "g") { e.preventDefault(); e.shiftKey ? c.ungroup() : c.group(); }
      else if (e.key === "Delete" || e.key === "Backspace") { e.preventDefault(); c.deleteSelected(); }
      else if (e.key === "Escape") { c.clearSelection(); useStudio.getState().setCommentMode(false); }
      else if (e.key.startsWith("Arrow")) {
        e.preventDefault();
        const d = e.shiftKey ? 10 : 1;
        c.nudge(e.key === "ArrowLeft" ? -d : e.key === "ArrowRight" ? d : 0, e.key === "ArrowUp" ? -d : e.key === "ArrowDown" ? d : 0);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // warn on unload with unsaved work
  useEffect(() => {
    const h = (e: BeforeUnloadEvent) => { if (useStudio.getState().saveState !== "saved") { e.preventDefault(); } };
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, []);

  if (!doc) return null;
  const size = sizeById(doc.sizeId);
  const isVideo = doc.contentType === "video";
  const kit = s.kits[doc.kitKey];

  return (
    <div className="flex h-screen flex-col bg-surface-2" onClick={() => { if (s.downloadOpen) s.setDownloadOpen(false); if (s.shareOpen) s.setShareOpen(false); }}>
      {/* top bar */}
      <header className="relative z-40 flex h-14 shrink-0 items-center gap-2 border-b border-line bg-surface px-3" onClick={(e) => e.stopPropagation()}>
        <Tip label="Back to templates"><button aria-label="Back" onClick={() => s.leaveEditor()} className="grid size-9 place-items-center rounded-md text-ink-soft hover:bg-accent-soft hover:text-accent"><ArrowLeft className="size-[18px]" /></button></Tip>
        <input aria-label="Design title" value={doc.title} onChange={(e) => s.setTitle(e.target.value)} className="h-9 w-56 rounded-md border border-transparent bg-transparent px-2 text-sm font-bold outline-none hover:border-line-2 focus:border-accent" />
        <span className="flex items-center gap-1.5 text-xs text-ink-faint" aria-live="polite">
          {saveState === "saving" ? <><Loader2 className="size-3.5 animate-spin" />Saving…</> : saveState === "error" ? <><CloudOff className="size-3.5 text-danger" />Not saved</> : <><Check className="size-3.5 text-ok" />Saved</>}
        </span>
        <div className="flex-1" />
        <Tip label="Undo (Ctrl+Z)"><button aria-label="Undo" disabled={!history.canUndo} onClick={() => controller?.undo()} className="grid size-9 place-items-center rounded-md text-ink-soft hover:bg-accent-soft disabled:opacity-30"><Undo2 className="size-[18px]" /></button></Tip>
        <Tip label="Redo (Ctrl+Shift+Z)"><button aria-label="Redo" disabled={!history.canRedo} onClick={() => controller?.redo()} className="grid size-9 place-items-center rounded-md text-ink-soft hover:bg-accent-soft disabled:opacity-30"><Redo2 className="size-[18px]" /></button></Tip>
        <span className="mx-1 h-6 w-px bg-line-2" />
        <button onClick={() => s.setShareOpen(!s.shareOpen)} className="inline-flex h-9 items-center gap-1.5 rounded-md border border-line-2 px-3 text-[13px] font-semibold hover:border-accent hover:text-accent"><Share2 className="size-4" />Share</button>
        <button onClick={() => s.setDownloadOpen(!s.downloadOpen)} className="inline-flex h-9 items-center gap-1.5 rounded-md bg-accent px-3.5 text-[13px] font-semibold text-white shadow-[0_3px_10px_rgba(43,43,181,.24)] hover:bg-accent-dark"><Download className="size-4" />Download</button>
        <DownloadPopover /><SharePopover />
      </header>

      <div className="flex min-h-0 flex-1">
        {/* rail */}
        <nav className="flex w-[72px] shrink-0 flex-col items-center gap-1 border-r border-line bg-surface py-2" aria-label="Tools">
          {RAIL.filter((r) => !r.videoOnly || isVideo).map((r) => (
            <button key={r.id} aria-pressed={panel === r.id} onClick={() => s.setPanel(panel === r.id ? null : r.id)} className={cn("flex w-14 flex-col items-center gap-1 rounded-lg py-2 text-[10.5px] font-semibold transition [&_svg]:size-5", panel === r.id ? "bg-accent-soft text-accent" : "text-ink-soft hover:bg-surface-2")}>
              {r.icon}{r.label}
            </button>
          ))}
        </nav>
        <Panels />

        {/* stage */}
        <main className="relative flex min-w-0 flex-1 flex-col">
          <ContextToolbar />
          <div ref={stageRef} className="relative flex-1 overflow-auto" onMouseDown={(e) => { if (e.target === e.currentTarget || (e.target as HTMLElement).dataset.stage) controller?.clearSelection(); }}>
            <div data-stage="1" className="flex min-h-full min-w-full items-center justify-center p-6">
              <div className="relative">
                <div ref={hostRef} />
                {isVideo && (s.overlayView || doc.overlay.header || doc.overlay.footer) && (
                  <div className="pointer-events-none absolute inset-0" style={{ width: size.w * scale, height: size.h * scale }}>
                    {doc.overlay.header && <div className="absolute inset-x-0 top-0 flex items-center px-3 text-[11px] font-bold text-white" style={{ height: size.h * scale * 0.08, background: `linear-gradient(90deg, ${kit.color}, ${kit.secondary})` }}>{kit.logoName}</div>}
                    {doc.overlay.footer && <div className="absolute inset-x-0 bottom-0 flex items-center truncate px-3 text-[10px] font-semibold text-white" style={{ height: size.h * scale * 0.08, background: `linear-gradient(90deg, ${kit.color}, ${kit.secondary})` }}>{kit.companyName} · {kit.rrn}</div>}
                  </div>
                )}
                <CommentsLayer scale={scale} />
                {building && <div className="absolute inset-0 z-40 grid place-items-center bg-white/70"><Loader2 className="size-7 animate-spin text-accent" /></div>}
              </div>
            </div>
          </div>
          <CompliancePopover />

          {/* zoom bar */}
          <div className="absolute bottom-3 right-4 z-30 flex items-center gap-1 rounded-full border border-line-2 bg-white px-1.5 py-1 shadow-3">
            <button aria-label="Zoom out" onClick={() => s.setUserZoom(userZoom - 0.1)} className="grid size-7 place-items-center rounded-full text-ink-soft hover:bg-accent-soft"><ZoomOut className="size-4" /></button>
            <button onClick={() => s.setUserZoom(1)} className="w-12 text-center text-xs font-bold tabular-nums">{Math.round(scale * 100)}%</button>
            <button aria-label="Zoom in" onClick={() => s.setUserZoom(userZoom + 0.1)} className="grid size-7 place-items-center rounded-full text-ink-soft hover:bg-accent-soft"><ZoomIn className="size-4" /></button>
          </div>

          {/* pages */}
          {doc.contentType !== "single" && (
            <div className="flex h-[104px] shrink-0 items-center gap-3 overflow-x-auto border-t border-line bg-surface px-4">
              {doc.pages.map((p, i) => (
                <div key={p.id} className="group relative shrink-0">
                  <button onClick={() => void s.switchPage(i)} aria-label={`Page ${i + 1}`} className={cn("block h-[72px] w-[72px] overflow-hidden rounded-md border-2 bg-field", i === s.pageIdx ? "border-accent" : "border-line-2 hover:border-accent-200")}>
                    {s.thumbs[p.id] ? <img src={s.thumbs[p.id]} alt="" className="size-full object-cover" /> : <ImageIcon className="m-auto size-5 text-ink-faint" />}
                  </button>
                  <div className="mt-1 text-center text-[10px] font-semibold text-ink-soft">{isVideo ? (i === 0 ? "First" : "Last") : i + 1}</div>
                  {!isVideo && doc.pages.length > 1 && <button aria-label="Delete page" onClick={() => void s.deletePage(i)} className="absolute -right-1.5 -top-1.5 hidden size-5 place-items-center rounded-full bg-white text-danger shadow-2 group-hover:grid"><Trash2 className="size-3" /></button>}
                </div>
              ))}
              {!isVideo && <button aria-label="Add page" onClick={() => void s.addPage()} className="grid size-[72px] shrink-0 place-items-center self-start rounded-md border-2 border-dashed border-line-2 text-ink-faint hover:border-accent hover:text-accent"><Plus className="size-5" /></button>}
            </div>
          )}
        </main>
      </div>
      <VideoPreview />
    </div>
  );
}
