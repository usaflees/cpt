// Local Cloudflare Pages emulator for QA: applies _headers (incl. CSP), _redirects, directory indexes and 404.html.
// Usage: node tests/serve.mjs [root] [port]   (defaults: repo root, 8788)
import http from "node:http";
import { readFileSync, existsSync, statSync } from "node:fs";
import { join, extname } from "node:path";

const ROOT = process.argv[2] || new URL("..", import.meta.url).pathname;
const PORT = +process.argv[3] || 8788;
const TYPES = { ".html": "text/html; charset=utf-8", ".css": "text/css", ".js": "application/javascript", ".json": "application/json", ".png": "image/png", ".svg": "image/svg+xml", ".ico": "image/x-icon", ".xml": "application/xml", ".txt": "text/plain", ".webmanifest": "application/manifest+json" };

function parseRules(file) {
  if (!existsSync(file)) return [];
  const rules = [];
  let cur = null;
  for (const line of readFileSync(file, "utf8").split("\n")) {
    if (!line.trim() || line.trim().startsWith("#")) continue;
    if (!/^\s/.test(line)) { cur = { pattern: line.trim(), headers: [] }; rules.push(cur); }
    else if (cur) { const i = line.indexOf(":"); cur.headers.push([line.slice(0, i).trim(), line.slice(i + 1).trim()]); }
  }
  return rules;
}
const toRe = p => new RegExp("^" + p.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*") + "$");
const headerRules = parseRules(join(ROOT, "_headers")).map(r => ({ ...r, re: toRe(r.pattern) }));
const redirects = existsSync(join(ROOT, "_redirects")) ? readFileSync(join(ROOT, "_redirects"), "utf8").split("\n").filter(l => l.trim() && !l.startsWith("#")).map(l => l.trim().split(/\s+/)) : [];

http.createServer((req, res) => {
  const path = decodeURIComponent(new URL(req.url, "http://x").pathname);
  const r = redirects.find(([from]) => from === path);
  if (r) { res.writeHead(+r[2] || 302, { Location: r[1] }); return res.end(); }
  let file = join(ROOT, path);
  let status = 200;
  if (existsSync(file) && statSync(file).isDirectory()) {
    if (!path.endsWith("/")) { res.writeHead(308, { Location: path + "/" }); return res.end(); }
    file = join(file, "index.html");
  }
  if (!existsSync(file) || path.split("/").some(seg => seg.startsWith("_"))) { file = join(ROOT, "404.html"); status = 404; }
  const headers = { "Content-Type": TYPES[extname(file)] || "application/octet-stream", "Cache-Control": "public, max-age=0, must-revalidate" };
  for (const rule of headerRules) if (rule.re.test(path)) for (const [k, v] of rule.headers) headers[k] = v;
  res.writeHead(status, headers);
  res.end(readFileSync(file));
}).listen(PORT, () => console.log("pages emulator on", PORT));
