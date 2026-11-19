# What LiveCoinWatch users get, and what we can give them without new URLs (2026-11-19)

Question from the owner: which features do competitors' users want, so the site can rank like livecoinwatch.com?
Method: 4 extended web searches plus one fetch of 3 pages (two 2026 reviews and LiveCoinWatch's home page). Builds
on `2026-11-08-competitor-gaps-and-news.md` (what rivals charge for), which this note doesn't repeat.

## LiveCoinWatch ranks on scale and returning users, not on one feature

- **Scale:** its home page claims 70,811 coins on 1,031 exchanges ([livecoinwatch.com](https://www.livecoinwatch.com/),
  read 2026-11-14). Each coin, exchange, category and platform has its own page. We have 114 coins and a rule against
  new URL families until Google indexes more than 1 of 134 pages (`docs/INDEXING-PLAN.md`), so copying the scale is
  out for now.
- **Brand and direct traffic:** third-party estimates put its search traffic near 113K visits a month (Oct 2026),
  led by its own name, with Direct as its largest source ([Ahrefs Top](https://ahrefstop.com/websites/livecoinwatch.com),
  [Similarweb](https://www.similarweb.com/website/livecoinwatch.com/)). These are estimates, not its analytics, and
  Semrush showed ~295K in Oct 2025, so treat them as rough. People return because it's fast and holds their
  portfolio, not because it ranks for many non-brand keywords.
- **What reviewers praise:** speed ("by far the best ticker as far as speed besides exchanges", 2-second updates),
  a clean table with filters, free widgets and API
  ([SourceForge](https://sourceforge.net/software/product/Live-Coin-Watch/),
  [Cryptoindustry](https://cryptoindustry.com/reviews/live-coin-watch)). The most detailed review of its portfolio
  calls "Advanced Portfolios" its strongest feature: logged buys with fees, average buy price, unrealized and total
  profit, cost-basis methods (FIFO/FILO/HIFO) ([CryptoAdventure, Feb 2026](https://cryptoadventure.com/livecoinwatch-portfolio-tracker-review-2026-quick-vs-advanced-portfolios-pros-cons/)).
- **Other things it has that we don't:** a "Layout" control for table columns, fiat currencies beyond USD on every
  table, movers with a choice of timeframe, liquidity ±2% as a headline market stat, coin up/down votes and a chat
  ([CEX.IO University, Mar 2026](https://university.cex.io/livecoinwatch-review/)). Votes and chat need a server and
  moderation; not for now.
- **What its users miss:** more detail per coin and better data for small coins
  ([SourceForge](https://sourceforge.net/software/product/Live-Coin-Watch/),
  [Cryptoindustry](https://cryptoindustry.com/reviews/live-coin-watch)). Our coin pages already carry computed
  history (best/worst month, largest fall, correlation), which is that gap.

Across trackers, users complain about paywall creep (CoinStats), slow loading (Delta) and missing web versions
([getdailytoolbox](https://getdailytoolbox.com/crypto/best-crypto-portfolio-trackers/)). Those are things we
already avoid. I found no Reddit threads in the results; app-store reviews were few and of mixed age.

## What to build (queued in docs/QUEUE.md, no new URLs)

1. **Profit and loss for holdings:** optional average buy price per coin in "My bag" → unrealized profit per coin and
   in total. LiveCoinWatch's most praised feature, done locally with no account.
2. **Fiat display currencies:** EUR, GBP, CAD, AUD, JPY, INR, BRL, KRW on the home table, movers and coin pages,
   from the FX rates the converter already loads. Same URLs (a setting, not per-currency pages).
3. **Choose columns and order the watchlist:** a "Columns" menu (7d, 7-day chart, market cap, volume) and drag or
   arrow-key reordering of starred coins, saved in the browser.
4. **Movers timeframe:** 24 h or 7 d on the biggest-movers cards (7 d from the 7-day candles the table already
   loads).

Not confirmed: whether any single one of these moves rankings. The ranking lever is still indexing (Goal 1); these
make visitors come back, which is how LiveCoinWatch earns its brand traffic.
