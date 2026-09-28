import test from 'node:test';
import assert from 'node:assert/strict';
import { createArenaServer } from '../server.mjs';

const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
const dataset = {
  exchange: 'demo', symbol: 'BTC/USD', dataKind: 'demo', fetchedAt: '2026-09-27T00:00:00.000Z',
  candles: [{ time: 1, close: 100 }, { time: 2, close: 110 }, { time: 3, close: 120 }],
};

test('mode-scoped owner consent and a shared paper duel work through HTTP', { timeout: 20000 }, async () => {
  let loads = 0;
  const server = createArenaServer({ loadCandles: async exchange => {
    loads++;
    assert.equal(exchange, 'demo');
    return dataset;
  } });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const post = (path, body, token) => fetch(`${base}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body),
  });
  try {
    const registered = await (await post('/api/agents', { name: 'Трейдер' })).json();
    const agentPath = `/api/agents/${registered.id}`;
    const headers = { authorization: `Bearer ${registered.token}` };
    await fetch(`${base}${agentPath}/next`, { headers });
    const fightReady = await post(`${agentPath}/ready`, { opponentAgentId: 'demo-storm' }, registered.token);
    assert.equal(fightReady.status, 200);
    const request = { mode: 'market', exchange: 'demo', leftAgentId: registered.id, rightAgentId: 'demo-storm' };
    assert.equal((await post('/api/matches', { ...request, exchange: undefined })).status, 400);
    assert.equal((await post('/api/matches', request)).status, 409);
    assert.equal(loads, 0);
    const paperReady = await post(`${agentPath}/ready`, { opponentAgentId: 'demo-storm', mode: 'market', exchange: 'demo' }, registered.token);
    assert.equal(paperReady.status, 200);
    assert.equal((await post('/api/matches', { ...request, exchange: 'coinbase' })).status, 409);
    assert.equal(loads, 0);
    assert.equal((await post('/api/matches', request)).status, 201);
    assert.equal(loads, 1);
    const initial = (await (await fetch(`${base}/api/state`)).json()).match;
    assert.equal(initial.mode, 'market');
    assert.equal(initial.market.dataKind, 'demo');
    assert.deepEqual(initial.market.history, []);
    assert.equal(initial.market.replay, undefined);
    assert.equal((await post('/api/matches', request)).status, 409);

    let answered = 0;
    const deadline = Date.now() + 12000;
    while (Date.now() < deadline) {
      const current = (await (await fetch(`${base}/api/state`)).json()).match;
      if (current.status === 'finished') {
        assert.equal(current.turn, 3);
        assert.equal(current.market.replay.length, 3);
        assert.ok(answered > 0);
        assert.equal((await (await fetch(`${base}/api/state`)).json()).agents.find(a => a.id === registered.id).ready, false);
        return;
      }
      const job = await (await fetch(`${base}${agentPath}/next`, { headers })).json();
      if (job.waiting) { await pause(50); continue; }
      assert.equal(job.mode, 'market');
      assert.deepEqual(job.actions, ['buy', 'sell', 'hold']);
      assert.equal(job.observation.recentPrices.at(-1), job.observation.price);
      assert.ok(job.observation.recentPrices.length <= job.turn);
      const action = job.turn === 1 ? 'buy' : 'hold';
      assert.equal((await post(`${agentPath}/action`, { matchId: job.matchId, turn: job.turn, action }, registered.token)).status, 200);
      answered++;
    }
    assert.fail('Paper duel did not finish');
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
});

test('revoked consent during quote loading prevents a duel; source failure preserves consent', { timeout: 10000 }, async () => {
  let releaseLoad;
  let signalLoad;
  let loads = 0;
  const loadStarted = new Promise(resolve => { signalLoad = resolve; });
  const heldLoad = new Promise(resolve => { releaseLoad = resolve; });
  const server = createArenaServer({ loadCandles: async () => {
    loads++;
    if (loads === 1) {
      signalLoad();
      return heldLoad;
    }
    throw new Error('Exchange unavailable');
  } });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const post = (path, body, token) => fetch(`${base}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body),
  });
  try {
    const { id, token } = await (await post('/api/agents', { name: 'Трейдер' })).json();
    await fetch(`${base}/api/agents/${id}/next`, { headers: { authorization: `Bearer ${token}` } });
    const readyPath = `/api/agents/${id}/ready`;
    const request = { mode: 'market', exchange: 'coinbase', leftAgentId: id, rightAgentId: 'demo-storm' };
    assert.equal((await post(readyPath, { mode: 'market', exchange: 'coinbase', opponentAgentId: 'demo-storm' }, token)).status, 200);
    const launching = post('/api/matches', request);
    await loadStarted;
    assert.equal((await post(readyPath, { ready: false }, token)).status, 200);
    releaseLoad(dataset);
    assert.equal((await launching).status, 409);
    assert.equal((await (await fetch(`${base}/api/state`)).json()).match, null);

    assert.equal((await post(readyPath, { mode: 'market', exchange: 'coinbase', opponentAgentId: 'demo-storm' }, token)).status, 200);
    assert.equal((await post('/api/matches', request)).status, 503);
    const state = await (await fetch(`${base}/api/state`)).json();
    assert.equal(state.match, null);
    assert.equal(state.agents.find(agent => agent.id === id).readyMode, 'market');
    assert.equal(state.agents.find(agent => agent.id === id).readyExchange, 'coinbase');
  } finally {
    releaseLoad(dataset);
    await new Promise(resolve => server.close(resolve));
  }
});
