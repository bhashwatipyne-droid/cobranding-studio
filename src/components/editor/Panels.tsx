"use client";
import { Eye, EyeOff, Heading1, Heading2, Lock, MessageSquare, Pilcrow, Unlock, Upload, ArrowUp, ArrowDown, Circle, Square, Triangle, Minus, MoveRight } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { RecolorScope } from "@/lib/canvas-controller";
import type { BrandKit } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { SIZES } from "@/lib/fabric-setup";
import { STOCK_PHOTOS } from "@/lib/stock";
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

const QUICK_PALETTES: { name: string; a: string; b: string }[] = [
  { name: "Royal", a: "#2B2BB5", b: "#9090EC" }, { name: "Ocean", a: "#0369A1", b: "#38BDF8" }, { name: "Forest", a: "#166534", b: "#86EFAC" },
  { name: "Sunset", a: "#B91C1C", b: "#FB923C" }, { name: "Rose", a: "#9D174D", b: "#F9A8D4" }, { name: "Slate", a: "#0F172A", b: "#94A3B8" },
];

/** Pick two colours (from the brand kit, a quick palette, or anything) and which kinds of element follow them. Fonts and logo are never touched. */
function RecolourCard({ kit }: { kit: BrandKit }) {
  const recolor = useStudio((s) => s.recolor);
  const [open, setOpen] = useState(false);
  const [main, setMain] = useState(kit.color);
  const [acc, setAcc] = useState(kit.secondary);
  const [what, setWhat] = useState<RecolorScope>({ background: true, shapes: true, text: true, pictures: true });
  useEffect(() => { setMain(kit.color); setAcc(kit.secondary); }, [kit.key, kit.color, kit.secondary]);
  const swatchRow = (label: string, value: string, set: (v: string) => void) => (
    <div>
      <div className="mb-1 text-[11px] font-bold text-ink-soft">{label}</div>
      <div className="flex flex-wrap items-center gap-1.5">
        {kit.swatches.map((sw) => (
          <button key={sw} aria-label={`${label} ${sw}`} aria-pressed={value.toLowerCase() === sw.toLowerCase()} onClick={() => set(sw)} title={sw}
            className={cn("size-6 rounded-md ring-1 ring-ink/10", value.toLowerCase() === sw.toLowerCase() && "ring-2 ring-accent ring-offset-1")} style={{ background: sw }} />
        ))}
        <label title="Any colour" className="relative grid size-6 cursor-pointer place-items-center rounded-md ring-1 ring-ink/10" style={{ background: "conic-gradient(red, yellow, lime, aqua, blue, magenta, red)" }}>
          <input type="color" aria-label={`${label} — any colour`} value={/^#[0-9a-f]{6}$/i.test(value) ? value : "#2B2BB5"} onChange={(e) => set(e.target.value)} className="absolute inset-0 cursor-pointer opacity-0" />
        </label>
        <span className="ml-1 font-mono text-[10px] uppercase text-ink-faint">{value}</span>
      </div>
    </div>
  );
  const opt = (key: keyof RecolorScope, label: string) => (
    <label key={key} className="flex cursor-pointer items-center gap-2 text-[12px] font-medium text-ink">
      <input type="checkbox" checked={what[key]} onChange={(e) => setWhat((w) => ({ ...w, [key]: e.target.checked }))} className="size-3.5 accent-[var(--color-accent)]" />{label}
    </label>
  );
  return (
    <div>
      <Button className="w-full" variant="outline" aria-expanded={open} onClick={() => setOpen((v) => !v)}>{open ? "Recolour — close" : "Recolour elements…"}</Button>
      {open && (
        <div className="mt-2 space-y-3 rounded-lg border border-line-2 bg-surface-2 p-3">
          {swatchRow("Main colour", main, setMain)}
          {swatchRow("Accent colour", acc, setAcc)}
          <div>
            <div className="mb-1 text-[11px] font-bold text-ink-soft">Or start from a palette</div>
            <div className="flex flex-wrap gap-1.5">
              <button onClick={() => { setMain(kit.color); setAcc(kit.secondary); }} className="rounded-full border border-line-2 bg-white px-2.5 py-1 text-[11px] font-semibold hover:border-accent">Brand kit</button>
              {QUICK_PALETTES.map((p) => (
                <button key={p.name} onClick={() => { setMain(p.a); setAcc(p.b); }} className="flex items-center gap-1 rounded-full border border-line-2 bg-white px-2 py-1 text-[11px] font-semibold hover:border-accent">
                  <span className="size-3 rounded-full" style={{ background: p.a }} /><span className="-ml-2 size-3 rounded-full ring-1 ring-white" style={{ background: p.b }} />{p.name}
                </button>
              ))}
            </div>
          </div>
          <div>
            <div className="mb-1 text-[11px] font-bold text-ink-soft">Recolour</div>
            <div className="grid grid-cols-2 gap-1.5">{opt("background", "Background")}{opt("shapes", "Shapes & icons")}{opt("text", "Text highlights")}{opt("pictures", "Pictures")}</div>
            <p className="mt-1.5 text-[11px] text-ink-faint">Fonts, your logo and the details strip are never changed here. Plain black or white text stays as it is.</p>
          </div>
          <Button className="w-full" onClick={() => recolor(main, acc, what)}>Apply colours</Button>
        </div>
      )}
    </div>
  );
}

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
          <select aria-label="Active brand kit" value={doc.kitKey} onChange={(e) => void s.switchDocKit(e.target.value)} className="mb-2.5 h-10 w-full rounded-md border border-line-2 bg-white px-2 text-[13px] font-semibold">
            {Object.values(kits).map((k) => <option key={k.key} value={k.key}>{k.label}</option>)}
          </select>
          <div className="rounded-lg border border-line-2 p-3">
            <div className="mb-2 flex items-center gap-2"><span className="size-5 rounded-full" style={{ background: kit.color }} /><b className="text-[13px]">{kit.label}</b></div>
            <div className="flex gap-1.5">{kit.swatches.map((sw) => <button key={sw} aria-label={`Apply ${sw}`} title={sw} onClick={() => c.setColor(sw)} className="size-7 rounded-md ring-1 ring-ink/10" style={{ background: sw }} />)}</div>
            <p className="mt-2 text-[11px] text-ink-faint">Click a swatch to colour the selected element.</p>
          </div>
          <div className="mt-3 space-y-2">
            <Button className="w-full" onClick={() => void s.reapplySetup()}>Apply brand to this post</Button>
            <RecolourCard kit={kit} />
            <Button className="w-full" variant="ghost" onClick={() => s.setSetupOpen(true)}>Edit cobranding setup</Button>
            <Button className="w-full" variant="outline" onClick={() => s.setShareOpen(true)}>Save as template…</Button>
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
                {t.thumbnail ? <img src={t.thumbnail} alt={t.name} loading="lazy" className="aspect-[4/5] w-full object-cover object-top" /> : <div className="grid h-16 place-items-center px-2 text-center text-[10px] font-bold text-white" style={{ background: gradientCss(t.palette) }}>{t.name}</div>}
                <div className="truncate px-2 py-1.5 text-[11px] font-semibold text-ink-soft">{t.name}</div>
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
          <H>Stock photos (demo)</H>
          <div className="grid grid-cols-2 gap-2">
            {STOCK_PHOTOS.map((u, i) => (
              <button key={i} aria-label={`Stock photo ${i + 1}`} onClick={() => { if (s.sel?.kind === "image") void c.setImageOnSelection(u); else s.toast("Select an image slot on the canvas first"); }} className="overflow-hidden rounded-lg border border-line hover:border-accent"><img src={u} alt="" className="aspect-[4/3] w-full object-cover" /></button>
            ))}
          </div>
        </>
      )}

      {panel === "layers" && (
        <>
          <H>Layers</H>
          <p className="mb-2 text-xs text-ink-soft">Ctrl/Shift-click layers to select several.</p>
          <ul className="space-y-1">
            {layers.map((l, i) => (
              <li key={l.id} className={cn("flex items-center gap-1 rounded-md border px-2 py-1.5 text-xs", l.selected ? "border-accent bg-accent-soft" : "border-transparent hover:bg-surface-2")}>
                <button className="min-w-0 flex-1 truncate text-left font-semibold" onClick={(e) => c.select(l.id, e.ctrlKey || e.metaKey || e.shiftKey)}>{l.name}</button>
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
          <p className="mb-3 rounded-md bg-amber-50 p-2.5 text-xs text-warn-ink">Branding only — no video editing happens here. Bars sit on top of your finished video; they are not a rendered video.</p>
          {(["header", "footer"] as const).map((k) => (
            <div key={k} className="mb-2 flex items-center justify-between rounded-lg border border-line-2 px-3 py-2.5">
              <span className="text-[13px] font-semibold capitalize">{k} bar (logo &amp; details)</span>
              <Switch checked={doc.overlay[k]} onCheckedChange={(v) => s.setOverlay(k, v)} aria-label={k} />
            </div>
          ))}
          <Button className="mt-2 w-full" variant="outline" onClick={() => { void s.switchPage(0); s.setOverlayView(true); }}>View overlay on first frame</Button>
          <Button className="mt-2 w-full" variant="soft" onClick={() => s.setVideoPreview(true)}>Preview playback (demo)</Button>
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
