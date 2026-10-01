import http from 'node:http';
import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { readFile, writeFile, rename, unlink } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads';
import { setTimeout as pause } from 'node:timers/promises';
import { createArenaServer } from '../server.mjs';
import { ACTIONS, createMatch, observationFor, resolveTurn } from '../engine.mjs';
import { createTurnResponder } from './decision.mjs';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const SOURCE_FILES = ['server.mjs', 'engine.mjs', 'examples/decision.mjs', 'examples/external-duel.mjs'];

function rush({ observation: { self, opponent } }) {
  const distance = Math.abs(self.x - opponent.x);
  if (distance > 34) return 'approach';
  if (self.energy >= 34) return 'special';
  if (distance <= 27 && self.energy >= 19) return 'kick';
  if (distance <= 17 && self.energy >= 10) return 'jab';
  return distance > 17 ? 'approach' : 'guard';
}

function sentinel({ observation: { self, opponent, turn } }) {
  const distance = Math.abs(self.x - opponent.x);
  if (distance > 27) return 'approach';
  if (turn % 3 === 0 || self.energy < 19) return 'guard';
  return 'kick';
}

function frameFor(match) {
  return {
    turn: match.turn,
    status: match.status,
    winnerAgentId: match.winnerAgentId,
    left: structuredClone(match.left),
    right: structuredClone(match.right),
    events: match.events.filter(event => event.turn === match.turn).map(event => event.text),
  };
}

export function verifyExternalReplay(replay) {
  assert.equal(replay.schemaVersion, 1);
  assert.equal(replay.mode, 'fight');
  assert.deepEqual(replay.agentTypes, ['external', 'external']);
  assert.equal(replay.provenance.kind, 'single-runner-scripted-http-duel');
  assert.equal(replay.provenance.modelCalls, 0);
  assert.ok(replay.frames.length > 1);
  const first = replay.frames[0];
  assert.equal(first.left.name, 'Rush');
  assert.equal(first.right.name, 'Sentinel');
  let expected = createMatch(replay.matchId,
    { id: first.left.agentId, name: first.left.name },
    { id: first.right.agentId, name: first.right.name });
  assert.equal(replay.maxTurns, expected.maxTurns);
  assert.deepEqual(first, frameFor(expected));
  const acceptedActions = { Rush: 0, Sentinel: 0 };
  assert.equal(replay.decisions.length, (replay.frames.length - 1) * 2);
  for (const [index, frame] of replay.frames.slice(1).entries()) {
    const turn = index + 1;
    const decisions = replay.decisions.filter(decision => decision.turn === turn);
    assert.equal(decisions.length, 2);
    const [left, right] = ['left', 'right'].map(side => {
      const decision = decisions.find(value => value.agentId === expected[side].agentId);
      assert.ok(decision);
      assert.equal(decision.name, expected[side].name);
      assert.equal(decision.matchId, replay.matchId);
      assert.equal(decision.mode, 'fight');
      assert.equal(decision.accepted, true);
      assert.equal(decision.statusCode, 200);
      assert.deepEqual(decision.allowedActions, ACTIONS);
      assert.ok(ACTIONS.includes(decision.action));
      assert.deepEqual(decision.observation, observationFor(expected, side));
      acceptedActions[decision.name]++;
      return decision;
    });
    expected = resolveTurn(expected, left.action, right.action);
    assert.deepEqual(frame, frameFor(expected));
  }
  assert.equal(expected.status, 'finished');
  assert.equal(replay.winnerAgentId, expected.winnerAgentId);
  assert.deepEqual(replay.evidence.acceptedActions, acceptedActions);
  assert.equal(replay.evidence.serverTimeoutCount, 0);
  assert.equal(replay.evidence.decisionTimeoutCount, 0);
  for (const [side, opponent] of [['left', 'right'], ['right', 'left']]) {
    const authorization = replay.evidence.authorization.find(value => value.agentId === first[side].agentId);
    assert.deepEqual(authorization, {
      agentId: first[side].agentId,
      name: first[side].name,
      opponentAgentId: first[opponent].agentId,
      mode: 'fight',
      granted: true,
      consumed: true,
    });
  }
  assert.deepEqual(Object.keys(replay.provenance.sourceHashes).sort(), [...SOURCE_FILES].sort());
  for (const hash of Object.values(replay.provenance.sourceHashes)) assert.match(hash, /^[a-f0-9]{64}$/);
  return { frames: replay.frames.length, turns: expected.turn, acceptedActions, timeoutCount: 0 };
}

