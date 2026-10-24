"use client";
import { FabricObject } from "fabric";
import type { DesignSize } from "./types";

declare module "fabric" {
  // Custom per-object metadata. Listed in FabricObject.customProperties below so it survives toObject()/loadFromJSON().
  interface FabricObject {
    id?: string;
    /** structural role: headline | sub | stat | image | accent | strip | logo | details | plate | decor */
    role?: string;
    /** editor type used by the toolbar: text | image | shape | icon | line | logo */
    kind?: string;
    templateText?: boolean;
    sebiKept?: string[];
    slotW?: number;
    slotH?: number;
    focusX?: number;
    focusY?: number;
    isPlaceholder?: boolean;
    origText?: string;
    upper?: boolean;
    bullets?: boolean;
    layerName?: string;
    hidden?: boolean;
    /** keep this text's own font when a brand kit is (re)applied — used by designed templates */
    keepFont?: boolean;
    /** which brand font this text follows: decided once from the template's own hierarchy */
    brandSlot?: "heading" | "body";
    /** designed inline emphasis (phrase → weight/colour); re-applied after every compliance restyle */
    richPhrases?: RichPhrase[];
  }
  interface SerializedObjectProps {
    id?: string;
    role?: string;
    kind?: string;
    templateText?: boolean;
    sebiKept?: string[];
    slotW?: number;
    slotH?: number;
    focusX?: number;
    focusY?: number;
    isPlaceholder?: boolean;
    origText?: string;
    upper?: boolean;
    bullets?: boolean;
    layerName?: string;
    hidden?: boolean;
    keepFont?: boolean;
    /** which brand font this text follows: decided once from the template's own hierarchy */
    brandSlot?: "heading" | "body";
    richPhrases?: RichPhrase[];
  }
}

export interface RichPhrase { text: string; fontWeight?: number; fill?: string }

export const CUSTOM_PROPS = [
  "id", "role", "kind", "templateText", "sebiKept", "slotW", "slotH", "focusX", "focusY",
  "isPlaceholder", "origText", "upper", "bullets", "layerName", "hidden", "keepFont", "brandSlot", "richPhrases",
  "lockMovementX", "lockMovementY", "lockRotation", "lockScalingX", "lockScalingY", "selectable", "evented",
];

let configured = false;
export function configureFabric() {
  if (configured) return;
  configured = true;
  FabricObject.customProperties = CUSTOM_PROPS;
  Object.assign(FabricObject.ownDefaults, {
    originX: "left",
    originY: "top",
    cornerStyle: "rect",
    cornerColor: "#ffffff",
    cornerStrokeColor: "#2B2BB5",
    borderColor: "#2B2BB5",
    transparentCorners: false,
    cornerSize: 11,
    touchCornerSize: 28,
    borderScaleFactor: 2,
    padding: 0,
  });
}

/** Logical canvas sizes (FR-02). Zoom/fit only changes the display scale, never these. */
export const SIZES: DesignSize[] = [
  { id: "post", label: "Instagram Post · 1080×1080", w: 1080, h: 1080 },
  { id: "story", label: "Instagram Story · 1080×1920", w: 1080, h: 1920 },
  { id: "linkedin", label: "LinkedIn Post · 1200×627", w: 1200, h: 627 },
  { id: "facebook", label: "Facebook Post · 1200×630", w: 1200, h: 630 },
  { id: "portrait", label: "Instagram Portrait · 1080×1350", w: 1080, h: 1350 },
];
export const sizeById = (id: string) => SIZES.find((s) => s.id === id) ?? SIZES[0];

// ── fonts ──
const loadedFonts = new Set(["Inter", "Sora", "Poppins", "Playfair Display", "Roboto", "Merriweather", "Lato", "Georgia", "Bree Serif"]);
/** Google families that only ship a regular weight — asking for wght@… makes the whole request fail. */
const SINGLE_WEIGHT = new Set(["Bree Serif", "Bebas Neue", "Abril Fatface", "Lobster", "Pacifico", "Satisfy", "Anton", "Righteous", "Great Vibes"]);
export const FONT_CHOICES = [
  "Inter", "Sora", "Poppins", "Playfair Display", "Roboto", "Merriweather", "Lato", "Georgia",
  "Montserrat", "Open Sans", "Nunito", "Raleway", "Oswald", "Work Sans", "Rubik", "Karla",
  "Quicksand", "Manrope", "DM Sans", "Space Grotesk", "Fira Sans", "PT Sans", "Ubuntu",
  "Josefin Sans", "Cabin", "Barlow", "Mulish", "Heebo", "Libre Baskerville", "Crimson Text",
  "Bitter", "Domine", "Zilla Slab", "Archivo", "Epilogue", "Outfit", "Plus Jakarta Sans",
  "Figtree", "Urbanist", "Bebas Neue", "Abril Fatface", "Bree Serif",
  "Lobster", "Pacifico", "Dancing Script", "Caveat", "Satisfy", "Comfortaa", "Anton", "Righteous", "Great Vibes", "Cinzel", "Lora", "Noto Sans", "Nunito Sans", "IBM Plex Sans", "Source Sans 3", "Cormorant Garamond",
];

const customUrls = new Map<string, string>();
const customLoaded = new Set<string>();
/** Fonts taken from a brand's own website (not on Google Fonts) are registered straight from their file URL. */
export function registerKitFonts(kit: { customFonts?: { family: string; url: string }[] }) {
  for (const f of kit.customFonts ?? []) if (f.family && f.url) customUrls.set(f.family, f.url);
}

/** Load a Google font and wait until the canvas can actually draw with it. */
export async function ensureFont(family: string, weights: number[] = [300, 400, 500, 600, 700, 800]) {
  if (typeof document === "undefined" || !family) return;
  const own = customUrls.get(family);
  if (own && !customLoaded.has(family)) {
    customLoaded.add(family);
    try {
      const face = new FontFace(family, `url("${own}")`, { weight: "100 900" });
      document.fonts.add(await face.load());
    } catch { customLoaded.delete(family); /* blocked/CORS — fall through to Google/system */ }
  }
  if (!own && !loadedFonts.has(family) && family !== "Georgia") {
    loadedFonts.add(family);
    const link = document.createElement("link");
    link.rel = "stylesheet";
    const fam = family.replace(/ /g, "+");
    link.href = SINGLE_WEIGHT.has(family)
      ? `https://fonts.googleapis.com/css2?family=${fam}&display=swap`
      : `https://fonts.googleapis.com/css2?family=${fam}:wght@400;600;700;800&display=swap`;
    // a family that lacks some weights makes the whole request fail — retry with the plain family URL
    link.onerror = () => { const plain = document.createElement("link"); plain.rel = "stylesheet"; plain.href = `https://fonts.googleapis.com/css2?family=${fam}&display=swap`; document.head.appendChild(plain); };
    document.head.appendChild(link);
  }
  try {
    await Promise.all(weights.map((w) => document.fonts.load(`${w} 24px "${family}"`)));
  } catch {
    /* offline / blocked — canvas falls back to the system font */
  }
}
