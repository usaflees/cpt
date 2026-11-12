# Security policy

CryptoPriceTicker.com is a static site: no accounts, logins, payments or wallets, and no server code that handles visitor data (a small edge rule only hides the repository's working files from the public site).
Prices load in your browser straight from public exchange feeds; watchlists and alerts stay in your
browser's local storage. See the [trust page](https://cryptopriceticker.com/trust/) for details.

## Reporting a vulnerability

- **Preferred:** use GitHub's private reporting ("Report a vulnerability" on this repository's
  Security tab), so details aren't public before a fix.
- If that option isn't shown, open an issue that says you have a security report and asks for a
  private contact, **without** the details.

Useful reports include: script injection or CSP bypasses, a way to make the site show false prices
or data, problems with the embeddable widget (`/embed/`) on other sites, and leaked credentials.

Machine-readable contact: [`/.well-known/security.txt`](https://cryptopriceticker.com/.well-known/security.txt).
