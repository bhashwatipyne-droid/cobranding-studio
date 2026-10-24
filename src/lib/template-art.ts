"use client";
/**
 * The designed "Minimalist" templates. Every element is its own Fabric object (text, shape, icon, line),
 * nothing is a flattened picture — except the photographic scenes in the Navratri and Dussehra templates,
 * which sit on one replaceable "Background art" image with all the type, shapes and icons live on top.
 *
 * Roles: the main message is `headline` / `sub` (so Change-layout keeps the user's words and SEBI checks run);
 * everything decorative is `art`, a neutral role that brand-kit recolouring leaves alone.
 */
import { Circle, FabricImage, FabricObject, Gradient, Group, Path, Polygon, Rect, Shadow, Textbox } from "fabric";
import type { BuildInput, BuiltPage } from "./layouts";
import { rect, tag, text } from "./layouts";
import { ensureFont } from "./fabric-setup";
import {
  BONDS_NOTE, BONDS_TITLE, DUSSEHRA_HEAD, DUSSEHRA_SUB, HABITS_HEAD, HABITS_NOTE, NINE_GLYPH, QUIZ_BLOB, QUIZ_DEFAULT, QUIZ_PILL,
} from "./template-paths";

type Pt = [number, number];
const WEIGHTS = [300, 400, 500, 600, 700];

// ───────────────────────────── small helpers ─────────────────────────────

function shape<T extends FabricObject>(o: T, name: string, kind = "shape"): T {
  return tag(o, "art", kind, { layerName: name });
}

interface CopyOpts {
  left: number; top: number; width: number; size: number; weight?: number; color: string; font: string;
  align?: "left" | "center" | "right"; lineHeight?: number; opacity?: number;
}
/** Editable copy. `role` is headline/sub for the main message, art for everything else. */
function copy(role: "headline" | "sub" | "art", value: string, name: string, o: CopyOpts) {
  // Fabric multiplies line height by its 1.13 font-size factor; callers here think in plain "pitch / font size"
  const t = text(role, value, { ...o, lineHeight: (o.lineHeight ?? 1.2) / 1.13, templateText: true });
  t.set({ layerName: name, keepFont: true });
  return t;
}

function poly(points: Pt[], fill: string | null, name: string, extra: Partial<Polygon> = {}) {
  return shape(new Polygon(points.map(([x, y]) => ({ x, y })), { fill: fill ?? "", objectCaching: false, ...extra }), name);
}

/** Stroke icon authored on a 24-unit grid, centred on (cx, cy). Same construction as the toolbar's icon library. */
function icon(d: string, cx: number, cy: number, size: number, color: string, name: string, sw = 1.7) {
  const p = new Path(d, { fill: "", stroke: color, strokeWidth: sw, strokeLineCap: "round", strokeLineJoin: "round" });
  const s = size / 24;
  p.set({ scaleX: s, scaleY: s });
  p.set({ left: cx - p.getScaledWidth() / 2, top: cy - p.getScaledHeight() / 2 });
  return shape(p, name, "icon");
}

function line(d: string, color: string, width: number, name: string) {
  return shape(new Path(d, { fill: "", stroke: color, strokeWidth: width, strokeLineCap: "round" }), name, "line");
}

/** Cover-fit a scene onto the canvas without stretching it; anchored to the bottom, where the artwork's subjects sit. */
async function photo(src: string, w: number, h: number, name: string) {
  const img = await FabricImage.fromURL(src, { crossOrigin: "anonymous" });
  const nw = img.width || w, nh = img.height || h;
  const k = Math.max(w / nw, h / nh);
  img.set({ left: (w - nw * k) / 2, top: h - nh * k, scaleX: k, scaleY: k });
  return tag(img, "art", "image", { layerName: name });
}

const pick = (v: string | undefined, fallback: string) => (v && v.trim() ? v : fallback);

// ───────────────────────────── 1 · Quiz ─────────────────────────────

const QUIZ_DOTS: [number, number, number][] = [
  [37, 43, 78], [557, 35, 72], [897, 107, 58], [208, 191, 47], [1073, 192, 36], [948, 444, 34], [85, 506, 71],
  [1032, 620, 21], [50, 874, 34], [651, 938, 52], [1000, 998, 57], [207, 1046, 95],
];
const QUIZ_OPTIONS = ["A) Less than 20%", "B) 20-40%", "C) 40-60%", "D) More than 60%"];

