// ============================================================
// API — Alpha Vantage
// Free tier: 25 calls/day, no CORS issues, no proxy needed
// Docs: https://www.alphavantage.co/documentation/
// ============================================================

const API_KEY = process.env.REACT_APP_AV_API_KEY;
const BASE = 'https://www.alphavantage.co/query';

// ── Generic fetch wrapper ──
const fetchAV = async (params) => {
  const query = new URLSearchParams({ ...params, apikey: API_KEY });
  const response = await fetch(`${BASE}?${query}`);
  if (!response.ok) throw new Error(`AV request failed: ${response.status}`);
  const data = await response.json();
  if (data['Error Message']) throw new Error(data['Error Message']);
  if (data['Note']) throw new Error('API call limit reached. Alpha Vantage free tier: 25 calls/day.');
  if (data['Information']) throw new Error('Rate limit hit — wait 1 minute and try again. Free tier: 25 calls/day.');
  return data;
};

// ============================================================
// QUOTE — Current price and key stats
// Used by: StockSearch
// ============================================================
export const fetchQuote = async (ticker) => {
  const [overview, globalQuote] = await Promise.all([
    fetchAV({ function: 'OVERVIEW', symbol: ticker.toUpperCase() }),
    fetchAV({ function: 'GLOBAL_QUOTE', symbol: ticker.toUpperCase() }),
  ]);

  const q = globalQuote['Global Quote'];
  if (!q || !q['05. price']) throw new Error(`No data found for ticker: ${ticker}`);

  return {
    ticker:           q['01. symbol'],
    name:             overview['Name'] ?? ticker,
    price:            parseFloat(q['05. price']),
    change:           parseFloat(q['09. change']),
    changePercent:    parseFloat(q['10. change percent']) / 100,
    open:             parseFloat(q['02. open']),
    high:             parseFloat(q['03. high']),
    low:              parseFloat(q['04. low']),
    previousClose:    parseFloat(q['08. previous close']),
    volume:           parseInt(q['06. volume']),
    marketCap:        parseFloat(overview['MarketCapitalization']) || null,
    fiftyTwoWeekHigh: parseFloat(q['03. high']) || parseFloat(overview['52WeekHigh']),
    fiftyTwoWeekLow:  parseFloat(q['04. low'])  || parseFloat(overview['52WeekLow']),
    exchange:         overview['Exchange'] ?? '',
    currency:         'USD',
    eps:              parseFloat(overview['EPS']) || null,
    pe:               parseFloat(overview['PERatio']) || null,
    sector:           overview['Sector'] ?? null,
    industry:         overview['Industry'] ?? null,
    description:      overview['Description'] ?? null,
  };
};

// ============================================================
// HISTORICAL PRICES — daily OHLCV data
// Used by: StockSearch, TechnicalAnalysis, QuantAnalysis
// ============================================================
export const fetchHistorical = async (ticker, outputsize = 'compact') => {
  // compact = last 100 days, full = 20 years
  const data = await fetchAV({
    function:   'TIME_SERIES_DAILY',
    symbol:     ticker.toUpperCase(),
    outputsize: outputsize,
  });

const series = data['Time Series (Daily)'];
console.log('AV response:', JSON.stringify(data));
console.log('Series exists:', !!series);
if (!series) throw new Error(`No historical data for: ${ticker}`);
  // Convert object to array, sort chronologically
  return Object.entries(series)
    .map(([date, v]) => ({
      date,
      open:     parseFloat(v['1. open']),
      high:     parseFloat(v['2. high']),
      low:      parseFloat(v['3. low']),
      close:    parseFloat(v['4. close']),
      volume:   parseInt(v['5. volume']),
      adjClose: parseFloat(v['4. close']),
    }))
    .sort((a, b) => new Date(a.date) - new Date(b.date));
};

