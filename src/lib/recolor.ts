/**
 * Brand-kit palette remap. Takes every saturated colour used in a design, groups them by hue, and moves the
 * biggest groups onto the kit's primary then secondary colour, keeping each shade's relative lightness so
 * highlights/shadows survive. Whites, blacks and greys are left alone.
 */
export interface Rgba { r: number; g: number; b: number; a: number }

export function parseCss(c: unknown): Rgba | null {
  if (typeof c !== "string") return null;
  const s = c.trim().toLowerCase();
  let m = s.match(/^#([0-9a-f]{3})$/);
  if (m) return { r: parseInt(m[1][0] + m[1][0], 16), g: parseInt(m[1][1] + m[1][1], 16), b: parseInt(m[1][2] + m[1][2], 16), a: 1 };
  m = s.match(/^#([0-9a-f]{6})([0-9a-f]{2})?$/);
  if (m) return { r: parseInt(m[1].slice(0, 2), 16), g: parseInt(m[1].slice(2, 4), 16), b: parseInt(m[1].slice(4, 6), 16), a: m[2] ? parseInt(m[2], 16) / 255 : 1 };
  m = s.match(/^rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:[,\s/]+([\d.]+%?))?\s*\)$/);
  if (m) { const a = m[4] === undefined ? 1 : m[4].endsWith("%") ? parseFloat(m[4]) / 100 : parseFloat(m[4]); return { r: +m[1], g: +m[2], b: +m[3], a }; }
  return null;
}

export function toHsl({ r, g, b }: Rgba): [number, number, number] {
  r /= 255; g /= 255; b /= 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, d = mx - mn;
  if (d === 0) return [0, 0, l];
  const s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
  const h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h * 60, s, l];
}

export function fromHsl(h: number, s: number, l: number): [number, number, number] {
  h = ((h % 360) + 360) % 360;
  const k = (n: number) => (n + h / 30) % 12, a = s * Math.min(l, 1 - l);
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return [Math.round(f(0) * 255), Math.round(f(8) * 255), Math.round(f(4) * 255)];
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const isNeutral = (hsl: [number, number, number]) => hsl[1] < 0.2 || hsl[2] > 0.93 || hsl[2] < 0.08;
const bucketOf = (h: number) => Math.round(h / 40) % 9;

export interface ColorUse { css: string; weight: number }

/** Returns a function mapping any css colour to its branded equivalent (identity for neutrals / unseen colours). */
export function buildRemap(uses: ColorUse[], primary: string, secondary: string): (css: string) => string {
  const targets = [parseCss(primary), parseCss(secondary)].map((c) => (c ? toHsl(c) : null));
  if (!targets[0]) return (c) => c;
  const t0 = targets[0], t1 = targets[1] ?? targets[0];
  const buckets = new Map<number, { w: number; lw: number }>();
  for (const u of uses) {
    const rgba = parseCss(u.css);
    if (!rgba || rgba.a < 0.05) continue;
    const hsl = toHsl(rgba);
    if (isNeutral(hsl)) continue;
    const k = bucketOf(hsl[0]);
    const b = buckets.get(k) ?? { w: 0, lw: 0 };
    b.w += u.weight; b.lw += u.weight * hsl[2];
    buckets.set(k, b);
  }
  const ranked = [...buckets.entries()].sort((a, b) => b[1].w - a[1].w);
  const assign = new Map<number, { t: [number, number, number]; meanL: number }>();
  ranked.forEach(([k, b], i) => assign.set(k, { t: i % 2 === 0 ? t0 : t1, meanL: b.lw / b.w }));
  return (css) => {
    const rgba = parseCss(css);
    if (!rgba) return css;
    const hsl = toHsl(rgba);
    if (isNeutral(hsl)) return css;
    const a = assign.get(bucketOf(hsl[0]));
    if (!a) return css;
    const l = clamp(hsl[2] + (a.t[2] - a.meanL) * 0.7, 0.06, 0.96);
    const s = clamp(a.t[1] * (0.55 + 0.45 * Math.min(1, hsl[1] / 0.8)), 0.1, 1);
    const [r, g, b] = fromHsl(a.t[0], s, l);
    return rgba.a < 1 ? `rgba(${r},${g},${b},${+rgba.a.toFixed(3)})` : `#${[r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
  };
}
