"use client";
import {
  AlignCenter, AlignLeft, AlignRight, Bold, Copy, Eraser, Group, Italic, List, Lock, Minus, MoveDown, MoveUp,
  Plus, Strikethrough, Sun, Trash2, Type, Underline, Ungroup, Unlock, ArrowUp, ArrowDown, ArrowLeft, ArrowRight, ImagePlus, CaseUpper, Droplets,
} from "lucide-react";
import { useRef } from "react";
import { Tip } from "@/components/ui/tooltip";
import { FONT_CHOICES } from "@/lib/fabric-setup";
import { fileToDataUrl, shrinkPhoto } from "@/lib/vectorize";
import { cn } from "@/lib/utils";
import { useStudio } from "@/store/studio-store";

function Btn({ label, active, onClick, children, disabled }: { label: string; active?: boolean; onClick: () => void; children: React.ReactNode; disabled?: boolean }) {
  return (
    <Tip label={label}>
      <button aria-label={label} aria-pressed={active} disabled={disabled} onMouseDown={(e) => e.preventDefault()} onClick={onClick} className={cn("grid size-8 shrink-0 place-items-center rounded-md transition [&_svg]:size-4", active ? "bg-accent text-white" : "text-ink-soft hover:bg-accent-soft hover:text-accent", disabled && "opacity-40")}>
        {children}
      </button>
    </Tip>
  );
}
const Sep = () => <span className="mx-1 h-5 w-px shrink-0 bg-line-2" />;
function Color({ label, value, onChange }: { label: string; value: string; onChange: (c: string) => void }) {
  return (
    <Tip label={label}>
      <label className="relative grid size-8 shrink-0 cursor-pointer place-items-center rounded-md hover:bg-accent-soft">
        <span className="size-5 rounded-full ring-1 ring-ink/20" style={{ background: value }} />
        <input type="color" aria-label={label} value={/^#[0-9a-f]{6}$/i.test(value) ? value : "#000000"} onChange={(e) => onChange(e.target.value)} className="absolute inset-0 cursor-pointer opacity-0" />
      </label>
    </Tip>
  );
}
function Slider({ label, value, min, max, step = 1, onChange, onDone, icon }: { label: string; value: number; min: number; max: number; step?: number; onChange: (v: number) => void; onDone?: () => void; icon?: React.ReactNode }) {
  return (
    <Tip label={label}>
      <label className="flex shrink-0 items-center gap-1.5 text-ink-soft [&_svg]:size-4">
        {icon}
        <input aria-label={label} type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} onPointerUp={onDone} onKeyUp={onDone} className="h-1 w-20 accent-[var(--color-accent)]" />
      </label>
    </Tip>
  );
}

