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
const PROVENANCE_DESCRIPTION = 'One local runner controls two named scripted HTTP clients. An unchanged createArenaServer runs in an isolated localhost worker; these are not independent owners or model-backed agents.';
const NON_CLAIMS = ['No independent community pilot', 'No model quality benchmark', 'No hosted public match server'];
const STAGES = new Set(['configuration', 'startup', 'registration', 'authorization', 'match', 'source-hashing', 'verification', 'output-write', 'output-commit', 'cleanup']);
const SAFE_CODES = new Set(['INVALID_ARGUMENT', 'DEADLINE_EXCEEDED', 'ASSERTION_FAILED', 'INVALID_RESPONSE', 'NETWORK_ERROR', 'WORKER_ERROR', 'INTERNAL_ERROR',
  'DECISION_TIMEOUT', 'DECISION_FAILED', 'INVALID_ACTION', 'INVALID_ACTIONS',
  'ENOENT', 'EACCES', 'EPERM', 'EISDIR', 'ENOTDIR', 'ENOSPC', 'EROFS', 'EMFILE', 'ENFILE', 'EEXIST']);

export class DuelFailure extends Error {
  constructor(stage, code) {
    const safeStage = STAGES.has(stage) ? stage : 'match';
    const safeCode = SAFE_CODES.has(code) || (typeof code === 'string' && /^HTTP_[45]\d{2}$/.test(code)) ? code : 'INTERNAL_ERROR';
    super(`External duel failed at ${safeStage} (${safeCode})`);
    this.name = 'DuelFailure';
    this.stage = safeStage;
    this.code = safeCode;
  }
}

function safeFailure(error, stage) {
  if (error instanceof DuelFailure) return error;
  const code = error?.code === 'ERR_ASSERTION' ? 'ASSERTION_FAILED' : error?.code;
  return new DuelFailure(stage, code);
}

export function formatDuelFailure(error) {
  // Reapply the allowlist at the output boundary even if an Error was mutated.
  const failure = new DuelFailure(error instanceof DuelFailure ? error.stage : 'match',
    error?.code === 'ERR_ASSERTION' ? 'ASSERTION_FAILED' : error?.code);
  return { status: 'FAIL', stage: failure.stage, code: failure.code };
}

function checkDeadline(signal, deadlineAt, stage) {
  if (signal?.aborted || performance.now() >= deadlineAt) throw new DuelFailure(stage, 'DEADLINE_EXCEEDED');
}

function exactKeys(value, allowed) {
  assert.ok(value && typeof value === 'object' && !Array.isArray(value), 'Replay schema requires an object');
  const keys = Object.keys(value);
  assert.ok(keys.length === allowed.length && keys.every(key => allowed.includes(key)), 'Replay schema has unexpected or missing fields');
}

