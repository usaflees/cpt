// Bell Brief: the home page section (scripts/build-coin-pages.mjs puts it between the bell-brief markers in index.html)
// and the same section inside the JSON the Cloudflare Worker (scripts/bell-worker/) stores for the /bell endpoint,
// which assets/bell.js swaps in when a newer edition exists than the static page shows. Keep the "How the Bell
// Brief is chosen" text in step with the scoring rule in scripts/lib/bell-core.mjs. Plain JavaScript only (Intl).
import { esc, usd, pctText, pctClass } from "./format.mjs";

export const etTime = iso => new Date(iso).toLocaleString("en-US", { timeZone: "America/New_York", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).replace(" AM", " am").replace(" PM", " pm") + " ET";
export const etDay = iso => new Date(iso).toLocaleDateString("en-US", { timeZone: "America/New_York", weekday: "short", month: "short", day: "numeric" });
export const bellName = (e, early) => (e === "open" ? "Opening bell" : early ? "Early closing bell" : "Closing bell");
export function bellSection(bell) {
  const ed = bell?.editions?.[0];
  const next = (bell?.next || []).filter(n => !ed || n.at > ed.cutoff);
  const nextText = next[0] ? `Next: ${bellName(next[0].edition, next[0].early).toLowerCase()}, ${etTime(next[0].at)}` : "";
  const items = ed ? ed.items.map((it, i) => `
          <li class="bell-item" style="--i:${i}">
            <span class="bell-rank" aria-hidden="true">${i + 1}</span>
            <span class="bell-body"><a class="bell-title" href="${esc(it.link)}" rel="noopener">${esc(it.title)}</a>
              <span class="bell-meta">${esc(it.source)}${it.topic ? ` · ${esc(it.topic)}` : ""} · <time datetime="${it.published}">${etTime(it.published)}</time></span></span>
            ${it.btcChange === null ? `<span class="bell-move muted">BTC —</span>` : `<span class="chg-pill ${pctClass(it.btcChange)} bell-move" title="Bitcoin's change on Coinbase (BTC-USD) from this release to the bell">BTC ${pctText(it.btcChange)}</span>`}
          </li>`).join("") : "";
  const words = ["no", "only one", "only two"];
  const quiet = ed && ed.items.length < 3 ? `<li class="bell-quiet">A quiet session: ${words[ed.items.length]} federal release${ed.items.length === 1 ? "" : "s"} met the bar in the last four days.</li>` : "";
  const first = !ed ? `<li class="bell-quiet">The first edition arrives with the next bell${next[0] ? `: ${etTime(next[0].at)}` : ""}.</li>` : "";
  return `<section class="bell-box" id="bell-brief" aria-labelledby="bell-h"${ed ? ` data-cutoff="${ed.cutoff}" data-btc="${ed.btcAtCutoff ?? ""}"` : ""} data-next='${esc(JSON.stringify(next.map(({ edition, at, early }) => ({ edition, at, early }))))}'>
        <div class="bell-head">
          <h2 id="bell-h"><span class="bell-icon" aria-hidden="true">🔔</span>Bell Brief${ed ? ` <span class="muted bell-ed">${bellName(ed.edition, ed.earlyClose)}, ${etDay(ed.cutoff)}</span>` : ""}</h2>
          <p class="bell-clock"><span id="bellNext">${esc(nextText)}</span><span class="bell-bar" aria-hidden="true"><span id="bellBar"></span></span></p>
        </div>
        <p class="bell-lede">Up to three official releases most likely to move crypto, published 5 minutes before the NYSE opening bell and 5 minutes after the close${ed ? ` (this edition: ${etTime(ed.cutoff)})` : ""}.</p>
        <ol class="bell-list">${items}${quiet}${first}
        </ol>
        ${ed?.btcAtCutoff ? `<p class="bell-live"><span>BTC at this bell: ${usd(ed.btcAtCutoff)} (Coinbase)</span><span>Since then: <span id="bellSince">—</span></span></p>` : ""}
        <details class="bell-how">
          <summary>How the Bell Brief is chosen</summary>
          <p>Sources are the public press and statistical releases of U.S. federal agencies: the Federal Reserve, the Bureau of Labor Statistics (CPI, jobs, producer prices), the Bureau of Economic Analysis, the SEC and the CFTC. A fixed rule ranks them: Federal Reserve monetary policy first, then the CPI and jobs reports, GDP and PCE, producer prices and crypto-related SEC actions, crypto, prediction-market and 24/7-trading CFTC actions, SEC news on exchange-traded funds, then Federal Reserve banking regulation and trade data, with a bonus for anything released since the last bell. Other releases (routine statistics, bank applications, and enforcement actions that don't involve crypto) never fill a slot. The BTC figure is Bitcoin's measured change on Coinbase from each release to the bell; it shows what the market did afterwards, not that the release caused it.${ed?.sourcesFailed?.length ? ` This edition could not reach: ${esc(ed.sourcesFailed.join(", "))}.` : ""} Titles link to the agency's own page. Not financial advice.</p>
        </details>
      </section>`;
}
