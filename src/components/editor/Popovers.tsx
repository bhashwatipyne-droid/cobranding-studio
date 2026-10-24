"use client";
import { Check, Copy, Download, Link2, Loader2, Pause, Play, ShieldAlert, X } from "lucide-react";
import { useEffect, useState } from "react";
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
  const [dismissed, setDismissed] = useState<unknown>(null);
  if (!compliance || !c || dismissed === compliance) return null;
  const has = compliance.flags.length > 0;
  return (
    <div role="alert" className="pop-in absolute left-1/2 top-[60px] z-30 w-[400px] max-w-[92%] -translate-x-1/2 rounded-lg border border-amber-300 bg-white p-3.5 shadow-4">
      <div className="mb-1.5 flex items-center gap-2 text-[13px] font-bold text-warn-ink">
        <ShieldAlert className="size-4" />Editing template text
        <button aria-label="Dismiss" onMouseDown={(e) => e.preventDefault()} onClick={() => setDismissed(compliance)} className="ml-auto grid size-6 place-items-center rounded-full text-ink-faint hover:bg-surface-2 hover:text-ink"><X className="size-3.5" /></button>
      </div>
      <p className="mb-2 text-xs text-ink-soft">{has ? "Edited copy may make this text non-SEBI compliant. Review carefully before publishing." : "No flagged terms found, but any specific return, safety or performance claim should still go through compliance review."}</p>
      <ul className="space-y-2.5">
        {compliance.flags.map((f) => (
          <li key={f.term} className="text-xs">
            <div className="mb-1.5 text-ink-soft">&ldquo;<b className="text-ink">{f.raw}</b>&rdquo; may be a restricted term. Try:</div>
            <div className="flex flex-wrap gap-1.5">
              {f.alts.slice(0, 3).map((a) => <button key={a} onMouseDown={(e) => e.preventDefault()} onClick={() => c.replaceFlag(compliance.objId, f.term, a)} className="rounded-full border border-accent bg-accent-soft px-2.5 py-1 font-semibold text-accent hover:bg-accent hover:text-white">{a}</button>)}
              <button onMouseDown={(e) => e.preventDefault()} onClick={() => c.keepFlag(compliance.objId, f.term)} className="rounded-full border border-line-2 px-2.5 py-1 font-semibold text-ink-soft hover:border-ink">Keep as is</button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function DownloadPopover() {
  const { downloadOpen, setDownloadOpen, download, doc, flushSave, toast, setShareOpen, leaveEditor } = useStudio();
  const [fmt, setFmt] = useState<ExportFormat>("png");
  const [tier, setTier] = useState<ResolutionTier>("high");
  const [all, setAll] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  if (!downloadOpen || !doc) return null;
  const multi = doc.pages.length > 1;
  const close = () => { setDownloadOpen(false); setDone(false); };
  return (
    <div className="pop-in absolute right-4 top-14 z-[150] w-[300px] rounded-xl border border-line-2 bg-white p-4 shadow-4" onClick={(e) => e.stopPropagation()}>
      {done ? (
        <div className="text-center">
          <div className="mx-auto mb-2 grid size-11 place-items-center rounded-full bg-emerald-50 text-ok"><Check className="size-6" /></div>
          <div className="mb-3 text-sm font-extrabold">Downloaded</div>
          <div className="space-y-2">
            <Button className="w-full" onClick={async () => { await flushSave({ library: true }); toast("Saved to your library"); close(); }}>Save to Library</Button>
            <Button className="w-full" variant="outline" onClick={() => { close(); setShareOpen(true); }}>Share</Button>
            <Button className="w-full" variant="ghost" onClick={() => { close(); leaveEditor(); }}>Start new</Button>
          </div>
        </div>
      ) : (
        <>
          <div className="mb-3 text-sm font-extrabold">Download</div>
          <div className="mb-3 grid grid-cols-3 gap-1.5">
            {(["png", "jpg", "pdf"] as const).map((f) => <button key={f} onClick={() => setFmt(f)} className={cn("h-9 rounded-md border text-xs font-bold uppercase", fmt === f ? "border-accent bg-accent text-white" : "border-line-2 text-ink-soft hover:border-accent")}>{f}</button>)}
          </div>
          <div className="mb-3 grid grid-cols-3 gap-1.5">
            {([["high", "High"], ["medium", "Medium"], ["low", "Web (low)"]] as const).map(([k, l]) => <button key={k} onClick={() => setTier(k)} className={cn("h-9 rounded-md border text-xs font-semibold", tier === k ? "border-accent bg-accent-soft text-accent" : "border-line-2 text-ink-soft hover:border-accent")}>{l}</button>)}
          </div>
          {multi && <label className="mb-3 flex items-center justify-between text-[13px] font-medium">Download all {doc.pages.length} pages<Switch checked={all} onCheckedChange={setAll} /></label>}
          <Button className="w-full" disabled={busy} onClick={async () => { setBusy(true); try { await download(fmt, tier, all); setDone(true); } catch { toast("Export failed — try a lower resolution"); } setBusy(false); }}>
            {busy ? <Loader2 className="animate-spin" /> : <Download />}Download {all && multi ? "(ZIP)" : fmt.toUpperCase()}
          </Button>
        </>
      )}
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
  const [t, setT] = useState(0);
  const [playing, setPlaying] = useState(true);
  useEffect(() => {
    if (!videoPreview || !playing) return;
    let raf = 0, last = performance.now();
    const tick = (now: number) => { const dt = (now - last) / 1000; last = now; setT((p) => (p + dt / 6) % 1); raf = requestAnimationFrame(tick); };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [videoPreview, playing]);
  useEffect(() => { if (videoPreview) { setT(0); setPlaying(true); } }, [videoPreview]);
  if (!doc) return null;
  const kit = kits[doc.kitKey];
  const pal = doc.palette ?? pendingTemplate?.palette ?? ["#2B2BB5", "#0D0D5C"];
  const first = doc.pages[0], last = doc.pages[doc.pages.length - 1];
  const mix = Math.min(1, Math.max(0, (t - 0.4) / 0.2)); // crossfade between 40% and 60%
  const frame = (id: string, op: number) => <div className="absolute inset-0 bg-cover" style={{ opacity: op, backgroundImage: thumbs[id] ? `url(${thumbs[id]})` : undefined, background: thumbs[id] ? undefined : "#0D1B3E" }} />;
  return (
    <Dialog open={videoPreview} onOpenChange={setVideoPreview}>
      <DialogContent className="w-[460px] p-6">
        <DialogTitle className="mb-1 text-lg">Video preview <span className="ml-1 rounded-full bg-amber-50 px-2 py-0.5 align-middle text-[10px] font-bold uppercase text-warn-ink">Demo</span></DialogTitle>
        <p className="mb-4 text-xs text-ink-soft">Simulated playback of your first and last frames. This is not a rendered video — no video editing happens in the studio.</p>
        <div className="relative mx-auto aspect-square w-full overflow-hidden rounded-lg bg-ink shadow-3">
          {first && frame(first.id, 1 - mix)}
          {last && last !== first && frame(last.id, mix)}
          {doc.overlay.header && <div className="absolute inset-x-0 top-0 flex h-9 items-center px-3 text-[10px] font-bold text-white" style={{ background: gradientCss(pal) }}>{kit.logoName}</div>}
          {doc.overlay.footer && <div className="absolute inset-x-0 bottom-0 flex h-9 items-center truncate px-3 text-[10px] font-semibold text-white" style={{ background: gradientCss(pal) }}>{kit.companyName} · {kit.rrn}</div>}
        </div>
        <div className="mt-3 flex items-center gap-3">
          <button aria-label={playing ? "Pause" : "Play"} onClick={() => setPlaying(!playing)} className="grid size-9 place-items-center rounded-full bg-accent text-white">{playing ? <Pause className="size-4" /> : <Play className="size-4" />}</button>
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-line-2"><div className="h-full bg-accent" style={{ width: `${t * 100}%` }} /></div>
        </div>
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
