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
  }
}

export const CUSTOM_PROPS = [
  "id", "role", "kind", "templateText", "sebiKept", "slotW", "slotH", "focusX", "focusY",
  "isPlaceholder", "origText", "upper", "bullets", "layerName", "hidden",
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
];
export const sizeById = (id: string) => SIZES.find((s) => s.id === id) ?? SIZES[0];

// ── fonts ──
const loadedFonts = new Set(["Inter", "Sora", "Poppins", "Playfair Display", "Roboto", "Merriweather", "Lato", "Georgia"]);
export const FONT_CHOICES = [
  "Inter", "Sora", "Poppins", "Playfair Display", "Roboto", "Merriweather", "Lato", "Georgia",
  "Montserrat", "Open Sans", "Nunito", "Raleway", "Oswald", "Work Sans", "Rubik", "Karla",
  "Quicksand", "Manrope", "DM Sans", "Space Grotesk", "Fira Sans", "PT Sans", "Ubuntu",
  "Josefin Sans", "Cabin", "Barlow", "Mulish", "Heebo", "Libre Baskerville", "Crimson Text",
  "Bitter", "Domine", "Zilla Slab", "Archivo", "Epilogue", "Outfit", "Plus Jakarta Sans",
  "Figtree", "Urbanist", "Bebas Neue", "Abril Fatface",
];

/** Load a Google font and wait until the canvas can actually draw with it. */
export async function ensureFont(family: string) {
  if (typeof document === "undefined" || !family) return;
  if (!loadedFonts.has(family) && family !== "Georgia") {
    loadedFonts.add(family);
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = `https://fonts.googleapis.com/css2?family=${family.replace(/ /g, "+")}:wght@400;600;700;800&display=swap`;
    document.head.appendChild(link);
  }
  try {
    await Promise.all([
      document.fonts.load(`400 24px "${family}"`),
      document.fonts.load(`700 24px "${family}"`),
      document.fonts.load(`800 24px "${family}"`),
    ]);
  } catch {
    /* offline / blocked — canvas falls back to the system font */
  }
}
