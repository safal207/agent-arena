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

`verify.mjs` checks both recordings against the fight engine. For the HTTP-client recording, it also checks accepted decisions, observations, one-match authorization and SHA-256 hashes of the source files. `capture.mjs` records a fresh built-in fight using a separate ephemeral server and overwrites `replay.json`. Its turn-zero frame is reconstructed using `createMatch`; later frames come from `/api/state`.

To recapture the two scripted HTTP clients through an isolated localhost server:

```sh
node examples/external-duel.mjs --output promo/external-replay.json
node promo/verify.mjs
```

The client runner starts its own server in a worker, registers Rush and Sentinel, authorizes their exact pair for one fight, saves every resolved state and accepted HTTP decision, verifies the complete capture, then atomically writes the file. Tokens stay in memory and are omitted from the recording and CLI summary. Cleanup terminates the worker so match timers do not keep failed runs alive. Recapture if a recorded source file changes. The same runner controls both scripted clients; this evidence does not establish independent participants or model quality.

Verification rejects unexpected schema fields and credential-like content outside the allowed source hashes. A failed CLI run reports a safe stage and code, never raw request/response data. The 45-second default deadline applies through source hashing and temporary output writing; no atomic rename starts after expiry. Once that final rename starts, it commits normally. Cancellation before it preserves an existing target and removes only the temporary file. Git keeps `.mjs` files as LF on every checkout so the recorded byte hashes remain comparable on Windows; CI runs both Node versions on Linux and Windows.

## Source and publication

Publish `index.html`, `style.css`, `app.js`, `replay.json`, `external-replay.json` and `media/agent-arena-x-card.png` together. With GitHub Pages publishing the repository's main branch root, the public route is `https://safal207.github.io/agent-arena/promo/`. Runtime assets use relative paths; CSS and JS are versioned `external-proof-2`. The canonical URL and social-image URL intentionally identify the public page.

Replay controls support recording selection, play/pause, restart, speed, slider and a jump to turn six. `?turn=6#replay` opens the built-in recording at turn six; `?replay=external&turn=6#replay` opens the HTTP-client recording. Invalid recording IDs select the built-in demo; invalid turns use zero and out-of-range numeric values clamp to the recording. “Copy a link to this turn” includes the selected recording. Switching stops playback; delayed responses cannot replace a newer choice, and failed loads hide stale frames and results. On local/non-HTTPS origins, share buttons use the public promo address, never the local address. Copy actions show a visible selectable fallback if clipboard access fails, retain usable focus after legacy copy succeeds, and restore their original label even after repeated clicks. No share button publishes a post.

## What the page can claim

- The built-in recording contains 10 turns. Storm wins with 10 HP against Guardian's 0 HP.
- The second recording comes from two **scripted HTTP clients**, Rush and Sentinel, operated by one local runner. Its saved evidence contains observations and accepted actions for every turn; the page derives turns, winner, HP and fallback timeout count from that recording.
- Both examples use scripted strategies and no model calls. Original Russian names/events remain in the JSON; the page translates the fixed event text.
- The local prototype supports external bots over HTTP. The example authorizes one fight against Storm; model integrations can use asynchronous `chooseAction` and may require their own dependencies or credentials.
- Self-serve local use needs no pilot application. The public page is a replay and documentation, not a hosted match server.
- Pilot selection and scheduling are manual. Applying does not guarantee a match or authorize one.
- There are no live fees, stakes, prizes, payments, payouts or model rankings.
- No testimonials, adoption counts, star counts or performance claims are invented. The repository currently has no license file; the page does not promise an open-source reuse grant.

## Feedback and growth measurement

The first-run form asks how far a builder got and where they stopped. Both first-run reports and pilot applications are public GitHub issues; users are reminded not to include secrets, private URLs or personal details. A GitHub account is required to submit, but not to watch the replay or run the prototype.

There is no analytics script, remote match telemetry or aggregate activation dashboard. Copies, replay views and outbound star links do not prove a completed match or an actual star. Use voluntary first-run reports for bounded activation evidence and count stars separately. See [the 14-day adoption experiment](../docs/growth-plan.md).
