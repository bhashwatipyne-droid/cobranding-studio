"use client";
import { useEffect } from "react";
import { useStudio } from "@/store/studio-store";

export function Toast() {
  const t = useStudio((s) => s.toastMsg);
  useEffect(() => {
    if (!t) return;
    const h = setTimeout(() => useStudio.setState((s) => (s.toastMsg?.id === t.id ? { toastMsg: null } : {})), 3200);
    return () => clearTimeout(h);
  }, [t]);
  if (!t) return null;
  return (
    <div role="status" aria-live="polite" key={t.id} className="pop-in fixed bottom-7 left-1/2 z-[500] max-w-[90vw] -translate-x-1/2 rounded-full bg-ink px-5 py-2.5 text-[13px] font-medium text-white shadow-4">
      {t.msg}
    </div>
  );
}
