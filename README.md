# Agent Arena

[![Checks](https://github.com/safal207/agent-arena/actions/workflows/checks.yml/badge.svg)](https://github.com/safal207/agent-arena/actions/workflows/checks.yml)

**A local, turn-based playground for bots that read an observation and choose an action over HTTP.** Run a fight, inspect HP, energy and actions, then replace the example strategy with your own code or model.

[Watch the recorded demo](https://safal207.github.io/agent-arena/promo/) · [Run locally](#run-locally) · [Connect your bot](#connect-your-bot) · [Русская документация](README.ru.md)

[![Agent Arena: Storm versus Guardian](promo/media/agent-arena-x-card.png)](https://safal207.github.io/agent-arena/promo/)

The web demo replays a recorded fight between **two built-in scripted bots**. It is not a public match server or evidence of external AI agents competing. The local prototype supports externally controlled bots; their strategy can be code, a model call or a combination.

## Run locally

Requires **Git and Node.js 20+**. The arena and built-in demo need **no packages, API keys or account**. These commands work in macOS/Linux terminals and Windows PowerShell:

```sh
git clone https://github.com/safal207/agent-arena.git
cd agent-arena
node server.mjs
```

Open [http://127.0.0.1:3000](http://127.0.0.1:3000), keep **Fight / Бой** selected, choose **Storm / Шторм** and **Guardian / Страж**, then click **Start fight / Начать бой**. The local interface currently uses Russian labels. The match should reach a visible result; the action log shows what happened each turn.

The server binds to localhost by default. Stop it with `Ctrl+C`. State and agent credentials live in memory and reset when the server restarts.

<a id="подключение-ботов"></a>

## Connect your bot

Leave the server running. In a second terminal, from the repository root:

```sh
node examples/remote-bot.mjs
```

The example registers a new external bot and authorizes **one fight against `demo-storm`**. It prints the bot's ID and secret token locally, then polls for turns. Keep that terminal running. In the arena, choose the new bot on one side and **Storm / Шторм** on the other, keep **Fight / Бой** selected, and start the match. A successful first run ends with a visible result and action lines in the bot terminal.

Replace `chooseAction` in [examples/remote-bot.mjs](examples/remote-bot.mjs) with your strategy. It can be synchronous or an `async` function; return one of the supplied `actions`: `approach`, `retreat`, `jab`, `kick`, `guard`, `special`. The bot initiates HTTP requests; the arena does not fetch or execute submitted bot code. A model integration may need its own dependencies or credentials; keep those in your environment.

**To authorize another match with the same bot**, stop the bot process and restart it with its saved ID and token. Keep the arena server running. Bash/zsh:

```sh
export ARENA_AGENT_ID='YOUR_AGENT_ID'
export ARENA_AGENT_TOKEN='YOUR_PRIVATE_TOKEN'
export ARENA_OPPONENT_ID='demo-storm'
node examples/remote-bot.mjs
```

Windows PowerShell:

```powershell
$env:ARENA_AGENT_ID = 'YOUR_AGENT_ID'
$env:ARENA_AGENT_TOKEN = 'YOUR_PRIVATE_TOKEN'
$env:ARENA_OPPONENT_ID = 'demo-storm'
node examples/remote-bot.mjs
```

Never put tokens or API keys in issues, screenshots, recordings or commits. Redact the registration output before sharing a terminal excerpt. Saved credentials become invalid after an arena restart; clear both `ARENA_AGENT_ID` and `ARENA_AGENT_TOKEN` to register a fresh bot.

For **two external bots**, register both first, then restart each with its saved credentials and the other bot's ID as `ARENA_OPPONENT_ID`. Both owners must authorize the same opponent and mode; for market mode, the market source must also match. Each authorization is consumed when that one match starts.

## HTTP protocol

All requests use the local arena URL. JSON requests use `Content-Type: application/json`. Each external bot keeps its own registration token and sends `Authorization: Bearer TOKEN` on `ready`, `next` and `action`.

| Step | Request | Result |
| --- | --- | --- |
| Register | `POST /api/agents`, `{"name":"MyBot"}` | `id`, secret `token`, polling hint `pollMs` |
| Authorize one fight | `POST /api/agents/:id/ready`, `{"opponentAgentId":"demo-storm","mode":"fight"}` | `ready: true` and the authorized conditions |
| Poll | `GET /api/agents/:id/next` | `{"waiting":true,"pollMs":400}` or a turn job |
| Act | `POST /api/agents/:id/action`, `{"matchId":"…","turn":1,"action":"jab"}` | `{"ok":true}` if it matches the pending turn |
| Start a fight | `POST /api/matches`, `{"leftAgentId":"YOUR_AGENT_ID","rightAgentId":"demo-storm","mode":"fight"}` | Match ID, mode and status |
| Inspect | `GET /api/state` | Agents and the current match; tokens are omitted |

A turn job contains `matchId`, `turn`, `mode`, `observation` and allowed `actions`. In fight mode, `observation.self` and `observation.opponent` contain `hp`, `x` and `energy`; the observation also includes `turn` and `maxTurns`. Both fighters choose actions before the turn resolves. A fight ends on knockout or after at most 36 turns; remaining HP determines the result.

Polling the same pending turn returns the same job until an action is accepted or time expires. Submit one action for each `matchId` and `turn`; a stale or duplicate action returns `409`. External bots have **5 seconds per turn** by default. A timeout uses `guard` in fight mode or `hold` in market mode and adds a log event. Set `AGENT_TIMEOUT_MS` before starting the server to an integer from 1000 to 30000 if your strategy needs more time.

For market mode, authorize `{"opponentAgentId":"demo-storm","mode":"market","exchange":"demo"}` and include `"mode":"market","exchange":"demo"` in the match-creation body. `coinbase` and `kraken` are the other supported sources. The turn observation contains disclosed prices, virtual `self.cash`, `self.units`, `self.equity` and `opponent.equity`; allowed actions are `buy`, `sell`, `hold`. Future candles are not included in turn observations.

| Example-bot setting | Default | Purpose |
| --- | --- | --- |
| `ARENA_URL` | `http://127.0.0.1:3000` | Arena address |
| `BOT_NAME` | `Demo Bot <process ID>` | Display name, 2–32 characters |
| `ARENA_AGENT_ID`, `ARENA_AGENT_TOKEN` | Unset | Reuse an agent; set both or neither |
| `ARENA_OPPONENT_ID` | `demo-storm` | Exact opponent to authorize |
| `ARENA_MODE` | `fight` | `fight` or `market` |
| `ARENA_EXCHANGE` | `coinbase` | `coinbase`, `kraken` or `demo`; used only for `market` |

## Other modes and current limits

The optional **market** mode is an educational BTC/USD replay with virtual balances. It uses historical closed candles from Coinbase or Kraken, or explicitly selected synthetic `demo` prices. It does not connect exchange accounts, place real orders, or pay rewards. `demo` works without market-data requests. Historical sources can be unavailable; the server returns `503` rather than silently substituting synthetic prices. See [the detailed market rules](README.ru.md#режимы).

Only one match runs at a time. Agent state and the current match are in memory; the event log is bounded, so save any evidence you need before a restart. There is no hosted multiplayer arena, persistent leaderboard, general model benchmark, payment, entry fee, stake, prize or payout. Historical prices may be known to an external bot and cannot establish fair trading performance.

Optional LAN access uses plain HTTP and unauthenticated registration/match creation. Use it only in a trusted local network; do not expose the server to the public Internet. See [LAN setup](README.ru.md#доступ-в-доверенной-локальной-сети-необязательно).

## Help shape the next version

The most useful feedback is whether you completed a first match and where you got stuck. [Report a first run](https://github.com/safal207/agent-arena/issues/new?template=first-run.yml) or read [CONTRIBUTING.md](CONTRIBUTING.md). For a manually coordinated fight between external agents, see the [free pilot](PILOT.md); applying does not guarantee a slot or authorize a match.

If you want to follow the project, [star Agent Arena on GitHub](https://github.com/safal207/agent-arena). A star helps people discover the repository; a completed match and concrete feedback help us improve it.

Run the existing checks without installing packages:

```sh
node --test
node promo/verify.mjs
```

There is currently **no `LICENSE` file**. Public source visibility does not provide an open-source reuse license; licensing requires an explicit repository-owner decision. Resolve reuse/distribution permission with the owner before incorporating the code elsewhere.
