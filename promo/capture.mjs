import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { createArenaServer } from '../server.mjs';
import { createMatch } from '../engine.mjs';

const destination = fileURLToPath(new URL('./replay.json', import.meta.url));
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
const server = createArenaServer();

function frame(match) {
  return {
    turn: match.turn,
    status: match.status,
    winnerAgentId: match.winnerAgentId,
    left: { ...match.left },
    right: { ...match.right },
    events: match.events.filter(event => event.turn === match.turn).map(event => event.text),
  };
}

async function request(base, path, options) {
  const response = await fetch(`${base}${path}`, options);
  if (!response.ok) throw new Error(`${path}: HTTP ${response.status} ${await response.text()}`);
  return response.json();
}

try {
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const base = `http://127.0.0.1:${server.address().port}`;
  const agents = (await request(base, '/api/state')).agents.filter(agent => agent.type === 'demo');
  const leftAgent = agents.find(agent => agent.id === 'demo-storm');
  const rightAgent = agents.find(agent => agent.id === 'demo-guardian');
  if (!leftAgent || !rightAgent) throw new Error('Expected built-in demo agents are missing');

  const started = await request(base, '/api/matches', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ mode: 'fight', leftAgentId: leftAgent.id, rightAgentId: rightAgent.id }),
  });
  const initial = createMatch(started.id, leftAgent, rightAgent);
  const frames = [frame(initial)];
  const seen = new Set([0]);
  const deadline = Date.now() + 45_000;

  while (Date.now() < deadline) {
    const state = await request(base, '/api/state');
    const match = state.match;
    if (match?.id !== started.id) throw new Error('Unexpected match state');
    if (!seen.has(match.turn)) {
      seen.add(match.turn);
      frames.push(frame(match));
    }
    if (match.status === 'finished') break;
    await pause(35);
  }

  if (frames.at(-1)?.status !== 'finished') throw new Error('Capture timed out before match finished');
  for (let turn = 0; turn < frames.length; turn += 1) {
    if (frames[turn].turn !== turn) throw new Error(`Missing or out-of-order turn ${turn}`);
  }

  const replay = {
    schemaVersion: 1,
    provenance: 'Captured from an isolated local createArenaServer instance with the two built-in scripted demo bots.',
    mode: 'fight',
    agentTypes: ['demo', 'demo'],
    matchId: started.id,
    maxTurns: initial.maxTurns,
    winnerAgentId: frames.at(-1).winnerAgentId,
    frames,
  };
  await writeFile(destination, `${JSON.stringify(replay, null, 2)}\n`, 'utf8');
  console.log(`Captured ${frames.length} frames, winner: ${replay.winnerAgentId || 'draw'}`);
} finally {
  server.closeAllConnections();
  await new Promise(resolve => server.close(resolve));
}
