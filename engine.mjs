export const ACTIONS = Object.freeze([
  'approach', 'retreat', 'jab', 'kick', 'guard', 'special',
]);

const ATTACKS = {
  jab: { damage: 11, range: 17, cost: 10 },
  kick: { damage: 17, range: 27, cost: 19 },
  special: { damage: 26, range: 34, cost: 34 },
};
const ATTACK_NAMES = {
  jab: 'быстрый удар',
  kick: 'удар ногой',
  special: 'особый приём',
};

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

export function createMatch(id, leftAgent, rightAgent, maxTurns = 36) {
  if (leftAgent.id === rightAgent.id) throw new Error('Agents must differ');
  return {
    id,
    status: 'running',
    turn: 0,
    maxTurns,
    winnerAgentId: null,
    left: { agentId: leftAgent.id, name: leftAgent.name, hp: 100, x: 22, energy: 100, action: 'guard' },
    right: { agentId: rightAgent.id, name: rightAgent.name, hp: 100, x: 78, energy: 100, action: 'guard' },
    events: [{ turn: 0, text: `${leftAgent.name} и ${rightAgent.name} выходят на арену.` }],
  };
}

export function observationFor(match, side) {
  const self = match[side];
  const opponent = match[side === 'left' ? 'right' : 'left'];
  return {
    self: { hp: self.hp, x: self.x, energy: self.energy },
    opponent: { hp: opponent.hp, x: opponent.x, energy: opponent.energy },
    turn: match.turn + 1,
    maxTurns: match.maxTurns,
  };
}

export function resolveTurn(previous, proposedLeft, proposedRight) {
  if (previous.status !== 'running') throw new Error('Match already finished');

  const match = {
    ...previous,
    turn: previous.turn + 1,
    left: { ...previous.left },
    right: { ...previous.right },
    events: [...previous.events],
  };
  const left = match.left;
  const right = match.right;
  const events = [];
  const actions = [
    ACTIONS.includes(proposedLeft) ? proposedLeft : 'guard',
    ACTIONS.includes(proposedRight) ? proposedRight : 'guard',
  ];

  for (const [index, fighter] of [left, right].entries()) {
    const attack = ATTACKS[actions[index]];
    if (attack && fighter.energy < attack.cost) {
      actions[index] = 'guard';
      events.push(`${fighter.name}: не хватило энергии, защита.`);
    }
  }
  left.action = actions[0];
  right.action = actions[1];

  const oldDirection = Math.sign(right.x - left.x) || 1;
  for (const [index, fighter] of [left, right].entries()) {
    const action = actions[index];
    const toward = index === 0 ? oldDirection : -oldDirection;
    if (action === 'approach') fighter.x = clamp(fighter.x + toward * 9, 5, 95);
    if (action === 'retreat') fighter.x = clamp(fighter.x - toward * 9, 5, 95);
  }
  // Fighters cannot pass through one another in a single decision step.
  if (oldDirection > 0 && left.x > right.x - 6) {
    const midpoint = (left.x + right.x) / 2;
    left.x = clamp(midpoint - 3, 5, 89);
    right.x = clamp(midpoint + 3, 11, 95);
  } else if (oldDirection < 0 && right.x > left.x - 6) {
    const midpoint = (left.x + right.x) / 2;
    right.x = clamp(midpoint - 3, 5, 89);
    left.x = clamp(midpoint + 3, 11, 95);
  }

  const distance = Math.abs(left.x - right.x);
  const damage = [0, 0];
  for (const [index, fighter] of [left, right].entries()) {
    const action = actions[index];
    const attack = ATTACKS[action];
    if (!attack) continue;
    fighter.energy -= attack.cost;
    if (distance > attack.range) {
      events.push(`${fighter.name}: ${ATTACK_NAMES[action]} — мимо.`);
      continue;
    }
    const targetIndex = 1 - index;
    const blocked = actions[targetIndex] === 'guard';
    damage[targetIndex] += blocked ? Math.ceil(attack.damage * 0.25) : attack.damage;
    events.push(`${fighter.name}: ${ATTACK_NAMES[action]} — ${blocked ? 'блок, ' : ''}${blocked ? Math.ceil(attack.damage * 0.25) : attack.damage} урона.`);
  }

  left.hp = clamp(left.hp - damage[0], 0, 100);
  right.hp = clamp(right.hp - damage[1], 0, 100);
  for (const [index, fighter] of [left, right].entries()) {
    fighter.energy = clamp(fighter.energy + (actions[index] === 'guard' ? 18 : 9), 0, 100);
  }
  if (events.length === 0) events.push('Бойцы меняют позицию.');
  match.events.push(...events.map(text => ({ turn: match.turn, text })));
  match.events = match.events.slice(-36);

  if (left.hp === 0 || right.hp === 0 || match.turn >= match.maxTurns) {
    match.status = 'finished';
    if (left.hp > right.hp) match.winnerAgentId = left.agentId;
    if (right.hp > left.hp) match.winnerAgentId = right.agentId;
    const result = match.winnerAgentId
      ? `Победа: ${match.winnerAgentId === left.agentId ? left.name : right.name}.`
      : 'Ничья.';
    match.events.push({ turn: match.turn, text: result });
  }

  return match;
}
