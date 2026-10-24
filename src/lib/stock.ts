/** Demo stock grid (FR-19). Generated locally so it works offline; swap for a real stock API later. */
const scenes: [string, string, string][] = [
  ["#2B2BB5", "#9090EC", "rise"], ["#0F766E", "#A7F3D0", "wave"], ["#B45309", "#FDE68A", "sun"], ["#0369A1", "#BAE6FD", "city"],
  ["#7C3AED", "#DDD6FE", "rise"], ["#0D1B3E", "#546490", "city"], ["#E11D48", "#FECDD3", "sun"], ["#065F46", "#6EE7B7", "wave"],
];
function art(kind: string, a: string, b: string) {
  switch (kind) {
    case "rise": return `<path d="M0 520 L160 400 L300 450 L470 280 L640 330 L800 160 L800 600 L0 600Z" fill="${b}" opacity=".55"/><path d="M0 560 L200 470 L360 520 L560 380 L800 430 L800 600 L0 600Z" fill="#fff" opacity=".18"/>`;
    case "wave": return `<path d="M0 380 Q200 300 400 380 T800 380 V600 H0Z" fill="${b}" opacity=".5"/><path d="M0 450 Q200 380 400 450 T800 450 V600 H0Z" fill="#fff" opacity=".2"/>`;
    case "sun": return `<circle cx="560" cy="220" r="120" fill="${b}" opacity=".7"/><rect y="440" width="800" height="160" fill="#000" opacity=".18"/>`;
    default: return [60, 170, 280, 410, 540, 650].map((x, i) => `<rect x="${x}" y="${330 - ((i * 53) % 150)}" width="80" height="${270 + ((i * 53) % 150)}" fill="${b}" opacity="${0.35 + (i % 3) * 0.15}"/>`).join("");
  }
}
export const STOCK_PHOTOS: string[] = scenes.map(([a, b, k], i) => {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600" viewBox="0 0 800 600"><defs><linearGradient id="g${i}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient></defs><rect width="800" height="600" fill="url(#g${i})"/>${art(k, a, b)}</svg>`;
  return "data:image/svg+xml;utf8," + encodeURIComponent(svg);
});
