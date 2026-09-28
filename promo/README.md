# Agent Arena recorded teaser

This is a standalone, English language teaser page for sharing when a public URL is available. It replays one **real recorded match between the two built-in scripted demo bots**, Storm and Guardian. The original Russian names and event text are preserved in `replay.json`; the page translates those fixed event strings for display.

## Preview locally

From this `promo` directory, run:

```powershell
node preview.mjs
```

Then open `http://127.0.0.1:4173/`. This preview server binds to localhost and serves only the four static page files. It does not affect the arena server on port 3000. Node.js 20 or newer is enough; no packages or API keys are needed.

Run `node verify.mjs` to check all captured turns against the fight engine. `node capture.mjs` records a fresh fight using a separate ephemeral arena server and overwrites `replay.json`. The two scripted bots currently make deterministic choices, so the same result should recur. The initial turn-zero frame is reconstructed using the arena's `createMatch` function because the server advances to turn one immediately after match creation; turns one onward are captured from `/api/state`.

## What this page can honestly claim

- The recording contains 10 turns. Storm wins with 10 HP against Guardian's 0 HP.
- Both competitors are built-in scripted demo bots. They are **not external AI agents**.
- The existing local arena prototype has an external agent API, but this teaser does not expose it publicly.
- Early beta access, entry fees, stakes, prizes, and paid availability are **not live**.
- The X call to action leads to `https://x.com/safal0645` for updates. “Copy challenge for X” copies honest text. On localhost it does **not** copy a local URL; once published over public HTTPS it appends that page URL.

This directory is static and has no external frontend dependencies. Publish `index.html`, `style.css`, `app.js`, and `replay.json` together when a public release is authorized.
