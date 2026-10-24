import type { BrandKit, TemplateDef } from "./types";

/** Built-in approved templates. Copy is deliberately SEBI-neutral (no promises of returns). */
export const BUILTIN_TEMPLATES: TemplateDef[] = [
  { id: "market-update", name: "Market Update", category: "Infographic", topic: "Market Updates", layout: "hero", palette: ["#2B2BB5", "#0D0D5C"],
    headline: "Markets this week: what moved and why", sub: "A quick snapshot for your clients" },
  { id: "sip-explainer", name: "SIP Explainer", category: "Carousel", topic: "Mutual Funds", layout: "split", palette: ["#5B5BE0", "#2B2BB5"],
    headline: "How a monthly SIP works", sub: "Small, regular investments over time" },
  { id: "tax-season", name: "Tax Season Tips", category: "Reel Cover", topic: "Tax Planning", layout: "banner", palette: ["#C2703A", "#7C3E17"],
    headline: "Tax planning checklist before the year ends", sub: "Review your options with your advisor" },
  { id: "fund-performance", name: "Fund Performance", category: "Infographic", topic: "Mutual Funds", layout: "stat", palette: ["#12897A", "#0B4F52"],
    headline: "Returns are market-linked and vary over time", sub: "Past performance may or may not be sustained", stat: "12.4%" },
  { id: "retirement-goals", name: "Retirement Goals", category: "Post", topic: "Mutual Funds", layout: "quote", palette: ["#8B4A9C", "#4A1D5C"],
    headline: "Start early, stay consistent, review regularly", sub: "— Your financial advisor" },
  { id: "gold-vs-equity", name: "Gold vs Equity", category: "Comparison", topic: "Market Updates", layout: "card", palette: ["#546490", "#20304F"],
    headline: "Gold vs equity: how each has behaved over time", sub: "Diversification can help spread risk" },
  { id: "new-fund-launch", name: "New Fund Launch", category: "Announcement", topic: "Mutual Funds", layout: "badge", palette: ["#9090EC", "#4141C4"],
    headline: "A new fund offer is now open", sub: "Read all scheme related documents carefully" },
  { id: "risk-quiz", name: "Risk Appetite Quiz", category: "Interactive", topic: "Tax Planning", layout: "minimal", palette: ["#B03A5B", "#5C1730"],
    headline: "What is your risk appetite?", sub: "Answer a few questions to find out" },
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
