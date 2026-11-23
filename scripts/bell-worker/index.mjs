// Bell Brief on Cloudflare: a cron Worker that publishes each edition into Workers KV, so the Bell Brief no longer
// depends on GitHub Actions starting a scheduled run on time (GitHub skipped or delayed several in Nov 2026).
//
// Each run reads the last published JSON from KV key "bell", asks scripts/lib/bell-core.mjs which edition is due
// (same calendar, sources, scoring rule and 4-hour late window as scripts/build-bell.mjs), builds it, and writes
//   { updated, next, editions[≤6], html }    html = the home page section (scripts/lib/bell-html.mjs)
// back to KV. functions/bell.js serves that at /bell, and assets/bell.js swaps the section in when it is newer
// than the edition in the static page. Nothing is committed to the repository and the site is not rebuilt.
//
// Setup and deploy: see wrangler.toml next to this file. Cron times are UTC; two expressions per bell cover
// daylight saving, and the core decides what is due (a run with nothing due does nothing).
import { dueEdition, buildEdition, withEdition, cutoffOf, etDate, CALENDAR_END } from "../lib/bell-core.mjs";
import { bellSection } from "../lib/bell-html.mjs";

const KEY = "bell";

export async function run(env, at) {
  if (!env.BELL) throw new Error("no KV namespace bound as BELL (see wrangler.toml)");
  if (etDate(at) > CALENDAR_END) console.warn(`bell: the NYSE calendar in scripts/lib/bell-core.mjs ends ${CALENDAR_END}; add the next year's holidays`);
  const previous = await env.BELL.get(KEY, "json");
  const job = dueEdition(at, previous);
  if (!job) return console.log(`bell: nothing due at ${at.toISOString()}`);
  // Cron runs start on time, so never publish before the bell (the GitHub script waits instead).
  if (at < cutoffOf(job.date, job.edition)) return console.log(`bell: ${job.date}-${job.edition} is not due until ${cutoffOf(job.date, job.edition).toISOString()}`);
  const edition = await buildEdition(job, new Date(), m => console.warn(m));
  const out = withEdition(previous, edition);
  await env.BELL.put(KEY, JSON.stringify({ ...out, html: bellSection(out) }));
  console.log(`bell: published ${edition.id} with ${edition.items.length} item(s)${edition.sourcesFailed.length ? `; unreachable: ${edition.sourcesFailed.join(", ")}` : ""}`);
}

export default {
  async scheduled(event, env, ctx) {
    ctx.waitUntil(run(env, new Date(event.scheduledTime)).catch(e => { console.error(`bell: ${e.message}`); throw e; }));
  },
  // No public URL: the site reads the edition from KV through functions/bell.js.
  async fetch() { return new Response("Not found", { status: 404 }); },
};
