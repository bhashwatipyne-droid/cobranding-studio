"use client";
import { BadgeCheck, Globe, Loader2, Plus, Upload, Wand2, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { FONT_CHOICES, SIZES, sizeById, ensureFont, registerKitFonts } from "@/lib/fabric-setup";
import { POS_LABEL, POS_OPTIONS, combineDetails } from "@/lib/templates";
import type { BrandKit, LogoPos } from "@/lib/types";
import { detectPalette, fileToDataUrl, processLogoDataUrl, svgToDataUrl } from "@/lib/vectorize";
import { cn } from "@/lib/utils";
import { useStudio } from "@/store/studio-store";

const Verified = () => <span className="absolute right-2.5 top-1/2 inline-flex -translate-y-1/2 items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700"><BadgeCheck className="size-3" />Verified</span>;

const PRESETS: { id: string; label: string; pos: LogoPos; details: "top" | "bottom" }[] = [
  { id: "classic", label: "Classic", pos: "top-left", details: "bottom" },
  { id: "modern", label: "Modern", pos: "top-right", details: "bottom" },
  { id: "minimal", label: "Minimal", pos: "bottom-left", details: "bottom" },
  { id: "badge", label: "Centered Badge", pos: "top-center", details: "bottom" },
  { id: "bold", label: "Bold Header", pos: "top-left", details: "top" },
];

const Field = ({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) => (
  <label className="block">
    <span className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-ink-soft">{label}</span>
    {children}
    {hint && <span className="mt-1 block text-[11px] text-ink-faint">{hint}</span>}
  </label>
);

export function SetupModal() {
  const { setupOpen, setSetupOpen, kits, activeKitKey, saveKit, toast, doc, screen, applyKitAll } = useStudio();
  const [draft, setDraft] = useState<BrandKit>(kits[activeKitKey]);
  const [site, setSite] = useState("");
  const [busy, setBusy] = useState<"" | "site" | "logo" | "colors">("");
  const [review, setReview] = useState<{ svg: string; original: string | null } | null>(null);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [pvSize, setPvSize] = useState("post");

  useEffect(() => { if (setupOpen) { setDraft(structuredClone(kits[activeKitKey])); setReview(null); setSite(""); } }, [setupOpen, activeKitKey, kits]);
  const set = <K extends keyof BrandKit>(k: K, v: BrandKit[K]) => setDraft((d) => ({ ...d, [k]: v }));

  async function ingestLogo(dataUrl: string, autoColors = true) {
    setBusy("logo");
    try {
      const r = await processLogoDataUrl(dataUrl);
      if (r.wasVector && !r.original) { set("logoSvg", r.svg); set("logoOriginal", null); setReview(null); }
      else { setReview({ svg: r.svg, original: r.original }); set("logoSvg", r.svg); set("logoOriginal", r.original); }
      if (autoColors) {
        const p = await detectPalette(r.svg, r.original);
        if (p) setDraft((d) => ({ ...d, color: p.primary, secondary: p.secondary }));
      }
    } catch { toast("Couldn't read that logo — try a PNG, JPG or SVG"); }
    setBusy("");
  }

  async function onFile(f?: File | null) {
    if (!f) return;
    if (!/^image\//.test(f.type)) { toast("Please choose an image file"); return; }
    if (f.size > 8e6) { toast("Logo is too large (max 8 MB)"); return; }
    await ingestLogo(await fileToDataUrl(f));
  }

  async function fetchSite() {
    if (!site.trim()) return;
    setBusy("site");
    try {
      const res = await fetch("/api/brand-fetch", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ url: site.trim() }) });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "Couldn't reach that site");
      setDraft((d) => ({
        ...d,
        companyName: d.companyName && !d.companyName.startsWith("Your Company") ? d.companyName : j.name || d.companyName,
        email: d.email || j.email || "", mobile: d.mobile || j.mobile || "", website: j.website || d.website,
        color: j.themeColor || d.color,
        fontHeading: j.fonts?.heading || d.fontHeading,
        fontBody: j.fonts?.body || d.fontBody,
        customFonts: j.fonts?.custom ?? [],
      }));
      if (j.fonts?.heading || j.fonts?.body) {
        registerKitFonts({ customFonts: j.fonts.custom });
        await Promise.all([j.fonts.heading, j.fonts.body].filter(Boolean).map((f: string) => ensureFont(f)));
      }
      if (j.logoDataUrl) await ingestLogo(j.logoDataUrl, true);
      else toast("No logo found on that site — upload one below");
      toast("Pulled what we could from the website — check the details");
    } catch (e) { toast(e instanceof Error ? e.message : "Couldn't fetch that site"); }
    setBusy("");
  }

  async function redetect() {
    setBusy("colors");
    const p = await detectPalette(draft.logoSvg, draft.logoOriginal);
    if (p) setDraft((d) => ({ ...d, color: p.primary, secondary: p.secondary })); else toast("Couldn't find distinct colours in this logo");
    setBusy("");
  }

  async function save() {
    setSaving(true);
    const kit: BrandKit = { ...draft, setupComplete: true, swatches: Array.from(new Set([draft.color, draft.secondary, draft.textColor, ...draft.swatches])).slice(0, 6) };
    await saveKit(kit);
    setSaving(false);
    setSetupOpen(false);
    toast(`${kit.label} saved`);
    if (screen === "editor" && doc?.kitKey === kit.key) void applyKitAll();
  }

  const fontOptions = Array.from(new Set([draft.fontHeading, draft.fontBody, ...FONT_CHOICES]));
  const logoPreview = draft.logoSvg ? svgToDataUrl(draft.logoSvg) : draft.logoOriginal;

  return (
    <Dialog open={setupOpen} onOpenChange={setSetupOpen}>
      <DialogContent className="flex h-[min(760px,92vh)] w-[1000px]">
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="border-b border-line px-8 pb-4 pt-6">
            <DialogTitle className="text-xl font-extrabold tracking-tight">Cobranding setup</DialogTitle>
            <DialogDescription className="mt-1 text-[13px] text-ink-soft">Set it up once for <b className="text-ink">{draft.label}</b>. Every template arrives with this applied.</DialogDescription>
          </div>
          <div className="flex-1 space-y-7 overflow-y-auto px-8 py-6">
            <section>
              <h4 className="mb-2.5 text-sm">1 · Start from a website <span className="font-medium text-ink-faint">(optional)</span></h4>
              <div className="flex gap-2">
                <Input value={site} onChange={(e) => setSite(e.target.value)} onKeyDown={(e) => e.key === "Enter" && void fetchSite()} placeholder="yourcompany.com" />
                <Button onClick={() => void fetchSite()} disabled={busy === "site" || !site.trim()} variant="soft" className="shrink-0">
                  {busy === "site" ? <Loader2 className="animate-spin" /> : <Globe />}Fetch brand
                </Button>
              </div>
            </section>

            <section>
              <h4 className="mb-2.5 text-sm">2 · Logo</h4>
              <div className="flex items-start gap-4">
                <div className="grid h-24 w-40 shrink-0 place-items-center rounded-lg border border-dashed border-line-2 bg-[repeating-conic-gradient(#f4f6fb_0%_25%,#fff_0%_50%)] bg-[length:14px_14px]">
                  {busy === "logo" ? <Loader2 className="animate-spin text-accent" /> : logoPreview ? <img src={logoPreview} alt="Logo preview" className="max-h-20 max-w-36 object-contain" /> : <span className="text-xs text-ink-faint">No logo yet</span>}
                </div>
                <div className="min-w-0 flex-1">
                  <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/svg+xml,image/webp" hidden onChange={(e) => { void onFile(e.target.files?.[0]); e.target.value = ""; }} />
                  <Button variant="outline" onClick={() => fileRef.current?.click()}><Upload />Upload logo</Button>
                  <p className="mt-2 text-xs text-ink-soft">SVG is used as-is. PNG/JPG are converted to a crisp vector so they recolour and scale cleanly.</p>
                  {review && (
                    <div className="mt-3 rounded-md border border-line-2 bg-accent-soft p-3 text-xs">
                      <b className="text-ink">Vectorised version applied.</b> Doesn&apos;t look right?
                      <div className="mt-2 flex gap-2">
                        {review.original && <Button size="sm" variant="outline" onClick={() => { set("logoSvg", null); setReview(null); }}>Use my original image</Button>}
                        <Button size="sm" variant="ghost" onClick={() => setReview(null)}>Looks good</Button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </section>

            <section>
              <div className="mb-2.5 flex items-center justify-between">
                <h4 className="text-sm">3 · Colours</h4>
                <Button size="sm" variant="ghost" onClick={() => void redetect()} disabled={!logoPreview || busy === "colors"}>{busy === "colors" ? <Loader2 className="animate-spin" /> : <Wand2 />}Detect from logo</Button>
              </div>
              <div className="grid grid-cols-3 gap-3">
                {([["color", "Primary"], ["secondary", "Secondary"], ["textColor", "Text"]] as const).map(([k, l]) => (
                  <Field key={k} label={l}>
                    <div className="flex h-10 items-center gap-2 rounded-md border border-line-2 px-2">
                      <input type="color" value={draft[k]} onChange={(e) => set(k, e.target.value)} className="size-7 cursor-pointer rounded border-0 bg-transparent p-0" />
                      <input value={draft[k]} onChange={(e) => /^#[0-9a-f]{0,6}$/i.test(e.target.value) && set(k, e.target.value)} className="w-full bg-transparent font-mono text-xs uppercase outline-none" />
                    </div>
                  </Field>
                ))}
              </div>
              <div className="mt-3 grid grid-cols-2 gap-3">
                <Field label="Heading font"><select value={draft.fontHeading} onChange={(e) => set("fontHeading", e.target.value)} className="h-10 w-full rounded-md border border-line-2 bg-white px-2 text-[13px]">{fontOptions.map((f) => <option key={f}>{f}</option>)}</select></Field>
                <Field label="Body font"><select value={draft.fontBody} onChange={(e) => set("fontBody", e.target.value)} className="h-10 w-full rounded-md border border-line-2 bg-white px-2 text-[13px]">{fontOptions.map((f) => <option key={f}>{f}</option>)}</select></Field>
              </div>
            </section>

            <section>
              <h4 className="mb-2.5 text-sm">4 · Placement <span className="font-medium text-ink-faint">(preset optional)</span></h4>
              <div className="mb-3 flex flex-wrap gap-2">
                {PRESETS.map((pr) => {
                  const on = draft.position === pr.pos && draft.detailsPosition === pr.details;
                  return <button key={pr.id} onClick={() => setDraft((d) => ({ ...d, position: pr.pos, detailsPosition: pr.details }))} aria-pressed={on} className={cn("rounded-full border px-3.5 py-1.5 text-xs font-semibold", on ? "border-accent bg-accent-soft text-accent" : "border-line-2 text-ink-soft hover:border-accent")}>{pr.label}</button>;
                })}
              </div>
              <div className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-ink-soft">Logo position</div>
              <div className="grid w-[168px] grid-cols-3 gap-1.5">
                {POS_OPTIONS.map((p) => (
                  <button key={p} title={POS_LABEL[p]} aria-label={POS_LABEL[p]} aria-pressed={draft.position === p} onClick={() => set("position", p as LogoPos)} className={cn("grid h-11 place-items-center rounded-md border transition", draft.position === p ? "border-accent bg-accent text-white" : "border-line-2 bg-white hover:border-accent")}>
                    <span className={cn("size-2 rounded-full", draft.position === p ? "bg-white" : "bg-line-2")} />
                  </button>
                ))}
              </div>
            </section>

            <section>
              <h4 className="mb-2.5 text-sm">5 · Company details <span className="font-medium text-ink-faint">(shown in the header/footer strip)</span></h4>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Company name"><div className="relative"><Input value={draft.companyName} readOnly disabled className="pr-24" /><Verified /></div></Field>
                <Field label="SEBI registration (RRN)" hint="Verified from your account — change it in account settings."><div className="relative"><Input value={draft.rrn} readOnly disabled className="pr-24" /><Verified /></div></Field>
                <Field label="Email"><Input value={draft.email} onChange={(e) => set("email", e.target.value)} placeholder="care@company.com" /></Field>
                <Field label="Mobile"><Input value={draft.mobile} onChange={(e) => set("mobile", e.target.value)} placeholder="+91 …" /></Field>
                <Field label="Website"><Input value={draft.website} onChange={(e) => set("website", e.target.value)} placeholder="company.com" /></Field>
                <Field label="Other"><Input value={draft.other} onChange={(e) => set("other", e.target.value)} placeholder="Anything else" /></Field>
              </div>
              {draft.otherFields.map((v, i) => (
                <div key={i} className="mt-2 flex gap-2">
                  <Input value={v} onChange={(e) => set("otherFields", draft.otherFields.map((x, k) => (k === i ? e.target.value : x)))} />
                  <Button size="icon" variant="ghost" aria-label="Remove field" onClick={() => set("otherFields", draft.otherFields.filter((_, k) => k !== i))}><X /></Button>
                </div>
              ))}
              {draft.otherFields.length < 3 && <Button size="sm" variant="ghost" className="mt-2" onClick={() => set("otherFields", [...draft.otherFields, ""])}><Plus />Add field</Button>}
              <div className="mt-3 flex gap-2">
                {(["top", "bottom"] as const).map((p) => (
                  <button key={p} onClick={() => set("detailsPosition", p)} className={cn("rounded-full border px-4 py-1.5 text-xs font-semibold", draft.detailsPosition === p ? "border-accent bg-accent-soft text-accent" : "border-line-2 text-ink-soft")}>Strip at {p}</button>
                ))}
              </div>
            </section>

            <section className="mb-3 flex items-center justify-between rounded-lg border border-line-2 bg-surface-2 px-4 py-3">
              <div><div className="text-[13px] font-bold">Box behind logo</div><div className="text-xs text-ink-soft">Off = logo sits directly on the strip. Keep it on if your logo is dark and the strip is dark.</div></div>
              <Switch checked={draft.logoPlate !== false} onCheckedChange={(v) => set("logoPlate", v)} aria-label="Box behind logo" />
            </section>
            <section className="flex items-center justify-between rounded-lg border border-line-2 bg-surface-2 px-4 py-3">
              <div><div className="text-[13px] font-bold">Auto-apply to new designs</div><div className="text-xs text-ink-soft">Off = templates open unbranded so you can brand by hand.</div></div>
              <Switch checked={draft.autoApply} onCheckedChange={(v) => set("autoApply", v)} aria-label="Auto-apply" />
            </section>
          </div>
          <div className="flex justify-end gap-2 border-t border-line px-8 py-4">
            <Button variant="outline" onClick={() => setSetupOpen(false)}>Cancel</Button>
            <Button onClick={() => void save()} disabled={saving || !draft.companyName.trim()}>{saving && <Loader2 className="animate-spin" />}Save setup</Button>
          </div>
        </div>

        <aside className="hidden w-[300px] shrink-0 border-l border-line bg-surface-2 p-6 lg:block">
          <div className="mb-2 text-[11px] font-bold uppercase tracking-wider text-ink-soft">Live preview</div>
          <select aria-label="Preview format" value={pvSize} onChange={(e) => setPvSize(e.target.value)} className="mb-3 h-9 w-full rounded-md border border-line-2 bg-white px-2 text-xs">{SIZES.map((z) => <option key={z.id} value={z.id}>{z.label}</option>)}</select>
          <div className="overflow-hidden rounded-lg shadow-3" style={{ background: `linear-gradient(135deg, ${draft.color}, ${draft.secondary})` }}>
            <div className="flex h-9 items-center px-3" style={{ background: "rgba(0,0,0,.18)" }}>
              <span className="truncate text-[9px] font-semibold text-white/90">{combineDetails(draft) || "Company details appear here"}</span>
            </div>
            <div style={{ aspectRatio: `${sizeById(pvSize).w} / ${sizeById(pvSize).h}`, fontFamily: draft.fontHeading }} className="relative grid max-h-[420px] place-items-center p-6 text-center text-[17px] font-extrabold leading-tight text-white">
              Your headline goes here
              <div className={cn("absolute rounded-md p-1.5", draft.logoPlate !== false && "bg-white shadow-2", draft.position.startsWith("top") ? "top-3" : draft.position.startsWith("bottom") ? "bottom-3" : "top-1/2 -translate-y-1/2", draft.position.endsWith("left") ? "left-3" : draft.position.endsWith("right") ? "right-3" : draft.position === "center" ? "left-1/2 -translate-x-1/2" : "left-1/2 -translate-x-1/2")}>
                {logoPreview ? <img src={logoPreview} alt="" className="h-6 max-w-16 object-contain" /> : <span className="text-[9px] font-bold" style={{ color: draft.color }}>{draft.logoName}</span>}
              </div>
            </div>
          </div>
          <p className="mt-3 text-xs text-ink-soft">Position: {POS_LABEL[draft.position]}</p>
        </aside>
      </DialogContent>
    </Dialog>
  );
}
