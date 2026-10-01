import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, writeFile, rename, readdir, rm, access } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout as pause } from 'node:timers/promises';
import { DuelFailure, runExternalDuel, verifyExternalReplay, writeVerifiedReplay, formatDuelFailure } from '../examples/external-duel.mjs';

const fixture = JSON.parse(await readFile(new URL('../promo/external-replay.json', import.meta.url), 'utf8'));
const exec = promisify(execFile);

test('the replay schema rejects credential-bearing fields and values while allowing source hashes', () => {
  assert.doesNotThrow(() => verifyExternalReplay(fixture));
  for (const inject of [
    replay => { replay.token = 'secret'; },
    replay => { replay.provenance.token = 'secret'; },
    replay => { replay.evidence.token = 'secret'; },
    replay => { replay.decisions[0].token = 'secret'; },
    replay => { replay.evidence.authorization[0].token = 'secret'; },
    replay => { replay.provenance.description = 'Bearer secret'; },
    replay => { replay.provenance.description = 'a'.repeat(64); },
  ]) {
    const attacked = structuredClone(fixture);
    inject(attacked);
    assert.throws(() => verifyExternalReplay(attacked));
  }
});

test('failure formatting allowlists stage and code without echoing messages, paths or bodies', () => {
  const error = new Error('Bearer private-key; private/request/body');
  error.stage = 'Bearer private-stage';
  error.code = 'private-provider-code';
  assert.deepEqual(formatDuelFailure(error), { status: 'FAIL', stage: 'match', code: 'INTERNAL_ERROR' });
  error.code = 'ERR_ASSERTION';
  assert.deepEqual(formatDuelFailure(error), { status: 'FAIL', stage: 'match', code: 'ASSERTION_FAILED' });
  const mutated = new DuelFailure('output-write', 'ENOENT');
  mutated.stage = 'Bearer private-stage';
  mutated.code = 'Bearer private-code';
  assert.deepEqual(formatDuelFailure(mutated), { status: 'FAIL', stage: 'match', code: 'INTERNAL_ERROR' });
});

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

test('an invalid output path reports a safe filesystem stage and code through the CLI', { timeout: 45000 }, async () => {
  const directory = await mkdtemp(join(tmpdir(), 'arena-external-invalid-path-'));
  const privateMarker = 'private-key-do-not-log';
  const outputPath = join(directory, privateMarker, 'replay.json');
  try {
    await assert.rejects(exec(process.execPath, [fileURLToPath(new URL('../examples/external-duel.mjs', import.meta.url)), '--output', outputPath], { timeout: 40000 }), error => {
      assert.equal(error.code, 1);
      assert.equal(error.stdout, '');
      assert.deepEqual(JSON.parse(error.stderr), { status: 'FAIL', stage: 'output-write', code: 'ENOENT' });
      assert.equal(error.stderr.includes(privateMarker), false);
      assert.equal(error.stderr.includes('Bearer '), false);
      return true;
    });
    await assert.rejects(access(outputPath), { code: 'ENOENT' });
    assert.deepEqual(await readdir(directory), []);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('abort during a held temporary write preserves the target and never starts rename', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'arena-external-cancel-write-'));
  const outputPath = join(directory, 'replay.json');
  const controller = new AbortController();
  let release;
  const held = new Promise(resolve => { release = resolve; });
  let written;
  const wroteTemporary = new Promise(resolve => { written = resolve; });
  let renames = 0;
  try {
    await writeFile(outputPath, 'existing-sentinel');
    const writing = writeVerifiedReplay(outputPath, fixture, {
      signal: controller.signal,
      writeTemporary: async (...args) => { await writeFile(...args); written(); await held; },
      commitTemporary: async (...args) => { renames++; await rename(...args); },
    });
    const rejected = assert.rejects(writing, error => {
      assert.deepEqual(formatDuelFailure(error), { status: 'FAIL', stage: 'output-commit', code: 'DEADLINE_EXCEEDED' });
      return true;
    });
    await wroteTemporary;
    controller.abort();
    release();
    await rejected;
    assert.equal(renames, 0);
    assert.equal(await readFile(outputPath, 'utf8'), 'existing-sentinel');
    assert.deepEqual(await readdir(directory), ['replay.json']);
  } finally {
    release();
    await rm(directory, { recursive: true, force: true });
  }
});

test('elapsed deadline prevents commit even if the abort timer has not dispatched', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'arena-external-elapsed-write-'));
  const outputPath = join(directory, 'replay.json');
  const signal = new AbortController().signal;
  const deadlineAt = performance.now() + 1000;
  let renames = 0;
  let temporaryWritten = false;
  try {
    await writeFile(outputPath, 'existing-sentinel');
    await assert.rejects(writeVerifiedReplay(outputPath, fixture, {
      signal,
      deadlineAt,
      writeTemporary: async (...args) => {
        await writeFile(...args);
        temporaryWritten = true;
        await pause(Math.max(1, deadlineAt - performance.now() + 20));
        assert.equal(signal.aborted, false);
      },
      commitTemporary: async (...args) => { renames++; await rename(...args); },
    }), error => error.code === 'DEADLINE_EXCEEDED' && error.stage === 'output-commit');
    assert.equal(temporaryWritten, true);
    assert.equal(renames, 0);
    assert.equal(await readFile(outputPath, 'utf8'), 'existing-sentinel');
    assert.deepEqual(await readdir(directory), ['replay.json']);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('a later abort cannot roll back an atomic commit that already started', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'arena-external-committed-write-'));
  const outputPath = join(directory, 'replay.json');
  const controller = new AbortController();
  try {
    await writeFile(outputPath, 'existing-sentinel');
    await writeVerifiedReplay(outputPath, fixture, {
      signal: controller.signal,
      commitTemporary: async (...args) => { controller.abort(); await rename(...args); },
    });
    assert.deepEqual(JSON.parse(await readFile(outputPath, 'utf8')), fixture);
    assert.deepEqual(await readdir(directory), ['replay.json']);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('temporary cleanup failure preserves the primary write failure and existing target', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'arena-external-primary-failure-'));
  const outputPath = join(directory, 'replay.json');
  let temporaryPath;
  try {
    await writeFile(outputPath, 'existing-sentinel');
    await assert.rejects(writeVerifiedReplay(outputPath, fixture, {
      writeTemporary: async path => {
        temporaryPath = path;
        await mkdir(path);
        const error = new Error('Do not expose private filesystem details');
        error.code = 'ENOSPC';
        throw error;
      },
    }), error => {
      assert.deepEqual(formatDuelFailure(error), { status: 'FAIL', stage: 'output-write', code: 'ENOSPC' });
      return true;
    });
    assert.equal(await readFile(outputPath, 'utf8'), 'existing-sentinel');
    await access(temporaryPath);
  } finally {
    // unlink cannot remove the injected directory; this test owns its removal.
    await rm(directory, { recursive: true, force: true });
  }
});

test('temporary cleanup failure still surfaces when no earlier operation failed', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'arena-external-cleanup-only-'));
  const outputPath = join(directory, 'replay.json');
  try {
    await writeFile(outputPath, 'existing-sentinel');
    await assert.rejects(writeVerifiedReplay(outputPath, fixture, {
      writeTemporary: async path => { await mkdir(path); },
      commitTemporary: async () => {},
    }), error => {
      const failure = formatDuelFailure(error);
      assert.equal(failure.stage, 'cleanup');
      assert.ok(['EISDIR', 'EPERM'].includes(failure.code));
      return true;
    });
    assert.equal(await readFile(outputPath, 'utf8'), 'existing-sentinel');
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