async function quiz(inp: BuildInput): Promise<BuiltPage> {
  await ensureFont("Lato", [400, 700]);
  const o: FabricObject[] = [];
  QUIZ_DOTS.forEach(([x, y, r], i) => o.push(shape(new Circle({ left: x - r, top: y - r, radius: r, fill: "#2e4d52" }), `Dot ${i + 1}`)));

  o.push(shape(new Path(QUIZ_BLOB, { fill: "#ffffff" }), "Question bubble"));
  o.push(line("M797 249 Q850 262 873 321", "#ffffff", 4, "Bubble accent 1"));
  o.push(line("M206 457 Q220 505 289 519", "#ffffff", 4, "Bubble accent 2"));

  QUIZ_OPTIONS.forEach((label, i) => {
    const dx = (i % 2) * 345, dy = Math.floor(i / 2) * 140;
    const pill = new Path(QUIZ_PILL, { fill: "#5cfac7" });
    pill.set({ left: (pill.left ?? 220) + dx, top: (pill.top ?? 584) + dy });
    o.push(shape(pill, `Option ${"ABCD"[i]} pill`));
    o.push(line(`M${486 + dx} ${586 + dy} Q${522 + dx} ${596 + dy} ${528 + dx} ${630 + dy}`, "#5cfac7", 4, `Option ${"ABCD"[i]} accent 1`));
    o.push(line(`M${218 + dx} ${669 + dy} Q${228 + dx} ${698 + dy} ${263 + dx} ${701 + dy}`, "#5cfac7", 4, `Option ${"ABCD"[i]} accent 2`));
  });
  QUIZ_OPTIONS.forEach((label, i) => {
    const dx = (i % 2) * 345, dy = Math.floor(i / 2) * 140;
    o.push(copy("art", label, `Option ${"ABCD"[i]}`, { left: 248 + dx, top: 620 + dy, width: 285, size: 33, color: "#272e40", font: "Lato", lineHeight: 1.2 }));
  });
  o.push(copy("headline", pick(inp.content.headline, QUIZ_DEFAULT), "Question", { left: 247, top: 346, width: 612, size: 35, weight: 700, color: "#0d0d0d", font: "Lato", lineHeight: 1.22 }));
  return { objects: o, background: "#272e40" };
}

// ───────────────────────────── 2 · Bonds vs interest rates ─────────────────────────────


const INDIGO = "#3b1f91";
const S = 0.94; // the artwork is drawn on a 1080 square; shrink it a touch so the note clears the brand strip

