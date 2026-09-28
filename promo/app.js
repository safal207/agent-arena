const $ = id => document.getElementById(id);
const elements = {
  slider: $('turn-slider'), play: $('play-button'), icon: $('play-icon'), restart: $('restart-button'),
  speed: $('speed-button'), jump: $('jump-button'), share: $('share-button'),
  round: $('round-label'), turn: $('turn-number'), time: $('scrubber-time'),
  leftHp: $('left-hp-text'), rightHp: $('right-hp-text'), leftBar: $('left-hp-bar'), rightBar: $('right-hp-bar'),
  leftEnergy: $('left-energy-text'), rightEnergy: $('right-energy-text'),
  leftEnergyBar: $('left-energy-bar'), rightEnergyBar: $('right-energy-bar'),
  leftAvatar: $('left-avatar'), rightAvatar: $('right-avatar'), distance: $('distance-label'),
  summary: $('action-summary'), eventTitle: $('event-title'), eventList: $('event-list'),
  leftAction: $('left-action'), rightAction: $('right-action'),
};
const actionNames = {
  approach: 'APPROACH', retreat: 'RETREAT', jab: 'JAB', kick: 'KICK',
  guard: 'GUARD', special: 'SPECIAL',
};
let replay = null;
let currentTurn = 0;
let speed = 1;
let timer = null;

function stop() {
  if (timer) clearInterval(timer);
  timer = null;
  elements.icon.textContent = '▶';
  elements.play.setAttribute('aria-label', 'Play the fight');
}

function translateEvent(message) {
  return message
    .replace('Шторм и Страж выходят на арену.', 'Storm and Guardian enter the arena.')
    .replace('Бойцы меняют позицию.', 'Both fighters reposition.')
    .replaceAll('Шторм', 'Storm')
    .replaceAll('Страж', 'Guardian')
    .replace('особый приём', 'special move')
    .replace('удар ногой', 'kick')
    .replace('быстрый удар', 'jab')
    .replace(' — блок, ', ' — blocked, ')
    .replace(' урона.', ' damage.')
    .replace('Победа:', 'Winner:');
}

function showTurn(turn) {
  if (!replay) return;
  currentTurn = Math.max(0, Math.min(turn, replay.frames.length - 1));
  const frame = replay.frames[currentTurn];
  const total = replay.frames.length - 1;
  const pad = number => String(number).padStart(2, '0');
  elements.slider.value = String(currentTurn);
  elements.round.textContent = `TURN ${pad(currentTurn)} / ${pad(total)}`;
  elements.turn.textContent = pad(currentTurn);
  elements.time.textContent = `${pad(currentTurn)} / ${pad(total)}`;
  elements.leftHp.textContent = `${frame.left.hp} / 100`;
  elements.rightHp.textContent = `${frame.right.hp} / 100`;
  elements.leftBar.style.width = `${frame.left.hp}%`;
  elements.rightBar.style.width = `${frame.right.hp}%`;
  elements.leftEnergy.textContent = String(frame.left.energy);
  elements.rightEnergy.textContent = String(frame.right.energy);
  elements.leftEnergyBar.style.width = `${frame.left.energy}%`;
  elements.rightEnergyBar.style.width = `${frame.right.energy}%`;
  elements.leftAvatar.style.left = `${frame.left.x}%`;
  elements.rightAvatar.style.left = `${frame.right.x}%`;
  elements.distance.textContent = `${Math.abs(frame.right.x - frame.left.x)} UNITS APART`;
  elements.leftAction.textContent = `STORM: ${actionNames[frame.left.action] ?? frame.left.action}`;
  elements.rightAction.textContent = `GUARDIAN: ${actionNames[frame.right.action] ?? frame.right.action}`;
  elements.eventTitle.textContent = currentTurn === 0 ? 'Turn 00 · start' : `Turn ${pad(currentTurn)}${frame.status === 'finished' ? ' · final' : ''}`;
  elements.eventList.replaceChildren(...frame.events.map(message => {
    const li = document.createElement('li');
    li.textContent = translateEvent(message);
    return li;
  }));
  elements.summary.textContent = translateEvent(frame.events.find(message => message.includes('Победа:'))
    ?? frame.events[0] ?? 'Бойцы меняют позицию.');
  if (currentTurn === total) stop();
}

function start() {
  if (!replay) return;
  if (currentTurn >= replay.frames.length - 1) showTurn(0);
  stop();
  elements.icon.textContent = 'Ⅱ';
  elements.play.setAttribute('aria-label', 'Pause the fight');
  timer = setInterval(() => showTurn(currentTurn + 1), 1050 / speed);
}

elements.play.addEventListener('click', () => timer ? stop() : start());
elements.restart.addEventListener('click', () => { stop(); showTurn(0); });
elements.slider.addEventListener('input', () => { stop(); showTurn(Number(elements.slider.value)); });
elements.speed.addEventListener('click', () => {
  speed = speed === 1 ? 2 : 1;
  elements.speed.textContent = `${speed}×`;
  elements.speed.setAttribute('aria-label', `Playback speed, currently ${speed} times`);
  if (timer) start();
});
elements.jump.addEventListener('click', () => {
  stop();
  showTurn(6);
  $('replay').scrollIntoView({ behavior: 'smooth', block: 'start' });
});

function shareText() {
  const message = 'Recorded fight between two built-in scripted bots: Storm beat Guardian on turn 10 with 10 HP left. Would your agent survive? Follow early beta updates: @safal0645';
  const host = location.hostname.toLowerCase();
  const local = host === 'localhost' || host === '127.0.0.1' || host === '0.0.0.0' || host === '[::1]' || host.endsWith('.local') || /^192\.168\.|^10\.|^172\.(1[6-9]|2\d|3[01])\./.test(host);
  return !local && location.protocol === 'https:' ? `${message}\n${location.origin}${location.pathname}` : message;
}

elements.share.addEventListener('click', async () => {
  const message = shareText();
  try {
    await navigator.clipboard.writeText(message);
  } catch {
    const input = document.createElement('textarea');
    input.value = message;
    input.setAttribute('readonly', '');
    input.style.position = 'fixed';
    input.style.opacity = '0';
    document.body.append(input);
    input.select();
    const copied = document.execCommand('copy');
    input.remove();
    if (!copied) { window.prompt('Copy this challenge for X:', message); return; }
  }
  const original = 'Copy challenge for X';
  elements.share.firstChild.textContent = 'Challenge copied for X ';
  setTimeout(() => { elements.share.firstChild.textContent = `${original} `; }, 2800);
});

try {
  const response = await fetch('./replay.json', { cache: 'no-store' });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  replay = await response.json();
  if (replay.mode !== 'fight' || replay.agentTypes.join(',') !== 'demo,demo' || replay.frames.length < 2 ||
      replay.frames.at(-1).status !== 'finished' || replay.frames.at(-1).winnerAgentId !== 'demo-storm') {
    throw new Error('Unexpected replay fixture');
  }
  elements.slider.max = String(replay.frames.length - 1);
  showTurn(0);
} catch (error) {
  elements.summary.textContent = 'Replay could not load. Preview this page through the local server described in the README.';
  elements.play.disabled = true;
  elements.restart.disabled = true;
  elements.slider.disabled = true;
  elements.speed.disabled = true;
  elements.jump.disabled = true;
  console.error('Replay loading failed:', error);
}
