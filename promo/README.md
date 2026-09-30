# Agent Arena developer landing page

A standalone English landing page for a **local playground for bot decisions**. The primary path is self-serve: understand the experiment, copy the quickstart, run a local fight, then connect the example bot. The free, manually reviewed local pilot is secondary. A contextual repository link invites people to star the project after seeing its value.

## Preview and check

From the repository root, run:

```sh
node promo/preview.mjs
```

Open `http://127.0.0.1:4173/` or `http://127.0.0.1:4173/agent-arena/promo/` to check the GitHub Pages subpath. The preview binds to localhost and serves the HTML, CSS, JS, JSON recording and social image through a fixed allowlist. It does not affect the arena server on port 3000. Node.js 20+ is enough; no packages or API keys are needed.

```sh
node promo/verify.mjs
node --test
```

`verify.mjs` checks all recorded turns against the fight engine. `capture.mjs` records a fresh fight using a separate ephemeral server and overwrites `replay.json`. The scripted choices are currently deterministic. The turn-zero frame is reconstructed using `createMatch`, because the server advances to turn one immediately after match creation; later frames come from `/api/state`.

## Source and publication

Publish `index.html`, `style.css`, `app.js`, `replay.json` and `media/agent-arena-x-card.png` together. With GitHub Pages publishing the repository's main branch root, the public route is `https://safal207.github.io/agent-arena/promo/`. Runtime assets use relative paths. The canonical URL and social-image URL intentionally identify the public page.

Replay controls support play/pause, restart, speed, slider and a jump to turn six. `?turn=6#replay` opens a specific recorded turn; invalid values use turn zero and out-of-range numeric values clamp to the recording. “Copy a link to this turn” shares that URL. On local/non-HTTPS origins, share buttons use the public promo address, never the local address. Copy actions show a visible selectable fallback if clipboard access fails, and retain usable focus after legacy copy succeeds. No share button publishes a post.

## What the page can claim

- The real recording contains 10 turns. Storm wins with 10 HP against Guardian's 0 HP.
- Both recorded competitors are built-in **scripted** bots, not external AI agents. Original Russian names/events remain in `replay.json`; the page translates the fixed event text.
- The local prototype supports external bots over HTTP. The example authorizes one fight against Storm; model integrations can use asynchronous `chooseAction` and may require their own dependencies or credentials.
- Self-serve local use needs no pilot application. The public page is a replay and documentation, not a hosted match server.
- Pilot selection and scheduling are manual. Applying does not guarantee a match or authorize one.
- There are no live fees, stakes, prizes, payments, payouts or model rankings.
- No testimonials, adoption counts, star counts or performance claims are invented. The repository currently has no license file; the page does not promise an open-source reuse grant.

## Feedback and growth measurement

The first-run form asks how far a builder got and where they stopped. Both first-run reports and pilot applications are public GitHub issues; users are reminded not to include secrets, private URLs or personal details. A GitHub account is required to submit, but not to watch the replay or run the prototype.

There is no analytics script, remote match telemetry or aggregate activation dashboard. Copies, replay views and outbound star links do not prove a completed match or an actual star. Use voluntary first-run reports for bounded activation evidence and count stars separately. See [the 14-day adoption experiment](../docs/growth-plan.md).
