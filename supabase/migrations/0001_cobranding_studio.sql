-- TheFinPedia Cobranding Studio — schema
-- Run manually in the Supabase SQL editor (project occiztgbyxtslbuhtavb).
-- Creates 3 NEW tables only; nothing existing is touched.
--
-- Access model: the Next.js API routes use the service-role key (server-side only), which bypasses RLS.
-- RLS is ENABLED with NO policies on purpose, so the public anon key can read/write nothing here.
-- `owner_id` is an opaque per-user key. Today the API sets it from an anonymous cookie; when you wire the
-- studio into your real login, change `getOwner()` in src/lib/server/owner.ts to return your user id.

create extension if not exists pgcrypto;

create or replace function public.cobrand_set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- 1) Brand kits (My Brand, Client A, Client B, …) — one row per owner + kit_key
create table if not exists public.cobrand_brand_kits (
  id          uuid primary key default gen_random_uuid(),
  owner_id    text not null,
  kit_key     text not null,
  label       text not null,
  data        jsonb not null,            -- full BrandKit: colours, fonts, details, logoSvg, logoOriginal …
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (owner_id, kit_key)
);

-- 2) Designs (single / carousel / video) — pages hold Fabric canvas JSON
create table if not exists public.cobrand_designs (
  id            uuid primary key default gen_random_uuid(),
  owner_id      text not null,
  title         text not null default 'Untitled post',
  template_id   text,
  content_type  text not null default 'single' check (content_type in ('single','carousel','video')),
  size_id       text not null default 'post',
  kit_key       text,
  pages         jsonb not null default '[]'::jsonb,
  overlay       jsonb not null default '{"header":false,"footer":false}'::jsonb,
  status        text not null default 'draft' check (status in ('draft','library')),
  thumbnail     text,
  is_shared     boolean not null default false,
  share_token   text unique,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists cobrand_designs_owner_updated_idx on public.cobrand_designs (owner_id, updated_at desc);

-- 3) Custom templates ("Save this design as a template")
create table if not exists public.cobrand_templates (
  id          uuid primary key default gen_random_uuid(),
  owner_id    text not null,
  name        text not null,
  category    text not null default 'Post',
  topic       text not null default 'Mutual Funds',
  layout      text not null default 'hero',
  palette     jsonb not null default '["#2B2BB5","#0D0D5C"]'::jsonb,
  doc         jsonb not null,            -- the DesignDoc snapshot to start from
  thumbnail   text,
  created_at  timestamptz not null default now()
);
create index if not exists cobrand_templates_owner_idx on public.cobrand_templates (owner_id, created_at desc);

drop trigger if exists cobrand_brand_kits_updated on public.cobrand_brand_kits;
create trigger cobrand_brand_kits_updated before update on public.cobrand_brand_kits
  for each row execute function public.cobrand_set_updated_at();
drop trigger if exists cobrand_designs_updated on public.cobrand_designs;
create trigger cobrand_designs_updated before update on public.cobrand_designs
  for each row execute function public.cobrand_set_updated_at();

alter table public.cobrand_brand_kits enable row level security;
alter table public.cobrand_designs    enable row level security;
alter table public.cobrand_templates  enable row level security;
-- (intentionally no policies — service role only)
