"use strict";

const els = {
  connectionStatus: document.getElementById("connectionStatus"),
  leftSelect: document.getElementById("leftAgent"),
  rightSelect: document.getElementById("rightAgent"),
  leftHint: document.getElementById("leftAgentHint"),
  rightHint: document.getElementById("rightAgentHint"),
  modeInputs: [...document.querySelectorAll('input[name="matchMode"]')],
  marketSetup: document.getElementById("marketSetup"),
  exchangeSelect: document.getElementById("exchangeSelect"),
  startButton: document.getElementById("startButton"),
  setupMessage: document.getElementById("setupMessage"),
  battleSection: document.getElementById("battleSection"),
  marketSection: document.getElementById("marketSection"),
  matchStatus: document.getElementById("matchStatus"),
  turnLabel: document.getElementById("turnLabel"),
  matchId: document.getElementById("matchId"),
  arena: document.getElementById("arena"),
  winnerBanner: document.getElementById("winnerBanner"),
  eventLog: document.getElementById("eventLog"),
  eventCount: document.getElementById("eventCount"),
  logTitle: document.getElementById("logTitle"),
  marketMatchStatus: document.getElementById("marketMatchStatus"),
  marketTurnLabel: document.getElementById("marketTurnLabel"),
  marketMatchId: document.getElementById("marketMatchId"),
  marketSource: document.getElementById("marketSource"),
  marketPrice: document.getElementById("marketPrice"),
  marketDataKind: document.getElementById("marketDataKind"),
  marketChart: document.getElementById("marketChart"),
  marketChartLine: document.getElementById("marketChartLine"),
  marketChartArea: document.getElementById("marketChartArea"),
  marketChartPoint: document.getElementById("marketChartPoint"),
  marketChartEmpty: document.getElementById("marketChartEmpty"),
  marketChartEnd: document.getElementById("marketChartEnd"),
  marketFee: document.getElementById("marketFee"),
  marketWinner: document.getElementById("marketWinner"),
  registerForm: document.getElementById("registerForm"),
  registerButton: document.getElementById("registerButton"),
  agentName: document.getElementById("agentName"),
  registerMessage: document.getElementById("registerMessage"),
  credentials: document.getElementById("credentials"),
  agentIdValue: document.getElementById("agentIdValue"),
  agentTokenValue: document.getElementById("agentTokenValue")
};

const state = {
  agents: [],
  match: null,
  mode: "fight",
  lastSeenMatchId: null,
  online: false,
  starting: false,
  registering: false,
  agentSignature: "",
  eventSignature: "",
  lastAnimationKey: "",
  notice: null
};

const actionNames = {
  approach: "Сближение",
  retreat: "Отступление",
  jab: "Быстрый удар",
  kick: "Удар ногой",
  guard: "Защита",
  special: "Особый приём"
};

const marketActionNames = { buy: "Покупка", sell: "Продажа", hold: "Ожидание" };
const sourceNames = { coinbase: "Coinbase", kraken: "Kraken", demo: "Демо" };
const dollars = new Intl.NumberFormat("ru-RU", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 });
const unitsFormat = new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 6 });
const percentFormat = new Intl.NumberFormat("ru-RU", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function byId(id) {
  return document.getElementById(id);
}

function numberInRange(value, min, max) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.min(max, Math.max(min, parsed)) : min;
}

function agentType(type) {
  const value = String(type || "").toLowerCase();
  if (["built-in", "builtin", "local", "demo", "internal"].includes(value)) return "Встроенный";
  if (["external", "remote", "custom"].includes(value)) return "Внешний";
  return type ? String(type) : "Агент";
}

function statusText(agent) {
  if (!agent?.connected) return "не в сети";
  if (agent.type === "demo") return "готов";
  if (!agent.readyAgainst) return "ждёт разрешения";
  const opponent = agentById(agent.readyAgainst);
  const mode = agent.readyMode || "fight";
  const modeName = mode === "market" ? "крипто-дуэль · " + (sourceNames[agent.readyExchange] || "источник не указан") : "бой";
  return "готов: " + modeName + " против " + (opponent?.name || String(agent.readyAgainst).slice(0, 8));
}

function agentById(id) {
  return state.agents.find((agent) => String(agent.id) === String(id));
}

function eligibleForMode(agent, mode) {
  return Boolean(agent?.connected && (agent.type === "demo" ||
    (agent.readyAgainst && (agent.readyMode || "fight") === mode &&
      (mode !== "market" || agent.readyExchange === els.exchangeSelect.value))));
}