export function ContextToolbar() {
  const { sel, controller: c } = useStudio();
  const toast = useStudio((s) => s.toast);
  const fileRef = useRef<HTMLInputElement>(null);
  if (!c) return null;
  if (!sel) return <div className="flex h-12 items-center border-b border-line bg-surface px-5 text-xs text-ink-faint">Click anything on the canvas to edit it. Double-click text to type.</div>;
  const t = sel.text;
  const isTxt = !!t;
  const done = (l: string) => c.commit(l);

  return (
    <div className="flex h-12 items-center gap-0.5 overflow-x-auto border-b border-line bg-surface px-3" role="toolbar" aria-label="Selection tools">
      {isTxt && t && (
        <>
          <select aria-label="Font" value={t.fontFamily} onChange={(e) => c.setFont(e.target.value)} className="mr-1 h-8 w-32 shrink-0 rounded-md border border-line-2 bg-white px-1.5 text-xs">
            {[...new Set([t.fontFamily, ...FONT_CHOICES])].map((f) => <option key={f}>{f}</option>)}
          </select>
          <Btn label="Smaller" onClick={() => c.stepFont(-2)}><Minus /></Btn>
          <span className="w-8 text-center text-xs font-semibold tabular-nums">{Math.round(t.fontSize)}</span>
          <Btn label="Larger" onClick={() => c.stepFont(2)}><Plus /></Btn>
          <Sep />
          <Btn label="Bold" active={t.bold} onClick={() => c.toggleBold()}><Bold /></Btn>
          <Btn label="Italic" active={t.italic} onClick={() => c.toggleItalic()}><Italic /></Btn>
          <Btn label="Underline" active={t.underline} onClick={() => c.toggleUnderline()}><Underline /></Btn>
          <Btn label="Strikethrough" active={t.strike} onClick={() => c.toggleStrike()}><Strikethrough /></Btn>
          <Btn label="UPPERCASE" active={t.upper} onClick={() => c.toggleUpper()}><CaseUpper /></Btn>
          <Sep />
          <Btn label="Align left" active={t.align === "left"} onClick={() => c.setAlign("left")}><AlignLeft /></Btn>
          <Btn label="Align center" active={t.align === "center"} onClick={() => c.setAlign("center")}><AlignCenter /></Btn>
          <Btn label="Align right" active={t.align === "right"} onClick={() => c.setAlign("right")}><AlignRight /></Btn>
          <Btn label="Bullets" active={t.bullets} onClick={() => c.toggleBullets()}><List /></Btn>
          <Btn label="Shadow" active={t.shadow} onClick={() => c.toggleShadow()}><Droplets /></Btn>
          <Color label="Text colour" value={t.fill} onChange={(v) => c.setColor(v)} />
          <Slider label="Line height" value={t.lineHeight} min={0.8} max={2} step={0.05} onChange={(v) => c.setLineHeight(v)} onDone={() => done("Line height")} icon={<Type />} />
          <Sep />
        </>
      )}
      {sel.paint && !isTxt && (
        <>
          {sel.kind !== "image" && <Color label="Fill colour" value={sel.paint.fill || "#2B2BB5"} onChange={(v) => c.setColor(v)} />}
          {sel.kind !== "image" && <Color label="Border colour" value={sel.paint.stroke || "#2B2BB5"} onChange={(v) => c.setBorderColor(v)} />}
          <Btn label="Thinner border" onClick={() => c.stepBorder(-1)}><Minus /></Btn>
          <span className="w-6 text-center text-xs font-semibold tabular-nums">{sel.paint.strokeWidth}</span>
          <Btn label="Thicker border" onClick={() => c.stepBorder(1)}><Plus /></Btn>
          <Sep />
        </>
      )}
      {sel.kind === "image" && sel.image && (
        <>
          <input ref={fileRef} type="file" accept="image/*" hidden onChange={async (e) => {
            const f = e.target.files?.[0]; e.target.value = "";
            if (!f) return;
            try { const src = await shrinkPhoto(await fileToDataUrl(f)); useStudio.getState().addUpload(src); await c.setImageOnSelection(src); } catch { toast("Couldn't read that image"); }
          }} />
          <Btn label="Replace image" onClick={() => fileRef.current?.click()}><ImagePlus /></Btn>
          <Btn label="Pan up" onClick={() => c.nudgeImage(0, -30)}><ArrowUp /></Btn>
          <Btn label="Pan down" onClick={() => c.nudgeImage(0, 30)}><ArrowDown /></Btn>
          <Btn label="Pan left" onClick={() => c.nudgeImage(-30, 0)}><ArrowLeft /></Btn>
          <Btn label="Pan right" onClick={() => c.nudgeImage(30, 0)}><ArrowRight /></Btn>
          <Slider label="Brightness" value={sel.image.brightness} min={-0.5} max={0.5} step={0.05} onChange={(v) => c.setImageFilter("brightness", v)} onDone={() => done("Brightness")} icon={<Sun />} />
          <Slider label="Contrast" value={sel.image.contrast} min={-0.5} max={0.5} step={0.05} onChange={(v) => c.setImageFilter("contrast", v)} onDone={() => done("Contrast")} icon={<span className="text-[10px] font-bold">C</span>} />
          <Slider label="Saturation" value={sel.image.saturation} min={-1} max={1} step={0.05} onChange={(v) => c.setImageFilter("saturation", v)} onDone={() => done("Saturation")} icon={<span className="text-[10px] font-bold">S</span>} />
          <Btn label="Remove white background" active={sel.image.whiteRemoved} onClick={() => c.toggleWhiteRemoval()}><Eraser /></Btn>
          <Sep />
        </>
      )}
      <Slider label="Opacity" value={sel.opacity} min={0.1} max={1} step={0.05} onChange={(v) => c.setOpacity(v)} onDone={() => done("Opacity")} icon={<span className="text-[10px] font-bold">Op</span>} />
      <Sep />
      <Btn label="Bring to front" onClick={() => c.reorder("front")}><MoveUp /></Btn>
      <Btn label="Send to back" onClick={() => c.reorder("back")}><MoveDown /></Btn>
      <Btn label={sel.locked ? "Unlock" : "Lock"} active={sel.locked} onClick={() => c.toggleLock()}>{sel.locked ? <Lock /> : <Unlock />}</Btn>
      <Btn label="Duplicate (Ctrl+D)" onClick={() => void c.duplicate()}><Copy /></Btn>
      {sel.count > 1 && <Btn label="Group (Ctrl+G)" onClick={() => c.group()}><Group /></Btn>}
      {sel.isGroup && <Btn label="Ungroup" onClick={() => c.ungroup()}><Ungroup /></Btn>}
      <Btn label="Delete" onClick={() => c.deleteSelected()}><Trash2 /></Btn>
    </div>
  );
}
