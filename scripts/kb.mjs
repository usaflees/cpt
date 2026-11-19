#!/usr/bin/env node
// Knowledge store: docs/knowledge/facts.jsonl holds one sourced, dated finding per line (search engines, AI
// platforms, Cloudflare, Claude tooling, and what we measured on this site). Every session reads the digest first.
//
//   node scripts/kb.mjs                  digest: open owner actions, next builds, facts due for a re-check, newest
//   node scripts/kb.mjs --topic google   every fact on one topic (topics: see TOPICS below)
//   node scripts/kb.mjs --status owner   every fact with one status (applied owner next avoid watch info)
//   node scripts/kb.mjs --find <word>    facts whose text contains <word> (case-insensitive)
//   node scripts/kb.mjs --write          rewrite docs/knowledge/FACTS.md (the readable view) from the store
//   node scripts/kb.mjs --check          validate the store and confirm FACTS.md is current (QA runs this)
//
// Adding a finding: append one JSON line (keep the file sorted by topic, then date), run --write, commit both.
// Merges: .gitattributes merges this file line by line (union), so parallel sessions' new facts combine without
// conflicts. If both sides edited the same fact, --check reports a duplicate id: keep the newer line, run --write.
// Fields: id (kebab-case, unique), date (YYYY-MM-DD the fact was published or measured), topic, claim (what is
// true, with numbers), so_what (what it means for this site), status, confidence, sources (URLs or repo paths),
// review (optional YYYY-MM-DD: re-check by then; required for status "watch").
// confidence: official (the platform's own docs/blog/status page), measured (we measured it on this site),
// reported (trade press), claim (vendor study or single blog). Prefer official; mark everything else honestly.
// This repo is public: never put search queries, analytics figures, credentials or personal data in a fact.
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { ROOT } from "./lib/registry.mjs";

const STORE = ROOT + "docs/knowledge/facts.jsonl";
const VIEW = ROOT + "docs/knowledge/FACTS.md";
const TOPICS = ["google", "ai-search", "bing", "cloudflare", "indexing", "markup", "content", "links", "performance",
  "accessibility", "measurement", "security", "data-sources", "site", "claude"];
const STATUS = { owner: "👤 owner action", next: "🔜 build next", watch: "👀 watch", avoid: "⛔ don't", applied: "✅ applied", info: "ℹ️ info" };
const CONF = ["official", "measured", "reported", "claim"];
const FIELDS = ["id", "date", "topic", "claim", "so_what", "status", "confidence", "sources", "review"];

const args = process.argv.slice(2);
const FLAGS = ["--topic", "--status", "--find", "--write", "--check"];
const bad = args.filter((a, i) => a.startsWith("--") && !FLAGS.includes(a));
if (bad.length || (args.length && !FLAGS.includes(args[0]))) {
  console.error(`Unknown argument(s): ${(bad.length ? bad : args).join(" ")}\nUsage: see the header of scripts/kb.mjs`);
  process.exit(2);
}
const today = new Date().toISOString().slice(0, 10);