function permittedPair(agent, opponent, mode) {
  return Boolean(agent && opponent && eligibleForMode(agent, mode) &&
    (agent.type === "demo" || String(agent.readyAgainst) === String(opponent.id)));
}

function visibleMatch() {
  return state.match && (state.match.mode || "fight") === state.mode ? state.match : null;
}

function setNotice(message, isError) {
  state.notice = { message, isError, until: Date.now() + 6500 };
  showSetupMessage();
}

function showSetupMessage() {
  let message = "";
  let isError = false;
  const ready = state.agents.filter((agent) => eligibleForMode(agent, state.mode)).length;
  const left = agentById(els.leftSelect.value);
  const right = agentById(els.rightSelect.value);
  const pairReady = permittedPair(left, right, state.mode) && permittedPair(right, left, state.mode);
  const matchName = state.mode === "market" ? "крипто-дуэли на " + (sourceNames[els.exchangeSelect.value] || "выбранной бирже") : "боя";
  if (state.notice && state.notice.until > Date.now()) {
    message = state.notice.message;
    isError = state.notice.isError;
  } else if (!state.online) {
    message = "Нет связи с сервером. Пробуем подключиться снова…";
    isError = true;
  } else if (state.match && state.match.status === "running") {
    message = (state.match.mode === "market" ? "Крипто-дуэль" : "Бой") + " идёт. Смотрите действия агентов ниже.";
  } else if (ready < 2) {
    message = "Для " + matchName + " нужны два готовых агента. Сейчас готовы: " + ready + ".";
  } else if (left && right && !pairReady) {
    message = state.mode === "market"
      ? "Владельцы должны разрешить выбранную пару и источник " + (sourceNames[els.exchangeSelect.value] || "котировок") + "."
      : "Владельцы должны разрешить бой с выбранным соперником.";
  } else if (left && right && String(left.id) !== String(right.id)) {
    message = state.mode === "market" ? "Агенты готовы. Запустите учебную дуэль." : "Агенты готовы. Запустите бой.";
  } else {
    message = "Агенты готовы. Выберите двух разных агентов.";
  }
  els.setupMessage.textContent = message;
  els.setupMessage.classList.toggle("error", isError);
}

function fillSelect(select, currentValue, agents) {
  const fragment = document.createDocumentFragment();
  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.textContent = agents.length ? "Выберите агента" : "Агенты пока не найдены";
  fragment.append(placeholder);
  for (const agent of agents) {
    const option = document.createElement("option");
    option.value = String(agent.id);
    option.textContent = String(agent.name) + " · " + statusText(agent);
    fragment.append(option);
  }
  select.replaceChildren(fragment);
  select.value = agents.some((agent) => String(agent.id) === currentValue) ? currentValue : "";
}

function renderAgentSelectors() {
  const signature = JSON.stringify([state.mode, els.exchangeSelect.value, ...state.agents.map((agent) => [agent.id, agent.name, agent.type, agent.connected, agent.readyAgainst, agent.readyMode, agent.readyExchange])]);
  if (signature === state.agentSignature) return;
  state.agentSignature = signature;

  const previousLeft = els.leftSelect.value;
  const previousRight = els.rightSelect.value;
  fillSelect(els.leftSelect, previousLeft, state.agents);
  fillSelect(els.rightSelect, previousRight, state.agents);
  const available = state.agents.filter((agent) => eligibleForMode(agent, state.mode));
  if (!els.leftSelect.value && available[0]) els.leftSelect.value = String(available[0].id);
  if (!els.rightSelect.value) {
    const candidate = available.find((agent) => String(agent.id) !== els.leftSelect.value);
    if (candidate) els.rightSelect.value = String(candidate.id);
  }
  els.leftSelect.disabled = !state.agents.length;
  els.rightSelect.disabled = !state.agents.length;
  updateSetupControls();
}

