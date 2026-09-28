import test from 'node:test';
import assert from 'node:assert/strict';
import { loadMarketCandles } from '../market-data.mjs';

const NOW = Date.UTC(2026, 8, 27, 12, 34, 30);
const CURRENT_MINUTE = Math.floor(NOW / 60_000) * 60_000;
const CURRENT_SECOND = CURRENT_MINUTE / 1_000;

const ok = body => ({ ok: true, status: 200, json: async () => body });
const coinbaseRow = (second, close) => [second, close - 2, close + 2, close - 1, close, 1.5];
const krakenRow = (second, close) => [second, String(close - 1), String(close + 2),
  String(close - 2), String(close), String(close - 0.5), '1.5', 3];

test('Coinbase uses only closed candles, sorts and deduplicates them', async () => {
  const rows = Array.from({ length: 27 }, (_, index) =>
    coinbaseRow(CURRENT_SECOND - index * 60, 70_000 + index));
  rows.push(coinbaseRow(CURRENT_SECOND - 10 * 60, 70_010));
  let requestedUrl;
  let signal;
  const result = await loadMarketCandles('coinbase', {
    now: NOW,
    count: 24,
    fetchImpl: async (url, options) => {
      requestedUrl = new URL(url);
      signal = options.signal;
      return ok(rows);
    },
  });

  assert.equal(requestedUrl.origin, 'https://api.exchange.coinbase.com');
  assert.equal(requestedUrl.pathname, '/products/BTC-USD/candles');
  assert.equal(requestedUrl.searchParams.get('granularity'), '60');
  assert.equal(requestedUrl.searchParams.get('end'), new Date(CURRENT_MINUTE).toISOString());
  assert.ok(Date.parse(requestedUrl.searchParams.get('start')) < CURRENT_MINUTE);
  assert.ok(signal instanceof AbortSignal);
  assert.deepEqual(Object.keys(result).sort(), ['candles', 'dataKind', 'exchange', 'fetchedAt', 'symbol']);
  assert.equal(result.exchange, 'coinbase');
  assert.equal(result.symbol, 'BTC/USD');
  assert.equal(result.dataKind, 'exchange');
  assert.equal(result.fetchedAt, new Date(NOW).toISOString());
  assert.equal(result.candles.length, 24);
  assert.equal(result.candles[0].time, CURRENT_MINUTE - 24 * 60_000);
  assert.equal(result.candles.at(-1).time, CURRENT_MINUTE - 60_000);
  assert.equal(result.candles.at(-1).close, 70_001);
  assert.ok(result.candles.every((candle, index, list) =>
    candle.time < CURRENT_MINUTE && (index === 0 || candle.time > list[index - 1].time)));
});

test('Kraken requests display pair names and drops its final open row', async () => {
  const closed = Array.from({ length: 15 }, (_, index) =>
    krakenRow(CURRENT_SECOND - (15 - index) * 60, 80_000 + index));
  const rows = [...closed, krakenRow(CURRENT_SECOND - 60, 999_999)];
  let requestedUrl;
  const result = await loadMarketCandles('kraken', {
    now: NOW,
    count: 14,
    fetchImpl: async url => {
      requestedUrl = new URL(url);
      return ok({ error: [], result: { 'BTC/USD': rows, last: CURRENT_SECOND } });
    },
  });

  assert.equal(requestedUrl.origin, 'https://api.kraken.com');
  assert.equal(requestedUrl.pathname, '/0/public/OHLC');
  assert.equal(requestedUrl.searchParams.get('pair'), 'BTC/USD');
  assert.equal(requestedUrl.searchParams.get('assetVersion'), '1');
  assert.equal(requestedUrl.searchParams.get('interval'), '1');
  assert.equal(result.dataKind, 'exchange');
  assert.equal(result.candles.length, 14);
  assert.equal(result.candles.at(-1).close, 80_014);
  assert.ok(result.candles.every(candle => candle.close !== 999_999 && candle.time < CURRENT_MINUTE));
});

test('demo data is synthetic, deterministic and requires no network', async () => {
  const options = {
    now: NOW,
    count: 24,
    fetchImpl: () => { throw new Error('Unexpected network request'); },
  };
  const first = await loadMarketCandles('demo', options);
  const second = await loadMarketCandles('demo', options);
  assert.deepEqual(first, second);
  assert.equal(first.dataKind, 'demo');
  assert.equal(first.candles.length, 24);
  assert.equal(first.candles.at(-1).time, CURRENT_MINUTE - 60_000);
  assert.ok(first.candles.every(candle => Number.isFinite(candle.close) && candle.close > 0));
});

test('live source errors are surfaced instead of falling back to demo data', async () => {
  await assert.rejects(() => loadMarketCandles('binance', { now: NOW }), /Unsupported/);
  await assert.rejects(() => loadMarketCandles('coinbase', { now: NOW, count: 11 }), /count/);
  await assert.rejects(() => loadMarketCandles('coinbase', {
    now: NOW, fetchImpl: async () => ({ ok: false, status: 429 }),
  }), /HTTP 429/);
  await assert.rejects(() => loadMarketCandles('kraken', {
    now: NOW, fetchImpl: async () => ok({ error: ['EGeneral:Temporary lockout'], result: {} }),
  }), /Kraken|kraken API error/i);
  await assert.rejects(() => loadMarketCandles('kraken', {
    now: NOW, fetchImpl: async () => ok({ error: [], result: { XXBTZUSD: [] } }),
  }), /invalid candle data/);
});

test('malformed and insufficient closed candles are rejected', async () => {
  const eleven = Array.from({ length: 11 }, (_, index) =>
    coinbaseRow(CURRENT_SECOND - (index + 1) * 60, 60_000 + index));
  await assert.rejects(() => loadMarketCandles('coinbase', {
    now: NOW, fetchImpl: async () => ok(eleven),
  }), /fewer than 12/);
  await assert.rejects(() => loadMarketCandles('coinbase', {
    now: NOW, fetchImpl: async () => ok([...eleven, [CURRENT_SECOND - 720, 1, 2, 3, 'not a price']]),
  }), /invalid candle/);
  await assert.rejects(() => loadMarketCandles('kraken', {
    now: NOW, fetchImpl: async () => ok({ error: [], result: { 'BTC/USD': [
      ...eleven.map(row => krakenRow(row[0], row[4])),
      krakenRow(CURRENT_SECOND, 60_000),
    ] } }),
  }), /fewer than 12/);
});

test('a stalled exchange request is aborted after the network timeout', { timeout: 8_000 }, async () => {
  let signal;
  await assert.rejects(() => loadMarketCandles('coinbase', {
    now: NOW,
    fetchImpl: async (_url, options) => {
      signal = options.signal;
      return new Promise(() => {});
    },
  }), /request timed out/);
  assert.equal(signal.aborted, true);
});
