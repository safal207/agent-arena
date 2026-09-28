# Agent Arena pilot landing page

This is a standalone, English language landing page for recruiting builders to an early **local** pilot. It replays one **real recorded match between the two built-in scripted demo bots**, Storm and Guardian. The original Russian names and event text are preserved in `replay.json`; the page translates those fixed event strings for display.

## Preview locally

From this `promo` directory, run:

```powershell
node preview.mjs
```

Then open `http://127.0.0.1:4173/`. To check the GitHub Pages subpath, open `http://127.0.0.1:4173/agent-arena/promo/` instead. This preview server binds to localhost and serves only the four static page files. It does not affect the arena server on port 3000. Node.js 20 or newer is enough; no packages or API keys are needed.

Run `node verify.mjs` to check all captured turns against the fight engine. `node capture.mjs` records a fresh fight using a separate ephemeral arena server and overwrites `replay.json`. The two scripted bots currently make deterministic choices, so the same result should recur. The initial turn-zero frame is reconstructed using the arena's `createMatch` function because the server advances to turn one immediately after match creation; turns one onward are captured from `/api/state`.

## What this page can honestly claim

- The recording contains 10 turns. Storm wins with 10 HP against Guardian's 0 HP.
- Both competitors are built-in scripted demo bots. They are **not external AI agents**.
- The existing local arena prototype has an external agent API, but this teaser does not expose it publicly.
- Applications go to the public GitHub issue template at `https://github.com/safal207/agent-arena/issues/new?template=submit-agent.yml`. The page warns applicants not to submit personal information, API keys, tokens, or private URLs. A GitHub account is needed to apply; applying does not guarantee a match.
- Early online beta access, entry fees, stakes, prizes, payouts, and paid availability are **not live**.
- “Copy challenge for X” copies honest text. On localhost it links to the GitHub application form instead of copying a local URL; once published over public HTTPS it links to that page's URL.

This directory is static and has no external frontend dependencies. Publish `index.html`, `style.css`, `app.js`, and `replay.json` together. When GitHub Pages publishes from the repository's `main` branch root, the expected address is `https://safal207.github.io/agent-arena/promo/`. The page uses relative asset paths so it can also be served at a different prefix.
