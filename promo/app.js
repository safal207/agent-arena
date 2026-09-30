const $ = id => document.getElementById(id);
const elements = {
  slider: $('turn-slider'), play: $('play-button'), icon: $('play-icon'), restart: $('restart-button'),
  speed: $('speed-button'), jump: $('jump-button'), share: $('share-button'), shareTurn: $('share-turn-button'),
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
  $('replay-next-title').textContent = currentTurn === total ? 'Storm won. Your strategy is next.' : 'Can your strategy beat Storm?';
  $('replay-next').classList.toggle('replay-complete', currentTurn === total);
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
  $('replay').scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'start' });
});

function shareUrl(turn) {
  const host = location.hostname.toLowerCase();
  const local = host === 'localhost' || host === '127.0.0.1' || host === '0.0.0.0' || host === '[::1]' || host.endsWith('.local') || /^192\.168\.|^10\.|^172\.(1[6-9]|2\d|3[01])\./.test(host);
  const destination = !local && location.protocol === 'https:'
    ? `${location.origin}${location.pathname}`
    : 'https://safal207.github.io/agent-arena/promo/';
  return turn === undefined ? destination : `${destination}?turn=${turn}#replay`;
}

async function copyText(message, success) {
  const fallback = $('copy-fallback');
  const status = $('copy-status');
  fallback.hidden = true;
  try {
    await navigator.clipboard.writeText(message);
  } catch {
    // Keep a visible, selectable recovery path if clipboard access is blocked.
    const previousFocus = document.activeElement;
    const input = $('copy-fallback-text');
    input.value = message;
    fallback.hidden = false;
    input.focus();
    input.select();
    let copied = false;
    try { copied = document.execCommand('copy'); } catch { /* manual copy remains available */ }
    if (!copied) {
      status.textContent = 'Clipboard unavailable. Your text is selected below; copy it manually.';
      input.scrollIntoView({ block: 'center' });
      return false;
    }
    fallback.hidden = true;
    previousFocus?.focus();
  }
  status.textContent = success;
  return true;
}

for (const button of document.querySelectorAll('[data-copy]')) {
  const original = button.textContent;
  let resetTimer;
  button.addEventListener('click', async () => {
    if (await copyText($(button.dataset.copy).textContent, `${original.replace('Copy', '').trim()} copied.`)) {
      button.textContent = 'Copied ✓';
      clearTimeout(resetTimer);
      resetTimer = setTimeout(() => { button.textContent = original; }, 2800);
    }
  });
}

elements.share.addEventListener('click', async () => {
  const message = `Can your bot beat Storm? Agent Arena is a local playground for agent decisions. Watch a real scripted-bot replay, run a match with Node.js, then change the strategy. No dependencies or model keys for the demo.\n${shareUrl()}`;
  if (await copyText(message, 'Challenge copied. Paste it wherever you want to share it.')) {
    elements.share.firstChild.textContent = 'Challenge copied for X ';
    setTimeout(() => { elements.share.firstChild.textContent = 'Copy challenge for X '; }, 2800);
  }
});

elements.shareTurn.addEventListener('click', async () => {
  if (await copyText(shareUrl(currentTurn), `Link to turn ${currentTurn} copied.`)) {
    elements.shareTurn.firstChild.textContent = 'Turn link copied ';
    setTimeout(() => { elements.shareTurn.firstChild.textContent = 'Copy a link to this turn '; }, 2800);
  }
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
  const requestedTurn = new URLSearchParams(location.search).get('turn');
  const initialTurn = requestedTurn !== null && /^\d+$/.test(requestedTurn)
    ? Math.min(Number(requestedTurn), replay.frames.length - 1) : 0;
  showTurn(initialTurn);
} catch (error) {
  elements.summary.textContent = 'Replay could not load. Refresh this page and try again.';
  elements.play.disabled = true;
  elements.restart.disabled = true;
  elements.slider.disabled = true;
  elements.speed.disabled = true;
  elements.jump.disabled = true;
  elements.shareTurn.disabled = true;
  console.error('Replay loading failed:', error);
}
