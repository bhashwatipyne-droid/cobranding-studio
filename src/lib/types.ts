export type ContentType = "single" | "carousel" | "video";
export type KitKey = string;

export type LogoPos =
  | "top-left" | "top-center" | "top-right"
  | "mid-left" | "center" | "mid-right"
  | "bottom-left" | "bottom-center" | "bottom-right";

export interface BrandKit {
  key: KitKey;
  label: string;
  /** Short name used for the initials placeholder logo */
  logoName: string;
  color: string;
  secondary: string;
  textColor: string;
  swatches: string[];
  /** Vector logo used on the canvas (FR-S03). Either the user's SVG or the reviewed traced SVG. */
  logoSvg: string | null;
  /** Original raster upload, kept as fallback if the user rejects vectorization */
  logoOriginal: string | null;
  position: LogoPos;
  fontHeading: string;
  fontBody: string;
  /** Fonts that aren't on Google Fonts (picked up from the brand's website) — registered from their file URL */
  customFonts?: { family: string; url: string }[];
  autoApply: boolean;
  /** White box behind the logo (default on). Off = the logo sits directly on the strip. */
  logoPlate?: boolean;
  setupComplete: boolean;
  companyName: string;
  rrn: string;
  email: string;
  mobile: string;
  website: string;
  other: string;
  otherFields: string[];
  detailsPosition: "top" | "bottom";
}

export interface PageData {
  id: string;
  /** Fabric canvas JSON (canvas.toObject) */
  json: unknown;
}

export interface DesignSize {
  id: string;
  label: string;
  w: number;
  h: number;
}

export interface DesignDoc {
  id: string;
  title: string;
  templateId: string;
  contentType: ContentType;
  sizeId: string;
  kitKey: KitKey;
  pages: PageData[];
  overlay: { header: boolean; footer: boolean };
  status: "draft" | "library";
  palette?: [string, string];
  layout?: LayoutId;
  shareToken?: string | null;
  isShared?: boolean;
  updatedAt?: string;
}

export type LayoutId =
  | "hero" | "split" | "card" | "stat" | "quote" | "minimal" | "banner" | "badge"
  /** designed, fully-editable templates (see template-art.ts) */
  | "art-quiz" | "art-bonds" | "art-habits" | "art-dussehra";

export interface TemplateDef {
  id: string;
  name: string;
  category: string;
  /** Content topic for the gallery filter */
  topic: string;
  /** Visual treatment used for the gallery thumbnail + the first layout */
  layout: LayoutId;
  /** [from, to] gradient — the template's colour story, followed by the default header/footer (FR-28) */
  palette: [string, string];
  headline: string;
  sub: string;
  stat?: string;
  /** canvas size the template is designed for (defaults to the 1080×1080 post) */
  sizeId?: string;
  /** visual style tag shown in the gallery, e.g. "Minimalist" */
  style?: string;
  custom?: boolean;
  thumbnail?: string | null;
  doc?: DesignDoc | null;
}

export interface CommentPin {
  id: string;
  pageId: string;
  x: number;
  y: number;
  text: string;
}

/** Designed templates (template-art.ts) — each is drawn for one canvas size. */
export const isArtLayout = (l: string) => l.startsWith("art-");
