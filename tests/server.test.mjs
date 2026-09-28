import test from 'node:test';
import assert from 'node:assert/strict';
import { createArenaServer } from '../server.mjs';

const pause = ms => new Promise(resolve => setTimeout(resolve, ms));

test('an external bot can join, act, and finish a network match', { timeout: 60000 }, async () => {
  const server = createArenaServer();
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    const initial = await (await fetch(`${base}/api/state`)).json();
    assert.equal(initial.agents.length, 2);
    assert.equal(initial.match, null);

    const createdResponse = await fetch(`${base}/api/agents`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Тестер' }),
    });
    assert.equal(createdResponse.status, 201);
    const { id, token } = await createdResponse.json();
    const path = `${base}/api/agents/${id}`;
    const headers = { authorization: `Bearer ${token}`, 'content-type': 'application/json' };
    assert.equal((await fetch(`${path}/next`)).status, 401);
    assert.equal((await (await fetch(`${path}/next`, { headers })).json()).waiting, true);
    const online = await (await fetch(`${base}/api/state`)).json();
    assert.equal(online.agents.find(agent => agent.id === id).connected, true);
    assert.equal(online.agents.find(agent => agent.id === id).ready, false);
    assert.equal(JSON.stringify(online).includes(token), false);

    const unarmed = await fetch(`${base}/api/matches`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ leftAgentId: 'demo-storm', rightAgentId: id }),
    });
    assert.equal(unarmed.status, 409);
    const armed = await fetch(`${path}/ready`, {
      method: 'POST', headers,
      body: JSON.stringify({ opponentAgentId: 'demo-guardian' }),
    });
    assert.equal(armed.status, 200);
    const wrongOpponent = await fetch(`${base}/api/matches`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ leftAgentId: 'demo-storm', rightAgentId: id }),
    });
    assert.equal(wrongOpponent.status, 409);
    const rearmed = await fetch(`${path}/ready`, {
      method: 'POST', headers,
      body: JSON.stringify({ opponentAgentId: 'demo-storm' }),
    });
    assert.equal(rearmed.status, 200);

    const started = await fetch(`${base}/api/matches`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ leftAgentId: 'demo-storm', rightAgentId: id }),
    });
    assert.equal(started.status, 201);
    assert.equal((await (await fetch(`${base}/api/state`)).json()).agents.find(agent => agent.id === id).ready, false);
    const deadline = Date.now() + 45000;
    let turnsAnswered = 0;
    let triedInvalid = false;
    let final;
    while (Date.now() < deadline) {
      final = (await (await fetch(`${base}/api/state`)).json()).match;
      if (final.status === 'finished') break;
      const next = await (await fetch(`${path}/next`, { headers })).json();
      if (next.waiting) { await pause(100); continue; }
      if (!triedInvalid) {
        const repeated = await (await fetch(`${path}/next`, { headers })).json();
        assert.equal(repeated.matchId, next.matchId);
        assert.equal(repeated.turn, next.turn);
        const invalid = await fetch(`${path}/action`, {
          method: 'POST', headers,
          body: JSON.stringify({ matchId: next.matchId, turn: next.turn, action: 'cheat' }),
        });
        assert.equal(invalid.status, 400);
        triedInvalid = true;
      }
      const { self, opponent } = next.observation;
      const distance = Math.abs(self.x - opponent.x);
      const action = distance > 27 ? 'approach' : self.energy >= 19 ? 'kick' : 'guard';
      const actionResponse = await fetch(`${path}/action`, {
        method: 'POST', headers,
        body: JSON.stringify({ matchId: next.matchId, turn: next.turn, action }),
      });
      assert.equal(actionResponse.status, 200);
      turnsAnswered++;
    }
    assert.equal(final.status, 'finished');
    assert.ok(turnsAnswered > 0);
    assert.ok(final.events.length > 0);
    assert.ok(final.winnerAgentId === id || final.winnerAgentId === 'demo-storm' || final.winnerAgentId === null);
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
});

test('two external agents authorize each other and complete a duel', { timeout: 30000 }, async () => {
  const server = createArenaServer();
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const post = (path, body, token) => fetch(`${base}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body),
  });
  try {
    const a = await (await post('/api/agents', { name: 'Альфа' })).json();
    const b = await (await post('/api/agents', { name: 'Бета' })).json();
    const headersA = { authorization: `Bearer ${a.token}` };
    const headersB = { authorization: `Bearer ${b.token}` };
    await fetch(`${base}/api/agents/${a.id}/next`, { headers: headersA });
    await fetch(`${base}/api/agents/${b.id}/next`, { headers: headersB });
    assert.equal((await post(`/api/agents/${a.id}/ready`, { opponentAgentId: b.id }, a.token)).status, 200);
    assert.equal((await post(`/api/agents/${b.id}/ready`, { opponentAgentId: a.id }, b.token)).status, 200);
    assert.equal((await post('/api/matches', { leftAgentId: a.id, rightAgentId: b.id })).status, 201);

    let turns = 0;
    const deadline = Date.now() + 20000;
    while (Date.now() < deadline) {
      const match = (await (await fetch(`${base}/api/state`)).json()).match;
      if (match.status === 'finished') {
        assert.ok(turns >= 2);
        assert.ok(match.winnerAgentId === a.id || match.winnerAgentId === b.id || match.winnerAgentId === null);
        return;
      }
      for (const [agent, headers] of [[a, headersA], [b, headersB]]) {
        const job = await (await fetch(`${base}/api/agents/${agent.id}/next`, { headers })).json();
        if (job.waiting) continue;
        const { self, opponent } = job.observation;
        const distance = Math.abs(self.x - opponent.x);
        const action = distance > 34 ? 'approach' : self.energy >= 34 ? 'special' : self.energy >= 19 ? 'kick' : 'guard';
        assert.equal((await post(`/api/agents/${agent.id}/action`, {
          matchId: job.matchId, turn: job.turn, action,
        }, agent.token)).status, 200);
        turns++;
      }
      await pause(50);
    }
    assert.fail('Duel did not finish');
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
});
