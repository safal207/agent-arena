export const PAPER_ACTIONS = Object.freeze(['buy', 'sell', 'hold']);

const START_CASH = 10000;
const TRADE_FRACTION = 0.25;
const FEE_BPS = 10;
const round = (value, places) => Math.round((value + Number.EPSILON) * 10 ** places) / 10 ** places;

export function createPaperMatch(id, leftAgent, rightAgent, dataset) {
  if (leftAgent.id === rightAgent.id) throw new Error('Agents must differ');
  if (!Array.isArray(dataset.candles) || dataset.candles.length < 2) throw new Error('Insufficient candles');
  const portfolio = agent => ({
    agentId: agent.id,
    name: agent.name,
    cash: START_CASH,
    units: 0,
    equity: START_CASH,
    action: 'hold',
  });
  return {
    id,
    mode: 'market',
    status: 'running',
    turn: 0,
    maxTurns: dataset.candles.length,
    winnerAgentId: null,
    left: portfolio(leftAgent),
    right: portfolio(rightAgent),
    market: {
      exchange: dataset.exchange,
      symbol: dataset.symbol,
      dataKind: dataset.dataKind,
      price: dataset.candles[0].close,
      history: [],
      feeBps: FEE_BPS,
      fetchedAt: dataset.fetchedAt,
    },
    events: [{ turn: 0, text: `Учебная дуэль ${leftAgent.name} и ${rightAgent.name}: по $10 000 виртуального капитала.` }],
  };
}

export function paperObservation(match, side, candle) {
  const self = match[side];
  const opponent = match[side === 'left' ? 'right' : 'left'];
  return {
    turn: match.turn + 1,
    maxTurns: match.maxTurns,
    symbol: match.market.symbol,
    exchange: match.market.exchange,
    dataKind: match.market.dataKind,
    price: candle.close,
    recentPrices: [...match.market.history.slice(-7).map(point => point.price), candle.close],
    self: { cash: self.cash, units: self.units, equity: round(self.cash + self.units * candle.close, 2) },
    opponent: { equity: round(opponent.cash + opponent.units * candle.close, 2) },
    feeBps: FEE_BPS,
    tradeFraction: TRADE_FRACTION,
  };
}

function applyAction(portfolio, proposed, price) {
  const action = PAPER_ACTIONS.includes(proposed) ? proposed : 'hold';
  portfolio.action = action;
  if (action === 'buy') {
    const spend = round(portfolio.cash * TRADE_FRACTION, 2);
    if (spend < 1) return `${portfolio.name}: недостаточно виртуальных USD для покупки.`;
    const fee = spend * FEE_BPS / 10000;
    portfolio.cash = round(portfolio.cash - spend, 2);
    portfolio.units = round(portfolio.units + (spend - fee) / price, 8);
    return `${portfolio.name}: купил BTC на $${spend.toFixed(2)}.`;
  }
  if (action === 'sell') {
    const units = round(portfolio.units * TRADE_FRACTION, 8);
    if (units * price < 1) return `${portfolio.name}: недостаточно виртуальных BTC для продажи.`;
    const proceeds = units * price;
    const fee = proceeds * FEE_BPS / 10000;
    portfolio.units = round(portfolio.units - units, 8);
    portfolio.cash = round(portfolio.cash + proceeds - fee, 2);
    return `${portfolio.name}: продал ${units.toFixed(8)} BTC.`;
  }
  return `${portfolio.name}: держит позицию.`;
}

export function resolvePaperTurn(previous, proposedLeft, proposedRight, candle) {
  if (previous.mode !== 'market' || previous.status !== 'running') throw new Error('Paper match is not running');
  const price = Number(candle?.close);
  if (!Number.isFinite(price) || price <= 0) throw new Error('Invalid market price');
  const match = {
    ...previous,
    turn: previous.turn + 1,
    left: { ...previous.left },
    right: { ...previous.right },
    market: { ...previous.market, history: [...previous.market.history] },
    events: [...previous.events],
  };
  const leftEvent = applyAction(match.left, proposedLeft, price);
  const rightEvent = applyAction(match.right, proposedRight, price);
  match.left.equity = round(match.left.cash + match.left.units * price, 2);
  match.right.equity = round(match.right.cash + match.right.units * price, 2);
  match.market.price = price;
  match.market.history.push({ turn: match.turn, price });
  match.events.push({ turn: match.turn, text: leftEvent }, { turn: match.turn, text: rightEvent });
  match.events = match.events.slice(-60);

  if (match.turn >= match.maxTurns) {
    match.status = 'finished';
    const difference = round(match.left.equity - match.right.equity, 2);
    if (difference > 0) match.winnerAgentId = match.left.agentId;
    if (difference < 0) match.winnerAgentId = match.right.agentId;
    match.events.push({ turn: match.turn, text: match.winnerAgentId
      ? `Учебная победа: ${match.winnerAgentId === match.left.agentId ? match.left.name : match.right.name}.`
      : 'Учебная ничья.' });
  }
  return match;
}