// ============================================================
// FUNDAMENTALS — Ratios, margins, financial health
// Used by: Fundamentals page
// ============================================================
export const fetchFundamentals = async (ticker) => {
  const overview = await fetchAV({
    function: 'OVERVIEW',
    symbol:   ticker.toUpperCase(),
  });

  const income = await fetchAV({
    function: 'INCOME_STATEMENT',
    symbol:   ticker.toUpperCase(),
  });

  const balance = await fetchAV({
    function: 'BALANCE_SHEET',
    symbol:   ticker.toUpperCase(),
  });

  const annualIncome  = income?.annualReports  ?? [];
  const annualBalance = balance?.annualReports ?? [];

  return {
    // Valuation
    peRatio:         parseFloat(overview['PERatio'])             || null,
    forwardPE:       parseFloat(overview['ForwardPE'])           || null,
    pbRatio:         parseFloat(overview['PriceToBookRatio'])    || null,
    evEbitda:        parseFloat(overview['EVToEBITDA'])          || null,
    evRevenue:       parseFloat(overview['EVToRevenue'])         || null,
    priceToSales:    parseFloat(overview['PriceToSalesRatioTTM'])|| null,

    // Profitability
    returnOnEquity:  parseFloat(overview['ReturnOnEquityTTM'])   || null,
    returnOnAssets:  parseFloat(overview['ReturnOnAssetsTTM'])   || null,
    grossMargin:     parseFloat(overview['GrossProfitTTM'])      || null,
    operatingMargin: parseFloat(overview['OperatingMarginTTM'])  || null,
    profitMargin:    parseFloat(overview['ProfitMargin'])        || null,

    // Financial health
    currentRatio:    parseFloat(overview['CurrentRatio'])        || null,
    quickRatio:      parseFloat(overview['QuickRatio'])          || null,
    debtToEquity:    parseFloat(overview['DebtToEquityRatio'])   || null,

    // Income statement history (last 5 years, chronological)
    incomeHistory: [...annualIncome].reverse().map(s => ({
      date:            s.fiscalDateEnding,
      revenue:         parseFloat(s.totalRevenue)      || null,
      grossProfit:     parseFloat(s.grossProfit)       || null,
      operatingIncome: parseFloat(s.operatingIncome)   || null,
      netIncome:       parseFloat(s.netIncome)         || null,
      eps:             parseFloat(s.reportedEPS)       || null,
    })),

    // Balance sheet history
    balanceHistory: [...annualBalance].reverse().map(s => ({
      date:              s.fiscalDateEnding,
      totalAssets:       parseFloat(s.totalAssets)              || null,
      totalLiabilities:  parseFloat(s.totalLiabilities)         || null,
      shareholderEquity: parseFloat(s.totalShareholderEquity)   || null,
    })),
  };
};

// ============================================================
// SENTIMENT — Analyst ratings, price targets
// Used by: Sentiment page
// ============================================================
export const fetchSentiment = async (ticker) => {
  const overview = await fetchAV({
    function: 'OVERVIEW',
    symbol:   ticker.toUpperCase(),
  });

  return {
    targetHighPrice:   parseFloat(overview['AnalystTargetPrice']) || null,
    targetLowPrice:    null,
    targetMeanPrice:   parseFloat(overview['AnalystTargetPrice']) || null,
    targetMedianPrice: null,
    recommendationKey: overview['AnalystRatingBuy'] ? 'buy' : null,
    trend: [],
  };
};

// ============================================================
// HISTORICAL PRICES — Yahoo Finance (no proxy needed for chart endpoint)
// Replaces Alpha Vantage historical — no premium restrictions
// range: '1mo', '3mo', '6mo', '1y', '2y', '5y'
// ============================================================
export const fetchHistoricalYahoo = async (ticker, range = '1y') => {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${ticker.toUpperCase()}?range=${range}&interval=1d`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Yahoo request failed: ${response.status}`);
  const data = await response.json();

  const result = data?.chart?.result?.[0];
  if (!result) throw new Error(`No historical data for: ${ticker}`);

  const timestamps = result.timestamp;
  const quote = result.indicators.quote[0];

  return timestamps.map((ts, i) => ({
    date:     new Date(ts * 1000).toISOString().split('T')[0],
    open:     quote.open[i],
    high:     quote.high[i],
    low:      quote.low[i],
    close:    quote.close[i],
    volume:   quote.volume[i],
    adjClose: quote.close[i],
  })).filter(d => d.close !== null);
};
// ============================================================
// HISTORICAL PRICES — Twelvedata
// Free tier: 800 calls/day, no CORS issues
// outputsize: number of data points (max 5000 on free tier)
// ============================================================
export const fetchHistoricalTD = async (ticker, outputsize = 365) => {
  const key = process.env.REACT_APP_TD_API_KEY;
  const url = `https://api.twelvedata.com/time_series?symbol=${ticker.toUpperCase()}&interval=1day&outputsize=${outputsize}&apikey=${key}`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Twelvedata request failed: ${response.status}`);
  const data = await response.json();
  if (data.status === 'error') throw new Error(data.message);

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
// QUOTE — Twelvedata
// Replaces Alpha Vantage quote to avoid 25 call/day limit
// ============================================================
export const fetchQuoteTD = async (ticker) => {
  const key = process.env.REACT_APP_TD_API_KEY;
  const t = ticker.toUpperCase();

  const quoteRes   = await fetch(`https://api.twelvedata.com/quote?symbol=${t}&apikey=${key}`);
  const quote      = await quoteRes.json();


  await new Promise(res => setTimeout(res, 500));
  const profileRes = await fetch(`https://api.twelvedata.com/profile?symbol=${t}&apikey=${key}`);
  const profile    = await profileRes.json();


  if (quote.status === 'error') throw new Error(quote.message);

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
    volume:    parseInt(quote.volume),
    avgVolume: parseInt(quote.average_volume) || null,
    fiftyTwoWeekHigh: parseFloat(quote.fifty_two_week?.high) || null,
    fiftyTwoWeekLow:  parseFloat(quote.fifty_two_week?.low)  || null,    
    exchange:         quote.exchange,
    currency:         quote.currency,
    eps:              null,
    pe:               null,
    sector:           profile?.sector    ?? null,
    industry:         profile?.industry  ?? null,
    description:      profile?.description ?? null,
  };
};