async function writeVerifiedReplay(outputPath, replay) {
  verifyExternalReplay(replay);
  const target = resolve(outputPath);
  const temporary = `${target}.${randomUUID()}.tmp`;
  try {
    await writeFile(temporary, `${JSON.stringify(replay, null, 2)}\n`, { flag: 'wx' });
    await rename(temporary, target);
  } finally {
    await unlink(temporary).catch(error => { if (error.code !== 'ENOENT') throw error; });
  }
}

export async function runExternalDuel({ outputPath, maxDurationMs = 45000 } = {}) {
  if (!Number.isInteger(maxDurationMs) || maxDurationMs < 1 || maxDurationMs > 120000) {
    throw new Error('Duel deadline must be an integer from 1 to 120000 ms');
  }
  const controller = new AbortController();
  const deadline = setTimeout(() => controller.abort(new Error('External duel deadline exceeded')), maxDurationMs);
  const worker = new Worker(new URL(import.meta.url), {
    workerData: { startArena: true },
    // The proof's 4-second client budget targets the default 5-second server deadline.
    env: { ...process.env, AGENT_TIMEOUT_MS: '5000' },
  });
  const sockets = new http.Agent({ keepAlive: true });
  const tokens = [];
  try {
    const baseUrl = await new Promise((yes, no) => {
      const aborted = () => no(controller.signal.reason);
      controller.signal.addEventListener('abort', aborted, { once: true });
      worker.once('message', ({ url }) => {
        controller.signal.removeEventListener('abort', aborted);
        yes(url);
      });
      worker.once('error', no);
      worker.once('exit', code => { if (code !== 0) no(new Error('Isolated arena stopped before startup')); });
    });
    const api = (path, { method = 'GET', body, token } = {}) => new Promise((yes, no) => {
      const json = body === undefined ? undefined : JSON.stringify(body);
      const request = http.request(new URL(path, baseUrl), {
        method,
        agent: sockets,
        signal: controller.signal,
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...(json ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(json) } : {}),
        },
      }, response => {
        let raw = '';
        response.setEncoding('utf8');
        response.on('data', chunk => { raw += chunk; });
        response.on('error', no);
        response.on('end', () => {
          if (response.statusCode < 200 || response.statusCode >= 300) {
            no(new Error(`Local arena request failed: HTTP ${response.statusCode}`));
            return;
          }
          try { yes({ statusCode: response.statusCode, body: JSON.parse(raw) }); }
          catch { no(new Error('Local arena returned invalid JSON')); }
        });
      });
      request.on('error', () => no(controller.signal.aborted ? controller.signal.reason : new Error('Local arena request failed')));
      request.end(json);
    });
    const state = async () => (await api('/api/state')).body;
    const clients = [];
    const decisions = [];
    for (const [name, selector] of [['Rush', rush], ['Sentinel', sentinel]]) {
      const { body: registration } = await api('/api/agents', { method: 'POST', body: { name } });
      assert.equal(typeof registration.id, 'string');
      assert.match(registration.token, /^[a-f0-9]{64}$/);
      tokens.push(registration.token);
      const client = { name, id: registration.id, token: registration.token };
      client.next = async () => (await api(`/api/agents/${client.id}/next`, { token: client.token })).body;
      client.answer = createTurnResponder(selector, async (job, action) => {
        const response = await api(`/api/agents/${client.id}/action`, {
          method: 'POST', token: client.token,
          body: { matchId: job.matchId, turn: job.turn, action },
        });
        assert.equal(response.body.ok, true);
        decisions.push({ agentId: client.id, name, matchId: job.matchId, turn: job.turn,
          mode: job.mode, observation: job.observation, allowedActions: job.actions,
          action, accepted: true, statusCode: response.statusCode });
      }, { timeoutMs: 4000 });
      clients.push(client);
      assert.equal((await client.next()).waiting, true);
    }
    const authorization = [];
    for (const [index, client] of clients.entries()) {
      const opponentAgentId = clients[1 - index].id;
      const ready = await api(`/api/agents/${client.id}/ready`, {
        method: 'POST', token: client.token, body: { opponentAgentId, mode: 'fight' },
      });
      assert.equal(ready.body.ready, true);
      assert.equal(ready.body.opponentAgentId, opponentAgentId);
      authorization.push({ agentId: client.id, name: client.name, opponentAgentId, mode: 'fight', granted: true, consumed: false });
    }
    const created = await api('/api/matches', {
      method: 'POST', body: { leftAgentId: clients[0].id, rightAgentId: clients[1].id, mode: 'fight' },
    });
    assert.equal(created.statusCode, 201);
    let current = await state();
    assert.equal(current.match.turn, 0);
    for (const grant of authorization) {
      const agent = current.agents.find(value => value.id === grant.agentId);
      assert.equal(agent.type, 'external');
      assert.equal(agent.readyAgainst, null);
      assert.equal(agent.readyMode, null);
      grant.consumed = true;
    }
    const frames = [frameFor(current.match)];
    while (current.match.status === 'running') {
      if (controller.signal.aborted) throw controller.signal.reason;
      const jobs = await Promise.all(clients.map(client => client.next()));
      await Promise.all(jobs.map((job, index) => job.waiting ? null : clients[index].answer(job)));
      current = await state();
      const previousTurn = frames.at(-1).turn;
      if (current.match.turn !== previousTurn) {
        assert.equal(current.match.turn, previousTurn + 1, 'A resolved frame was missed');
        frames.push(frameFor(current.match));
      }
      if (current.match.status === 'running') await pause(30, undefined, { signal: controller.signal });
    }
    const sourceHashes = Object.fromEntries(await Promise.all(SOURCE_FILES.map(async name =>
      [name, createHash('sha256').update(await readFile(resolve(ROOT, name))).digest('hex')])));
    const replay = {
      schemaVersion: 1,
      provenance: {
        kind: 'single-runner-scripted-http-duel',
        description: 'One local runner controls two named scripted HTTP clients. An unchanged createArenaServer runs in an isolated localhost worker; these are not independent owners or model-backed agents.',
        capturedAt: new Date().toISOString(),
        nodeVersion: process.version,
        modelCalls: 0,
        serverTimeoutMs: 5000,
        clientDecisionTimeoutMs: 4000,
        sourceHashes,
        nonClaims: ['No independent community pilot', 'No model quality benchmark', 'No hosted public match server'],
      },
      mode: 'fight', agentTypes: ['external', 'external'], matchId: current.match.id,
      maxTurns: current.match.maxTurns, winnerAgentId: current.match.winnerAgentId,
      frames,
      decisions: decisions.sort((a, b) => a.turn - b.turn || (a.name === 'Rush' ? -1 : 1)),
      evidence: {
        acceptedActions: Object.fromEntries(clients.map(client => [client.name, decisions.filter(decision => decision.agentId === client.id).length])),
        serverTimeoutCount: frames.flatMap(frame => frame.events).filter(text => text.includes('время ответа вышло')).length,
        decisionTimeoutCount: 0,
        authorization,
      },
    };
    const serialized = JSON.stringify(replay);
    for (const token of tokens) assert.equal(serialized.includes(token), false, 'Replay contains credentials');
    verifyExternalReplay(replay);
    if (outputPath) await writeVerifiedReplay(outputPath, replay);
    return replay;
  } finally {
    clearTimeout(deadline);
    controller.abort();
    sockets.destroy();
    let onStopped;
    const stopped = new Promise(resolveStopped => {
      onStopped = message => { if (message.stopped) resolveStopped(); };
      worker.on('message', onStopped);
    });
    worker.postMessage({ stop: true });
    await Promise.race([stopped, pause(200)]);
    worker.off('message', onStopped);
    // Worker termination also cancels any private match timers after an error/deadline.
    await worker.terminate();
  }
}

if (!isMainThread && workerData?.startArena) {
  const server = createArenaServer();
  parentPort.once('message', () => {
    server.closeAllConnections();
    server.close(() => parentPort.postMessage({ stopped: true }));
  });
  server.listen(0, '127.0.0.1', () => parentPort.postMessage({ url: `http://127.0.0.1:${server.address().port}` }));
} else if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  const args = process.argv.slice(2);
  if (args.length && (args.length !== 2 || args[0] !== '--output' || !args[1])) {
    console.error('Usage: node examples/external-duel.mjs [--output PATH]');
    process.exitCode = 1;
  } else {
    runExternalDuel({ outputPath: args[1] }).then(replay => {
      const verification = verifyExternalReplay(replay);
      console.log(JSON.stringify({ status: 'PASS', scope: 'One runner, two scripted HTTP clients; no models or independent owners',
        ...verification, authorizationConsumed: replay.evidence.authorization.every(value => value.consumed),
        ...(args[1] ? { output: resolve(args[1]) } : {}) }));
    }).catch(() => {
      // Keep assertion details, provider data and credentials out of CLI output.
      console.error('External duel failed; no verified replay was written. Check the local setup and try again.');
      process.exitCode = 1;
    });
  }
}
