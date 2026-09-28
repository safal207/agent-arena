const MIN_CANDLES = 12;
const MAX_CANDLES = 287; // Coinbase permits at most 300 one-minute buckets per request.
const MINUTE_MS = 60_000;
const REQUEST_TIMEOUT_MS = 5_000;

function validateOptions(exchange, now, count) {
  if (!['coinbase', 'kraken', 'demo'].includes(exchange)) {
    throw new RangeError('Unsupported market data source');
  }
  if (!Number.isSafeInteger(now) || now < MINUTE_MS) {
    throw new RangeError('now must be a Unix timestamp in milliseconds');
  }
  if (!Number.isInteger(count) || count < MIN_CANDLES || count > MAX_CANDLES) {
    throw new RangeError(`count must be between ${MIN_CANDLES} and ${MAX_CANDLES}`);
  }
}

async function requestJson(url, fetchImpl, exchange) {
  if (typeof fetchImpl !== 'function') throw new TypeError('fetchImpl must be a function');
  const controller = new AbortController();
  let timer;
  try {
    return await Promise.race([
      (async () => {
        const response = await fetchImpl(url, {
          signal: controller.signal,
          headers: { accept: 'application/json' },
        });
        if (!response?.ok) {
          throw new Error(`${exchange} returned HTTP ${response?.status ?? 'error'}`);
        }
        try {
          return await response.json();
        } catch {
          throw new Error(`${exchange} returned invalid JSON`);
        }
      })(),
      new Promise((_, reject) => {
        timer = setTimeout(() => {
          reject(new Error(`${exchange} request timed out`));
          controller.abort();
        }, REQUEST_TIMEOUT_MS);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

function parseCandle(row, minimumLength, exchange) {
  const validNumber = value => typeof value === 'number' || typeof value === 'string';
  if (!Array.isArray(row) || row.length < minimumLength ||
      !validNumber(row[0]) || !validNumber(row[4])) {
    throw new Error(`${exchange} returned an invalid candle`);
  }
  const seconds = Number(row[0]);
  const close = Number(row[4]);
  if (!Number.isSafeInteger(seconds) || seconds <= 0 || seconds % 60 !== 0 ||
      !Number.isFinite(close) || close <= 0) {
    throw new Error(`${exchange} returned an invalid candle`);
  }
  return { time: seconds * 1_000, close };
}

function normalizeCandles(rows, minimumLength, exchange, currentMinuteStart, count) {
  if (!Array.isArray(rows)) throw new Error(`${exchange} returned invalid candle data`);
  const byTime = new Map();
  for (const row of rows) {
    const candle = parseCandle(row, minimumLength, exchange);
    if (candle.time < currentMinuteStart) byTime.set(candle.time, candle);
  }
  const candles = [...byTime.values()].sort((a, b) => a.time - b.time).slice(-count);
  if (candles.length < MIN_CANDLES) {
    throw new Error(`${exchange} returned fewer than ${MIN_CANDLES} closed candles`);
  }
  return candles;
}

function demoCandles(currentMinuteStart, count) {
  return Array.from({ length: count }, (_, index) => {
    const time = currentMinuteStart - (count - index) * MINUTE_MS;
    const minute = time / MINUTE_MS;
    const close = Math.round((65_000 + 430 * Math.sin(minute / 11) +
      180 * Math.sin(minute / 3.7) + 90 * Math.cos(minute / 23)) * 100) / 100;
    return { time, close };
  });
}

/** Load recent, closed BTC/USD one-minute candles from a fixed public source. */
export async function loadMarketCandles(exchange, {
  fetchImpl = globalThis.fetch,
  now = Date.now(),
  count = 24,
} = {}) {
  validateOptions(exchange, now, count);
  const currentMinuteStart = Math.floor(now / MINUTE_MS) * MINUTE_MS;
  const fetchedAt = new Date(now).toISOString();

  if (exchange === 'demo') {
    return {
      exchange, symbol: 'BTC/USD', dataKind: 'demo',
      candles: demoCandles(currentMinuteStart, count), fetchedAt,
    };
  }

  let rows;
  let minimumLength;
  if (exchange === 'coinbase') {
    const end = currentMinuteStart;
    const start = end - (count + MIN_CANDLES) * MINUTE_MS;
    const url = new URL('https://api.exchange.coinbase.com/products/BTC-USD/candles');
    url.searchParams.set('granularity', '60');
    url.searchParams.set('start', new Date(start).toISOString());
    url.searchParams.set('end', new Date(end).toISOString());
    rows = await requestJson(url.toString(), fetchImpl, exchange);
    minimumLength = 6; // [time, low, high, open, close, volume]
  } else {
    const url = new URL('https://api.kraken.com/0/public/OHLC');
    url.searchParams.set('pair', 'BTC/USD');
    url.searchParams.set('assetVersion', '1');
    url.searchParams.set('interval', '1');
    const response = await requestJson(url.toString(), fetchImpl, exchange);
    if (!Array.isArray(response?.error)) throw new Error('kraken returned invalid response');
    if (response.error.length) throw new Error(`kraken API error: ${response.error.join(', ')}`);
    if (!Array.isArray(response.result?.['BTC/USD'])) {
      throw new Error('kraken returned invalid candle data');
    }
    rows = response.result['BTC/USD'].slice(0, -1); // The final Kraken OHLC row is always open.
    minimumLength = 8; // [time, open, high, low, close, vwap, volume, count]
  }

  return {
    exchange, symbol: 'BTC/USD', dataKind: 'exchange',
    candles: normalizeCandles(rows, minimumLength, exchange, currentMinuteStart, count),
    fetchedAt,
  };
}
