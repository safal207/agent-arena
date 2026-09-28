import http from 'node:http';
import { randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { ACTIONS, createMatch, observationFor, resolveTurn } from './engine.mjs';
import { PAPER_ACTIONS, createPaperMatch, paperObservation, resolvePaperTurn } from './paper-engine.mjs';
import { loadMarketCandles } from './market-data.mjs';

const ROOT = dirname(fileURLToPath(import.meta.url));
const STATIC = new Map([
  ['/', ['index.html', 'text/html; charset=utf-8']],
  ['/style.css', ['style.css', 'text/css; charset=utf-8']],
  ['/app.js', ['app.js', 'text/javascript; charset=utf-8']],
]);
const configuredTimeout = Number(process.env.AGENT_TIMEOUT_MS);
const WAIT_FOR_ACTION_MS = Number.isInteger(configuredTimeout) && configuredTimeout >= 1000 && configuredTimeout <= 30000
  ? configuredTimeout : 5000;
const NEXT_POLL_HINT_MS = 400;
const betweenTurns = ms => new Promise(resolve => setTimeout(resolve, ms));

function json(res, status, value) {
  const body = JSON.stringify(value);
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
  });
  res.end(body);
}

async function bodyJson(req) {
  let raw = '';
  for await (const chunk of req) {
    raw += chunk.toString('utf8');
    if (Buffer.byteLength(raw) > 8192) {
      const error = new Error('Request body is too large');
      error.status = 413;
      throw error;
    }
  }
  try { return JSON.parse(raw); }
  catch {
    const error = new Error('Invalid JSON');
    error.status = 400;
    throw error;
  }
}

function authorized(req, agent) {
  const presented = req.headers.authorization?.match(/^Bearer ([a-f0-9]{64})$/)?.[1];
  if (!presented || !agent?.token) return false;
  return timingSafeEqual(Buffer.from(presented), Buffer.from(agent.token));
}

function demoAction(agent, observation) {
  const { self, opponent, turn } = observation;
  const distance = Math.abs(self.x - opponent.x);
  if (agent.style === 'guardian' && turn % 4 === 0 && distance < 35) return 'guard';
  if (self.energy < 20 && distance < 30) return 'guard';
  if (distance > 30) return 'approach';
  if (agent.style === 'storm' && self.energy >= 34 && distance <= 34 && turn % 3 === 0) return 'special';
  if (distance <= 27 && self.energy >= 19) return 'kick';
  if (distance <= 17 && self.energy >= 10) return 'jab';
  return 'approach';
}

function demoMarketAction(agent, observation) {
  const prices = observation.recentPrices;
  const previous = prices.length > 1 ? prices[prices.length - 2] : observation.price;
  const rising = observation.price >= previous;
  if (agent.style === 'storm') {
    if (rising && observation.self.cash >= 1) return 'buy';
    if (!rising && observation.self.units > 0) return 'sell';
  } else {
    if (!rising && observation.self.cash >= 1) return 'buy';
    if (rising && observation.self.units > 0) return 'sell';
  }
  return 'hold';
}

