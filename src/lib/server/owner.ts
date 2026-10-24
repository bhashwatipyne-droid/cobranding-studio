import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { db } from "./supabase";

/**
 * Who owns the data. Today: an anonymous, httpOnly per-browser id.
 * TODO(auth): replace with your real session user id (e.g. from your PMT / Supabase auth session)
 * so kits and designs follow the advisor across devices.
 */
export async function getOwner(): Promise<string> {
  const jar = await cookies();
  let id = jar.get("cobrand_owner")?.value;
  if (!id) {
    id = crypto.randomUUID();
    jar.set("cobrand_owner", id, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 365 });
  }
  return id;
}

export const notConfigured = () =>
  NextResponse.json({ error: "not_configured", message: "SUPABASE_SERVICE_ROLE_KEY is not set" }, { status: 503 });

export function requireDb() {
  const c = db();
  return c ? { c } : { response: notConfigured() };
}