async function bonds(inp: BuildInput): Promise<BuiltPage> {
  await ensureFont("Poppins", WEIGHTS);
  const X = (x: number) => 540 + (x - 540) * S;
  const Y = (y: number) => y * S;
  const Z = (v: number) => v * S;
  const o: FabricObject[] = [];
  const P = (x: number, y: number): Pt => [X(x), Y(y)];

  // crossing lines + fulcrum
  o.push(line(`M${X(160)} ${Y(470)} L${X(930)} ${Y(727)}`, "#26148c", Z(3.2), "Line: interest rates"));
  o.push(line(`M${X(160)} ${Y(727)} L${X(930)} ${Y(470)}`, "#5cf5c6", Z(3.2), "Line: bond prices"));
  o.push(poly([P(430, 843), P(545, 598), P(545, 843)], "#26008a", "Fulcrum (left)"));
  o.push(poly([P(545, 598), P(657, 843), P(545, 843)], "#441a96", "Fulcrum (right)"));

  // % and ₹ glyphs
  const glyphShadow = () => new Shadow({ color: "rgba(20,10,80,0.35)", offsetX: 4, offsetY: 4, blur: 0 });
  const pct = copy("art", "%", "Percent glyph", { left: X(262), top: Y(528), width: Z(120), size: Z(100), weight: 700, color: "#ffffff", font: "Poppins", align: "center", lineHeight: 1 });
  pct.set({ shadow: glyphShadow() });
  const rup = copy("art", "₹", "Rupee glyph", { left: X(718), top: Y(535), width: Z(100), size: Z(100), weight: 700, color: "#ffffff", font: "Poppins", align: "center", lineHeight: 1 });
  rup.set({ shadow: glyphShadow() });
  o.push(pct, rup);

  // direction arrows
  const arrow = (dir: "up" | "down", cx: number, top: number, w: number, h: number, left: string, right: string, name: string) => {
    const sw = w * 0.44, hb = 0.375;
    const yy = (t: number) => (dir === "up" ? top + t * h : top + h - t * h);
    const outline: Pt[] = [P(cx, yy(0)), P(cx + w / 2, yy(hb)), P(cx + sw / 2, yy(hb)), P(cx + sw / 2, yy(1)), P(cx - sw / 2, yy(1)), P(cx - sw / 2, yy(hb)), P(cx - w / 2, yy(hb))];
    const sh = outline.map(([x, y]) => [x + 5, y + 5] as Pt);
    const l: Pt[] = [P(cx, yy(0)), P(cx - w / 2, yy(hb)), P(cx - sw / 2, yy(hb)), P(cx - sw / 2, yy(1)), P(cx, yy(1))];
    const r: Pt[] = [P(cx, yy(0)), P(cx + w / 2, yy(hb)), P(cx + sw / 2, yy(hb)), P(cx + sw / 2, yy(1)), P(cx, yy(1))];
    const g = new Group([
      new Polygon(sh.map(([x, y]) => ({ x, y })), { fill: "rgba(10,30,70,0.22)", objectCaching: false }),
      new Polygon(l.map(([x, y]) => ({ x, y })), { fill: left, objectCaching: false }),
      new Polygon(r.map(([x, y]) => ({ x, y })), { fill: right, objectCaching: false }),
      new Polygon(outline.map(([x, y]) => ({ x, y })), { fill: "", stroke: "#ffffff", strokeWidth: 2.4, strokeLineJoin: "round", objectCaching: false }),
    ], { subTargetCheck: false });
    return shape(g, name);
  };
  o.push(arrow("up", 72, 380, 60, 82, "#62f7cb", "#3fd9ac", "Arrow: rates rise"));
  o.push(arrow("up", 997, 383, 64, 84, "#4a1e9c", "#26008a", "Arrow: prices rise"));
  o.push(arrow("down", 80, 745, 62, 85, "#26008a", "#4a1e9c", "Arrow: rates fall"));
  o.push(arrow("down", 1002, 745, 62, 85, "#44dcae", "#62f7cb", "Arrow: prices fall"));

  // labels
  const lab = (value: string, name: string, left: number, top: number, align: "left" | "right") =>
    copy("art", value, name, { left: align === "left" ? X(left) : X(left) - Z(420), top: Y(top), width: Z(420), size: Z(32), weight: 700, color: "#ffffff", font: "Poppins", align, lineHeight: 1.45 });
  o.push(lab("As interest\nrates rise", "Label: rates rise", 120, 378, "left"));
  o.push(lab("Bond prices\nrise", "Label: prices rise", 962, 378, "right"));
  o.push(lab("As interest\nrates fall", "Label: rates fall", 120, 742, "left"));
  o.push(lab("Bond prices\nfall", "Label: prices fall", 962, 742, "right"));

  // header icons — a document with a coin, and a rising bar chart
  o.push(scroll(X, Y, Z));
  o.push(chart(X, Y, Z));

  // title (two lines, mixed weight)
  const title = pick(inp.content.headline, BONDS_TITLE);
  const t = copy("headline", title, "Title", { left: X(60), top: Y(206), width: Z(960), size: Z(42), weight: 300, color: "#ffffff", font: "Poppins", align: "center", lineHeight: 1.55 });
  if (title === BONDS_TITLE) t.set({ richPhrases: [{ text: "bonds prices", fontWeight: 700, fill: INDIGO }, { text: "interest rates", fontWeight: 700, fill: INDIGO }] });
  o.push(t);

  // worked example
  const note = pick(inp.content.sub, BONDS_NOTE);
  const n = copy("sub", note, "Worked example", { left: X(47), top: Y(889), width: Z(985), size: Z(21.6), weight: 400, color: "#ffffff", font: "Poppins", lineHeight: 1.58 });
  if (note === BONDS_NOTE) n.set({ richPhrases: [{ text: "Example:", fontWeight: 700 }] });
  o.push(n);

  const bg = new Gradient({ type: "linear", gradientUnits: "pixels", coords: { x1: 0, y1: 0, x2: 0, y2: inp.h }, colorStops: [{ offset: 0, color: "#5df6c7" }, { offset: 1, color: "#353994" }] });
  return { objects: o, background: bg };
}