function updateSetupControls() {
  const left = agentById(els.leftSelect.value);
  const right = agentById(els.rightSelect.value);
  const locked = state.starting || state.match?.status === "running";
  for (const input of els.modeInputs) input.disabled = locked;
  els.exchangeSelect.disabled = locked;
  els.marketSetup.hidden = state.mode !== "market";
  els.leftHint.textContent = left ? agentType(left.type) + " · " + statusText(left) : "Выберите доступного агента";
  els.rightHint.textContent = right ? agentType(right.type) + " · " + statusText(right) : "Выберите доступного агента";
  const canStart = state.online && !state.starting &&
    (!state.match || state.match.status !== "running") &&
    left && right && left.connected && right.connected && String(left.id) !== String(right.id) &&
    permittedPair(left, right, state.mode) && permittedPair(right, left, state.mode);
  els.startButton.disabled = !canStart;
  els.startButton.querySelector("span:last-child").textContent = state.starting ? "Запускаем…" : (state.mode === "market" ? "Начать дуэль" : "Начать бой");
  if (!visibleMatch()) {
    if (state.mode === "market") renderMarketMatch(null);
    else renderPreview();
  }
  showSetupMessage();
}

function setConnection(online) {
  state.online = online;
  els.connectionStatus.classList.toggle("online", online);
  els.connectionStatus.classList.toggle("offline", !online);
  els.connectionStatus.lastChild.textContent = online ? " Арена в сети" : " Нет связи";
}

function updateMeter(meter, label, value, hasData) {
  const amount = numberInRange(value, 0, 100);
  meter.querySelector("span").style.width = hasData ? amount + "%" : "0%";
  meter.setAttribute("aria-valuenow", hasData ? String(amount) : "0");
  label.textContent = hasData ? Math.round(amount) + " / 100" : "—";
}

function updateFighter(side, fighter, type, isPreview) {
  const prefix = side === "left" ? "left" : "right";
  const root = byId(prefix + "Fighter");
  byId(prefix + "Name").textContent = fighter && fighter.name ? String(fighter.name) : "Ожидание агента";
  byId(prefix + "Type").textContent = fighter ? agentType(type) : "—";
  const hasData = Boolean(fighter);
  updateMeter(byId(prefix + "HpBar"), byId(prefix + "HpText"), fighter && fighter.hp, hasData);
  updateMeter(byId(prefix + "EnergyBar"), byId(prefix + "EnergyText"), fighter && fighter.energy, hasData);
  const rawAction = fighter && fighter.action;
  byId(prefix + "Action").textContent = isPreview || !rawAction ? "Готов к бою" : (actionNames[rawAction] || String(rawAction));
  root.classList.toggle("is-down", !isPreview && hasData && Number(fighter.hp) <= 0);
  const base = side === "left" ? 22 : 78;
  const position = fighter && !isPreview ? numberInRange(fighter.x, 5, 95) : base;
  const shift = Math.round((position - base) * 1.7);
  root.querySelector(".fighter-visual").style.setProperty("--move", shift + "px");
}

function renderPreview() {
  const left = agentById(els.leftSelect.value);
  const right = agentById(els.rightSelect.value);
  updateFighter("left", left ? { name: left.name, hp: 100, energy: 100 } : null, left && left.type, true);
  updateFighter("right", right ? { name: right.name, hp: 100, energy: 100 } : null, right && right.type, true);
}

function money(value, fallback = 0) {
  const amount = Number(value);
  return dollars.format(Number.isFinite(amount) ? amount : fallback);
}

function marketAction(action) {
  const raw = typeof action === "string" ? action : (action?.type || action?.action);
  return marketActionNames[String(raw || "").toLowerCase()] || (raw ? String(raw) : "Готов");
}

function updatePortfolio(side, data, isPreview) {
  const agent = isPreview ? agentById(els[side + "Select"].value) : null;
  const name = isPreview ? agent?.name : data?.name;
  const cash = isPreview ? 10000 : Number(data?.cash);
  const units = isPreview ? 0 : Number(data?.units);
  const equity = isPreview ? 10000 : Number(data?.equity);
  const safeEquity = Number.isFinite(equity) ? equity : 10000;
  const change = (safeEquity / 10000 - 1) * 100;
  byId(side + "MarketName").textContent = name ? String(name) : "Ожидание агента";
  byId(side + "MarketCash").textContent = money(cash, 10000);
  byId(side + "MarketUnits").textContent = Number.isFinite(units) ? unitsFormat.format(units) : "0";
  byId(side + "MarketEquity").textContent = money(safeEquity, 10000);
  const pnl = byId(side + "MarketPnl");
  pnl.textContent = (change > 0 ? "+" : "") + percentFormat.format(change) + "% от старта";
  pnl.classList.toggle("negative", change < 0);
  pnl.classList.toggle("positive", change > 0);
  byId(side + "MarketAction").textContent = isPreview ? "Готов" : marketAction(data?.action);
  byId(side + "Portfolio").classList.toggle("is-winner", !isPreview && data && String(data.agentId) === String(state.match?.winnerAgentId) && state.match?.winnerAgentId != null);
}

