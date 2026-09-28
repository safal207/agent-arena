import test from 'node:test';
import assert from 'node:assert/strict';
import { createMatch, observationFor, resolveTurn } from '../engine.mjs';

const initial = () => createMatch('m1', { id: 'a', name: 'А' }, { id: 'b', name: 'Б' });

test('both agents receive only the current shared arena state', () => {
  const match = initial();
  const left = observationFor(match, 'left');
  const right = observationFor(match, 'right');
  assert.deepEqual(left.self, { hp: 100, x: 22, energy: 100 });
  assert.deepEqual(right.self, { hp: 100, x: 78, energy: 100 });
  assert.equal(left.turn, 1);
  assert.equal(left.opponent.x, right.self.x);
});

test('moves resolve simultaneously and attacks cannot hit from outside range', () => {
  const first = resolveTurn(initial(), 'approach', 'approach');
  assert.equal(first.left.x, 31);
  assert.equal(first.right.x, 69);
  const second = resolveTurn(first, 'special', 'special');
  assert.equal(second.left.hp, 100);
  assert.equal(second.right.hp, 100);
  assert.equal(second.left.energy, 75);
  assert.equal(second.right.energy, 75);
  assert.equal(initial().turn, 0);
});

test('guard reduces damage, exhausted attacks fall back to guard', () => {
  const match = initial();
  match.left.x = 43;
  match.right.x = 57;
  const guarded = resolveTurn(match, 'special', 'guard');
  assert.equal(guarded.right.hp, 93);
  assert.equal(guarded.left.energy, 75);
  assert.equal(guarded.right.energy, 100);
  guarded.left.energy = 0;
  const exhausted = resolveTurn(guarded, 'special', 'jab');
  assert.equal(exhausted.left.action, 'guard');
  assert.equal(exhausted.left.hp, 97);
});

test('match ends by health or turn limit with a recorded winner', () => {
  const match = createMatch('m2', { id: 'a', name: 'А' }, { id: 'b', name: 'Б' }, 1);
  match.left.x = 43;
  match.right.x = 57;
  const ended = resolveTurn(match, 'kick', 'guard');
  assert.equal(ended.status, 'finished');
  assert.equal(ended.winnerAgentId, 'a');
  assert.throws(() => resolveTurn(ended, 'jab', 'jab'), /finished/);
});
