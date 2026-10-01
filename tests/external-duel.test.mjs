import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, access } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runExternalDuel, verifyExternalReplay } from '../examples/external-duel.mjs';

test('two scripted external HTTP clients complete an engine-verified, secret-free replay', { timeout: 45000 }, async () => {
  const directory = await mkdtemp(join(tmpdir(), 'arena-external-proof-'));
  const outputPath = join(directory, 'replay.json');
  try {
    const replay = await runExternalDuel({ outputPath });
    const saved = JSON.parse(await readFile(outputPath, 'utf8'));
    assert.deepEqual(saved, replay);
    const result = verifyExternalReplay(saved);
    assert.ok(result.turns > 0);
    assert.equal(result.frames, result.turns + 1);
    assert.deepEqual(result.acceptedActions, { Rush: result.turns, Sentinel: result.turns });
    assert.equal(result.timeoutCount, 0);
    assert.equal(saved.frames.at(-1).status, 'finished');
    assert.equal(JSON.stringify(saved).includes('"token"'), false);
    assert.equal(JSON.stringify(saved).includes('Bearer '), false);
    const altered = structuredClone(saved);
    altered.decisions[0].action = 'cheat';
    assert.throws(() => verifyExternalReplay(altered));
    const wrongObservation = structuredClone(saved);
    wrongObservation.decisions[0].observation.self.hp = 1;
    assert.throws(() => verifyExternalReplay(wrongObservation));
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('a bounded failed run stops its isolated arena and leaves no output', { timeout: 5000 }, async () => {
  const directory = await mkdtemp(join(tmpdir(), 'arena-external-deadline-'));
  const outputPath = join(directory, 'replay.json');
  try {
    await assert.rejects(runExternalDuel({ outputPath, maxDurationMs: 300 }));
    await assert.rejects(access(outputPath), { code: 'ENOENT' });
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