function renderMarketChart(history) {
  const points = Array.isArray(history) ? history.map((entry) => Number(entry?.price)).filter((price) => Number.isFinite(price) && price > 0) : [];
  const hasPoints = points.length > 0;
  els.marketChartEmpty.hidden = hasPoints;
  els.marketChartPoint.toggleAttribute("hidden", !hasPoints);
  if (!hasPoints) {
    els.marketChartLine.setAttribute("d", "");
    els.marketChartArea.setAttribute("d", "");
    els.marketChart.setAttribute("aria-label", "График цены BTC/USD появится после начала дуэли");
    return;
  }
  const low = Math.min(...points);
  const high = Math.max(...points);
  const spread = high - low;
  const pad = spread ? spread * .12 : Math.max(low * .002, 1);
  const min = low - pad;
  const max = high + pad;
  const coords = points.map((price, index) => {
    const x = 20 + (points.length === 1 ? 0 : index / (points.length - 1) * 760);
    const y = 235 - (price - min) / (max - min) * 210;
    return [Math.round(x * 10) / 10, Math.round(y * 10) / 10];
  });
  const line = coords.map(([x, y], index) => (index ? "L" : "M") + x + " " + y).join(" ");
  const first = coords[0];
  const last = coords[coords.length - 1];
  els.marketChartLine.setAttribute("d", line);
  els.marketChartArea.setAttribute("d", coords.length > 1 ? line + " L" + last[0] + " 250 L" + first[0] + " 250 Z" : "");
  els.marketChartPoint.setAttribute("cx", String(last[0]));
  els.marketChartPoint.setAttribute("cy", String(last[1]));
  const mod10 = points.length % 10;
  const mod100 = points.length % 100;
  const pointWord = mod10 === 1 && mod100 !== 11 ? "точка" :
    (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14) ? "точки" : "точек");
  els.marketChart.setAttribute("aria-label", "Исторический график BTC/USD: " + points.length + " " + pointWord + ", последняя цена " + money(points[points.length - 1]));
}

function renderMarketMatch(match) {
  const preview = !match;
  const finished = match?.status === "finished";
  els.marketMatchStatus.className = "match-status " + (preview ? "waiting" : (finished ? "completed" : "running"));
  els.marketMatchStatus.lastChild.textContent = preview ? " Ожидание дуэли" : (finished ? " Дуэль завершена" : " Дуэль идёт");
  els.marketTurnLabel.textContent = "ХОД " + (match?.turn ?? "—") + " / " + (match?.maxTurns ?? "—");
  els.marketMatchId.textContent = preview ? "Матч ещё не создан" : "Матч #" + String(match.id || "").slice(0, 12);
  const market = match?.market;
  const exchange = market?.exchange || els.exchangeSelect.value;
  els.marketSource.textContent = sourceNames[exchange] || String(exchange);
  els.marketPrice.textContent = market && Number.isFinite(Number(market.price)) ? money(market.price) : "—";
  els.marketDataKind.textContent = preview ? "Выберите агентов и источник котировок" : (market?.dataKind === "demo" ? "Демо-ряд · без подключения к бирже" : "Исторические котировки · реплей");
  els.marketChartEnd.textContent = preview ? "ТЕКУЩИЙ ХОД" : "ХОД " + (match.turn ?? "—");
  renderMarketChart(market?.history);
  updatePortfolio("left", match?.left, preview);
  updatePortfolio("right", match?.right, preview);
  const feeBps = Number(market?.feeBps);
  els.marketFee.textContent = "Комиссия: " + percentFormat.format(Number.isFinite(feeBps) ? feeBps / 100 : .1) + "% в учебном расчёте";
  if (finished) {
    const winner = [match.left, match.right].find((portfolio) => portfolio && String(portfolio.agentId) === String(match.winnerAgentId));
    els.marketWinner.textContent = winner && match.winnerAgentId != null ? "Победа по капиталу: " + String(winner.name) : "Ничья по капиталу";
    els.marketWinner.hidden = false;
  } else {
    els.marketWinner.hidden = true;
  }
}

