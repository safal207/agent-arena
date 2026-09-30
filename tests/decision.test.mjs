import test from 'node:test';
import assert from 'node:assert/strict';
import { createTurnResponder, decideWithinDeadline, parseDecisionTimeout } from '../examples/decision.mjs';

const job = (turn) => ({ matchId: 'test-match', turn, actions: ['jab', 'guard'], observation: {} });
const deferred = () => {
  let resolve;
  let reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
};

test('a never-resolving selector expires, skips that turn and recovers on the next turn', async () => {
  let expiredSignal;
  const selected = [];
  const submitted = [];
  const answer = createTurnResponder((next, { signal }) => {
    selected.push(next.turn);
    if (next.turn === 1) {
      expiredSignal = signal;
      return new Promise(() => {});
    }
    return 'guard';
  }, async (next, action) => { submitted.push({ turn: next.turn, action }); }, { timeoutMs: 20 });

  await assert.rejects(answer(job(1)), { code: 'DECISION_TIMEOUT' });
  assert.equal(expiredSignal.aborted, true);
  assert.equal(await answer(job(1)), null);
  assert.deepEqual(await answer(job(2)), { turnKey: 'test-match:2', action: 'guard' });
  assert.deepEqual(selected, [1, 2]);
  assert.deepEqual(submitted, [{ turn: 2, action: 'guard' }]);
});

test('a late result cannot submit after the deadline or displace a recovered next turn', async () => {
  const late = deferred();
  const submitted = [];
  const answer = createTurnResponder((next) => next.turn === 1 ? late.promise : 'guard',
    async (next, action) => { submitted.push({ turn: next.turn, action }); }, { timeoutMs: 20 });

  await assert.rejects(answer(job(1)), { code: 'DECISION_TIMEOUT' });
  await answer(job(2));
  late.resolve('jab');
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(submitted, [{ turn: 2, action: 'guard' }]);
});

test('sync and async selectors submit one valid action with a cancellation signal', async () => {
  for (const asynchronous of [false, true]) {
    const submitted = [];
    let receivedSignal;
    const answer = createTurnResponder((next, { signal }) => {
      receivedSignal = signal;
      assert.equal(next.turn, 1);
      return asynchronous ? Promise.resolve('jab') : 'jab';
    }, async (next, action) => { submitted.push({ turn: next.turn, action }); }, { timeoutMs: 20 });

    assert.deepEqual(await answer(job(1)), { turnKey: 'test-match:1', action: 'jab' });
    assert.equal(await answer(job(1)), null);
    assert.equal(receivedSignal instanceof AbortSignal, true);
    assert.equal(receivedSignal.aborted, false);
    assert.deepEqual(submitted, [{ turn: 1, action: 'jab' }]);
  }
});

test('invalid selector output never submits and is not copied into an error', async () => {
  const privateOutput = 'secret-provider-response';
  let submissions = 0;
  const answer = createTurnResponder(() => privateOutput, async () => { submissions++; }, { timeoutMs: 20 });
  await assert.rejects(answer(job(1)), error => {
    assert.equal(error.code, 'INVALID_ACTION');
    assert.equal(error.message.includes(privateOutput), false);
    return true;
  });
  assert.equal(await answer(job(1)), null);
  assert.equal(submissions, 0);
});

test('selector rejection is bounded and redacted before recovery', async () => {
  await assert.rejects(decideWithinDeadline(() => { throw new Error('private-key-in-provider-error'); }, job(1), 20), error => {
    assert.equal(error.code, 'DECISION_FAILED');
    assert.equal(error.message, 'Selector failed');
    assert.equal(error.cause, undefined);
    return true;
  });
});

test('bot decision timeout defaults to 4 seconds and validates the environment range', () => {
  assert.equal(parseDecisionTimeout(undefined), 4000);
  assert.equal(parseDecisionTimeout('500'), 500);
  assert.equal(parseDecisionTimeout('29000'), 29000);
  for (const invalid of ['', 'not-a-number', '499', '29001', '1000.5', 'Infinity']) {
    assert.throws(() => parseDecisionTimeout(invalid), /BOT_DECISION_TIMEOUT_MS must be an integer from 500 to 29000/);
  }
});
