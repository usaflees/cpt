// Internal link, #anchor and duplicate-id check over every HTML file. Usage: node tests/links.mjs
import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
const ROOT = new URL("..", import.meta.url).pathname;
const files = [];
const walk = d => readdirSync(ROOT + d).forEach(f => { const p = d + f; if (["node_modules", ".git", "scripts", "docs", "dist"].includes(f)) return; if (statSync(ROOT + p).isDirectory()) walk(p + "/"); else if (f.endsWith(".html")) files.push(p); });
walk("");
const redirects = readFileSync(ROOT + "_redirects", "utf8").split("\n").filter(l => l && !l.startsWith("#")).map(l => l.split(/\s+/)[0]);
const idsOf = {};
const getIds = f => idsOf[f] ||= new Set([...readFileSync(ROOT + f, "utf8").matchAll(/\sid="([^"]+)"/g)].map(m => m[1]));
const resolve = path => { if (redirects.includes(path)) return "redirect"; let f = path.replace(/^\//, ""); if (f === "" || f.endsWith("/")) f += "index.html"; return existsSync(ROOT + f) ? f : null; };
let bad = 0, checked = 0;
for (const f of files) {
  const html = readFileSync(ROOT + f, "utf8");
  for (const m of html.matchAll(/\s(?:href|src)="([^"]+)"/g)) {
    let u = m[1]; if (/^(https?:|mailto:|data:|javascript:|\$\{)/.test(u) || u.includes("${")) continue;
    checked++;
    const [pathq, hash] = u.split("#"); const path = pathq.split("?")[0];
    const target = path ? resolve(path.startsWith("/") ? path : "/" + f.replace(/[^/]*$/, "") + path) : f;
    if (!target) { bad++; console.log("BROKEN", f, "->", u); continue; }
    if (hash && target !== "redirect" && !getIds(target).has(hash)) { bad++; console.log("NO ANCHOR", f, "->", u); }
  }
  // duplicate ids
  const ids = [...html.matchAll(/\sid="([^"$]+)"/g)].map(m => m[1]); const dup = ids.filter((x, i) => ids.indexOf(x) !== i);
  if (dup.length) { bad++; console.log("DUP IDS", f, [...new Set(dup)].join(",")); }
}
console.log(`links: ${files.length} files, ${checked} internal links checked, ${bad} problem(s)`);
process.exitCode = bad ? 1 : 0;
