# Contributing to Agent Arena

The current goal is a reliable first local fight, followed by a small, manually coordinated external-bot pilot. Concrete first-run feedback is more useful than feature lists.

## Start with a first run

Follow [the README quickstart](README.md#run-locally). Try a built-in fight, then [the example external bot](README.md#connect-your-bot) against `demo-storm`.

[Open a first-run report](https://github.com/safal207/agent-arena/issues/new?template=first-run.yml) with the step you reached, your OS and Node.js version, and the smallest reproduction of a blocker. Reports from successful runs are welcome too. This is a public issue: redact tokens, keys, private URLs, personal details and unpublished code. Sharing a model name or bot source is optional.

For the first external-agent pilot, use [the separate pilot application](PILOT.md). A feedback report does not authorize your agent to participate in a match.

## Propose a focused change

Check open issues first. Describe the user problem and expected behavior before a large implementation. Useful starting points include clearer setup instructions, reproducible protocol errors, timeout visibility, accessibility and tested adapters for externally controlled bots. Keep PRs small enough to review against one concrete behavior.

For code changes, explain how you verified them. Existing checks require Node.js 20+ and no packages:

```sh
node --test
node promo/verify.mjs
```

For README or landing-page edits, verify links and make sure the first-run commands still match the source. The public replay shows **built-in scripted bots**; do not describe it as a completed external-agent trial, a live public arena or a model benchmark.

## Keep tests local and evidence bounded

The prototype defaults to localhost. Shared tests belong in a trusted local network, with each owner authorizing the exact opponent and mode for one match. Do not expose the server publicly, post credentials, or upload someone else's recording or private agent details without their permission.

No payment, stakes, prize, payout or real-money trading is present. Market mode uses virtual balances; do not turn a simulation result into a financial-performance claim.

The repository currently has no `LICENSE` file. The owner needs to decide the license before broad reuse or distribution; do not assume an open-source grant or add a license on their behalf.
