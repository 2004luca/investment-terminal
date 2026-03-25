// ============================================================
// API — Yahoo Finance data fetching
// All functions return clean, normalized data objects
// We use the unofficial Yahoo Finance API via a CORS proxy
// ============================================================

const PROXY = 'https://cors-anywhere.herokuapp.com/';
const YF_BASE = 'https://query1.finance.yahoo.com/v8/finance';
const YF_BASE_V10 = 'https://query1.finance.yahoo.com/v10/finance';

// ── Generic fetch wrapper ──
// Every API call goes through this — handles errors in one place
const fetchYahoo = async (url) => {
  const response = await fetch(PROXY + url, {
    headers: {
      'X-Requested-With': 'XMLHttpRequest',
    },
  });
  if (!response.ok) {
    throw new Error(`Yahoo Finance request failed: ${response.status}`);
  }
  return response.json();
};

// ============================================================
// QUOTE — Current price, market cap, basic info
// Used by: StockSearch, PortfolioBuilder
// ============================================================
export const fetchQuote = async (ticker) => {
  const url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${ticker.toUpperCase()}`;
  const data = await fetchYahoo(url);
  const q = data?.quoteResponse?.result?.[0];
  if (!q) throw new Error(`No data found for ticker: ${ticker}`);

  return {
    ticker: q.symbol,
    name: q.longName || q.shortName || ticker,
    price: q.regularMarketPrice,
    change: q.regularMarketChange,
    changePercent: q.regularMarketChangePercent / 100,
    open: q.regularMarketOpen,
    high: q.regularMarketDayHigh,
    low: q.regularMarketDayLow,
    previousClose: q.regularMarketPreviousClose,
    volume: q.regularMarketVolume,
    marketCap: q.marketCap,
    fiftyTwoWeekHigh: q.fiftyTwoWeekHigh,
    fiftyTwoWeekLow: q.fiftyTwoWeekLow,
    exchange: q.fullExchangeName,
    currency: q.currency,
  };
};

// ============================================================
// HISTORICAL PRICES — OHLCV data for charts
// interval: '1d', '1wk', '1mo'
// range:    '1mo', '3mo', '6mo', '1y', '2y', '5y'
// Used by: StockSearch, TechnicalAnalysis, QuantAnalysis
// ============================================================
export const fetchHistorical = async (ticker, range = '1y', interval = '1d') => {
  const url = `${YF_BASE}/chart/${ticker.toUpperCase()}?range=${range}&interval=${interval}&includeAdjustedClose=true`;
  const data = await fetchYahoo(url);
  const result = data?.chart?.result?.[0];
  if (!result) throw new Error(`No historical data for: ${ticker}`);

  const timestamps = result.timestamp;
  const quote = result.indicators.quote[0];
  const adjClose = result.indicators.adjclose?.[0]?.adjclose;

  // Zip all arrays into array of OHLCV objects
  return timestamps.map((ts, i) => ({
    date: new Date(ts * 1000).toISOString().split('T')[0],
    open:   quote.open[i],
    high:   quote.high[i],
    low:    quote.low[i],
    close:  quote.close[i],
    volume: quote.volume[i],
    adjClose: adjClose?.[i] ?? quote.close[i],
  })).filter(d => d.close !== null); // remove null entries
};

// ============================================================
// FUNDAMENTALS — Financial ratios and summary detail
// Used by: Fundamentals page
// ============================================================
export const fetchFundamentals = async (ticker) => {
  const url = `${YF_BASE_V10}/quoteSummary/${ticker.toUpperCase()}?modules=summaryDetail,defaultKeyStatistics,financialData,incomeStatementHistory,balanceSheetHistory`;
  const data = await fetchYahoo(url);
  const result = data?.quoteSummary?.result?.[0];
  if (!result) throw new Error(`No fundamentals data for: ${ticker}`);

  const sd  = result.summaryDetail;
  const ks  = result.defaultKeyStatistics;
  const fd  = result.financialData;
  const ish = result.incomeStatementHistory?.incomeStatementHistory ?? [];
  const bsh = result.balanceSheetHistory?.balanceSheetHistory ?? [];

  return {
    // Valuation
    peRatio:        sd?.trailingPE?.raw ?? null,
    forwardPE:      sd?.forwardPE?.raw ?? null,
    pbRatio:        ks?.priceToBook?.raw ?? null,
    evEbitda:       ks?.enterpriseToEbitda?.raw ?? null,
    evRevenue:      ks?.enterpriseToRevenue?.raw ?? null,
    priceToSales:   sd?.priceToSalesTrailing12Months?.raw ?? null,

    // Profitability
    returnOnEquity:  fd?.returnOnEquity?.raw ?? null,
    returnOnAssets:  fd?.returnOnAssets?.raw ?? null,
    grossMargin:     fd?.grossMargins?.raw ?? null,
    operatingMargin: fd?.operatingMargins?.raw ?? null,
    profitMargin:    fd?.profitMargins?.raw ?? null,

    // Growth
    revenueGrowth:  fd?.revenueGrowth?.raw ?? null,
    earningsGrowth: fd?.earningsGrowth?.raw ?? null,

    // Financial health
    totalCash:       fd?.totalCash?.raw ?? null,
    totalDebt:       fd?.totalDebt?.raw ?? null,
    debtToEquity:    fd?.debtToEquity?.raw ?? null,
    currentRatio:    fd?.currentRatio?.raw ?? null,
    quickRatio:      fd?.quickRatio?.raw ?? null,
    freeCashFlow:    fd?.freeCashflow?.raw ?? null,

    // Income statement history (last 4 years)
    incomeHistory: ish.map(s => ({
      date:            s.endDate?.fmt ?? '',
      revenue:         s.totalRevenue?.raw ?? null,
      grossProfit:     s.grossProfit?.raw ?? null,
      operatingIncome: s.operatingIncome?.raw ?? null,
      netIncome:       s.netIncome?.raw ?? null,
      eps:             s.basicEPS?.raw ?? null,
    })),

    // Balance sheet history
    balanceHistory: bsh.map(s => ({
      date:              s.endDate?.fmt ?? '',
      totalAssets:       s.totalAssets?.raw ?? null,
      totalLiabilities:  s.totalLiab?.raw ?? null,
      shareholderEquity: s.totalStockholderEquity?.raw ?? null,
    })),
  };
};

// ============================================================
// SENTIMENT — Analyst ratings, price targets, recommendations
// Used by: Sentiment page
// ============================================================
export const fetchSentiment = async (ticker) => {
  const url = `${YF_BASE_V10}/quoteSummary/${ticker.toUpperCase()}?modules=recommendationTrend,financialData,defaultKeyStatistics,institutionOwnership`;
  const data = await fetchYahoo(url);
  const result = data?.quoteSummary?.result?.[0];
  if (!result) throw new Error(`No sentiment data for: ${ticker}`);

  const rt = result.recommendationTrend?.trend ?? [];
  const fd = result.financialData;
  const ks = result.defaultKeyStatistics;

  return {
    // Analyst consensus
    recommendationKey:  fd?.recommendationKey ?? null,
    recommendationMean: fd?.recommendationMean?.raw ?? null,
    numberOfAnalysts:   fd?.numberOfAnalystOpinions?.raw ?? null,
    targetHighPrice:    fd?.targetHighPrice?.raw ?? null,
    targetLowPrice:     fd?.targetLowPrice?.raw ?? null,
    targetMeanPrice:    fd?.targetMeanPrice?.raw ?? null,
    targetMedianPrice:  fd?.targetMedianPrice?.raw ?? null,

    // Short interest
    shortRatio:         ks?.shortRatio?.raw ?? null,
    shortPercentFloat:  ks?.shortPercentOfFloat?.raw ?? null,
    sharesShort:        ks?.sharesShort?.raw ?? null,

    // Recommendation trend (last 4 months)
    trend: rt.map(t => ({
      period:     t.period,
      strongBuy:  t.strongBuy,
      buy:        t.buy,
      hold:       t.hold,
      sell:       t.sell,
      strongSell: t.strongSell,
    })),
  };
};