import test from 'node:test';
import assert from 'node:assert/strict';
import { createPaperMatch, paperObservation, resolvePaperTurn } from '../paper-engine.mjs';

const dataset = {
  exchange: 'demo', symbol: 'BTC/USD', dataKind: 'demo', fetchedAt: '2026-09-27T00:00:00.000Z',
  candles: [{ time: 1, close: 100 }, { time: 2, close: 120 }],
};
const initial = () => createPaperMatch('m', { id: 'a', name: 'А' }, { id: 'b', name: 'Б' }, dataset);

test('paper observation shows the current price without future prices', () => {
  const match = initial();
  assert.equal(match.market.history.length, 0);
  const observed = paperObservation(match, 'left', dataset.candles[0]);
  assert.deepEqual(observed.recentPrices, [100]);
  assert.equal(observed.self.cash, 10000);
  assert.equal(observed.opponent.equity, 10000);
  assert.equal(JSON.stringify(match).includes('120'), false);
});

test('paper trades use virtual cash, fee and a shared immutable price series', () => {
  const first = resolvePaperTurn(initial(), 'buy', 'hold', dataset.candles[0]);
  assert.equal(first.left.cash, 7500);
  assert.equal(first.left.units, 24.975);
  assert.equal(first.left.equity, 9997.5);
  assert.equal(first.right.equity, 10000);
  assert.equal(first.status, 'running');
  const observedSecond = paperObservation(first, 'left', dataset.candles[1]);
  assert.equal(observedSecond.self.equity, 10497);
  assert.equal(observedSecond.opponent.equity, 10000);
  assert.equal(first.left.equity, 9997.5);
  const second = resolvePaperTurn(first, 'hold', 'hold', dataset.candles[1]);
  assert.equal(second.status, 'finished');
  assert.equal(second.left.equity, 10497);
  assert.equal(second.winnerAgentId, 'a');
  assert.deepEqual(second.market.history.map(point => point.price), [100, 120]);
  assert.equal(initial().left.cash, 10000);
});

test('invalid and unaffordable actions cannot create leverage or a negative balance', () => {
  const match = initial();
  match.left.cash = 0;
  const next = resolvePaperTurn(match, 'buy', 'not-an-action', dataset.candles[0]);
  assert.equal(next.left.cash, 0);
  assert.equal(next.left.units, 0);
  assert.equal(next.right.action, 'hold');
});
