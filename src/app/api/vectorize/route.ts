import { NextResponse } from "next/server";
import { ColorMode, Hierarchical, PathSimplifyMode, vectorize } from "@neplex/vectorizer";

export const runtime = "nodejs";
export const maxDuration = 30;

/**
 * FR-S03 server-side tracer (vtracer). Better curve fitting than the in-browser fallback.
 * Input: { dataUrl } PNG/JPEG/WebP only. Output: { svg }. The client still runs sanitize + plate removal + user review.
 */
export async function POST(req: Request) {
  try {
    const { dataUrl } = (await req.json()) as { dataUrl?: string };
    const m = /^data:image\/(png|jpeg|jpg|webp);base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl ?? "");
    if (!m) return NextResponse.json({ error: "PNG, JPG or WebP data URL required" }, { status: 400 });
    const buf = Buffer.from(m[2], "base64");
    if (buf.length > 6_000_000) return NextResponse.json({ error: "Image too large" }, { status: 413 });
    const svg = await vectorize(buf, {
      colorMode: ColorMode.Color,
      hierarchical: Hierarchical.Stacked,
      filterSpeckle: 4,
      colorPrecision: 6,
      layerDifference: 16,
      mode: PathSimplifyMode.Spline,
      cornerThreshold: 60,
      lengthThreshold: 4,
      maxIterations: 10,
      spliceThreshold: 45,
      pathPrecision: 2,
    });
    return NextResponse.json({ svg });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Trace failed" }, { status: 500 });
  }
}
