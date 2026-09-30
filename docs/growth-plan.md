# Agent Arena: 14-day adoption experiment

This is a proposed experiment, not a record of users, traction or published outreach. Distribution text below is **draft only**; nothing is sent by this document. Start the two-week clock when the updated README and landing page are public.

## Primary sources checked on 2026-09-30

These sources support the design patterns below. They do not establish that the changes will increase Agent Arena's adoption or stars; the two-week experiment tests that locally.

| Source | Supported pattern | Application here |
| --- | --- | --- |
| [GitHub: about READMEs](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/about-readmes) | Explain usefulness, setup and where to get help; use relative repository links | A concrete category, runnable commands, screenshot, protocol and feedback path |
| [GitHub: finding users](https://opensource.guide/finding-users/) | Explain the user's problem, share with relevant communities and ask for specific feedback | Builder-focused drafts and one first-run question, followed by replies and fixes |
| [GitHub: repository traffic](https://docs.github.com/en/repositories/viewing-activity-and-data-for-your-repository/viewing-traffic-to-a-repository) | Owners with push access can inspect clones, visitors and referrals; traffic uses UTC and a limited window | Capture the available 14-day traffic evidence; do not equate clones with completed matches |
| [GitHub: stars](https://docs.github.com/en/get-started/exploring-projects-on-github/saving-repositories-with-stars) | Stars help people bookmark and discover interesting projects | Optional follow CTA; keep stars separate from activation |
| [Promptfoo: getting started](https://www.promptfoo.dev/docs/getting-started/) | Start with a working example, run it, then inspect outputs before customizing | A built-in fight, the example external bot, then the user's strategy |
| [Inspect: getting started](https://inspect.aisi.org.uk/#getting-started) | Concrete setup and small examples make an evaluation framework approachable | Explicit environment requirements and a visible completed run; borrow the onboarding sequence, not benchmark claims |

## What we are testing

**Audience:** builders who already have a script or agent and want a small, visual HTTP environment to test decisions. Start with fight mode: it has no market-data dependency and the recorded demo demonstrates its rules.

**Promise:** watch a recorded fight, run the arena locally, and connect your own strategy to six fight actions. The current recording uses two built-in scripted bots. A public arena, leaderboard and external-agent success stories are not available yet.

| Hypothesis | Test | Evidence that would support it |
| --- | --- | --- |
| Clear setup beats a pilot application as the first action | Put local quickstart before pilot signup; ask first-run reporters which step they reached | Independently reported completed local fights, with fewer repeated setup blockers |
| Builders want to connect their own strategy | Offer the example bot and one explicit opponent first | Reports of completed example-bot fights, then custom-adapter fights |
| A reviewed external-bot match makes a stronger demo | Arrange one bounded, consented fight after both owners verify locally | Finished match, saved observations/actions/timeouts, both owners approve the public summary |
| Useful evidence creates repeat use | Share the reviewed match and ask for the next desired opponent or adapter | A second match by the same participating builder, reported voluntarily |

## Count use separately from attention

There is no built-in website analytics or remote activation telemetry. Local matches are invisible to the maintainer unless a builder voluntarily reports them. Do not claim a conversion rate from incomplete or incompatible counts.

| Metric | Collection | Interpretation |
| --- | --- | --- |
| First-run reports | Public `first-run` issues, manually reviewed and deduplicated by author | Self-reported feedback, not all users |
| Completed built-in / example / custom-bot fights | Separate stages in those reports | Activation evidence; keep the stages distinct |
| Reviewed external-versus-external fight | Consent-approved evidence and pilot summary | Product proof for that bounded match |
| Repeat participants | Builders voluntarily report a second completed match | Early retention signal, with small-sample limits |
| Stars | Public GitHub star count at start and end | Interest/bookmarking, not activation or retention |
| Clones and visitors, if owner traffic data is available | Owner's GitHub traffic view | A limited traffic window; clones are not completed runs |

Suggested two-week learning goal: get **5 detailed first-run reports**, including **2 completed external-example runs**, and attempt **1 reviewed external-versus-external match**. These are experiment targets, not predictions. If few builders arrive, fix distribution; if builders arrive but stall, fix the first common blocker. Do not buy stars, reward stars, or require a star to participate.

## Two-week sequence

| Days | Work | Decision |
| --- | --- | --- |
| 1–2 | Run the documented commands on a clean environment; verify replay and issue links; record the starting star count. Repository owner decides licensing before promoting broad reuse. | Is first use concrete and are reuse permissions clear? |
| 3–4 | Owner shares one approved short demo in relevant builder communities where project sharing is allowed. Lead with the problem and ask for setup feedback. | Which audience produces specific questions or first runs? |
| 5–6 | Review each report, reproduce the most common blocker, ship one small fix and reply with exact new instructions. | Does the fix unblock the next reporter? |
| 7–8 | Invite interested, ready builders to the manual pilot via their existing issue. Each owner retains their token and authorizes only the agreed match. | Are both external bots ready under the same conditions? |
| 9–10 | Attempt one external-versus-external fight. Save bounded evidence before the in-memory state disappears; seek separate approval before sharing. | Finished, blocked or inconclusive? Explain the result honestly. |
| 11–12 | Publish an owner-approved result with setup, bot type, actions and timeout limits. Offer a focused contribution task from actual feedback. | Does anyone run a second match or contribute an adapter? |
| 13–14 | Summarize counts, blockers, exact evidence and limitations. Pick one next experiment: onboarding, logs/replays or a specific adapter. | Continue based on completed runs and repeat use; report stars separately. |

## Distribution drafts for owner review

### Short demo post

> I built Agent Arena: a small local playground where two bots read an observation and choose one of six fight actions over HTTP. Node.js 20+, no packages or API keys for the built-in demo.
>
> The web replay shows two built-in scripted bots. You can run it locally, then replace the example strategy with your own code or model. I'm looking for first-run feedback: can you finish one example-bot match, and which setup step is unclear?
>
> Demo: https://safal207.github.io/agent-arena/promo/
> Setup: https://github.com/safal207/agent-arena#run-locally

### Technical community post

> How do you test an agent's decisions before connecting it to a larger system?
>
> Agent Arena is my small local experiment: poll an HTTP endpoint for HP, position and energy, then return an allowed action. Both fighters choose before each turn resolves; slow bots fall back to guard. It's a toy environment, not a general model benchmark.
>
> The repository includes an example adapter and tests. I'd appreciate a review of the first-run protocol, especially polling, one-match authorization and timeout handling. A useful reply is a completed local fight or one reproducible blocker.
>
> https://github.com/safal207/agent-arena

### Result post — fill only after a verified pilot

> We completed [NUMBER] fight(s) between two externally controlled bots in Agent Arena, using [COMMIT / SETUP]. [BOT TYPES] chose actions through the HTTP protocol. The saved result shows [OUTCOME] and [TIMEOUT COUNT] timeout events.
>
> This demonstrates that specific local integration path. It does not establish a model ranking, hosted availability or general reliability. Both owners approved this summary and the attached recording.
>
> Reproduce the setup: [PUBLIC LINK]. Next question: [ONE QUESTION FROM THE OBSERVED BLOCKER OR NEXT MATCH].

Choose channels where the owner can answer technical questions. Follow each community's current rules, disclose ownership and avoid posting the same pitch across unrelated threads. A relevant conversation with two builders is a stronger next step than an unsupported claim of an active community.
