"use client";
import { ArrowLeft, Play } from "lucide-react";
import { useStudio } from "@/store/studio-store";
import type { ContentType } from "@/lib/types";

export function TypeSelect() {
  const { goto, startEditor, kits, activeKitKey, pendingTemplate } = useStudio();
  const kit = kits[activeKitKey];
  const cards: { id: ContentType; title: string; text: string; tag: string; icon: React.ReactNode }[] = [
    { id: "single", title: "Single post", text: "One image or graphic. Edit everything — text, logo, image, colors — on a single canvas.", tag: "Fastest", icon: <span className="size-6 rounded-[5px] bg-accent" /> },
    { id: "carousel", title: "Carousel", text: "Multiple slides in one post. Add, reorder, and edit as many pages as you need.", tag: "Multi-slide", icon: <span className="flex items-center gap-[3px]"><i className="h-6 w-2 rounded-[3px] bg-accent/40" /><i className="h-[30px] w-2 rounded-[3px] bg-accent" /><i className="h-6 w-2 rounded-[3px] bg-accent/40" /></span> },
    { id: "video", title: "Video", text: "Brand the first frame, the last frame, and an optional logo/details bar shown throughout — not every frame.", tag: "First + last frame", icon: <Play className="size-5 fill-accent text-accent" /> },
  ];
  return (
    <div className="min-h-screen">
      <div className="flex h-16 items-center gap-3 border-b border-line bg-surface px-7">
        <button aria-label="Back" onClick={() => goto("gallery")} className="grid size-9 place-items-center rounded-md text-ink-soft hover:bg-accent-soft hover:text-accent"><ArrowLeft className="size-[18px]" /></button>
        <div className="text-base font-extrabold tracking-tight">Choose a format</div>
      </div>
      <div className="mx-auto max-w-[960px] px-8 py-[72px] text-center">
        <h1 className="mb-2.5 text-[30px] tracking-[-.03em]">How do you want to edit this?</h1>
        <p className="mb-11 text-[15px] text-ink-soft">{pendingTemplate?.name} — pick a format. You can always start over if it&apos;s not the right fit.</p>
        <div className="grid gap-5 md:grid-cols-3">
          {cards.map((c) => (
            <button key={c.id} onClick={() => void startEditor(c.id)} className="rounded-xl border border-line bg-surface p-7 text-left shadow-1 transition hover:-translate-y-1 hover:border-line-2 hover:shadow-3">
              <span className="grid size-[52px] place-items-center rounded-lg bg-accent-soft">{c.icon}</span>
              <h3 className="mb-2 mt-[18px] text-[17px]">{c.title}</h3>
              <p className="min-h-[62px] text-[13px] leading-relaxed text-ink-soft">{c.text}</p>
              <span className="mt-[18px] inline-block rounded-full bg-accent-soft px-[11px] py-[5px] text-[10.5px] font-bold uppercase tracking-wider text-accent">{c.tag}</span>
            </button>
          ))}
        </div>
        <p className="mt-9 inline-flex items-center gap-2.5 rounded-full border border-line-2 bg-surface px-4 py-2 text-[12.5px] text-ink-soft shadow-1">
          <span className="size-4 rounded-full" style={{ background: kit.color }} />Branding from <b className="text-ink">{kit.label}</b> will be applied automatically.
        </p>
      </div>
    </div>
  );
}
