import dns from "node:dns/promises";
import net from "node:net";

function isPrivateIp(ip: string): boolean {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split(".").map(Number);
    return (
      a === 0 || a === 10 || a === 127 || a >= 224 ||
      (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127)
    );
  }
  if (net.isIPv6(ip)) {
    const l = ip.toLowerCase();
    const mapped = l.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (mapped) return isPrivateIp(mapped[1]);
    return l === "::1" || l === "::" || l.startsWith("fc") || l.startsWith("fd") || l.startsWith("fe8") || l.startsWith("fe9") || l.startsWith("fea") || l.startsWith("feb");
  }
  return true;
}

/** Throws unless the URL is plain http(s) on 80/443 and resolves only to public addresses. */
export async function assertPublicUrl(raw: string): Promise<URL> {
  const u = new URL(raw);
  if (u.protocol !== "http:" && u.protocol !== "https:") throw new Error("Only http(s) URLs are allowed");
  if (u.username || u.password) throw new Error("URLs with credentials are not allowed");
  if (u.port && u.port !== "80" && u.port !== "443") throw new Error("Unsupported port");
  const host = u.hostname.replace(/^\[|\]$/g, "");
  if (host === "localhost" || host.endsWith(".local") || host.endsWith(".internal")) throw new Error("That host is not allowed");
  const addrs = net.isIP(host) ? [{ address: host }] : await dns.lookup(host, { all: true });
  if (!addrs.length || addrs.some((a) => isPrivateIp(a.address))) throw new Error("That host is not allowed");
  return u;
}

/**
 * Fetch with SSRF protection: every hop (including redirects) is re-validated, with a timeout and byte cap.
 * Note: DNS is resolved once for validation and again by fetch; for stricter pinning put this behind an egress proxy.
 */
export async function safeFetch(raw: string, opts: { maxBytes: number; accept?: string; timeoutMs?: number }) {
  let url = raw;
  for (let hop = 0; hop < 5; hop++) {
    const u = await assertPublicUrl(url);
    const res = await fetch(u, {
      redirect: "manual",
      signal: AbortSignal.timeout(opts.timeoutMs ?? 8000),
      headers: { "user-agent": "TheFinPediaCobrandBot/1.0 (+brand setup)", accept: opts.accept ?? "*/*" },
    });
    if (res.status >= 300 && res.status < 400 && res.headers.get("location")) {
      url = new URL(res.headers.get("location")!, u).toString();
      continue;
    }
    if (!res.ok || !res.body) throw new Error(`Request failed (${res.status})`);
    const reader = res.body.getReader();
    const chunks: Uint8Array[] = [];
    let total = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.length;
      if (total > opts.maxBytes) { await reader.cancel(); throw new Error("Response too large"); }
      chunks.push(value);
    }
    return { buffer: Buffer.concat(chunks), contentType: res.headers.get("content-type") ?? "", url: u.toString() };
  }
  throw new Error("Too many redirects");
}
