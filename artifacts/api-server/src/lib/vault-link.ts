import { lookup } from "node:dns/promises";
import { request } from "node:https";
import { BlockList, isIP } from "node:net";
import { VaultError, fail } from "./vault-errors";

export const LINK_MAX_BYTES = 15 * 1024 * 1024;

// Applies to suggested AND edited names. Never persist URL syntax, encoded
// payloads, directory paths, or invisible controls in metadata/activity.
export function importFileName(raw: string): string {
  if (!raw.trim() || raw.length > 200 || raw.trim().startsWith(".") ||
      /[\\/:?&#=%<>|"*\p{Cc}\p{Cf}]/u.test(raw))
    fail(400, "Nama file tidak valid. Gunakan hanya nama file tanpa tautan atau direktori.");
  const name = raw.trim();
  if (!/\.(pdf|docx|xlsx|txt|md|csv|jpg|jpeg|png)$/i.test(name))
    fail(400, "Gunakan nama file dengan ekstensi PDF, DOCX, XLSX, TXT, MD, CSV, JPG, atau PNG.");
  return name;
}

const blocked = new BlockList();
for (const [ip, prefix] of [
  ["0.0.0.0", 8], ["10.0.0.0", 8], ["100.64.0.0", 10], ["127.0.0.0", 8],
  ["169.254.0.0", 16], ["172.16.0.0", 12], ["192.0.0.0", 24],
  ["168.63.129.16", 32],
  ["192.0.2.0", 24], ["192.88.99.0", 24], ["192.168.0.0", 16],
  ["198.18.0.0", 15], ["198.51.100.0", 24], ["203.0.113.0", 24],
  ["224.0.0.0", 4], ["240.0.0.0", 4],
] as const) blocked.addSubnet(ip, prefix, "ipv4");
// Only global-unicast IPv6, excluding transition, documentation and special-use.
const globalV6 = new BlockList();
globalV6.addSubnet("2000::", 3, "ipv6");
for (const [ip, prefix] of [["2001::", 23], ["2001:db8::", 32], ["2002::", 16], ["3fff::", 20]] as const)
  blocked.addSubnet(ip, prefix, "ipv6");

export function publicAddress(ip: string) {
  const family = isIP(ip);
  return family === 4 ? !blocked.check(ip, "ipv4") :
    family === 6 && globalV6.check(ip, "ipv6") && !blocked.check(ip, "ipv6");
}
export function linkUrl(raw: string) {
  let url: URL;
  try { url = new URL(raw); } catch { fail(400, "Tautan tidak valid. Gunakan URL HTTPS file publik."); }
  if (url.protocol !== "https:" || url.username || url.password || (url.port && url.port !== "443"))
    fail(400, "Gunakan tautan HTTPS tanpa kredensial dan port khusus.");
  const host = url.hostname.replace(/^\[|\]$/g, "").toLowerCase();
  if (!host || host.endsWith(".") || host === "localhost" || host.endsWith(".localhost") ||
      host.endsWith(".local") || host.endsWith(".internal") || (isIP(host) && !publicAddress(host)))
    fail(400, "Tautan jaringan privat, lokal, atau layanan metadata tidak diizinkan.");
  url.hash = "";
  return url;
}

// Inject only at the network boundary for deterministic, offline security tests.
type Network = { lookup: typeof lookup; request: typeof request };
export async function fetchPublicFile(raw: string, network: Network = { lookup, request }, timeoutMs = 20_000): Promise<Buffer> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const { signal } = controller;
  const aborted = new Promise<never>((_, reject) => {
    signal.addEventListener("abort", () => reject(new VaultError(504, "Tải file quá thời gian.")), { once: true });
  });
  // Errors from DNS/TLS/HTTP must never escape with a URL or token.
  const download = async () => {
    let url = linkUrl(raw);
    for (let redirects = 0; redirects <= 3; redirects++) {
      const host = url.hostname.replace(/^\[|\]$/g, "");
      const addresses = isIP(host) ? [{ address: host, family: isIP(host) }] :
        await network.lookup(host, { all: true, verbatim: true });
      if (!addresses.length || addresses.some(a => !publicAddress(a.address)))
        fail(400, "Tautan jaringan privat, lokal, atau layanan metadata tidak diizinkan.");
      if (signal.aborted) fail(504, "Pengambilan file melewati batas waktu. Coba lagi.");
      const pin = addresses[0];
      const result = await new Promise<Buffer | URL>((resolve, reject) => {
        const req = network.request(url, {
          agent: false, signal, family: pin.family,
          // Keep original TLS servername/Host, but connect only to the checked IP.
          lookup: (_hostname, _options, cb) => cb(null, pin.address, pin.family),
          headers: { Accept: "*/*", "Accept-Encoding": "identity" },
        }, res => {
          const status = res.statusCode ?? 0;
          if ([301, 302, 303, 307, 308].includes(status)) {
            res.destroy();
            if (!res.headers.location || redirects === 3) {
              reject(new VaultError(400, "Tautan terlalu banyak dialihkan atau tidak valid.")); return;
            }
            try { resolve(linkUrl(new URL(res.headers.location, url).href)); } catch (e) { reject(e); }
            return;
          }
          if (status !== 200) {
            res.destroy();
            reject(new VaultError(status === 401 || status === 403 ? 400 : 502,
              status === 401 || status === 403 ? "Tautan privat atau memerlukan login. Gunakan tautan unduh publik langsung." : "File dari tautan tidak dapat diambil.")); return;
          }
          const mime = String(res.headers["content-type"] ?? "").toLowerCase();
          if (mime.includes("html") || (res.headers["content-encoding"] && res.headers["content-encoding"] !== "identity")) {
            res.destroy(); reject(new VaultError(400, "Tautan membuka halaman web/login, bukan file publik langsung.")); return;
          }
          if (Number(res.headers["content-length"]) > LINK_MAX_BYTES) {
            res.destroy(); reject(new VaultError(413, "File melebihi batas 15 MiB.")); return;
          }
          let size = 0;
          const chunks: Buffer[] = [];
          res.on("data", (chunk: Buffer) => {
            size += chunk.length;
            if (size > LINK_MAX_BYTES) {
              res.destroy(); reject(new VaultError(413, "File melebihi batas 15 MiB.")); return;
            }
            chunks.push(chunk);
          });
          res.on("error", reject);
          res.on("aborted", () => reject(new VaultError(502, "Pengunduhan file terputus.")));
          res.on("end", () => {
            const bytes = Buffer.concat(chunks);
            const head = bytes.subarray(0, 1024).toString("utf8").replace(/^\uFEFF/, "").trimStart();
            if (/(?:<!doctype\s+html|<html\b|<head\b|<body\b|<form\b)/i.test(head)) {
              reject(new VaultError(400, "Tautan membuka halaman web/login, bukan file publik langsung.")); return;
            }
            resolve(bytes);
          });
        });
        req.on("error", reject);
        req.end();
      });
      if (Buffer.isBuffer(result)) return result;
      url = result;
    }
    return fail(400, "Tautan terlalu banyak dialihkan.");
  };
  try { return await Promise.race([download(), aborted]); }
  catch (e) {
    if (signal.aborted) fail(504, "Pengambilan file melewati batas waktu. Coba lagi.");
    if (e instanceof VaultError) throw e;
    fail(502, "File dari tautan tidak dapat diambil. Pastikan file publik dan dapat diunduh langsung.");
  } finally { clearTimeout(timeout); }
}
