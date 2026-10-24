# TheFinPedia Cobranding Studio

Browser-based image/video cobranding editor. Next.js 16 (App Router) · React 19 · TypeScript · Fabric.js 7 · Tailwind 4 · shadcn-style UI · Zustand · Supabase · jsPDF/jszip export.

## Run

```bash
npm install
cp .env.example .env.local   # fill SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY
npm run dev
```

Without Supabase env vars the app still works — kits, designs and templates are saved to `localStorage` (the header badge shows "Local storage").

## Database

Run `supabase/migrations/0001_cobranding_studio.sql` in the Supabase SQL editor. It creates `cobrand_brand_kits`, `cobrand_designs`, `cobrand_templates` with RLS enabled and **no policies** — all access goes through server-only API routes (`src/app/api/*`) using the service-role key. Never expose that key to the browser.

Owner identity is currently an anonymous httpOnly cookie (`cobrand_owner`). Replace `src/lib/server/owner.ts` with real auth before multi-user use.

## Scope notes

- Video: brand the first/last frame + optional header/footer overlay bars; export is branded frame images (no video re-encoding).
- Background removal is a white-pixel remover, not ML segmentation.
- Raster logos are vectorised with imagetracerjs; review/fallback to original is offered.
- SEBI check is a whole-word term list in `src/lib/compliance.ts` — have compliance review the list.
