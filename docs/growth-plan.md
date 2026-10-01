# Agent Arena: 14-day adoption experiment

This is a proposed experiment, not a record of users, traction or published outreach. Distribution text below is **UNSENT draft only**; nothing is sent by this document. Start the two-week clock when the updated README, landing page and verified first-run command are public.

Updated scope, 2026-10-01: **local integration proof achieved** for a fight between two locally owned scripted external HTTP clients through a one-command runner. This integration check and a future fight between independently owned agents are separate milestones. The local check does not establish that another builder adopted the project.

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

Channel rules checked on 2026-10-01:

| Primary source | Current constraint | Distribution decision |
| --- | --- | --- |
| [X: authenticity](https://help.x.com/en/rules-and-policies/authenticity) | Prohibits bulk unsolicited replies, irrelevant promotional replies, duplicate spam and coordinated engagement inflation | Recommend one owner-approved post on the owner's existing profile, with context and a useful first-run request; no automated mass replies or engagement exchange |
| [Show HN guidelines](https://news.ycombinator.com/showhn.html) | Projects must be something people can try; signup or landing pages alone do not qualify; owner should be present to discuss | A runnable repository may become a suitable destination after proof; a pilot signup page is not the submission |
| [Hacker News guidelines](https://news.ycombinator.com/newsguidelines.html) | Prohibits generated or AI-edited text and automated posting; discourages primarily promotional use and soliciting votes | The launch drafts in this file are **not for Hacker News**. If the owner later chooses HN, they must write and submit their own text under the current rules |

## What we are testing

**Audience:** builders who already have a script or agent and want a small, visual HTTP environment to test decisions. Start with fight mode: it has no market-data dependency and the recorded demo demonstrates its rules.

**Promise:** inspect a saved fight, run a local HTTP duel with one command, and replace a scripted strategy with your own code. The web page offers the built-in scripted recording and the saved Rush-versus-Sentinel external-client run. A public match server, leaderboard, independent-user success story and independently owned pilot are not established by that check.

## Proof milestones and launch gate

| Milestone | What it can establish | What it cannot establish | Status in this plan |
| --- | --- | --- | --- |
| Built-in recorded replay | Visitors can inspect a saved example fight | A new live match or a connected external agent | Available; explicitly label it scripted and recorded |
| Local external-versus-external runner | Two locally owned scripted clients register, authorize the agreed pair and act through HTTP until a terminal result | Independent adoption, general agent quality, model ranking or a hosted service | **PASS, 2026-10-01**; [saved evidence](../promo/external-replay.json), source hashes and result below |
| Independent first-run report | Another builder self-reports a completed local run or a reproducible blocker | All users, population conversion rate or independent audit of every claim | Not achieved by the maintainer's run |
| Independently owned two-agent pilot | Two different owners complete the agreed bounded match, with approved evidence | Broad adoption, universal reliability or comparative model ranking | Future target; not achieved by the local runner |

### Verified local result

From the repository root:

```sh
node examples/external-duel.mjs --output external-replay.json
```

The checked-in [recording and evidence](../promo/external-replay.json) were captured with `--output promo/external-replay.json` on Node.js `v24.19.0` at `2026-10-01T05:21:40.727Z`. [Open the saved final turn](https://safal207.github.io/agent-arena/promo/?replay=external&turn=11#replay).

| Check | Observed result |
| --- | --- |
| Ownership and implementation | One local runner operates two scripted external HTTP clients, Rush and Sentinel; no model calls |
| Accepted HTTP actions | Rush: 11; Sentinel: 11; total: 22 |
| Match completion | 11 turns, `finished`, draw; simultaneous knockout with both HP at 0 |
| Timeout counters | Server: 0; client decision: 0 |
| Match authorization | Both clients granted reciprocal consent for this fight; both authorizations consumed |

The artifact binds the run to these SHA-256 source hashes. They matched the corresponding local files when this result was added. Record the publication commit when it is known.

| Source | SHA-256 |
| --- | --- |
| `server.mjs` | `6edb7608d75add202921dd56d2209e512a4bde56ede52f5d9365337b8f0d239d` |
| `engine.mjs` | `2a583f6c23625bcc9d9830f42949b031fb5c1df9dcf3a0939e490dea6e0ac5ec` |
| `examples/decision.mjs` | `80f5babee6b440242d10fd8a8fd6528bcbd0353437603a078385ae0b2ae1b1d6` |
| `examples/external-duel.mjs` | `9db35ef0a142fe1c6fcabe1493fac8deb41830a32daf072c3d59a7757d60950c` |

Before releasing a launch draft, confirm that the published quickstart, runner and linked replay contain this checked result, and attach only the redacted output or recording actually produced. If source files change, rerun validation rather than carry the previous result forward. A clean local success is a launch prerequisite, not an audience metric. Confirm the intended reuse license before advertising broad open-source reuse; this plan does not choose or grant a license.

| Hypothesis | Test | Evidence that would support it |
| --- | --- | --- |
| Clear setup beats a pilot application as the first action | Put local quickstart before pilot signup; ask first-run reporters which step they reached | Independently reported completed local fights, with fewer repeated setup blockers |
| A one-command external-client run is a useful entry point | Offer the verified local runner before manual adapter setup | Independent builders report a completed runner match and explain their next desired change |
| Builders want to connect their own strategy | Offer the example bot and one explicit opponent after the runner | Reports of completed example-bot fights, then custom-adapter fights |
| A reviewed independently owned match is useful beyond the starter example | Arrange one bounded, consented fight after two different owners verify locally | Finished match, saved observations/actions/timeouts, both owners approve the public summary |
| Useful evidence creates repeat use | Share the reviewed match and ask for the next desired opponent or adapter | A second match by the same participating builder, reported voluntarily |

## Count use separately from attention

There is no built-in website analytics or remote activation telemetry. Local matches are invisible to the maintainer unless a builder voluntarily reports them. Do not claim a conversion rate from incomplete or incompatible counts.

| Metric | Collection | Interpretation |
| --- | --- | --- |
| First-run reports | Public `first-run` issues, manually reviewed and deduplicated by author | Self-reported feedback, not all users |
| Maintainer's external-versus-external runner result | Saved redacted local result with source hashes and command; add publication commit when known | Integration proof only; exclude from independent first-run and user counts |
| Independently reported built-in / runner / example / custom-bot fights | Separate stages in first-run reports | Self-reported activation evidence; keep bot type, ownership and stages distinct |
| Reviewed independently owned external-versus-external fight | Consent-approved evidence and pilot summary from two different owners | Product proof for that bounded match; a separate milestone from the local runner |
| Repeat participants | Builders voluntarily report a second completed match | Early retention signal, with small-sample limits |
| Stars | Public GitHub star count at start and end | Interest/bookmarking, not activation or retention |
| Clones and visitors, if owner traffic data is available | Owner's GitHub traffic view | A limited traffic window; clones are not completed runs |

Suggested two-week learning goal, **after** local runner proof: get **5 detailed independent first-run reports**, including **2 completed external-client runs**, and attempt **1 reviewed match between independently owned agents**. These are experiment targets, not predictions. Maintainer-authored issues and maintainer-operated bots do not count toward those targets. If few builders arrive, examine distribution; if builders arrive but stall, reproduce the first common blocker. Do not buy stars, reward stars, or require a star to participate.

## Two-week sequence

| Days | Work | Decision |
| --- | --- | --- |
| 1–2 | Verify the one-command local external-client runner and documented commands from a fresh checkout; save the exact commit and redacted result; verify replay and issue links; record the starting star count. Repository owner decides licensing before promoting broad reuse. | Does the integration pass, is first use concrete and are reuse permissions clear? |
| 3–4 | After proof and owner approval, share one short demo on the owner's existing X profile for builders who already write agents or HTTP bots. Link the runnable repository and first-run form; answer relevant questions. | Did any independent builder report a run or a specific blocker? |
| 5–6 | Review each report, reproduce the most common blocker, ship one small fix and reply with exact new instructions. | Does the fix unblock the next reporter? |
| 7–8 | Invite interested, ready builders to the manual pilot via their existing issue. Each owner retains their token and authorizes only the agreed match. | Are both external bots ready under the same conditions? |
| 9–10 | Attempt one fight between independently owned external agents. Save bounded evidence before the in-memory state disappears; seek separate approval before sharing. | Finished, blocked or inconclusive? Explain the result honestly, separately from the maintainer's runner. |
| 11–12 | Publish an owner-approved result with setup, bot type, actions and timeout limits. Offer a focused contribution task from actual feedback. | Does anyone run a second match or contribute an adapter? |
| 13–14 | Summarize counts, blockers, exact evidence and limitations. Pick one next experiment: onboarding, logs/replays or a specific adapter. | Continue based on completed runs and repeat use; report stars separately. |

## Distribution drafts for owner review — UNSENT

The drafts below use the verified local result above. They still require owner review and publication authorization. They are for the owner's own profile or another channel that permits this type of draft; they are not HN submissions. Short posts use one external-replay URL; the longer versions include setup and the first-run form.

### Russian short X post — UNSENT

> Делаю Agent Arena: локальные бои HTTP-ботов. Rush vs Sentinel — 11 ходов, 22 принятых действия, двойной нокаут. Скриптовые стратегии; дальше — твоя. Запусти пример и оставь First run: матч завершился или что помешало?
> https://safal207.github.io/agent-arena/promo/?replay=external&turn=11#replay

### English short X post — UNSENT

> I built Agent Arena: local fights for HTTP bots. Rush vs Sentinel: 11 turns, 22 accepted actions, double knockout. Scripted strategies; yours can be next. Try the runner and leave a First run report: finished or blocked?
> https://safal207.github.io/agent-arena/promo/?replay=external&turn=11#replay

### Russian technical launch draft — UNSENT

> Что выберет твой бот, когда соперник давит, а энергии осталось на один удар?
>
> Делаю Agent Arena — локальную арену для разработчиков агентов и HTTP-ботов. Бот получает здоровье, позицию и энергию обоих бойцов, затем выбирает одно из шести действий. Оба решения применяются в одном ходе; можно смотреть, как стратегия меняет результат.
>
> Из корня репозитория запусти `node examples/external-duel.mjs --output external-replay.json`. Нужен Node.js 20+; пакеты и API-ключи для этого примера не нужны. Runner поднимает локальный сервер и подключает двух моих скриптовых HTTP-ботов, Rush и Sentinel. Проверенный бой: 11 ходов, 22 принятых действия, ноль таймаутов и одновременный нокаут. Сохраняется JSON с ходами и результатом. Дальше можно заменить стратегию своим кодом.
>
> Попробуй запуск и оставь First run: матч завершился или на каком шаге остановился?
>
> Запуск: https://github.com/safal207/agent-arena#run-locally
> Запись боя: https://safal207.github.io/agent-arena/promo/?replay=external&turn=11#replay
> Отчёт: https://github.com/safal207/agent-arena/issues/new?template=first-run.yml

### English technical launch draft — UNSENT

> What does your bot choose when the opponent keeps pressing and it has energy for one more strike?
>
> I'm building Agent Arena, a local arena for agent and HTTP-bot developers. A bot receives both fighters' health, position and energy, then chooses one of six actions. Both decisions resolve in the same turn, so you can inspect how a strategy changes the fight.
>
> From the repository root, run `node examples/external-duel.mjs --output external-replay.json`. You'll need Node.js 20+; this example needs no packages or API keys. The runner starts a local server and connects two scripted HTTP clients that I operate, Rush and Sentinel. The verified fight finished in 11 turns: 22 accepted actions, zero timeouts and a simultaneous knockout. It saves a JSON replay with the turns and result. Next, replace a strategy with your own code.
>
> Try the runner and leave a First run report: did the match finish, or which step blocked you?
>
> Setup: https://github.com/safal207/agent-arena#run-locally
> Replay: https://safal207.github.io/agent-arena/promo/?replay=external&turn=11#replay
> First-run report: https://github.com/safal207/agent-arena/issues/new?template=first-run.yml

### Replay-only post — alternative, UNSENT

> I built Agent Arena: a small local playground where two bots read an observation and choose one of six fight actions over HTTP. Node.js 20+, no packages or API keys for the built-in demo.
>
> The web replay shows two built-in scripted bots. You can run it locally, then replace the example strategy with your own code or model. I'm looking for first-run feedback: can you finish one example-bot match, and which setup step is unclear?
>
> Demo: https://safal207.github.io/agent-arena/promo/
> Setup: https://github.com/safal207/agent-arena#run-locally

### Technical community post — alternative, UNSENT; check that community's rules before use

> How do you test an agent's decisions before connecting it to a larger system?
>
> Agent Arena is my small local experiment: poll an HTTP endpoint for HP, position and energy, then return an allowed action. Both fighters choose before each turn resolves; slow bots fall back to guard. It's a toy environment, not a general model benchmark.
>
> The repository includes an example adapter and tests. I'd appreciate a review of the first-run protocol, especially polling, one-match authorization and timeout handling. A useful reply is a completed local fight or one reproducible blocker.
>
> https://github.com/safal207/agent-arena

### Independently owned pilot result post — fill only after that separate milestone

> We completed [NUMBER] fight(s) between two independently owned, externally controlled bots in Agent Arena, using [COMMIT / SETUP]. [BOT TYPES] chose actions through the HTTP protocol. The saved result shows [OUTCOME] and [TIMEOUT COUNT] timeout events.
>
> This demonstrates that specific local integration path. It does not establish a model ranking, hosted availability or general reliability. Both owners approved this summary and the attached recording.
>
> Reproduce the setup: [PUBLIC LINK]. Next question: [ONE QUESTION FROM THE OBSERVED BLOCKER OR NEXT MATCH].

## First distribution action after proof

Recommended next action: the owner publishes **one** concise post on their existing X profile, in the language of the builders they intend to reach, with the verified runner command, actual redacted output or recording, repository link and first-run form. Lead with the developer task and a first-run question. Evaluate independent reports and actual blockers before choosing another channel. No post is sent by this plan.

Owner decisions needed: approve the exact result and draft, choose the account and language, confirm the intended reuse license if promoting it as open source, and explicitly authorize publication. None of these decisions establishes independent adoption. For a later independently owned pilot, agree the pair, conditions and public evidence with both participating owners separately.

Choose channels where the owner can answer technical questions. Follow each community's current rules, disclose ownership and avoid posting the same pitch across unrelated threads. A relevant conversation with two builders is a useful next step; it still does not justify claiming an active community. No growth rate, star count increase or viral outcome is predicted here.
