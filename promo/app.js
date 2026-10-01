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
let recordingId = 'demo';
let loadGeneration = 0;
const recordings = {
  demo: {
    file: './replay.json', types: ['demo', 'demo'], names: ['Storm', 'Guardian'],
    note: '2 built-in scripted bots · recorded demo',
    styles: ['Aggressive style · built-in script', 'Defensive style · built-in script'],
    moment: 'Storm presses the lead.',
    explanation: 'A special move deals 26 damage. Guardian strikes back for 17, but the health gap grows.',
  },
  external: {
    file: './external-replay.json', types: ['external', 'external'], names: ['Rush', 'Sentinel'],
    note: '2 scripted HTTP clients · one local runner · no model calls',
    styles: ['Rush strategy · HTTP client', 'Sentinel strategy · HTTP client'],
    moment: 'Inspect the HTTP decisions.',
    explanation: 'Both scripted clients receive observations and submit actions over HTTP. Inspect the saved JSON for accepted actions, timeout counts and source hashes.',
  },
};

function stop() {
  if (timer) clearInterval(timer);
  timer = null;
  elements.icon.textContent = '▶';
  elements.play.setAttribute('aria-label', 'Play the fight');
}

function translateEvent(message) {
  return message
    .replace('Шторм и Страж выходят на арену.', 'Storm and Guardian enter the arena.')
    .replace(' и ', ' and ')
    .replace(' выходят на арену.', ' enter the arena.')
    .replace('Бойцы меняют позицию.', 'Both fighters reposition.')
    .replaceAll('Шторм', 'Storm')
    .replaceAll('Страж', 'Guardian')
    .replace('особый приём', 'special move')
    .replace('удар ногой', 'kick')
    .replace('быстрый удар', 'jab')
    .replace(' — блок, ', ' — blocked, ')
    .replace(' урона.', ' damage.')
    .replace('Победа:', 'Winner:')
    .replace('Ничья.', 'Draw.');
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
  const [leftName, rightName] = recordings[recordingId].names;
  elements.leftAction.textContent = `${leftName.toUpperCase()}: ${actionNames[frame.left.action] ?? frame.left.action}`;
  elements.rightAction.textContent = `${rightName.toUpperCase()}: ${actionNames[frame.right.action] ?? frame.right.action}`;
  elements.eventTitle.textContent = currentTurn === 0 ? 'Turn 00 · start' : `Turn ${pad(currentTurn)}${frame.status === 'finished' ? ' · final' : ''}`;
  elements.eventList.replaceChildren(...frame.events.map(message => {
    const li = document.createElement('li');
    li.textContent = translateEvent(message);
    return li;
  }));
  elements.summary.textContent = translateEvent(frame.events.find(message => message.includes('Победа:') || message === 'Ничья.')
    ?? frame.events[0] ?? 'Бойцы меняют позицию.');
  const final = replay.frames.at(-1);
  const winner = final.winnerAgentId === final.left.agentId ? leftName : final.winnerAgentId === final.right.agentId ? rightName : null;
  $('replay-next-title').textContent = currentTurn === total
    ? `${winner ? `${winner} won.` : 'The fight ended in a draw.'} Your strategy is next.`
    : `What would your strategy choose?`;
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
  const query = new URLSearchParams();
  if (recordingId === 'external') query.set('replay', 'external');
  if (turn !== undefined) query.set('turn', String(turn));
  const encoded = query.toString();
  return `${destination}${encoded ? `?${encoded}` : ''}${turn !== undefined || recordingId === 'external' ? '#replay' : ''}`;
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
  const message = `Agent Arena is a local playground for agent decisions. Watch ${recordingId === 'external' ? 'two scripted HTTP clients' : 'two built-in scripted bots'}, then reproduce a match with Node.js and change the strategy. No dependencies or model keys for these examples.\n${shareUrl()}`;
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

function setReplayControls(disabled) {
  for (const element of [elements.play, elements.restart, elements.slider, elements.speed, elements.jump, elements.shareTurn]) element.disabled = disabled;
}

async function loadRecording(id, requestedTurn = null) {
  const generation = ++loadGeneration;
  stop();
  replay = null;
  recordingId = Object.hasOwn(recordings, id) ? id : 'demo';
  $('replay-select').value = recordingId;
  $('recording-view').hidden = true;
  $('recording-result').hidden = true;
  $('replay-note').textContent = recordings[recordingId].note;
  $('replay-status').textContent = 'Loading recording…';
  $('replay-evidence').hidden = true;
  setReplayControls(true);
  const config = recordings[recordingId];
  try {
    const response = await fetch(config.file, { cache: 'no-store' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const loaded = await response.json();
    if (generation !== loadGeneration) return;
    if (loaded.mode !== 'fight' || loaded.agentTypes?.join(',') !== config.types.join(',') ||
        !Array.isArray(loaded.frames) || loaded.frames.length < 7 || loaded.frames.at(-1).status !== 'finished' ||
        loaded.frames.some((frame, index) => frame.turn !== index || !frame.left || !frame.right ||
          !Array.isArray(frame.events) || frame.events.some(message => typeof message !== 'string'))) {
      throw new Error('Unexpected replay fixture');
    }
    if (recordingId === 'external' && (loaded.provenance?.kind !== 'single-runner-scripted-http-duel' ||
        !Number.isInteger(loaded.evidence?.serverTimeoutCount) || loaded.evidence.serverTimeoutCount < 0)) {
      throw new Error('Unexpected HTTP-client evidence');
    }
    replay = loaded;
    const total = replay.frames.length - 1;
    const final = replay.frames.at(-1);
    const [leftName, rightName] = config.names;
    for (const [side, name, meta] of [['left', leftName, config.styles[0]], ['right', rightName, config.styles[1]]]) {
      $(`${side}-name`).textContent = name.toUpperCase();
      $(`${side}-avatar-name`).textContent = name.toUpperCase();
      $(`${side}-initial`).textContent = name[0];
      $(`${side}-meta`).textContent = meta;
    }
    elements.slider.max = String(total);
    $('tick-middle').textContent = String(Math.floor(total / 2)).padStart(2, '0');
    $('tick-last').textContent = String(total).padStart(2, '0');
    $('moment-total').textContent = `/${total}`;
    $('moment-title').textContent = config.moment;
    $('moment-description').textContent = config.explanation;
    const winnerSide = final.winnerAgentId === final.left.agentId ? 'left' : final.winnerAgentId === final.right.agentId ? 'right' : null;
    $('result-name').textContent = winnerSide ? (winnerSide === 'left' ? leftName : rightName).toUpperCase() : 'DRAW';
    $('result-description').textContent = `${leftName}: ${final.left.hp} HP · ${rightName}: ${final.right.hp} HP.`;
    $('result-turns').textContent = $('result-bg-turns').textContent = String(total);
    $('result-third').textContent = recordingId === 'external' ? String(replay.evidence.serverTimeoutCount) : '$0';
    $('result-third-label').textContent = recordingId === 'external' ? 'fallback timeouts' : 'stakes or prizes';
    $('replay-note').textContent = `${total} turns · ${config.note}`;
    $('replay-evidence').href = config.file;
    $('replay-evidence').hidden = false;
    $('replay-status').textContent = recordingId === 'external'
      ? 'Recorded from two local scripted HTTP clients controlled by this example runner. Reproduce it with the command above.'
      : 'Recorded from the two built-in scripted bots. Choose HTTP clients to inspect the external integration.';
    const initialTurn = requestedTurn !== null && /^\d+$/.test(requestedTurn)
      ? Math.min(Number(requestedTurn), total) : 0;
    showTurn(initialTurn);
    setReplayControls(false);
    $('recording-view').hidden = false;
    $('recording-result').hidden = false;
  } catch (error) {
    if (generation !== loadGeneration) return;
    replay = null;
    stop();
    setReplayControls(true);
    $('recording-view').hidden = true;
    $('recording-result').hidden = true;
    $('replay-evidence').hidden = true;
    $('replay-status').textContent = 'Recording could not load. Choose another recording or refresh to retry.';
    console.error('Replay loading failed:', error);
  }
}

$('replay-select').addEventListener('change', () => loadRecording($('replay-select').value));
const params = new URLSearchParams(location.search);
await loadRecording(params.get('replay'), params.get('turn'));