function rejectCredentialStrings(value, path = []) {
  if (typeof value === 'string') {
    const sourceHash = path.length === 3 && path[0] === 'provenance' && path[1] === 'sourceHashes' && SOURCE_FILES.includes(path[2]);
    assert.ok(!/\bbearer[\s:=]+/i.test(value), 'Replay contains credential-like data');
    assert.ok(sourceHash || !/[a-f0-9]{64}/i.test(value), 'Replay contains credential-like data');
  } else if (value && typeof value === 'object') {
    for (const [key, nested] of Object.entries(value)) rejectCredentialStrings(nested, [...path, key]);
  }
}

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
  exactKeys(replay, ['schemaVersion', 'provenance', 'mode', 'agentTypes', 'matchId', 'maxTurns', 'winnerAgentId', 'frames', 'decisions', 'evidence']);
  exactKeys(replay.provenance, ['kind', 'description', 'capturedAt', 'nodeVersion', 'modelCalls', 'serverTimeoutMs', 'clientDecisionTimeoutMs', 'sourceHashes', 'nonClaims']);
  exactKeys(replay.evidence, ['acceptedActions', 'serverTimeoutCount', 'decisionTimeoutCount', 'authorization']);
  exactKeys(replay.evidence.acceptedActions, ['Rush', 'Sentinel']);
  exactKeys(replay.provenance.sourceHashes, SOURCE_FILES);
  rejectCredentialStrings(replay);
  assert.equal(replay.schemaVersion, 1);
  assert.equal(replay.mode, 'fight');
  assert.deepEqual(replay.agentTypes, ['external', 'external']);
  assert.equal(replay.provenance.kind, 'single-runner-scripted-http-duel');
  assert.equal(replay.provenance.description, PROVENANCE_DESCRIPTION);
  assert.deepEqual(replay.provenance.nonClaims, NON_CLAIMS);
  assert.match(replay.provenance.capturedAt, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
  assert.equal(new Date(replay.provenance.capturedAt).toISOString(), replay.provenance.capturedAt);
  assert.match(replay.provenance.nodeVersion, /^v\d+\.\d+\.\d+$/);
  assert.equal(replay.provenance.serverTimeoutMs, 5000);
  assert.equal(replay.provenance.clientDecisionTimeoutMs, 4000);
  assert.equal(replay.provenance.modelCalls, 0);
  assert.match(replay.matchId, /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/);
  assert.ok(Array.isArray(replay.frames) && replay.frames.length <= 37);
  assert.ok(Array.isArray(replay.decisions));
  for (const decision of replay.decisions) exactKeys(decision, ['agentId', 'name', 'matchId', 'turn', 'mode', 'observation', 'allowedActions', 'action', 'accepted', 'statusCode']);
  assert.ok(Array.isArray(replay.evidence.authorization));
  assert.equal(replay.evidence.authorization.length, 2);
  for (const authorization of replay.evidence.authorization) exactKeys(authorization, ['agentId', 'name', 'opponentAgentId', 'mode', 'granted', 'consumed']);
  assert.ok(replay.frames.length > 1);
  const first = replay.frames[0];
  for (const side of ['left', 'right']) assert.match(first[side].agentId, /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/);
  assert.notEqual(first.left.agentId, first.right.agentId);
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

export async function writeVerifiedReplay(outputPath, replay, {
  signal,
  deadlineAt = Infinity,
  writeTemporary = writeFile,
  commitTemporary = rename,
} = {}) {
  let stage = 'verification';
  checkDeadline(signal, deadlineAt, stage);
  try { verifyExternalReplay(replay); }
  catch (error) { throw safeFailure(error, stage); }
  checkDeadline(signal, deadlineAt, stage);
  const target = resolve(outputPath);
  const temporary = `${target}.${randomUUID()}.tmp`;
  let commitStarted = false;
  try {
    stage = 'output-write';
    const serialized = `${JSON.stringify(replay, null, 2)}\n`;
    checkDeadline(signal, deadlineAt, stage);
    await writeTemporary(temporary, serialized, { flag: 'wx', signal });
    stage = 'output-commit';
    checkDeadline(signal, deadlineAt, stage);
    // This is the commit boundary. Once rename starts, a later abort must not
    // delete or restore the target: rename may already have committed it.
    commitStarted = true;
    await commitTemporary(temporary, target);
  } catch (error) {
    if (!commitStarted && (signal?.aborted || performance.now() >= deadlineAt)) throw new DuelFailure(stage, 'DEADLINE_EXCEEDED');
    throw safeFailure(error, stage);
  } finally {
    await unlink(temporary).catch(error => {
      if (error.code !== 'ENOENT') throw safeFailure(error, 'cleanup');
    });
  }
}

export async function runExternalDuel({ outputPath, maxDurationMs = 45000 } = {}) {
  if (!Number.isInteger(maxDurationMs) || maxDurationMs < 1 || maxDurationMs > 120000) {
    throw new DuelFailure('configuration', 'INVALID_ARGUMENT');
  }
  let stage = 'startup';
  const deadlineAt = performance.now() + maxDurationMs;
  const controller = new AbortController();
  const deadline = setTimeout(() => controller.abort(new DuelFailure(stage, 'DEADLINE_EXCEEDED')), maxDurationMs);
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
      worker.once('error', () => no(new DuelFailure('startup', 'WORKER_ERROR')));
      worker.once('exit', code => { if (code !== 0) no(new DuelFailure('startup', 'WORKER_ERROR')); });
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
            no(new DuelFailure(stage, `HTTP_${response.statusCode}`));
            return;
          }
          try { yes({ statusCode: response.statusCode, body: JSON.parse(raw) }); }
          catch { no(new DuelFailure(stage, 'INVALID_RESPONSE')); }
        });
      });
      request.on('error', () => no(controller.signal.aborted ? controller.signal.reason : new DuelFailure(stage, 'NETWORK_ERROR')));
      request.end(json);
    });
    const state = async () => (await api('/api/state')).body;
    const clients = [];
    const decisions = [];
    stage = 'registration';
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
    stage = 'authorization';
    for (const [index, client] of clients.entries()) {
      const opponentAgentId = clients[1 - index].id;
      const ready = await api(`/api/agents/${client.id}/ready`, {
        method: 'POST', token: client.token, body: { opponentAgentId, mode: 'fight' },
      });
      assert.equal(ready.body.ready, true);
      assert.equal(ready.body.opponentAgentId, opponentAgentId);
      authorization.push({ agentId: client.id, name: client.name, opponentAgentId, mode: 'fight', granted: true, consumed: false });
    }
    stage = 'match';
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
      checkDeadline(controller.signal, deadlineAt, stage);
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
    stage = 'source-hashing';
    checkDeadline(controller.signal, deadlineAt, stage);
    const sourceHashes = Object.fromEntries(await Promise.all(SOURCE_FILES.map(async name => {
      checkDeadline(controller.signal, deadlineAt, stage);
      const source = await readFile(resolve(ROOT, name), { signal: controller.signal });
      checkDeadline(controller.signal, deadlineAt, stage);
      return [name, createHash('sha256').update(source).digest('hex')];
    })));
    checkDeadline(controller.signal, deadlineAt, stage);
    const replay = {
      schemaVersion: 1,
      provenance: {
        kind: 'single-runner-scripted-http-duel',
        description: PROVENANCE_DESCRIPTION,
        capturedAt: new Date().toISOString(),
        nodeVersion: process.version,
        modelCalls: 0,
        serverTimeoutMs: 5000,
        clientDecisionTimeoutMs: 4000,
        sourceHashes,
        nonClaims: NON_CLAIMS,
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
    stage = 'verification';
    checkDeadline(controller.signal, deadlineAt, stage);
    const serialized = JSON.stringify(replay);
    for (const token of tokens) assert.equal(serialized.includes(token), false, 'Replay contains credentials');
    verifyExternalReplay(replay);
    checkDeadline(controller.signal, deadlineAt, stage);
    if (outputPath) await writeVerifiedReplay(outputPath, replay, { signal: controller.signal, deadlineAt });
    return replay;
  } catch (error) {
    if (error instanceof DuelFailure) throw error;
    if (controller.signal.aborted || performance.now() >= deadlineAt) throw new DuelFailure(stage, 'DEADLINE_EXCEEDED');
    throw safeFailure(error, stage);
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
    let graceTimer;
    await Promise.race([stopped, new Promise(resolveStopped => { graceTimer = setTimeout(resolveStopped, 200); })]);
    clearTimeout(graceTimer);
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
    console.error(JSON.stringify(formatDuelFailure(new DuelFailure('configuration', 'INVALID_ARGUMENT'))));
    console.error('Usage: node examples/external-duel.mjs [--output PATH]');
    process.exitCode = 1;
  } else {
    runExternalDuel({ outputPath: args[1] }).then(replay => {
      const verification = verifyExternalReplay(replay);
      console.log(JSON.stringify({ status: 'PASS', scope: 'One runner, two scripted HTTP clients; no models or independent owners',
        ...verification, authorizationConsumed: replay.evidence.authorization.every(value => value.consumed),
        ...(args[1] ? { output: resolve(args[1]) } : {}) }));
    }).catch(error => {
      // Keep assertion details, provider data and credentials out of CLI output.
      console.error(JSON.stringify(formatDuelFailure(error)));
      process.exitCode = 1;
    });
  }
}
