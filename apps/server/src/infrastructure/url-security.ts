import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { ClipError } from "../domain/errors.js";

export type Resolver = (hostname: string) => Promise<{ address: string; family: number }[]>;

export function isPublicIp(address: string): boolean {
  const ip = address.toLowerCase();
  if (isIP(ip) === 4) {
    const [a, b, c] = ip.split(".").map(Number) as [number, number, number, number];
    return !(a === 0 || a === 10 || a === 127 || a >= 224
      || (a === 100 && b >= 64 && b <= 127)
      || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31)
      || (a === 192 && (b === 168 || b === 0 || (b === 88 && c === 99)))
      || (a === 198 && (b === 18 || b === 19 || (b === 51 && c === 100)))
      || (a === 203 && b === 0 && c === 113));
  }
  if (isIP(ip) !== 6) return false;
  // Only ordinary global unicast; exclude mapped/compatible, NAT64, local,
  // multicast, documentation, transition and special-purpose IPv6 ranges.
  const first = Number.parseInt(ip.split(":")[0]!, 16);
  const second = Number.parseInt(ip.split(":")[1] || "0", 16);
  return first >= 0x2000 && first <= 0x3fff
    && !(first === 0x2001 && (second < 0x200 || second === 0xdb8))
    && !/^2002:/i.test(ip) && !/^3fff:/i.test(ip);
}

export async function validatePublicUrl(
  input: string,
  resolver: Resolver = hostname => lookup(hostname, { all: true, verbatim: true }),
): Promise<{ url: URL; address: string; family: number }> {
  let url: URL;
  try { url = new URL(input); }
  catch { throw blocked(); }
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) throw blocked();
  const host = url.hostname.replace(/^\[|\]$/g, "").replace(/\.$/, "").toLowerCase();
  if (host === "localhost" || host.endsWith(".localhost") || !host.includes(".") && !isIP(host)) throw blocked();
  let addresses;
  try { addresses = isIP(host) ? [{ address: host, family: isIP(host) }] : await resolver(host); }
  catch { throw blocked(); }
  if (!addresses.length || addresses.some(value => !isPublicIp(value.address))) throw blocked();
  // Prefer validated IPv4 on dual-stack hosts: many NAS networks advertise
  // IPv6 DNS answers without a working IPv6 route. IPv6-only hosts still work.
  return { url, ...(addresses.find(value => value.family === 4) ?? addresses[0]!) };
}

function blocked(): ClipError {
  return new ClipError("UNSAFE_URL", "链接必须指向公网 HTTP/HTTPS 地址", 400);
}
