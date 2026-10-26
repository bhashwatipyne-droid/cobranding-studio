import type { BrandKit, TemplateDef } from "./types";
import { UNITY_HEAD, UNITY_SUB, BONDS_NOTE, BONDS_TITLE, DUSSEHRA_HEAD, DUSSEHRA_SUB, HABITS_HEAD, HABITS_NOTE, QUIZ_DEFAULT } from "./template-paths";

/**
 * Built-in approved templates — the designed "Minimalist" set. Each one is built from live Fabric objects in
 * template-art.ts (every word, shape and icon editable); the copy below is SEBI-neutral.
 */
export const BUILTIN_TEMPLATES: TemplateDef[] = [
  { id: "min-investor-quiz", name: "Investor Quiz", category: "Interactive", topic: "Mutual Funds", style: "Minimalist", layout: "art-quiz", palette: ["#1f2535", "#2e4d52"], sizeId: "post",
    headline: QUIZ_DEFAULT, sub: "", thumbnail: "/templates/min-investor-quiz.jpg" },
  { id: "min-bonds-rates", name: "Bond Prices & Interest Rates", category: "Infographic", topic: "Market Updates", style: "Minimalist", layout: "art-bonds", palette: ["#353994", "#432a96"], sizeId: "post",
    headline: BONDS_TITLE, sub: BONDS_NOTE, thumbnail: "/templates/min-bonds-rates.jpg" },
  { id: "min-nine-habits", name: "Nine Habits of Investing", category: "Infographic", topic: "Festivals", style: "Minimalist", layout: "art-habits", palette: ["#2a1f8a", "#4a2fb0"], sizeId: "portrait",
    headline: HABITS_HEAD, sub: HABITS_NOTE, thumbnail: "/templates/min-nine-habits.jpg" },
  { id: "min-dussehra", name: "Dussehra · Ayudha Puja", category: "Post", topic: "Festivals", style: "Minimalist", layout: "art-dussehra", palette: ["#2b1a6e", "#7a2f8f"], sizeId: "portrait",
    headline: DUSSEHRA_HEAD, sub: DUSSEHRA_SUB, thumbnail: "/templates/min-dussehra.jpg" },
  { id: "min-unity-day", name: "National Unity Day · Sardar Patel", category: "Post", topic: "Festivals", style: "Minimalist", layout: "art-unity", palette: ["#2a1593", "#6b4fc4"], sizeId: "portrait",
    headline: UNITY_HEAD, sub: UNITY_SUB, thumbnail: "/templates/min-unity-day.jpg" },
];

export const gradientCss = (p: [string, string]) => `linear-gradient(150deg, ${p[0]}, ${p[1]})`;

const base = (key: string, label: string, logoName: string, color: string, secondary: string, swatches: string[], companyName: string, rrn: string, website: string): BrandKit => ({
  key, label, logoName, color, secondary, textColor: "#0D1B3E", swatches,
  logoSvg: null, logoOriginal: null, position: "top-left",
  fontHeading: "Sora", fontBody: "Inter", autoApply: true, setupComplete: false,
  companyName, rrn, email: "", mobile: "", website, other: "", otherFields: [], detailsPosition: "bottom",
});

export const DEFAULT_KITS: Record<string, BrandKit> = {
  mine: base("mine", "My Brand", "Your Company", "#2B2BB5", "#5B5BE0", ["#2B2BB5", "#5B5BE0", "#9090EC", "#0D1B3E", "#546490", "#0D0D5C"], "Your Company Pvt Ltd", "RRN: 000000000000", ""),
  clientA: base("clientA", "Client A — Aster Wealth", "Aster Wealth", "#0369A1", "#0EA5E9", ["#0369a1", "#0EA5E9", "#075985", "#334155", "#64748B", "#082F49"], "Aster Wealth Advisors Pvt Ltd", "RRN: 110022334455", "asterwealth.com"),
  clientB: base("clientB", "Client B — Northline Capital", "Northline Capital", "#0F766E", "#10B981", ["#047857", "#10B981", "#065F46", "#B45309", "#78350F", "#1F2937"], "Northline Capital Pvt Ltd", "RRN: 220033445566", "northlinecapital.com"),
};

/** The single details line shown in the header/footer strip. Empty parts are skipped. */
export function combineDetails(k: BrandKit): string {
  return [k.companyName, k.rrn, k.email, k.mobile, k.website, k.other, ...k.otherFields]
    .filter((p) => p && p.trim())
    .join(" · ");
}

export const POS_OPTIONS = [
  "top-left", "top-center", "top-right", "mid-left", "center", "mid-right", "bottom-left", "bottom-center", "bottom-right",
] as const;

export const POS_LABEL: Record<string, string> = {
  "top-left": "Top left", "top-center": "Top center", "top-right": "Top right",
  "mid-left": "Middle left", center: "Center", "mid-right": "Middle right",
  "bottom-left": "Bottom left", "bottom-center": "Bottom center", "bottom-right": "Bottom right",
};