function scroll(X: (n: number) => number, Y: (n: number) => number, Z: (n: number) => number) {
  const k = 0.2528;
  const sx = (cx: number) => X(152 + (cx - 132) * k);
  const sy = (cy: number) => Y(118 + (cy - 78) * k);
  const sz = (v: number) => Z(v * k);
  const R = (x0: number, y0: number, x1: number, y1: number, fill: string, rx = 0, extra: Record<string, unknown> = {}) =>
    new Rect({ left: sx(x0), top: sy(y0), width: sz(x1 - x0), height: sz(y1 - y0), fill, rx: sz(rx), ry: sz(rx), ...extra });
  const parts: FabricObject[] = [
    R(194, 90, 650, 626, "rgba(10,60,70,0.22)", 20),
    R(180, 78, 600, 545, "#b8fae9", 16),
    R(560, 78, 636, 150, "#8cf0d4", 30),
    R(132, 538, 590, 612, "#8bf3d5", 37),
    R(525, 538, 592, 612, "#b8fae9", 37),
    R(265, 157, 512, 180, "#6a35a8"),
    R(265, 157, 305, 180, "#2c1480"),
  ];
  [222, 264, 305, 346, 387, 428, 468].forEach((y) => parts.push(R(230, y - 3, 545, y + 3, "#ffffff")));
  parts.push(new Circle({ left: sx(387 - 110), top: sy(350 - 110), radius: sz(110), fill: "#6a35a8" }));
  parts.push(new Circle({ left: sx(387 - 92), top: sy(350 - 92), radius: sz(92), fill: "", stroke: "#8a5cc8", strokeWidth: sz(5) }));
  const rup = new Textbox("₹", { left: sx(387 - 60), top: sy(350 - 78), width: sz(120), fontSize: sz(150), fontFamily: "Poppins", fontWeight: 700, fill: "#ffffff", textAlign: "center", lineHeight: 1 });
  parts.push(rup);
  parts.push(R(435, 509, 547, 515, "#2c1480"));
  return shape(new Group(parts, { subTargetCheck: false }), "Icon: bond certificate");
}

function chart(X: (n: number) => number, Y: (n: number) => number, Z: (n: number) => number) {
  const k = 0.2525;
  const sx = (cx: number) => X(798 + (cx - 80) * k);
  const sy = (cy: number) => Y(127 + (cy - 115) * k);
  const sz = (v: number) => Z(v * k);
  const col = "#6a35a8";
  const parts: FabricObject[] = [];
  [[80, 462, 143, 622], [156, 416, 219, 622], [235, 355, 297, 622], [310, 276, 375, 622]].forEach(([x0, y0, x1, y1]) =>
    parts.push(new Rect({ left: sx(x0), top: sy(y0), width: sz(x1 - x0), height: sz(y1 - y0), fill: col })));
  parts.push(new Rect({ left: sx(388), top: sy(205), width: sz(64), height: sz(417), fill: col }));
  parts.push(new Polygon([{ x: sx(355), y: sy(208) }, { x: sx(419), y: sy(115) }, { x: sx(484), y: sy(208) }], { fill: col, objectCaching: false }));
  parts.push(new Circle({ left: sx(260 - 88), top: sy(182 - 88), radius: sz(88), fill: "#ffffff" }));
  parts.push(new Textbox("%", { left: sx(260 - 70), top: sy(182 - 62), width: sz(140), fontSize: sz(130), fontFamily: "Poppins", fontWeight: 600, fill: "#5cd9b8", textAlign: "center", lineHeight: 1 }));
  return shape(new Group(parts, { subTargetCheck: false }), "Icon: rising rates chart");
}

// ───────────────────────────── 3 · Nine habits (Navratri) ─────────────────────────────