export function createArenaServer({ loadCandles = loadMarketCandles } = {}) {
  const agents = new Map();
  const addDemo = (id, name, style) => agents.set(id, { id, name, type: 'demo', style, lastSeen: Date.now() });
  addDemo('demo-storm', 'Шторм', 'storm');
  addDemo('demo-guardian', 'Страж', 'guardian');
  let match = null;
  let startingMatch = false;

  function isConnected(agent) {
    return agent.type === 'demo' || Date.now() - agent.lastSeen < 15000;
  }

  function ownersAuthorized(left, right, mode, exchange) {
    const authorizedFor = (agent, opponent) => agent.type !== 'external' ||
      (agent.readyAgainst === opponent.id && agent.readyMode === mode &&
        (mode !== 'market' || agent.readyExchange === exchange));
    return authorizedFor(left, right) && authorizedFor(right, left);
  }

  function state() {
    return {
      agents: [...agents.values()].map(agent => ({
        id: agent.id,
        name: agent.name,
        type: agent.type,
        connected: isConnected(agent),
        ready: agent.type === 'demo' || Boolean(agent.readyAgainst),
        readyAgainst: agent.type === 'demo' ? null : agent.readyAgainst,
        readyMode: agent.type === 'demo' ? null : agent.readyMode,
        readyExchange: agent.type === 'demo' ? null : agent.readyExchange,
      })),
      match,
    };
  }

  function awaitAgentAction(agent, observation, matchId, turn, mode) {
    const actions = mode === 'market' ? PAPER_ACTIONS : ACTIONS;
    const fallback = mode === 'market' ? 'hold' : 'guard';
    if (agent.type === 'demo') return Promise.resolve({
      action: mode === 'market' ? demoMarketAction(agent, observation) : demoAction(agent, observation),
      timedOut: false,
    });
    return new Promise(resolve => {
      let settled = false;
      const finish = (action, timedOut = false) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        agent.pending = null;
        resolve({ action, timedOut });
      };
      const timer = setTimeout(() => finish(fallback, true), WAIT_FOR_ACTION_MS);
      agent.pending = {
        matchId,
        turn,
        mode,
        observation,
        actions,
        delivered: false,
        finish,
      };
    });
  }

  async function runMatch(leftAgent, rightAgent, dataset = null) {
    const matchId = match.id;
    while (match?.id === matchId && match.status === 'running') {
      const current = match;
      const turn = current.turn + 1;
      const isMarket = current.mode === 'market';
      const candle = isMarket ? dataset.candles[current.turn] : null;
      const [leftDecision, rightDecision] = await Promise.all([
        awaitAgentAction(leftAgent, isMarket ? paperObservation(current, 'left', candle) : observationFor(current, 'left'), current.id, turn, current.mode || 'fight'),
        awaitAgentAction(rightAgent, isMarket ? paperObservation(current, 'right', candle) : observationFor(current, 'right'), current.id, turn, current.mode || 'fight'),
      ]);
      match = isMarket
        ? resolvePaperTurn(current, leftDecision.action, rightDecision.action, candle)
        : resolveTurn(current, leftDecision.action, rightDecision.action);
      const timeoutEvents = [
        leftDecision.timedOut ? { turn, text: `${leftAgent.name}: время ответа вышло, ${isMarket ? 'держит позицию' : 'автоматическая защита'}.` } : null,
        rightDecision.timedOut ? { turn, text: `${rightAgent.name}: время ответа вышло, ${isMarket ? 'держит позицию' : 'автоматическая защита'}.` } : null,
      ].filter(Boolean);
      if (timeoutEvents.length) match.events = [...match.events, ...timeoutEvents].slice(-36);
      if (isMarket && match.status === 'finished') {
        match.market.replay = dataset.candles;
      }
      await betweenTurns(700);
    }
  }

  const server = http.createServer(async (req, res) => {
    const pathname = new URL(req.url || '/', 'http://localhost').pathname;
    try {
      if (req.method === 'GET' && STATIC.has(pathname)) {
        const [filename, type] = STATIC.get(pathname);
        const content = await readFile(join(ROOT, 'public', filename));
        res.writeHead(200, { 'content-type': type, 'x-content-type-options': 'nosniff' });
        res.end(content);
        return;
      }

      if (req.method === 'GET' && pathname === '/api/state') {
        json(res, 200, state());
        return;
      }

      if (req.method === 'POST' && pathname === '/api/agents') {
        if (agents.size >= 128) { json(res, 429, { error: 'Agent limit reached' }); return; }
        const body = await bodyJson(req);
        const name = body && typeof body.name === 'string' ? body.name.trim() : '';
        if (name.length < 2 || name.length > 32) {
          json(res, 400, { error: 'Name must contain 2–32 characters' });
          return;
        }
        const agent = {
          id: randomUUID(),
          token: randomBytes(32).toString('hex'),
          name,
          type: 'external',
          lastSeen: 0,
          readyAgainst: null,
          readyMode: null,
          readyExchange: null,
          pending: null,
        };
        agents.set(agent.id, agent);
        json(res, 201, { id: agent.id, token: agent.token, pollMs: NEXT_POLL_HINT_MS });
        return;
      }

      const nextMatch = pathname.match(/^\/api\/agents\/([a-f0-9-]+)\/next$/);
      if (req.method === 'GET' && nextMatch) {
        const agent = agents.get(nextMatch[1]);
        if (!authorized(req, agent) || agent.type !== 'external') {
          json(res, 401, { error: 'Invalid agent token' });
          return;
        }
        agent.lastSeen = Date.now();
        if (agent.pending) {
          agent.pending.delivered = true;
          const { matchId, turn, mode, observation, actions } = agent.pending;
          json(res, 200, { matchId, turn, mode, observation, actions });
        } else {
          json(res, 200, { waiting: true, pollMs: NEXT_POLL_HINT_MS });
        }
        return;
      }

      const actionMatch = pathname.match(/^\/api\/agents\/([a-f0-9-]+)\/action$/);
      if (req.method === 'POST' && actionMatch) {
        const agent = agents.get(actionMatch[1]);
        if (!authorized(req, agent) || agent.type !== 'external') {
          json(res, 401, { error: 'Invalid agent token' });
          return;
        }
        agent.lastSeen = Date.now();
        const body = await bodyJson(req);
        const pending = agent.pending;
        if (!pending || !pending.delivered || body?.matchId !== pending.matchId || body.turn !== pending.turn) {
          json(res, 409, { error: 'No matching decision is pending' });
          return;
        }
        if (!pending.actions.includes(body.action)) {
          json(res, 400, { error: 'Unknown action', actions: pending.actions });
          return;
        }
        pending.finish(body.action);
        json(res, 200, { ok: true });
        return;
      }

      const readyMatch = pathname.match(/^\/api\/agents\/([a-f0-9-]+)\/ready$/);
      if (req.method === 'POST' && readyMatch) {
        const agent = agents.get(readyMatch[1]);
        if (!authorized(req, agent) || agent.type !== 'external') {
          json(res, 401, { error: 'Invalid agent token' });
          return;
        }
        if (match?.status === 'running' && [match.left.agentId, match.right.agentId].includes(agent.id)) {
          json(res, 409, { error: 'Agent is already fighting' });
          return;
        }
        const body = await bodyJson(req);
        if (body?.ready === false) {
          agent.lastSeen = Date.now();
          agent.readyAgainst = null;
          agent.readyMode = null;
          agent.readyExchange = null;
          json(res, 200, { ok: true, ready: false, opponentAgentId: null, mode: null, exchange: null });
          return;
        }
        const readyMode = body?.mode ?? 'fight';
        if (readyMode !== 'fight' && readyMode !== 'market') {
          json(res, 400, { error: 'Mode must be fight or market' });
          return;
        }
        const readyExchange = readyMode === 'market' ? body?.exchange ?? 'coinbase' : null;
        if (readyMode === 'market' && !['coinbase', 'kraken', 'demo'].includes(readyExchange)) {
          json(res, 400, { error: 'Exchange must be coinbase, kraken or demo' });
          return;
        }
        const opponent = agents.get(body?.opponentAgentId);
        if (!opponent || opponent.id === agent.id) {
          json(res, 400, { error: 'Choose a different registered opponentAgentId' });
          return;
        }
        agent.lastSeen = Date.now();
        agent.readyAgainst = opponent.id;
        agent.readyMode = readyMode;
        agent.readyExchange = readyExchange;
        json(res, 200, { ok: true, ready: true, opponentAgentId: opponent.id, mode: readyMode, exchange: readyExchange });
        return;
      }

      if (req.method === 'POST' && pathname === '/api/matches') {
        if (match?.status === 'running' || startingMatch) { json(res, 409, { error: 'A match is running or starting' }); return; }
        const body = await bodyJson(req);
        const mode = body?.mode ?? 'fight';
        if (mode !== 'fight' && mode !== 'market') {
          json(res, 400, { error: 'Mode must be fight or market' });
          return;
        }
        const exchange = mode === 'market' ? body?.exchange : null;
        if (mode === 'market' && !['coinbase', 'kraken', 'demo'].includes(exchange)) {
          json(res, 400, { error: 'Exchange must be coinbase, kraken or demo' });
          return;
        }
        const left = agents.get(body?.leftAgentId);
        const right = agents.get(body?.rightAgentId);
        if (!left || !right || left.id === right.id) {
          json(res, 400, { error: 'Choose two different registered agents' });
          return;
        }
        if (!isConnected(left) || !isConnected(right)) {
          json(res, 409, { error: 'Both external agents must be online' });
          return;
        }
        if (!ownersAuthorized(left, right, mode, exchange)) {
          json(res, 409, { error: 'Each owner must authorize this opponent, mode and market source for one match' });
          return;
        }
        if (match?.status === 'running' || startingMatch) { json(res, 409, { error: 'A match is running or starting' }); return; }
        startingMatch = true;
        try {
          let dataset = null;
          if (mode === 'market') {
            try { dataset = await loadCandles(exchange); }
            catch (error) {
              console.error('Market data unavailable:', error);
              json(res, 503, { error: 'Не удалось загрузить закрытые котировки выбранного источника. Попробуйте позже или выберите демо-данные.' });
              return;
            }
          }
          if (!isConnected(left) || !isConnected(right) || !ownersAuthorized(left, right, mode, exchange)) {
            json(res, 409, { error: 'Agents disconnected or match authorization was revoked' });
            return;
          }
          match = mode === 'market'
            ? createPaperMatch(randomUUID(), left, right, dataset)
            : createMatch(randomUUID(), left, right);
          if (left.type === 'external') { left.readyAgainst = null; left.readyMode = null; left.readyExchange = null; }
          if (right.type === 'external') { right.readyAgainst = null; right.readyMode = null; right.readyExchange = null; }
          const createdId = match.id;
          void runMatch(left, right, dataset).catch(error => {
            console.error('Match failed:', error);
            if (match?.id === createdId && match.status === 'running') {
              match = { ...match, status: 'finished', events: [...match.events, { turn: match.turn, text: 'Бой остановлен из-за ошибки сервера.' }] };
            }
          });
          json(res, 201, { id: match.id, mode, status: match.status });
        } finally {
          startingMatch = false;
        }
        return;
      }

      json(res, 404, { error: 'Not found' });
    } catch (error) {
      const status = error.status || 500;
      if (status === 500) console.error(error);
      if (!res.headersSent) json(res, status, { error: status === 500 ? 'Server error' : error.message });
    }
  });

  return server;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const host = process.env.HOST || '127.0.0.1';
  const port = Number(process.env.PORT || 3000);
  const server = createArenaServer();
  server.listen(port, host, () => {
    console.log(`Арена агентов: http://${host}:${server.address().port}`);
  });
}
