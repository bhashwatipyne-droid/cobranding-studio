"use client";
import dynamic from "next/dynamic";
import { useEffect } from "react";
import { Gallery } from "@/components/gallery/Gallery";
import { TypeSelect } from "@/components/gallery/TypeSelect";
import { SetupModal } from "@/components/setup/SetupModal";
import { Toast } from "@/components/Toast";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useStudio } from "@/store/studio-store";

const EditorScreen = dynamic(() => import("@/components/editor/EditorScreen").then((m) => m.EditorScreen), { ssr: false });

export default function Page() {
  const screen = useStudio((s) => s.screen);
  const init = useStudio((s) => s.init);
  useEffect(() => { void init(); }, [init]);
  return (
    <TooltipProvider>
      {screen === "gallery" && <Gallery />}
      {screen === "type" && <TypeSelect />}
      {screen === "editor" && <EditorScreen />}
      <SetupModal />
      <Toast />
    </TooltipProvider>
  );
}