const TAU = Math.PI * 2;
const NETWORK = (() => {
  let d = "M12 9.6a2.4 2.4 0 1 0 0 4.8a2.4 2.4 0 1 0 0-4.8";
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * TAU - Math.PI / 2, c = Math.cos(a), s = Math.sin(a);
    d += `M${(12 + c * 4.6).toFixed(2)} ${(12 + s * 4.6).toFixed(2)}L${(12 + c * 8.2).toFixed(2)} ${(12 + s * 8.2).toFixed(2)}`;
    const nx = 12 + c * 9.6, ny = 12 + s * 9.6;
    d += `M${(nx + 1.5).toFixed(2)} ${ny.toFixed(2)}a1.5 1.5 0 1 0 -3 0a1.5 1.5 0 1 0 3 0`;
  }
  return d;
})();

const HABIT_ICONS: Record<string, string> = {
  network: NETWORK,
  hourglass: "M6 3h12M6 21h12M7 3v3.5c0 2 3 3.5 5 5.5c2-2 5-3.5 5-5.5V3M7 21v-3.5c0-2 3-3.5 5-5.5c2 2 5 3.5 5 5.5V21",
  bars: "M4 20v-4M9 20v-8M14 20v-12M19 20V4",
  shield: "M12 3l8 3v6c0 5-3.5 8-8 9c-4.5-1-8-4-8-9V6z",
  scales: "M12 4v16M7 20h10M4 8h16M4 8l-2.5 7M4 8l2.5 7M1.5 15a2.5 2.5 0 0 0 5 0M20 8l-2.5 7M20 8l2.5 7M17.5 15a2.5 2.5 0 0 0 5 0",
  book: "M12 6c-2-1.5-5-2-8-2v14c3 0 6 .5 8 2c2-1.5 5-2 8-2V4c-3 0-6 .5-8 2zM12 6v14",
  leaf: "M5 19c0-8 4-13 13-14c0 8-4 13-13 14zM5 19l7-7",
  flame: "M12 3c1 4 5 6 5 11a5 5 0 0 1-10 0c0-2 1-3.5 2-4.5c0 1.5.5 2.5 1.5 3C10 9 11 6 12 3z",
  target: "M12 3a9 9 0 1 0 9 9M12 7.5a4.5 4.5 0 1 0 4.5 4.5M12 12l8-8M17 4h3v3",
};

interface Petal { name: string; label: string; ix: number; iy: number; lx: number; ly: number; icon: string; light: boolean }
const PETALS: Petal[] = [
  { name: "Patience", label: "Patience", ix: 653, iy: 486, lx: 652, ly: 527, icon: "hourglass", light: false },
  { name: "Diversification", label: "Diversification", ix: 431, iy: 564, lx: 435, ly: 606, icon: "network", light: true },
  { name: "Discipline", label: "Discipline", ix: 868, iy: 568, lx: 869, ly: 611, icon: "bars", light: false },
  { name: "Emotional Balance", label: "Emotional\nBalance", ix: 333, iy: 752, lx: 334, ly: 809, icon: "scales", light: false },
  { name: "Risk Awareness", label: "Risk\nAwareness", ix: 976, iy: 748, lx: 975, ly: 804, icon: "shield", light: false },
  { name: "Financial Literacy", label: "Financial\nLiteracy", ix: 385, iy: 968, lx: 385, ly: 1022, icon: "book", light: false },
  { name: "Compounding", label: "Compounding", ix: 985, iy: 1002, lx: 986, ly: 1040, icon: "leaf", light: false },
  { name: "Courage", label: "Courage", ix: 540, iy: 1176, lx: 540, ly: 1216, icon: "flame", light: true },
  { name: "Goal Orientation", label: "Goal\nOrientation", ix: 766, iy: 1130, lx: 767, ly: 1188, icon: "target", light: true },
];

