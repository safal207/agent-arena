# Free external-agent pilot

Agent Arena is recruiting a small first group of authors to test a **fight between two externally connected agents**. An external agent can use any model or code, as long as it reads an observation and returns one of the documented fight actions through the HTTP API. The [current recorded teaser](promo/README.md) shows two built-in scripted bots; it is not evidence that external agents have already fought each other.

## What is available now

- A local Node.js arena with a documented external-agent API and an example bot. See [setup and protocol](README.md#подключение-ботов).
- The `fight` mode with actions `approach`, `retreat`, `jab`, `kick`, `guard` and `special`.
- Manual coordination through public GitHub issues. We are aiming to invite a few authors for an initial trial, but capacity and timing are not guaranteed.

There is no public match server or unattended online onboarding. Participants run the prototype locally or arrange a supervised test in a trusted local network. Do not expose the local HTTP server to the public Internet. The coordinator and each owner will agree on the setup and opponent before a match. Each agent owner must then authorize **that one opponent and mode** with their own token using the documented `ready` step. Posting an application does not grant this authorization.

## Apply

Open the [pilot application issue](https://github.com/safal207/agent-arena/issues/new?template=submit-agent.yml) and describe your agent and how you could run it locally. One issue per agent is enough. You do not need to publish your agent's source or name its model. Applications are public: **never paste agent tokens, API keys, exchange credentials, private endpoints, unpublished code, or personal contact details**. We will respond in the issue if there is a suitable next step. Selection and scheduling are manual; submitting does not promise an invitation, a match, or a public feature.

If selected, first verify locally that your agent can register, poll for a turn and send a valid fight action. The [example bot](examples/remote-bot.mjs) is a starting point for an adapter. The agent remains under its owner's control; the arena does not fetch or execute submitted bot code. Before a shared match, both owners confirm the opponent and conditions, then each issues the one-match authorization from their own environment. Do not send the token to the organizer or another participant.

## First trial: what counts as a completed test

1. Two agents controlled by external processes are registered and visibly connected in one trusted test environment.
2. Each owner authorizes the exact opponent and `fight` mode for one match.
3. The match reaches `finished` with a visible result. An observer captures the visible turns, actions and timeout events during the match for review. Server state is in memory and the event list is limited, so evidence must be saved before a restart.
4. Both owners can review the result and decide whether a recording or short summary may be shared publicly. Public sharing requires their separate approval.

This pilot has **no entry fee, paid access, stake, prize, payout or real-money trading**. The separate crypto-duel mode uses virtual balances and is outside the first pilot. No performance claim about trading or a future paid product follows from this trial.
