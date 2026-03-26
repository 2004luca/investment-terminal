// ============================================================
// API — Twelvedata
// Price data for all quant and portfolio pages
// Free tier: 800 calls/day
// ============================================================

const TD_KEY = process.env.REACT_APP_TD_API_KEY;
const TD_BASE = 'https://api.twelvedata.com';

// ── Generic fetch wrapper ──
const fetchTD = async (endpoint) => {
  const response = await fetch(`${TD_BASE}${endpoint}&apikey=${TD_KEY}`);
  if (!response.ok) throw new Error(`Twelvedata request failed: ${response.status}`);
  const data = await response.json();
  if (data.status === 'error') throw new Error(data.message);
  return data;
};

// ============================================================
// QUOTE — Current price and key stats
// Used by: Portfolio Builder, all pages with ticker search
// ============================================================
export const fetchQuote = async (ticker) => {
  const t = ticker.toUpperCase();

  const quoteRes   = await fetch(`${TD_BASE}/quote?symbol=${t}&apikey=${TD_KEY}`);
  const quote      = await quoteRes.json();
  if (quote.status === 'error') throw new Error(quote.message);

  await new Promise(res => setTimeout(res, 500));

  const profileRes = await fetch(`${TD_BASE}/profile?symbol=${t}&apikey=${TD_KEY}`);
  const profile    = await profileRes.json();

  return {
    ticker:           quote.symbol,
    name:             quote.name,
    price:            parseFloat(quote.close),
    change:           parseFloat(quote.change),
    changePercent:    parseFloat(quote.percent_change) / 100,
    open:             parseFloat(quote.open),
    high:             parseFloat(quote.high),
    low:              parseFloat(quote.low),
    previousClose:    parseFloat(quote.previous_close),
    volume:           parseInt(quote.volume),
    avgVolume:        parseInt(quote.average_volume) || null,
    fiftyTwoWeekHigh: parseFloat(quote.fifty_two_week?.high) || null,
    fiftyTwoWeekLow:  parseFloat(quote.fifty_two_week?.low)  || null,
    exchange:         quote.exchange,
    currency:         'USD',
    sector:           profile?.sector      ?? null,
    industry:         profile?.industry    ?? null,
    description:      profile?.description ?? null,
  };
};

// ============================================================
// HISTORICAL PRICES — daily OHLCV data
// Used by: all quant and portfolio pages
// outputsize: number of data points (up to 5000 on free tier)
// ============================================================
export const fetchHistorical = async (ticker, outputsize = 365) => {
  const data = await fetchTD(
    `/time_series?symbol=${ticker.toUpperCase()}&interval=1day&outputsize=${outputsize}&`
  );

  if (!data.values) throw new Error(`No historical data for: ${ticker}`);

  // Twelvedata returns newest first — reverse for chronological order
  return [...data.values].reverse().map(d => ({
    date:     d.datetime,
    open:     parseFloat(d.open),
    high:     parseFloat(d.high),
    low:      parseFloat(d.low),
    close:    parseFloat(d.close),
    volume:   parseInt(d.volume),
    adjClose: parseFloat(d.close),
  }));
};

// ============================================================
// MULTIPLE TICKERS — fetch historical for several tickers
// Used by: Portfolio pages, Regression (stock + SPY)
// ============================================================
export const fetchMultipleHistorical = async (tickers, outputsize = 365) => {
  const results = {};
  for (const ticker of tickers) {
    try {
      results[ticker] = await fetchHistorical(ticker, outputsize);
      // Small delay between calls to respect rate limits
      await new Promise(res => setTimeout(res, 300));
    } catch (err) {
      console.warn(`Failed to fetch ${ticker}:`, err.message);
      results[ticker] = [];
    }
  }
  return results;
};