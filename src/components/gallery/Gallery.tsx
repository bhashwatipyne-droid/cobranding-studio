"use client";
import { ChevronDown, ChevronLeft, ChevronRight, Cloud, LayoutGrid, List, Search, SlidersHorizontal, TriangleAlert } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { sizeById } from "@/lib/fabric-setup";
import { gradientCss } from "@/lib/templates";
import { cn } from "@/lib/utils";
import { useStudio } from "@/store/studio-store";
import type { TemplateDef } from "@/lib/types";

const TYPES = ["All types", "Infographic", "Interactive", "Post", "Carousel", "Reel Cover", "Video"];
const STYLES = ["All styles", "Minimalist"];
const TOPICS = ["All categories", "Mutual Funds", "Tax Planning", "Market Updates", "Festivals"];
const DATES = ["Anytime", "Today", "Last 7 days", "Last 30 days"];

function ago(iso: string) {
  if (!iso) return "Edited recently";
  const d = Math.max(0, Date.now() - new Date(iso).getTime());
  const m = Math.floor(d / 60000);
  if (m < 1) return "Edited just now";
  if (m < 60) return `Edited ${m} min ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `Edited ${h} hr ago`;
  const days = Math.floor(h / 24);
  return days < 31 ? `Edited ${days} day${days > 1 ? "s" : ""} ago` : `Edited ${Math.floor(days / 30)} mo ago`;
}

function Thumb({ t, className }: { t: TemplateDef; className?: string }) {
  return (
    <div
      className={cn("relative flex items-center justify-center overflow-hidden px-4 text-center text-[12.5px] font-bold leading-tight text-white", className)}
      style={t.thumbnail ? { backgroundImage: `url(${t.thumbnail})`, backgroundSize: "cover", backgroundPosition: "center" } : { background: gradientCss(t.palette), textShadow: "0 1px 8px rgba(0,0,0,.28)" }}
    >
      {!t.thumbnail && (
        <>
          <span className="absolute left-3 top-3 h-3 w-7 rounded-[3px] bg-white/90 shadow-1" />
          <span className="absolute bottom-3 left-3 h-[3px] w-[46%] rounded-sm bg-white/50" />
          {t.name}
        </>
      )}
    </div>
  );
}

function FilterPill({ label, options, value, onPick }: { label: string; options: string[]; value: string; onPick: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const h = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);
  const active = value !== options[0];
  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen(!open)} className={cn("inline-flex h-9 items-center gap-1.5 rounded-full border bg-white/90 px-3.5 text-[12.5px] font-semibold transition hover:border-accent hover:text-accent", active ? "border-accent text-accent" : "border-line-2 text-ink-soft")}>
        {active ? value : label} <ChevronDown className="size-3.5 opacity-70" />
      </button>
      {open && (
        <div className="pop-in absolute left-0 top-11 z-[130] w-52 rounded-lg border border-line-2 bg-surface p-1.5 text-left shadow-4">
          {options.map((o) => (
            <button key={o} onClick={() => { onPick(o); setOpen(false); }} className="block w-full rounded-sm px-3 py-2 text-left text-[13px] font-medium text-ink-soft hover:bg-accent-soft hover:font-semibold hover:text-accent">{o}</button>
          ))}
        </div>
      )}
    </div>
  );
}

export function Gallery() {
  const s = useStudio();
  const kit = s.kits[s.activeKitKey];
  const [kitMenu, setKitMenu] = useState(false);
  const [collapsed, setCollapsed] = useState({ folders: false, templates: false });
  const recentsRef = useRef<HTMLDivElement>(null);
  const kitRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const h = (e: MouseEvent) => { if (!kitRef.current?.contains(e.target as Node)) setKitMenu(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const templates = useMemo(() => {
    const q = s.query.trim().toLowerCase();
    return s.templates.map((t, i) => ({ t, i })).filter(({ t }) =>
      (!q || t.name.toLowerCase().includes(q) || t.category.toLowerCase().includes(q) || t.topic.toLowerCase().includes(q) || (t.style ?? "").toLowerCase().includes(q)) &&
      (s.filters.type === "All types" || t.category === s.filters.type) &&
      (s.filters.topic === "All categories" || t.topic === s.filters.topic) &&
      (s.filters.style === "All styles" || t.style === s.filters.style),
    );
  }, [s.templates, s.query, s.filters.type, s.filters.topic, s.filters.style]);

  const recents = useMemo(() => {
    const now = Date.now();
    const lim = { Today: 864e5, "Last 7 days": 7 * 864e5, "Last 30 days": 30 * 864e5 }[s.filters.date as "Today"];
    return s.recents.filter((r) =>
      (s.filters.brand === "All brand kits" || s.kits[r.kitKey]?.label === s.filters.brand) &&
      (!lim || now - new Date(r.updatedAt).getTime() <= lim),
    );
  }, [s.recents, s.filters.brand, s.filters.date, s.kits]);

  const kitList = Object.values(s.kits);
  const tplById = (id: string) => s.templates.find((t) => t.id === id) ?? s.templates[0];

  return (
    <div className="min-h-screen">
      <div className="relative z-30 flex h-16 items-center gap-7 border-b border-line bg-surface px-7">
        <div className="flex items-center gap-2.5 text-base font-extrabold tracking-tight">
          <span className="grid size-[30px] place-items-center rounded-md bg-accent text-sm text-white">T</span>Thefinpedia
        </div>
        {["Trending", "Events", "Tools"].map((n) => <span key={n} className="cursor-pointer py-1.5 text-[13.5px] font-semibold text-ink-soft hover:text-ink">{n}</span>)}
        <div className="flex-1" />
        <span title={s.persist === "cloud" ? "Saved to Supabase" : "Saved in this browser only"} className={cn("inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-bold", s.persist === "local" ? "bg-amber-50 text-warn-ink" : "bg-accent-soft text-accent")}>
          <Cloud className="size-3.5" />{s.persist === "local" ? "Local storage" : s.persist === "cloud" ? "Cloud synced" : "Connecting…"}
        </span>
        <div className="size-8 rounded-full bg-gradient-to-br from-accent-300 to-accent ring-[3px] ring-accent-soft" />
      </div>

      <div className="relative border-b border-line bg-gradient-to-b from-surface-2 via-accent-soft to-white px-8 pb-9 pt-[52px] text-center">
        <Button onClick={() => s.setSetupOpen(true)} variant={kit.setupComplete ? "outline" : "primary"} size="lg" className={cn("absolute right-8 top-6 h-[42px] text-[13.5px]", !kit.setupComplete && "shadow-[0_6px_18px_rgba(43,43,181,.28)]")}>
          <SlidersHorizontal />{kit.setupComplete ? "Edit cobranding setup" : "Set up cobranding"}
        </Button>
        <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-line-2 bg-white/80 px-3.5 py-1.5 text-[10.5px] font-bold uppercase tracking-[.08em] text-ink-soft"><span className="size-1.5 rounded-full bg-accent" />Cobranding Studio</div>
        <h1 className="mb-2 text-[38px] font-extrabold leading-[1.05] tracking-[-.03em]">Templates that arrive <em className="not-italic text-accent">already branded</em></h1>
        <p className="mx-auto mb-6 max-w-[520px] text-[15px] text-ink-soft">Set up your logo, colours and RRN once. Every template you open comes co-branded and ready to post.</p>
        <label className="mx-auto mb-4 flex h-[54px] max-w-[600px] items-center gap-3 rounded-full border border-line-2 bg-surface px-[22px] shadow-3 focus-within:border-accent focus-within:ring-[3px] focus-within:ring-accent/20">
          <Search className="size-[18px] text-ink-faint" />
          <input value={s.query} onChange={(e) => s.setQuery(e.target.value)} placeholder="Search templates and folders" className="flex-1 bg-transparent text-[14.5px] outline-none placeholder:text-ink-faint" />
        </label>
        <div className="flex flex-wrap justify-center gap-2">
          <FilterPill label="Type" options={TYPES} value={s.filters.type} onPick={(v) => s.setFilter("type", v)} />
          <FilterPill label="Category" options={TOPICS} value={s.filters.topic} onPick={(v) => s.setFilter("topic", v)} />
          <FilterPill label="Style" options={STYLES} value={s.filters.style} onPick={(v) => s.setFilter("style", v)} />
          <FilterPill label="Brand kit" options={["All brand kits", ...kitList.map((k) => k.label)]} value={s.filters.brand} onPick={(v) => s.setFilter("brand", v)} />
          <FilterPill label="Date modified" options={DATES} value={s.filters.date} onPick={(v) => s.setFilter("date", v)} />
        </div>
      </div>

      <div className="relative mx-auto flex max-w-[1440px] items-center gap-2.5 px-8 pt-6">
        <div ref={kitRef} className="relative">
          <button onClick={() => setKitMenu(!kitMenu)} className="inline-flex h-10 items-center gap-2 rounded-full border border-line-2 bg-surface px-3.5 text-[13px] font-semibold shadow-1 hover:border-accent">
            <span className="size-[18px] rounded-full ring-1 ring-ink/10" style={{ background: kit.color, boxShadow: "inset 0 0 0 2px rgba(255,255,255,.85)" }} />
            Posting as: {kit.label}<ChevronDown className="size-3.5 opacity-70" />
          </button>
          {kitMenu && (
            <div className="pop-in absolute left-0 top-12 z-[120] w-[266px] rounded-lg border border-line-2 bg-surface p-1.5 shadow-4">
              {kitList.map((k) => <button key={k.key} onClick={() => { s.setActiveKit(k.key); setKitMenu(false); }} className="block w-full rounded-sm px-3 py-2.5 text-left text-[13px] font-medium text-ink-soft hover:bg-accent-soft hover:text-ink">{k.label}</button>)}
              <button onClick={() => { s.setSetupOpen(true); setKitMenu(false); }} className="mt-1.5 block w-full border-t border-line px-3 pt-3 text-left text-[13px] font-bold text-accent">Edit this brand kit</button>
            </div>
          )}
        </div>
        <div className="flex-1" />
        <button title="Switch between grid and list" onClick={s.toggleListView} className="grid size-10 place-items-center rounded-full border border-line-2 bg-surface text-ink-soft shadow-1 hover:border-accent hover:text-accent">{s.listView ? <LayoutGrid className="size-[18px]" /> : <List className="size-[18px]" />}</button>
      </div>

      <div className="mx-auto mt-3 max-w-[1440px] px-8">
        {kit.setupComplete ? (
          <p className="text-[13px] text-ink-soft">{kit.label} is set up. Your logo, colours and details are applied the moment you co-brand a template.</p>
        ) : (
          <p className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-[12.5px] leading-relaxed text-warn-ink">
            <TriangleAlert className="mt-0.5 size-4 shrink-0" />
            <span>{kit.label} isn&apos;t set up yet. <button className="font-bold underline underline-offset-2" onClick={() => s.setSetupOpen(true)}>Set it up now</button> and every template you open arrives branded — or keep browsing and brand each post by hand.</span>
          </p>
        )}
      </div>

      <div className="mx-auto max-w-[1440px] px-8 pb-16 pt-2">
        <h2 className="mb-4 mt-9 text-[17px]">Recents</h2>
        {recents.length === 0 ? (
          <p className="rounded-lg border border-dashed border-line-2 bg-surface px-5 py-6 text-[13px] text-ink-soft">Nothing here yet — designs you edit are saved automatically and show up here.</p>
        ) : (
          <div className="relative">
            <div ref={recentsRef} className="flex gap-[18px] overflow-x-auto scroll-smooth pb-2">
              {recents.map((r) => (
                <button key={r.id} onClick={() => void s.openDesign(r.id)} className="group w-[196px] flex-none text-left">
                  <div className="mb-2.5 h-[132px] overflow-hidden rounded-lg shadow-2 transition group-hover:-translate-y-0.5 group-hover:shadow-3" style={r.thumbnail ? { backgroundImage: `url(${r.thumbnail})`, backgroundSize: "cover", backgroundPosition: "center" } : { background: gradientCss(tplById(r.templateId).palette) }} />
                  <div className="truncate text-[13px] font-semibold">{r.title}</div>
                  <div className="text-[11.5px] text-ink-faint">{r.contentType} · {ago(r.updatedAt)}</div>
                </button>
              ))}
            </div>
            {recents.length > 5 && <button aria-label="Scroll recents" onClick={() => recentsRef.current?.scrollBy({ left: 400, behavior: "smooth" })} className="absolute -right-4 top-11 grid size-9 place-items-center rounded-full border border-line-2 bg-surface shadow-3 hover:border-accent hover:text-accent"><ChevronRight className="size-[18px]" /></button>}
          </div>
        )}

        <button onClick={() => setCollapsed((c) => ({ ...c, folders: !c.folders }))} className="mb-4 mt-9 flex items-center gap-2 text-[17px] font-extrabold tracking-tight">
          <ChevronDown className={cn("size-4 text-ink-faint transition", collapsed.folders && "-rotate-90")} />Folders
        </button>
        {!collapsed.folders && (
          <div className="flex flex-wrap gap-4">
            {kitList.map((k) => (
              <button key={k.key} onClick={() => s.setActiveKit(k.key)} className={cn("flex min-h-[68px] w-[262px] items-center gap-3 rounded-lg border bg-surface px-3.5 py-3 text-left shadow-1 transition hover:-translate-y-0.5 hover:border-line-2 hover:shadow-3", k.key === s.activeKitKey ? "border-accent" : "border-line")}>
                <span className="grid size-10 place-items-center rounded-md bg-accent-soft"><span className="size-5 rounded-full" style={{ background: k.color, boxShadow: "inset 0 0 0 2px rgba(255,255,255,.9), 0 0 0 1px rgba(13,27,62,.1)" }} /></span>
                <span className="min-w-0"><span className="block truncate text-[13.5px] font-semibold">{k.label}</span><span className="text-[11.5px] text-ink-faint">{k.setupComplete ? "Brand kit ready" : "Not set up"}</span></span>
              </button>
            ))}
          </div>
        )}

        <button onClick={() => setCollapsed((c) => ({ ...c, templates: !c.templates }))} className="mb-4 mt-9 flex items-center gap-2 text-[17px] font-extrabold tracking-tight">
          <ChevronDown className={cn("size-4 text-ink-faint transition", collapsed.templates && "-rotate-90")} />Templates
          <span className="text-xs font-semibold text-ink-faint">{templates.length}</span>
        </button>
        {!collapsed.templates && (templates.length === 0 ? (
          <p className="text-[13px] text-ink-soft">No templates match those filters.</p>
        ) : (
          <div className={cn("grid gap-5", s.listView ? "grid-cols-1 gap-2.5" : "grid-cols-2 lg:grid-cols-3 xl:grid-cols-4")}>
            {templates.map(({ t, i }) => (
              <button key={t.id} onClick={() => s.openModal(i)} className={cn("overflow-hidden rounded-lg border border-line bg-surface text-left shadow-1 transition hover:-translate-y-[3px] hover:border-line-2 hover:shadow-3", s.listView && "flex items-center")}>
                <Thumb t={t} className={s.listView ? "h-[88px] w-[150px] flex-none" : "h-[158px]"} />
                <div className="px-3.5 pb-3.5 pt-3"><div className="mb-0.5 text-[13px] font-semibold">{t.name}</div><div className="text-[10.5px] font-bold uppercase tracking-wider text-ink-faint">{t.category}</div></div>
              </button>
            ))}
          </div>
        ))}
      </div>
      <TemplateModal />
    </div>
  );
}

function TemplateModal() {
  const { modalIndex, templates, openModal, chooseTemplate } = useStudio();
  const idx = modalIndex ?? 0;
  const t = templates[idx];
  const cycle = (d: number) => openModal((idx + d + templates.length) % templates.length);
  return (
    <Dialog open={modalIndex !== null} onOpenChange={(o) => !o && openModal(null)}>
      <DialogContent className="flex w-[820px]">
        {t && (
          <>
            <DialogTitle className="sr-only">{t.name}</DialogTitle>
            <div className="relative flex w-[44%] items-center justify-center text-center text-sm font-bold text-white" style={t.thumbnail ? { backgroundImage: `url(${t.thumbnail})`, backgroundSize: "cover" } : { background: gradientCss(t.palette), textShadow: "0 2px 12px rgba(0,0,0,.3)" }}>
              {!t.thumbnail && t.name}
              <button aria-label="Previous" onClick={() => cycle(-1)} className="absolute left-3 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-full bg-white/95 text-ink shadow-2"><ChevronLeft className="size-[18px]" /></button>
              <button aria-label="Next" onClick={() => cycle(1)} className="absolute right-3 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-full bg-white/95 text-ink shadow-2"><ChevronRight className="size-[18px]" /></button>
            </div>
            <div className="w-[56%] px-8 py-[30px]">
              <h2 className="mb-3 text-xl">{t.name}</h2>
              <div className="mb-[18px] flex flex-wrap gap-[7px]">{[t.category, t.topic, ...(t.style ? [t.style] : []), sizeById(t.sizeId ?? "post").label.replace(/×/g, " × ")].map((p) => <span key={p} className="rounded-full bg-accent-soft px-[11px] py-[5px] text-[10.5px] font-bold uppercase tracking-wider text-accent">{p}</span>)}</div>
              <p className="mb-6 text-[13.5px] leading-relaxed text-ink-soft">A ready-to-edit template — swap the headline, image, and details, or use it as-is with your brand already applied.</p>
              <Button size="lg" className="h-[46px] w-full text-sm" onClick={chooseTemplate}>Co-brand this template</Button>
              <Button variant="outline" className="mt-2 w-full" onClick={() => openModal(null)}>Cancel</Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