function countLabel(count) {
  const mod10 = count % 10;
  const mod100 = count % 100;
  const word = mod10 === 1 && mod100 !== 11 ? "событие" : (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14) ? "события" : "событий");
  return String(count).padStart(2, "0") + " " + word;
}

function renderEvents(match) {
  const events = Array.isArray(match && match.events) ? match.events : [];
  const signature = state.mode + ":" + String(match && match.id || "") + ":" + JSON.stringify(events);
  if (signature === state.eventSignature) return;
  state.eventSignature = signature;
  els.eventCount.textContent = countLabel(events.length);
  if (!events.length) {
    const empty = document.createElement("li");
    empty.className = "empty-log";
    const dot = document.createElement("span");
    dot.className = "event-indicator";
    const text = document.createElement("div");
    text.textContent = match ? "Агенты готовятся к первому ходу…" :
      (state.mode === "market" ? "Здесь появятся учебные сделки после начала крипто-дуэли." : "Здесь появятся действия агентов после начала боя.");
    empty.append(dot, text);
    els.eventLog.replaceChildren(empty);
    return;
  }
  const fragment = document.createDocumentFragment();
  for (const event of events.slice(-80)) {
    const item = document.createElement("li");
    const dot = document.createElement("span");
    dot.className = "event-indicator";
    const turn = document.createElement("span");
    turn.className = "event-turn";
    turn.textContent = "ХОД " + (event.turn ?? "—");
    const message = document.createElement("span");
    message.textContent = String(event.text ?? "");
    item.append(dot, turn, message);
    fragment.append(item);
  }
  els.eventLog.replaceChildren(fragment);
  els.eventLog.scrollTop = els.eventLog.scrollHeight;
}

function animateTurn(match) {
  const key = String(match.id) + ":" + String(match.turn);
  if (key === state.lastAnimationKey) return;
  state.lastAnimationKey = key;
  if (!match.turn) return;
  for (const side of ["left", "right"]) {
    const fighter = match[side];
    if (!fighter || !fighter.action) continue;
    const node = byId(side + "Fighter");
    node.classList.remove("just-acted");
    void node.offsetWidth;
    node.classList.add("just-acted");
    window.setTimeout(() => node.classList.remove("just-acted"), 500);
  }
}

function renderMatch() {
  const match = visibleMatch();
  const isMarket = state.mode === "market";
  els.battleSection.hidden = isMarket;
  els.marketSection.hidden = !isMarket;
  els.logTitle.textContent = isMarket ? "Ход крипто-дуэли" : "Ход поединка";
  if (isMarket) {
    renderMarketMatch(match);
    renderEvents(match);
    return;
  }
  if (!match) {
    els.arena.dataset.phase = "idle";
    els.matchStatus.className = "match-status waiting";
    els.matchStatus.lastChild.textContent = " Ожидание боя";
    els.turnLabel.textContent = "ХОД — / —";
    els.matchId.textContent = "Матч ещё не создан";
    els.winnerBanner.hidden = true;
    state.lastAnimationKey = "";
    renderPreview();
    renderEvents(null);
    return;
  }

  const finished = match.status === "finished";
  els.arena.dataset.phase = finished ? "finished" : "running";
  els.matchStatus.className = "match-status " + (finished ? "completed" : "running");
  els.matchStatus.lastChild.textContent = finished ? " Бой завершён" : " Бой идёт";
  els.turnLabel.textContent = "ХОД " + (match.turn ?? "—") + " / " + (match.maxTurns ?? "—");
  els.matchId.textContent = "Матч #" + String(match.id || "").slice(0, 12);
  const left = match.left;
  const right = match.right;
  updateFighter("left", left, agentById(left && left.agentId)?.type, false);
  updateFighter("right", right, agentById(right && right.agentId)?.type, false);

  if (finished) {
    const winner = [left, right].find((fighter) => fighter && String(fighter.agentId) === String(match.winnerAgentId));
    els.winnerBanner.textContent = winner && match.winnerAgentId != null ? "Победа: " + String(winner.name) : "Ничья";
    els.winnerBanner.hidden = false;
  } else {
    els.winnerBanner.hidden = true;
  }
  renderEvents(match);
  animateTurn(match);
}