function load() {
  const errors = [], facts = [], ids = new Set();
  readFileSync(STORE, "utf8").split("\n").forEach((line, n) => {
    if (!line.trim()) return;
    let f;
    try { f = JSON.parse(line); } catch (e) { errors.push(`line ${n + 1}: not valid JSON (${e.message})`); return; }
    const at = `line ${n + 1} (${f.id || "no id"})`;
    for (const k of Object.keys(f)) if (!FIELDS.includes(k)) errors.push(`${at}: unknown field "${k}"`);
    for (const k of FIELDS.slice(0, 8)) if (f[k] === undefined || f[k] === "" || (Array.isArray(f[k]) && !f[k].length)) errors.push(`${at}: missing ${k}`);
    if (f.id && !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(f.id)) errors.push(`${at}: id must be kebab-case`);
    if (ids.has(f.id)) errors.push(`${at}: duplicate id`); ids.add(f.id);
    for (const k of ["date", "review"]) if (f[k] !== undefined && !(/^\d{4}-\d{2}-\d{2}$/.test(f[k]) && !isNaN(Date.parse(f[k])))) errors.push(`${at}: ${k} must be YYYY-MM-DD`);
    if (f.date > today) errors.push(`${at}: date is in the future`);
    if (f.topic && !TOPICS.includes(f.topic)) errors.push(`${at}: topic must be one of ${TOPICS.join(", ")}`);
    if (f.status && !STATUS[f.status]) errors.push(`${at}: status must be one of ${Object.keys(STATUS).join(", ")}`);
    if (f.confidence && !CONF.includes(f.confidence)) errors.push(`${at}: confidence must be one of ${CONF.join(", ")}`);
    if (f.status === "watch" && !f.review) errors.push(`${at}: status "watch" needs a review date`);
    for (const s of f.sources || []) {
      if (/^https?:\/\//.test(s)) continue;
      if (!existsSync(ROOT + s.split("#")[0])) errors.push(`${at}: source ${s} is neither a URL nor a file in the repo`);
    }
    facts.push(f);
  });
  return { facts, errors };
}

const line = f => `- **${f.claim}** → ${f.so_what} _(${f.date}, ${f.confidence}${f.review ? `, re-check by ${f.review}` : ""}; \`${f.id}\`)_`;
const short = (f, w = 150) => `  - ${f.claim.length > w ? f.claim.slice(0, w - 1) + "…" : f.claim} → ${f.so_what.length > w ? f.so_what.slice(0, w - 1) + "…" : f.so_what} [${f.id}]`;

function render(facts) {
  const out = [`# Facts: what we know, with sources

Generated by \`node scripts/kb.mjs --write\` from [facts.jsonl](facts.jsonl). Don't edit this file by hand: edit the
store, then rewrite this view. ${facts.length} facts. Status: ${Object.values(STATUS).join(" · ")}.
Confidence: **official** (the platform's own docs), **measured** (on this site), **reported** (trade press),
**claim** (vendor study or single blog).
`];
  const open = facts.filter(f => f.status === "owner" || f.status === "next");
  out.push(`## Open now\n`);
  for (const s of ["owner", "next"]) {
    const list = open.filter(f => f.status === s);
    if (list.length) out.push(`### ${STATUS[s]} (${list.length})\n`, ...list.map(line), "");
  }
  for (const t of TOPICS) {
    const list = facts.filter(f => f.topic === t).sort((a, b) => b.date.localeCompare(a.date));
    if (!list.length) continue;
    out.push(`## ${t} (${list.length})\n`);
    for (const f of list) {
      out.push(`- ${STATUS[f.status].split(" ")[0]} **${f.claim}**`, `  → ${f.so_what}`,
        `  _${f.date} · ${f.confidence}${f.review ? ` · re-check by ${f.review}` : ""} · \`${f.id}\` · ${f.sources.map(s => /^https?:/.test(s) ? `[${new URL(s).hostname.replace(/^www\./, "")}](${s})` : `[${s.split("/").pop()}](${s.replace(/^docs\/knowledge\//, "")})`).join(", ")}_`);
    }
    out.push("");
  }
  return out.join("\n");
}

const { facts, errors } = load();
if (errors.length) { console.error(errors.join("\n")); console.error(`kb: ${errors.length} problem(s) in docs/knowledge/facts.jsonl`); process.exit(1); }

const [cmd, val] = args;
if (cmd === "--write") {
  writeFileSync(VIEW, render(facts));
  console.log(`kb: wrote docs/knowledge/FACTS.md (${facts.length} facts)`);
} else if (cmd === "--check") {
  const current = existsSync(VIEW) && readFileSync(VIEW, "utf8") === render(facts);
  if (!current) { console.error("kb: docs/knowledge/FACTS.md is out of date; run node scripts/kb.mjs --write"); process.exit(1); }
  console.log(`kb: ${facts.length} facts, 0 problem(s)`);
} else if (cmd === "--topic" || cmd === "--status" || cmd === "--find") {
  if (!val) { console.error(`${cmd} needs a value`); process.exit(2); }
  const v = val.toLowerCase();
  const list = facts.filter(f => cmd === "--topic" ? f.topic === v : cmd === "--status" ? f.status === v
    : JSON.stringify(f).toLowerCase().includes(v));
  console.log(list.map(line).join("\n") || "(none)");
  console.log(`kb: ${list.length} of ${facts.length} facts`);
} else {
  // Digest: short enough to read at the start of every session.
  const by = s => facts.filter(f => f.status === s);
  const due = facts.filter(f => f.review && f.review <= today);
  const newest = facts.slice().sort((a, b) => b.date.localeCompare(a.date)).slice(0, 6);
  console.log(`Knowledge store: ${facts.length} facts (docs/knowledge/FACTS.md; query with --topic/--status/--find).`);
  if (due.length) console.log(`Re-check now (review date passed): ${due.length}\n${due.map(f => short(f)).join("\n")}`);
  console.log(`Owner actions open: ${by("owner").length} (node scripts/kb.mjs --status owner)`);
  console.log(`Build next: ${by("next").length}\n${by("next").map(f => short(f)).join("\n")}`);
  console.log(`Don't: ${by("avoid").map(f => f.id).join(", ")}`);
  console.log(`Newest:\n${newest.map(f => short(f, 120)).join("\n")}`);
}
