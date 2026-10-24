"use client";
import { Check, Copy, Download, Link2, Loader2, ShieldAlert } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import type { ExportFormat, ResolutionTier } from "@/lib/export";
import { gradientCss } from "@/lib/templates";
import { cn } from "@/lib/utils";
import { useStudio } from "@/store/studio-store";

export function CompliancePopover() {
  const { compliance, controller: c } = useStudio();
  if (!compliance || !c || compliance.flags.length === 0) return null;
  return (
    <div role="alert" className="pop-in absolute left-1/2 top-[60px] z-30 w-[380px] max-w-[92%] -translate-x-1/2 rounded-lg border border-amber-300 bg-white p-3.5 shadow-4">
      <div className="mb-2 flex items-center gap-2 text-[13px] font-bold text-warn-ink"><ShieldAlert className="size-4" />SEBI compliance check</div>
      <ul className="space-y-2.5">
        {compliance.flags.map((f) => (
          <li key={f.term} className="text-xs">
            <div className="mb-1.5 text-ink-soft">“<b className="text-ink">{f.raw}</b>” may be a restricted term. Try:</div>
            <div className="flex flex-wrap gap-1.5">
              {f.alts.map((a) => <button key={a} onMouseDown={(e) => e.preventDefault()} onClick={() => c.replaceFlag(compliance.objId, f.term, a)} className="rounded-full border border-accent bg-accent-soft px-2.5 py-1 font-semibold text-accent hover:bg-accent hover:text-white">{a}</button>)}
              <button onMouseDown={(e) => e.preventDefault()} onClick={() => c.keepFlag(compliance.objId, f.term)} className="rounded-full border border-line-2 px-2.5 py-1 font-semibold text-ink-soft hover:border-ink">Keep as is</button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function DownloadPopover() {
  const { downloadOpen, setDownloadOpen, download, doc } = useStudio();
  const [fmt, setFmt] = useState<ExportFormat>("png");
  const [tier, setTier] = useState<ResolutionTier>("high");
  const [all, setAll] = useState(false);
  const [busy, setBusy] = useState(false);
  if (!downloadOpen || !doc) return null;
  const multi = doc.pages.length > 1;
  return (
    <div className="pop-in absolute right-4 top-14 z-[150] w-[300px] rounded-xl border border-line-2 bg-white p-4 shadow-4">
      <div className="mb-3 text-sm font-extrabold">Download</div>
      <div className="mb-3 grid grid-cols-3 gap-1.5">
        {(["png", "jpg", "pdf"] as const).map((f) => <button key={f} onClick={() => setFmt(f)} className={cn("h-9 rounded-md border text-xs font-bold uppercase", fmt === f ? "border-accent bg-accent text-white" : "border-line-2 text-ink-soft hover:border-accent")}>{f}</button>)}
      </div>
      <div className="mb-3 grid grid-cols-3 gap-1.5">
        {([["high", "High"], ["medium", "Medium"], ["low", "Low"]] as const).map(([k, l]) => <button key={k} onClick={() => setTier(k)} className={cn("h-9 rounded-md border text-xs font-semibold", tier === k ? "border-accent bg-accent-soft text-accent" : "border-line-2 text-ink-soft hover:border-accent")}>{l}</button>)}
      </div>
      {multi && <label className="mb-3 flex items-center justify-between text-[13px] font-medium">All {doc.pages.length} pages<Switch checked={all} onCheckedChange={setAll} /></label>}
      <Button className="w-full" disabled={busy} onClick={async () => { setBusy(true); try { await download(fmt, tier, all); setDownloadOpen(false); } catch { useStudio.getState().toast("Export failed — try a lower resolution"); } setBusy(false); }}>
        {busy ? <Loader2 className="animate-spin" /> : <Download />}Download {all && multi ? "(ZIP)" : fmt.toUpperCase()}
      </Button>
    </div>
  );
}

export function SharePopover() {
  const { shareOpen, setShareOpen, doc, toggleShare, saveAsTemplate, persist } = useStudio();
  const [copied, setCopied] = useState(false);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  if (!shareOpen || !doc) return null;
  const link = doc.isShared && doc.shareToken ? `${location.origin}/share/${doc.shareToken}` : "";
  return (
    <div className="pop-in absolute right-4 top-14 z-[150] w-[340px] rounded-xl border border-line-2 bg-white p-4 shadow-4">
      <div className="mb-3 text-sm font-extrabold">Share</div>
      <label className="mb-2 flex items-center justify-between text-[13px] font-medium"><span className="flex items-center gap-2"><Link2 className="size-4 text-ink-faint" />Anyone with the link can view</span>
        <Switch checked={!!doc.isShared} disabled={persist === "local"} onCheckedChange={(v) => void toggleShare(v)} /></label>
      {persist === "local" && <p className="mb-2 text-xs text-warn-ink">Sharing needs cloud storage (Supabase not configured).</p>}
      {link && (
        <div className="mb-3 flex gap-1.5"><Input readOnly value={link} className="h-9 text-xs" onFocus={(e) => e.currentTarget.select()} />
          <Button size="icon" variant="outline" aria-label="Copy link" onClick={async () => { await navigator.clipboard.writeText(link); setCopied(true); setTimeout(() => setCopied(false), 1500); }}>{copied ? <Check /> : <Copy />}</Button></div>
      )}
      <div className="mt-3 border-t border-line pt-3">
        <div className="mb-1.5 text-xs font-bold text-ink-soft">Save as template</div>
        <div className="flex gap-1.5"><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Template name" className="h-9" />
          <Button size="sm" className="h-9" disabled={!name.trim() || busy} onClick={async () => { setBusy(true); await saveAsTemplate(name.trim()); setBusy(false); setName(""); setShareOpen(false); }}>Save</Button></div>
      </div>
    </div>
  );
}

export function VideoPreview() {
  const { videoPreview, setVideoPreview, doc, thumbs, kits, pendingTemplate } = useStudio();
  if (!doc) return null;
  const kit = kits[doc.kitKey];
  const pal = doc.palette ?? pendingTemplate?.palette ?? ["#2B2BB5", "#0D0D5C"];
  const first = doc.pages[0], last = doc.pages[doc.pages.length - 1];
  const Frame = ({ id, label }: { id: string; label: string }) => (
    <div className="w-[220px]">
      <div className="relative aspect-square overflow-hidden rounded-lg bg-ink shadow-3" style={thumbs[id] ? { backgroundImage: `url(${thumbs[id]})`, backgroundSize: "cover" } : undefined}>
        {doc.overlay.header && <div className="absolute inset-x-0 top-0 flex h-7 items-center px-2 text-[8px] font-bold text-white" style={{ background: gradientCss(pal) }}>{kit.logoName}</div>}
        {doc.overlay.footer && <div className="absolute inset-x-0 bottom-0 flex h-7 items-center truncate px-2 text-[8px] font-semibold text-white" style={{ background: gradientCss(pal) }}>{kit.companyName} · {kit.rrn}</div>}
      </div>
      <div className="mt-2 text-center text-xs font-semibold text-ink-soft">{label}</div>
    </div>
  );
  return (
    <Dialog open={videoPreview} onOpenChange={setVideoPreview}>
      <DialogContent className="w-[560px] p-6">
        <DialogTitle className="mb-4 text-lg">Video frames</DialogTitle>
        <div className="flex justify-center gap-6">{first && <Frame id={first.id} label="First frame" />}{last && last !== first && <Frame id={last.id} label="Last frame" />}</div>
        <p className="mt-4 text-center text-xs text-ink-soft">Bars appear across the whole video when enabled. Export gives you the branded first and last frames as images.</p>
      </DialogContent>
    </Dialog>
  );
}

export function CommentsLayer({ scale }: { scale: number }) {
  const { comments, commentMode, doc, pageIdx, addComment, updateComment, setCommentMode, setPanel } = useStudio();
  const [openId, setOpenId] = useState<string | null>(null);
  const pageId = doc?.pages[pageIdx]?.id;
  const mine = comments.filter((m) => m.pageId === pageId);
  return (
    <div className={cn("absolute inset-0 z-20", commentMode ? "cursor-crosshair" : "pointer-events-none")}
      onClick={(e) => {
        if (!commentMode || !pageId) return;
        const r = e.currentTarget.getBoundingClientRect();
        const id = addComment({ pageId, x: (e.clientX - r.left) / scale, y: (e.clientY - r.top) / scale, text: "" });
        setOpenId(id); setCommentMode(false); setPanel("comments");
      }}>
      {mine.map((m, i) => (
        <div key={m.id} className="pointer-events-auto absolute" style={{ left: m.x * scale, top: m.y * scale }} onClick={(e) => e.stopPropagation()}>
          <button aria-label={`Comment ${i + 1}`} onClick={() => setOpenId(openId === m.id ? null : m.id)} className="-translate-x-1/2 -translate-y-full grid size-7 place-items-center rounded-full rounded-bl-none bg-accent text-[11px] font-bold text-white shadow-3">{i + 1}</button>
          {openId === m.id && <textarea autoFocus value={m.text} onChange={(e) => updateComment(m.id, e.target.value)} placeholder="Write a comment…" className="absolute left-0 top-1 h-20 w-52 resize-none rounded-lg border border-line-2 bg-white p-2 text-xs shadow-4 outline-none focus:border-accent" />}
        </div>
      ))}
    </div>
  );
}