async function fetchJson(url, options = {}, timeoutMs = 5000) {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal, cache: "no-store" });
    const body = await response.text();
    let data = {};
    if (body) {
      try { data = JSON.parse(body); } catch { throw new Error("Сервер вернул неверный ответ."); }
    }
    if (!response.ok) {
      const detail = typeof data.error === "string" ? data.error : (typeof data.message === "string" ? data.message : "Ошибка " + response.status);
      throw new Error(detail);
    }
    return data;
  } catch (error) {
    if (error.name === "AbortError") throw new Error("Сервер не ответил вовремя.");
    throw error;
  } finally {
    window.clearTimeout(timeout);
  }
}

async function poll() {
  try {
    const data = await fetchJson("/api/state");
    if (!Array.isArray(data.agents)) throw new Error("Некорректное состояние арены.");
    setConnection(true);
    state.agents = data.agents;
    state.match = data.match || null;
    if (state.match && String(state.match.id) !== state.lastSeenMatchId) {
      state.lastSeenMatchId = String(state.match.id);
      state.mode = state.match.mode === "market" ? "market" : "fight";
      const modeInput = els.modeInputs.find((input) => input.value === state.mode);
      if (modeInput) modeInput.checked = true;
      if (state.match.market?.exchange && sourceNames[state.match.market.exchange]) {
        els.exchangeSelect.value = state.match.market.exchange;
      }
    }
    renderAgentSelectors();
    renderMatch();
    updateSetupControls();
  } catch (error) {
    setConnection(false);
    els.startButton.disabled = true;
    state.notice = { message: error.message || "Не удалось загрузить состояние арены.", isError: true, until: Date.now() + 1000 };
    showSetupMessage();
  } finally {
    window.setTimeout(poll, document.hidden ? 1500 : 500);
  }
}

async function startMatch() {
  if (els.startButton.disabled) return;
  state.starting = true;
  updateSetupControls();
  const isMarket = state.mode === "market";
  setNotice(isMarket ? "Готовим исторические котировки и запускаем дуэль…" : "Запускаем поединок…", false);
  try {
    await fetchJson("/api/matches", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode: state.mode, exchange: isMarket ? els.exchangeSelect.value : undefined,
        leftAgentId: els.leftSelect.value, rightAgentId: els.rightSelect.value })
    }, 12000);
    setNotice(isMarket ? "Учебная дуэль запущена. Смотрите портфели ниже." : "Поединок запущен. Смотрите арену ниже.", false);
    (isMarket ? els.marketSection : els.arena).scrollIntoView({ behavior: "smooth", block: "center" });
  } catch (error) {
    setNotice("Не удалось начать " + (isMarket ? "дуэль" : "бой") + ": " + error.message, true);
  } finally {
    state.starting = false;
    updateSetupControls();
  }
}

async function registerAgent(event) {
  event.preventDefault();
  if (state.registering) return;
  const name = els.agentName.value.trim();
  if (!name) {
    els.registerMessage.textContent = "Введите имя агента.";
    els.registerMessage.classList.add("error");
    return;
  }
  state.registering = true;
  els.registerButton.disabled = true;
  els.registerButton.textContent = "Создаём…";
  els.registerMessage.textContent = "";
  els.registerMessage.classList.remove("error");
  try {
    const data = await fetchJson("/api/agents", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name })
    });
    if (!data.id || !data.token) throw new Error("Сервер не вернул ID и токен.");
    els.agentIdValue.textContent = String(data.id);
    els.agentTokenValue.textContent = String(data.token);
    els.credentials.hidden = false;
    els.registerMessage.textContent = "Агент создан. Сохраните токен, запустите бота и разрешите ему один матч.";
    els.agentName.value = "";
  } catch (error) {
    els.registerMessage.textContent = "Не удалось создать агента: " + error.message;
    els.registerMessage.classList.add("error");
  } finally {
    state.registering = false;
    els.registerButton.disabled = false;
    els.registerButton.textContent = "Создать ID";
  }
}

els.leftSelect.addEventListener("change", updateSetupControls);
els.rightSelect.addEventListener("change", updateSetupControls);
for (const input of els.modeInputs) input.addEventListener("change", () => {
  if (!input.checked) return;
  state.mode = input.value;
  renderAgentSelectors();
  renderMatch();
  updateSetupControls();
});
els.exchangeSelect.addEventListener("change", () => {
  renderAgentSelectors();
  updateSetupControls();
  if (!visibleMatch()) renderMarketMatch(null);
});
els.startButton.addEventListener("click", startMatch);
els.registerForm.addEventListener("submit", registerAgent);
poll();
