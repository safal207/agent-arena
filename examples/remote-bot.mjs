import { createTurnResponder, DecisionError, parseDecisionTimeout } from './decision.mjs';

const baseUrl = new URL(process.env.ARENA_URL ?? "http://127.0.0.1:3000");
const name = process.env.BOT_NAME || `Demo Bot ${process.pid}`;
const mode = process.env.ARENA_MODE || "fight";
const exchange = process.env.ARENA_EXCHANGE || "coinbase";
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function api(path, { method = "GET", token, body } = {}) {
  const response = await fetch(new URL(path, baseUrl), {
    method,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(10_000),
  });
  const result = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(`${method} ${path}: HTTP ${response.status} — ${result?.error ?? "unknown error"}`);
  }
  return result;
}

// Replace this function with a sync or async call to your own agent/model.
// For async network calls, accept the second { signal } argument and pass it to fetch.
function chooseAction({ observation, actions }) {
  if (!Array.isArray(actions) || actions.length === 0) {
    throw new Error("Server returned no allowed actions");
  }
  if (actions.includes("hold")) {
    const prices = observation.recentPrices;
    const previous = prices.length > 1 ? prices[prices.length - 2] : observation.price;
    if (observation.price > previous && observation.self.cash >= 1) return "buy";
    if (observation.price < previous && observation.self.units > 0) return "sell";
    return "hold";
  }
  const { self, opponent } = observation;
  const distance = Math.abs(self.x - opponent.x);
  const preferred =
    self.energy < 10
      ? ["guard", "retreat"]
      : distance > 34
        ? ["approach", "guard"]
        : self.energy >= 34
          ? ["special", "kick", "jab", "guard"]
          : self.energy >= 19 && distance <= 27
            ? ["kick", "jab", "guard"]
            : self.energy >= 10 && distance <= 17
              ? ["jab", "guard"]
              : distance > 17
                ? ["approach", "guard"]
                : ["guard", "retreat"];
  return preferred.find((action) => actions.includes(action)) ?? actions[0];
}

async function main() {
  const decisionTimeoutMs = parseDecisionTimeout(process.env.BOT_DECISION_TIMEOUT_MS);
  if (mode !== "fight" && mode !== "market") {
    throw new Error("ARENA_MODE must be fight or market");
  }
  if (mode === "market" && !["coinbase", "kraken", "demo"].includes(exchange)) {
    throw new Error("ARENA_EXCHANGE must be coinbase, kraken or demo");
  }
  const savedId = process.env.ARENA_AGENT_ID;
  const savedToken = process.env.ARENA_AGENT_TOKEN;
  if (Boolean(savedId) !== Boolean(savedToken)) {
    throw new Error("Set both ARENA_AGENT_ID and ARENA_AGENT_TOKEN to reuse an agent");
  }
  const { id, token } = savedId && savedToken
    ? { id: savedId, token: savedToken }
    : await api("/api/agents", { method: "POST", body: { name } });
  if (!id || !token) throw new Error("Registration did not return an ID and token");

  const opponentAgentId = process.env.ARENA_OPPONENT_ID || "demo-storm";
  await api(`/api/agents/${encodeURIComponent(id)}/ready`, {
    method: "POST", token, body: { opponentAgentId, mode, ...(mode === "market" ? { exchange } : {}) },
  });

  console.log(`Registered: ${name}`);
  console.log(`Agent ID: ${id}`);
  console.log(`Token (keep private): ${token}`);
  console.log(`Ready for one ${mode} match against ${opponentAgentId}${mode === "market" ? ` using ${exchange}` : ""}. Restart with this ID and token to authorize another. Press Ctrl+C to stop.`);

  const answerTurn = createTurnResponder(chooseAction, async (job, action) => {
    await api(`/api/agents/${encodeURIComponent(id)}/action`, {
      method: "POST",
      token,
      body: { matchId: job.matchId, turn: job.turn, action },
    });
  }, { timeoutMs: decisionTimeoutMs });
  while (true) {
    try {
      const job = await api(`/api/agents/${encodeURIComponent(id)}/next`, { token });
      if (!job.waiting) {
        const submitted = await answerTurn(job);
        if (submitted) console.log(`${submitted.turnKey} -> ${submitted.action}`);
      }
      await pause(400);
    } catch (error) {
      console.error(error instanceof DecisionError ? `${error.message}; skipped turn.` : error.message);
      await pause(error instanceof DecisionError ? 400 : 1_500);
    }
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
