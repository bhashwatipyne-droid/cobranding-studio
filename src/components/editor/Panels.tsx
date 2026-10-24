"use client";
import { Eye, EyeOff, Heading1, Heading2, Lock, MessageSquare, Pilcrow, Unlock, Upload, ArrowUp, ArrowDown, Circle, Square, Triangle, Minus, MoveRight } from "lucide-react";
import { useMemo, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { SIZES } from "@/lib/fabric-setup";
import { gradientCss } from "@/lib/templates";
import { fileToDataUrl, shrinkPhoto } from "@/lib/vectorize";
import { cn } from "@/lib/utils";
import { useStudio } from "@/store/studio-store";

const H = ({ children }: { children: React.ReactNode }) => <h4 className="mb-2.5 mt-5 text-[11px] font-bold uppercase tracking-wider text-ink-soft first:mt-0">{children}</h4>;
const Tile = ({ children, onClick, label }: { children: React.ReactNode; onClick: () => void; label: string }) => (
  <button aria-label={label} onClick={onClick} className="grid h-16 place-items-center rounded-lg border border-line-2 bg-white text-ink-soft transition hover:border-accent hover:text-accent [&_svg]:size-6">{children}</button>
);

const BG_SOLIDS = ["#FFFFFF", "#F7F9FC", "#0D1B3E", "#2B2BB5", "#0369A1", "#0F766E", "#B45309", "#E11D48"];
const BG_GRADS: [string, string][] = [["#2B2BB5", "#0D0D5C"], ["#0369A1", "#0EA5E9"], ["#0F766E", "#10B981"], ["#7C3AED", "#2B2BB5"], ["#0D1B3E", "#546490"], ["#F59E0B", "#E11D48"]];

export function Panels() {
  const s = useStudio();
  const { panel, controller: c, doc, kits } = s;
  const fileRef = useRef<HTMLInputElement>(null);
  const layers = useMemo(() => (c ? c.getLayers() : []), [c, s.layersVersion, s.sel]);
  if (!panel || !c || !doc) return null;
  const kit = kits[doc.kitKey];

  async function pickPhotos(files: FileList | null) {
    if (!files) return;
    for (const f of Array.from(files)) {
      if (!f.type.startsWith("image/")) continue;
      try { s.addUpload(await shrinkPhoto(await fileToDataUrl(f))); } catch { s.toast("Couldn't read " + f.name); }
    }
  }

  return (
    <aside className="w-[300px] shrink-0 overflow-y-auto border-r border-line bg-surface p-4" aria-label="Panel">
      {panel === "brand" && (
        <>
          <H>Brand kit</H>
          <div className="rounded-lg border border-line-2 p-3">
            <div className="mb-2 flex items-center gap-2"><span className="size-5 rounded-full" style={{ background: kit.color }} /><b className="text-[13px]">{kit.label}</b></div>
            <div className="flex gap-1.5">{kit.swatches.map((sw) => <button key={sw} aria-label={`Apply ${sw}`} title={sw} onClick={() => c.setColor(sw)} className="size-7 rounded-md ring-1 ring-ink/10" style={{ background: sw }} />)}</div>
            <p className="mt-2 text-[11px] text-ink-faint">Click a swatch to colour the selected element.</p>
          </div>
          <div className="mt-3 space-y-2">
            <Button className="w-full" onClick={() => void s.reapplySetup()}>Apply brand to this post</Button>
            <Button className="w-full" variant="outline" onClick={() => void s.applyKitAll()}>Recolour all elements</Button>
            <Button className="w-full" variant="ghost" onClick={() => s.setSetupOpen(true)}>Edit cobranding setup</Button>
          </div>
          {!kit.setupComplete && <p className="mt-3 rounded-md bg-amber-50 p-3 text-xs text-warn-ink">This kit isn&apos;t set up yet. Set it up to place your logo and RRN automatically.</p>}
        </>
      )}

      {panel === "design" && (
        <>
          <H>Canvas size</H>
          <select value={doc.sizeId} onChange={(e) => s.changeSize(e.target.value)} className="h-10 w-full rounded-md border border-line-2 bg-white px-2 text-[13px]">
            {SIZES.map((z) => <option key={z.id} value={z.id}>{z.label}</option>)}
          </select>
          <H>Layouts</H>
          <p className="mb-2 text-xs text-ink-soft">Switching keeps your headline, image and logo.</p>
          <div className="grid grid-cols-2 gap-2">
            {s.templates.filter((t) => !t.custom).map((t) => (
              <button key={t.id} onClick={() => void s.applyLayoutFrom(t)} className="overflow-hidden rounded-lg border border-line text-left transition hover:border-accent">
                <div className="grid h-16 place-items-center px-2 text-center text-[10px] font-bold text-white" style={{ background: gradientCss(t.palette) }}>{t.name}</div>
              </button>
            ))}
          </div>
          <H>Background</H>
          <div className="grid grid-cols-8 gap-1.5">{BG_SOLIDS.map((b) => <button key={b} aria-label={`Background ${b}`} onClick={() => void c.setBackground(b)} className="aspect-square rounded-md ring-1 ring-ink/10" style={{ background: b }} />)}</div>
          <div className="mt-2 grid grid-cols-6 gap-1.5">{BG_GRADS.map(([a, b]) => <button key={a + b} aria-label="Gradient background" onClick={() => void c.setBackground({ from: a, to: b })} className="aspect-square rounded-md ring-1 ring-ink/10" style={{ background: gradientCss([a, b]) }} />)}</div>
        </>
      )}

      {panel === "elements" && (
        <>
          <H>Shapes</H>
          <div className="grid grid-cols-3 gap-2">
            <Tile label="Rectangle" onClick={() => c.addShape("rect")}><Square /></Tile>
            <Tile label="Circle" onClick={() => c.addShape("circle")}><Circle /></Tile>
            <Tile label="Triangle" onClick={() => c.addShape("triangle")}><Triangle /></Tile>
          </div>
          <H>Lines</H>
          <div className="grid grid-cols-3 gap-2">
            <Tile label="Line" onClick={() => c.addLine(false)}><Minus /></Tile>
            <Tile label="Arrow" onClick={() => c.addLine(true)}><MoveRight /></Tile>
          </div>
          <H>Icons</H>
          <div className="grid grid-cols-4 gap-2">
            {(["rupee", "bars", "pie", "arrowup"] as const).map((n) => <Tile key={n} label={n} onClick={() => c.addIcon(n)}><span className="text-xs font-semibold capitalize">{n}</span></Tile>)}
          </div>
        </>
      )}

      {panel === "text" && (
        <>
          <H>Add text</H>
          <div className="space-y-2">
            <button onClick={() => void c.addText("heading")} className="flex w-full items-center gap-3 rounded-lg border border-line-2 px-4 py-3 text-left text-xl font-extrabold hover:border-accent"><Heading1 className="size-5 text-ink-faint" />Add a heading</button>
            <button onClick={() => void c.addText("subhead")} className="flex w-full items-center gap-3 rounded-lg border border-line-2 px-4 py-3 text-left text-base font-bold hover:border-accent"><Heading2 className="size-5 text-ink-faint" />Add a subheading</button>
            <button onClick={() => void c.addText("body")} className="flex w-full items-center gap-3 rounded-lg border border-line-2 px-4 py-3 text-left text-sm hover:border-accent"><Pilcrow className="size-5 text-ink-faint" />Add body text</button>
          </div>
          <p className="mt-3 text-xs text-ink-soft">Investor-facing terms (e.g. “guaranteed returns”) are flagged automatically as you type.</p>
        </>
      )}

      {panel === "uploads" && (
        <>
          <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={(e) => { void pickPhotos(e.target.files); e.target.value = ""; }} />
          <Button className="w-full" onClick={() => fileRef.current?.click()}><Upload />Upload images</Button>
          <p className="mt-2 text-xs text-ink-soft">Select an image slot on the canvas, then click a photo to place it. Or use it as the background.</p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            {s.uploads.map((u, i) => (
              <div key={i} className="group relative overflow-hidden rounded-lg border border-line">
                <img src={u} alt="" className="aspect-square w-full object-cover" />
                <div className="absolute inset-0 flex flex-col justify-end gap-1 bg-ink/0 p-1.5 opacity-0 transition group-hover:bg-ink/40 group-hover:opacity-100">
                  <Button size="sm" onClick={() => { if (s.sel?.kind === "image") void c.setImageOnSelection(u); else s.toast("Select an image slot on the canvas first"); }}>Place</Button>
                  <Button size="sm" variant="outline" onClick={() => void c.setBackgroundImage(u)}>Background</Button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {panel === "layers" && (
        <>
          <H>Layers</H>
          <ul className="space-y-1">
            {layers.map((l, i) => (
              <li key={l.id} className={cn("flex items-center gap-1 rounded-md border px-2 py-1.5 text-xs", l.selected ? "border-accent bg-accent-soft" : "border-transparent hover:bg-surface-2")}>
                <button className="min-w-0 flex-1 truncate text-left font-semibold" onClick={() => c.select(l.id)}>{l.name}</button>
                <button aria-label="Move up" disabled={i === 0} onClick={() => c.moveLayer(l.id, "up")} className="p-1 text-ink-faint hover:text-accent disabled:opacity-30"><ArrowUp className="size-3.5" /></button>
                <button aria-label="Move down" disabled={i === layers.length - 1} onClick={() => c.moveLayer(l.id, "down")} className="p-1 text-ink-faint hover:text-accent disabled:opacity-30"><ArrowDown className="size-3.5" /></button>
                <button aria-label={l.visible ? "Hide" : "Show"} onClick={() => c.toggleVisible(l.id)} className="p-1 text-ink-faint hover:text-accent">{l.visible ? <Eye className="size-3.5" /> : <EyeOff className="size-3.5" />}</button>
                <button aria-label={l.locked ? "Unlock" : "Lock"} onClick={() => c.toggleLock(l.id)} className="p-1 text-ink-faint hover:text-accent">{l.locked ? <Lock className="size-3.5" /> : <Unlock className="size-3.5" />}</button>
              </li>
            ))}
          </ul>
        </>
      )}

      {panel === "overlay" && (
        <>
          <H>Video overlay</H>
          <p className="mb-3 text-xs text-ink-soft">Branded bars shown across the whole video, on top of your footage. First and last frames are designed on the canvas.</p>
          {(["header", "footer"] as const).map((k) => (
            <div key={k} className="mb-2 flex items-center justify-between rounded-lg border border-line-2 px-3 py-2.5">
              <span className="text-[13px] font-semibold capitalize">{k} bar (logo &amp; details)</span>
              <Switch checked={doc.overlay[k]} onCheckedChange={(v) => s.setOverlay(k, v)} aria-label={k} />
            </div>
          ))}
          <Button className="mt-2 w-full" variant="soft" onClick={() => s.setVideoPreview(true)}>Preview video frames</Button>
        </>
      )}

      {panel === "comments" && (
        <>
          <H>Comments</H>
          <Button className="w-full" variant={s.commentMode ? "primary" : "outline"} onClick={() => s.setCommentMode(!s.commentMode)}><MessageSquare />{s.commentMode ? "Click the canvas to pin…" : "Add a comment"}</Button>
          <ul className="mt-3 space-y-2">
            {s.comments.filter((m) => m.pageId === doc.pages[s.pageIdx]?.id).map((m, i) => (
              <li key={m.id} className="rounded-lg border border-line-2 p-2.5 text-xs"><b className="mr-1.5 text-accent">#{i + 1}</b>{m.text || <i className="text-ink-faint">Empty</i>}</li>
            ))}
          </ul>
        </>
      )}

      {panel === "history" && (
        <>
          <H>History</H>
          <ul className="space-y-1">
            {[...s.history.entries].map((e, i) => ({ e, i })).reverse().map(({ e, i }) => (
              <li key={i}>
                <button onClick={() => c.restoreHistory(i)} className={cn("flex w-full items-center justify-between rounded-md px-2.5 py-2 text-left text-xs", i === s.history.index ? "bg-accent-soft font-bold text-accent" : "text-ink-soft hover:bg-surface-2", i > s.history.index && "opacity-50")}>
                  <span>{e.label}</span><span className="text-[10px] text-ink-faint">{new Date(e.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</span>
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </aside>
  );
}