async function habits(inp: BuildInput): Promise<BuiltPage> {
  await ensureFont("Poppins", WEIGHTS);
  await ensureFont("Lato", [400]);
  const o: FabricObject[] = [];
  o.push(await photo("/templates/habits-art.jpg", inp.w, inp.h, "Background art"));

  // the big "9" + the two mint bars it sits on
  o.push(poly([[206, 271], [228, 276], [250, 296], [259, 313], [266, 337], [617, 337], [634, 272]], "#5cfac7", "Bar: essential habits"));
  o.push(poly([[264, 350], [551, 350], [535, 416], [238, 416], [257, 383]], "#5cfac7", "Bar: of investing"));
  o.push(shape(new Path(NINE_GLYPH, { fill: "#ffffff", fillRule: "evenodd" }), "Number 9"));
  const chip = (value: string, top: number, name: string) =>
    copy("art", value, name, { left: 277, top, width: 360, size: 40, weight: 700, color: "#1d0a7a", font: "Poppins", lineHeight: 1.2 });
  o.push(chip("essential habits", 284, "Chip: essential habits"));
  o.push(chip("of investing", 356, "Chip: of investing"));
  o.push(copy("headline", pick(inp.content.headline, HABITS_HEAD), "Headline", { left: 116, top: 118, width: 570, size: 47, weight: 600, color: "#ffffff", font: "Poppins", lineHeight: 1.32 }));

  // nine petals: icon + label each
  for (const p of PETALS) {
    const color = p.light ? "#ffffff" : "#1d0076";
    o.push(icon(HABIT_ICONS[p.icon], p.ix, p.iy, 50, color, `Icon: ${p.name}`, 1.7));
    const lines = p.label.split("\n").length;
    const lh = 18.5 * 1.35;
    o.push(copy("art", p.label, `Label: ${p.name}`, { left: p.lx - 90, top: p.ly - (lines * lh) / 2, width: 180, size: 18.5, weight: 600, color, font: "Poppins", align: "center", lineHeight: 1.35 }));
  }

  // SEBI line, sitting on the edge the brand strip leaves free
  const stripH = Math.max(Math.round(Math.min(inp.w, inp.h) * 0.075), 56);
  const atTop = (inp.applyKit ? inp.kit.detailsPosition : "bottom") === "top";
  const barBottom = atTop ? inp.h : inp.h - stripH;
  const barH = 30;
  o.push(shape(new Rect({ left: 0, top: barBottom - barH, width: inp.w, height: barH, fill: "#ffffff" }), "Disclaimer bar"));
  o.push(copy("sub", pick(inp.content.sub, HABITS_NOTE), "Disclaimer", { left: 12, top: barBottom - barH + 5, width: inp.w - 24, size: 20, weight: 400, color: "#1a1a1a", font: "Lato", align: "center", lineHeight: 1.1 }));
  return { objects: o, background: "#2a1f8a" };
}

// ───────────────────────────── 4 · Dussehra ─────────────────────────────


async function dussehra(inp: BuildInput): Promise<BuiltPage> {
  await ensureFont("Bree Serif", [400]);
  await ensureFont("Lato", [400]);
  const o: FabricObject[] = [];
  o.push(await photo("/templates/dussehra-art.jpg", inp.w, inp.h, "Background art"));
  o.push(copy("headline", pick(inp.content.headline, DUSSEHRA_HEAD), "Headline", { left: 147, top: 140, width: 800, size: 50, weight: 400, color: "#5cf5c6", font: "Bree Serif", align: "right", lineHeight: 1.2 }));
  const rule = rect("art", { left: 598, top: 295, width: 350, height: 2.5, fill: new Gradient({ type: "linear", gradientUnits: "pixels", coords: { x1: 0, y1: 0, x2: 350, y2: 0 }, colorStops: [{ offset: 0, color: "rgba(92,245,198,0)" }, { offset: 1, color: "rgba(92,245,198,1)" }] }) });
  rule.set({ layerName: "Divider" });
  o.push(rule);
  o.push(copy("art", "This Dussehra,", "Greeting", { left: 547, top: 336, width: 400, size: 37, weight: 400, color: "#ffffff", font: "Lato", align: "right", lineHeight: 1.2 }));
  o.push(copy("sub", pick(inp.content.sub, DUSSEHRA_SUB), "Message", { left: 487, top: 394, width: 460, size: 32, weight: 400, color: "#ffffff", font: "Lato", align: "right", lineHeight: 1.31 }));
  return { objects: o, background: "#2b1a7a" };
}

// ───────────────────────────── entry ─────────────────────────────

export async function buildArt(inp: BuildInput): Promise<BuiltPage> {
  switch (inp.layout) {
    case "art-quiz": return quiz(inp);
    case "art-bonds": return bonds(inp);
    case "art-habits": return habits(inp);
    default: return dussehra(inp);
  }
}
