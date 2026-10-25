"use client";
import { Delete, X } from "lucide-react";
import { useStudio } from "@/store/studio-store";

const ROWS: { label: string; keys: string[] }[] = [
  { label: "Vowels", keys: ["अ", "आ", "इ", "ई", "उ", "ऊ", "ऋ", "ए", "ऐ", "ओ", "औ", "अं", "अः"] },
  { label: "Matras", keys: ["ा", "ि", "ी", "ु", "ू", "ृ", "े", "ै", "ो", "ौ", "ं", "ः", "ँ", "्", "़"] },
  { label: "", keys: ["क", "ख", "ग", "घ", "ङ", "च", "छ", "ज", "झ", "ञ"] },
  { label: "", keys: ["ट", "ठ", "ड", "ढ", "ण", "त", "थ", "द", "ध", "न"] },
  { label: "", keys: ["प", "फ", "ब", "भ", "म", "य", "र", "ल", "व"] },
  { label: "", keys: ["श", "ष", "स", "ह", "क्ष", "त्र", "ज्ञ", "श्र", "ड़", "ढ़"] },
  { label: "Numbers", keys: ["०", "१", "२", "३", "४", "५", "६", "७", "८", "९", "।", "₹", ",", ".", "?", "!"] },
];
const MATRAS = new Set(["ा", "ि", "ी", "ु", "ू", "ृ", "े", "ै", "ो", "ौ", "ं", "ः", "ँ", "्", "़"]);

/** On-screen Devanagari keyboard — inserts at the caret of the selected text. */
export function HindiKeyboard({ onClose }: { onClose: () => void }) {
  const c = useStudio((s) => s.controller);
  if (!c) return null;
  const key = "grid h-9 min-w-9 place-items-center rounded-md border border-line-2 bg-white px-2 text-[17px] font-medium text-ink hover:border-accent hover:bg-accent-soft active:scale-95";
  return (
    <div role="dialog" aria-label="Hindi keyboard" className="fixed bottom-5 left-1/2 z-50 w-[min(640px,calc(100vw-24px))] -translate-x-1/2 rounded-xl border border-line-2 bg-surface p-3 shadow-2" onMouseDown={(e) => e.preventDefault()}>
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-bold uppercase tracking-wider text-ink-soft">Hindi keyboard <span className="font-medium normal-case text-ink-faint">· tap a letter to type it into the selected text</span></span>
        <button aria-label="Close keyboard" onClick={onClose} className="grid size-7 place-items-center rounded-md text-ink-soft hover:bg-accent-soft"><X className="size-4" /></button>
      </div>
      <div className="space-y-1.5">
        {ROWS.map((r, i) => (
          <div key={i} className="flex flex-wrap items-center gap-1.5">
            {r.label && <span className="w-14 shrink-0 text-[10px] font-bold uppercase tracking-wider text-ink-faint">{r.label}</span>}
            {r.keys.map((k) => (
              <button key={k} aria-label={`Type ${k}`} onMouseDown={(e) => e.preventDefault()} onClick={() => void c.typeText(k)} className={key}>
                {MATRAS.has(k) ? `◌${k}` : k}
              </button>
            ))}
          </div>
        ))}
        <div className="flex items-center gap-1.5 pt-1">
          <button aria-label="Space" onMouseDown={(e) => e.preventDefault()} onClick={() => void c.typeText(" ")} className={`${key} flex-1 text-xs`}>Space</button>
          <button aria-label="New line" onMouseDown={(e) => e.preventDefault()} onClick={() => void c.typeText("\n")} className={`${key} text-xs`}>↵</button>
          <button aria-label="Backspace" onMouseDown={(e) => e.preventDefault()} onClick={() => void c.typeText("", true)} className={key}><Delete className="size-4" /></button>
        </div>
      </div>
      <p className="mt-2 text-[11px] text-ink-faint">Tip: your computer&apos;s own Hindi keyboard (Windows: Win+Space) also works while a text is being edited.</p>
    </div>
  );
}
