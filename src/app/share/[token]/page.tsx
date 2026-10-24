"use client";
import { Loader2 } from "lucide-react";
import { use, useEffect, useState } from "react";
import { renderPage } from "@/lib/export";
import { sizeById } from "@/lib/fabric-setup";

export default function SharePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const [state, setState] = useState<{ title: string; imgs: string[] } | "missing" | null>(null);
  useEffect(() => {
    let dead = false;
    (async () => {
      try {
        const r = await fetch(`/api/share/${token}`);
        if (!r.ok) throw new Error();
        const { design } = await r.json();
        const z = sizeById(design.sizeId);
        const imgs: string[] = [];
        for (const p of design.pages as { json: unknown }[]) imgs.push(await renderPage(p.json, z.w, z.h, { format: "jpeg", multiplier: 0.6 }));
        if (!dead) setState({ title: design.title, imgs });
      } catch { if (!dead) setState("missing"); }
    })();
    return () => { dead = true; };
  }, [token]);

  if (!state) return <div className="grid min-h-screen place-items-center"><Loader2 className="size-7 animate-spin text-accent" /></div>;
  if (state === "missing") return <div className="grid min-h-screen place-items-center text-center"><div><h1 className="text-2xl">Link not available</h1><p className="mt-2 text-ink-soft">This design was unshared or never existed.</p></div></div>;
  return (
    <div className="mx-auto max-w-[760px] px-6 py-10">
      <h1 className="mb-1 text-2xl">{state.title}</h1>
      <p className="mb-6 text-xs text-ink-faint">Shared from TheFinPedia Cobranding Studio · view only</p>
      <div className="space-y-6">{state.imgs.map((s, i) => <img key={i} src={s} alt={`${state.title} page ${i + 1}`} className="w-full rounded-lg shadow-3" />)}</div>
    </div>
  );
}
