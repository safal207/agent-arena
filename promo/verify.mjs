import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createMatch, resolveTurn } from '../engine.mjs';
import { verifyExternalReplay } from '../examples/external-duel.mjs';

const replay = JSON.parse(await readFile(new URL('./replay.json', import.meta.url), 'utf8'));
assert.equal(replay.schemaVersion, 1);
assert.equal(replay.mode, 'fight');
assert.deepEqual(replay.agentTypes, ['demo', 'demo']);
assert.ok(replay.frames.length > 1);
const [first, ...later] = replay.frames;
assert.equal(first.turn, 0);
assert.equal(first.left.agentId, 'demo-storm');
assert.equal(first.right.agentId, 'demo-guardian');
let match = createMatch(replay.matchId,
  { id: first.left.agentId, name: first.left.name },
  { id: first.right.agentId, name: first.right.name });
assert.deepEqual(first.left, match.left);
assert.deepEqual(first.right, match.right);

for (const [index, frame] of later.entries()) {
  assert.equal(frame.turn, index + 1);
  match = resolveTurn(match, frame.left.action, frame.right.action);
  assert.deepEqual(frame.left, match.left);
  assert.deepEqual(frame.right, match.right);
  assert.equal(frame.status, match.status);
  assert.equal(frame.winnerAgentId, match.winnerAgentId);
  assert.deepEqual(frame.events, match.events.filter(event => event.turn === frame.turn).map(event => event.text));
}

assert.equal(match.status, 'finished');
assert.equal(replay.winnerAgentId, match.winnerAgentId);
assert.equal(match.winnerAgentId, 'demo-storm');
assert.equal(match.turn, 10);
assert.equal(match.left.hp, 10);
assert.equal(match.right.hp, 0);
console.log(`Verified ${replay.frames.length} frames against fight engine: Storm wins turn ${match.turn} with ${match.left.hp} HP.`);

const external = JSON.parse(await readFile(new URL('./external-replay.json', import.meta.url), 'utf8'));
const verified = verifyExternalReplay(external);
for (const [path, hash] of Object.entries(external.provenance.sourceHashes)) {
  const actual = createHash('sha256').update(await readFile(new URL(`../${path}`, import.meta.url))).digest('hex');
  assert.equal(actual, hash, `HTTP-client recording source changed: ${path}. Recapture with examples/external-duel.mjs.`);
}
console.log(`Verified HTTP clients: ${verified.turns} turns, accepted actions ${JSON.stringify(verified.acceptedActions)}, ${verified.timeoutCount} timeouts.`);
