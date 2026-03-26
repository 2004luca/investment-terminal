// ============================================================
// STOCK SEARCH — Ticker search, price overview, 12m chart
// ============================================================

import React, { useState } from 'react';
import Plot from 'react-plotly.js';
import { fetchQuoteTD, fetchHistoricalTD } from '../utils/api';
import {
  formatPrice,
  formatPercent,
  formatMarketCap,
  formatNumber,
  colorClass,
} from '../utils/formatters';

// ── How many calendar days each range covers ──
const RANGES = [
  { label: '1M', range: '1mo' },
  { label: '3M', range: '3mo' },
  { label: '6M', range: '6mo' },
  { label: '1Y', range: '1y'  },
  { label: '2Y', range: '2y'  },
];

const StockSearch = () => {
  const [ticker, setTicker]       = useState('');
  const [quote, setQuote]         = useState(null);
  const [history, setHistory]     = useState([]);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState(null);
  const [activeRange, setRange]   = useState('1Y');

  // ── Search handler ──
  const handleSearch = async () => {
    if (!ticker.trim()) return;
    setLoading(true);
    setError(null);
    setQuote(null);
    setHistory([]);

    try {
      // Use 'full' so we have enough data for 2Y range
    const [quoteData, histData] = await Promise.all([
        fetchQuoteTD(ticker.trim()),
        fetchHistoricalTD(ticker.trim(), 500),
    ]);
    setQuote(quoteData);
    setHistory(histData);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') handleSearch();
  };

  // ── Filter history to selected range ──
  const filteredHistory = () => {
    if (!history.length) return [];
    const range = RANGES.find(r => r.label === activeRange);
    const daysMap = { '1mo': 30, '3mo': 90, '6mo': 180, '1y': 365, '2y': 730 };
    const days = daysMap[range.range];
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    return history.filter(d => new Date(d.date) >= cutoff);
  };

  // ── Build Plotly chart data ──
  const visible = filteredHistory();

  const chartData = visible.length ? [
    {
      x: visible.map(d => d.date),
      y: visible.map(d => d.adjClose),
      type: 'scatter',
      mode: 'lines',
      name: quote?.ticker ?? ticker,
      line: { color: '#2563eb', width: 2 },
      fill: 'tozeroy',
      fillcolor: 'rgba(37, 99, 235, 0.06)',
      hovertemplate: '<b>%{x}</b><br>Price: $%{y:.2f}<extra></extra>',
    },
  ] : [];

  const chartLayout = {
    autosize: true,
    height: 320,
    margin: { t: 10, r: 20, b: 40, l: 60 },
    paper_bgcolor: 'transparent',
    plot_bgcolor: 'transparent',
    xaxis: {
      showgrid: false,
      tickfont: { size: 11, color: '#9ca3af' },
      tickformat: '%b %Y',
    },
    yaxis: {
      showgrid: true,
      gridcolor: '#f0f2f5',
      tickfont: { size: 11, color: '#9ca3af' },
      tickprefix: '$',
    },
    hovermode: 'x unified',
    showlegend: false,
  };

  return (
    <>
      {/* ── Page Header ── */}
      <div className="page-header">
        <h2>Stock Search</h2>
        <p>Search for a ticker to see price overview, price history, and key statistics</p>
      </div>

      <div className="page-body">

        {/* ── Search Bar ── */}
        <div className="search-bar">
          <input
            className="search-input"
            type="text"
            placeholder="Enter ticker — e.g. AAPL, MSFT, TSLA"
            value={ticker}
            onChange={(e) => setTicker(e.target.value.toUpperCase())}
            onKeyDown={handleKeyDown}
          />
          <button
            className="search-btn"
            onClick={handleSearch}
            disabled={loading}
          >
            {loading ? 'Loading...' : 'Search'}
          </button>
        </div>

        {/* ── Error state ── */}
        {error && (
          <div className="chart-error">
            <span>Could not load data: {error}</span>
            <span style={{ fontSize: '12px', color: '#9ca3af' }}>
              Make sure the ticker is valid and you have API calls remaining.
            </span>
          </div>
        )}

        {/* ── Results ── */}
        {quote && (
          <>
            {/* Company name + sector */}
            <div className="section">
              <h3 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '4px' }}>
                {quote.name}
              </h3>
              <span className="text-muted" style={{ fontSize: '13px' }}>
                {quote.ticker}
                {quote.exchange  ? ` — ${quote.exchange}`  : ''}
                {quote.sector    ? ` — ${quote.sector}`    : ''}
                {quote.industry  ? ` · ${quote.industry}`  : ''}
              </span>
            </div>

            {/* ── Metric Cards Row ── */}
            <div className="metric-grid" style={{ marginBottom: '24px' }}>

              <div className="metric-card">
                <span className="metric-card-label">Price</span>
                <span className="metric-card-value">
                  {formatPrice(quote.price)}
                </span>
                <span className={`metric-card-sub ${colorClass(quote.change)}`}>
                  {formatPrice(quote.change)} ({formatPercent(quote.changePercent)}) today
                </span>
              </div>

              <div className="metric-card">
                <span className="metric-card-label">Avg Volume</span>
                <span className="metric-card-value">
                  {formatMarketCap(quote.avgVolume, 1)}
                </span>
                <span className="metric-card-sub">30-day average</span>
              </div>

              <div className="metric-card">
                <span className="metric-card-label">Volume</span>
                <span className="metric-card-value">
                  {formatNumber(quote.volume, 1)}
                </span>
                <span className="metric-card-sub">Shares traded today</span>
              </div>

              <div className="metric-card">
                <span className="metric-card-label">52W High</span>
                <span className="metric-card-value positive">
                  {formatPrice(quote.fiftyTwoWeekHigh)}
                </span>
                <span className="metric-card-sub">
                  {formatPercent((quote.price - quote.fiftyTwoWeekHigh) /
                    quote.fiftyTwoWeekHigh)} from high
                </span>
              </div>

              <div className="metric-card">
                <span className="metric-card-label">52W Low</span>
                <span className="metric-card-value negative">
                  {formatPrice(quote.fiftyTwoWeekLow)}
                </span>
                <span className="metric-card-sub">
                  {formatPercent((quote.price - quote.fiftyTwoWeekLow) /
                    quote.fiftyTwoWeekLow)} from low
                </span>
              </div>

              <div className="metric-card">
                <span className="metric-card-label">Prev. Close</span>
                <span className="metric-card-value">
                  {formatPrice(quote.previousClose)}
                </span>
                <span className="metric-card-sub">
                  Open: {formatPrice(quote.open)}
                </span>
              </div>

            </div>

            {/* ── Price Chart ── */}
            <div className="chart-container">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <div className="chart-title" style={{ marginBottom: 0 }}>
                  Price History — {quote.ticker}
                </div>
                {/* Range selector */}
                <div className="range-group">
                  {RANGES.map(r => (
                    <button
                      key={r.label}
                      className={`range-btn ${activeRange === r.label ? 'active' : ''}`}
                      onClick={() => setRange(r.label)}
                    >
                      {r.label}
                    </button>
                  ))}
                </div>
              </div>

              {visible.length ? (
                <Plot
                  data={chartData}
                  layout={chartLayout}
                  config={{ displayModeBar: false, responsive: true }}
                  style={{ width: '100%' }}
                />
              ) : (
                <div className="chart-loading">Loading chart...</div>
              )}
            </div>

            {/* ── 52W Range Bar ── */}
            <div className="card" style={{ marginBottom: '24px' }}>
              <div className="card-title">52-Week Price Range</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span style={{ fontSize: '13px', color: '#dc2626', fontWeight: 600 }}>
                  {formatPrice(quote.fiftyTwoWeekLow)}
                </span>
                <div style={{
                  flex: 1, height: '6px', background: '#f0f2f5',
                  borderRadius: '3px', position: 'relative',
                }}>
                  <div style={{
                    height: '100%',
                    width: `${((quote.price - quote.fiftyTwoWeekLow) /
                      (quote.fiftyTwoWeekHigh - quote.fiftyTwoWeekLow)) * 100}%`,
                    background: 'linear-gradient(to right, #bfdbfe, #2563eb)',
                    borderRadius: '3px',
                  }} />
                  <div style={{
                    position: 'absolute',
                    left: `${((quote.price - quote.fiftyTwoWeekLow) /
                      (quote.fiftyTwoWeekHigh - quote.fiftyTwoWeekLow)) * 100}%`,
                    top: '50%',
                    transform: 'translate(-50%, -50%)',
                    width: '12px', height: '12px',
                    borderRadius: '50%',
                    background: '#2563eb',
                    border: '2px solid white',
                    boxShadow: '0 1px 4px rgba(0,0,0,0.2)',
                  }} />
                </div>
                <span style={{ fontSize: '13px', color: '#16a34a', fontWeight: 600 }}>
                  {formatPrice(quote.fiftyTwoWeekHigh)}
                </span>
              </div>
              <div style={{ textAlign: 'center', marginTop: '8px', fontSize: '12px', color: '#9ca3af' }}>
                Current: {formatPrice(quote.price)}
              </div>
            </div>

            {/* ── Company Description ── */}
            {quote.description && (
              <div className="card" style={{ marginBottom: '24px' }}>
                <div className="card-title">About {quote.name}</div>
                <p style={{ fontSize: '13px', lineHeight: '1.7', color: '#4a5568' }}>
                  {quote.description}
                </p>
              </div>
            )}

          </>
        )}

        {/* ── Empty state ── */}
        {!quote && !loading && !error && (
          <div className="chart-empty">
            <span style={{ fontSize: '14px' }}>Enter a ticker above to get started</span>
            <span style={{ fontSize: '12px' }}>Try AAPL, MSFT, GOOGL, TSLA, SPY</span>
          </div>
        )}

        {/* ── Concepts Section — always visible at bottom ── */}
        <div className="section" style={{ marginTop: '48px' }}>
          <div className="section-title">Understanding the Metrics</div>

          <div className="two-col" style={{ gap: '16px' }}>

            <div className="formula-box">
              <div className="formula-box-title">Regular Close Price</div>
              <div className="formula-box-math">Close = Last transaction price of the trading day</div>
              <div className="formula-box-description">
                The price at which the stock last traded before the market closed.
                This is the raw, unadjusted price — exactly what you would have paid
                if you bought the stock at the end of that day.
              </div>
            </div>

            <div className="formula-box">
              <div className="formula-box-title">Adjusted Close Price</div>
              <div className="formula-box-math">Adj. Close = Close × adjustment factor</div>
              <div className="formula-box-description">
                Corrects the historical price for dividends and stock splits.
                When a company pays a dividend, its price drops by that amount — the
                adjusted close adds it back. When a stock splits 4:1, the adjusted close
                divides all prior prices by 4 so the chart stays continuous.
              </div>
            </div>

            <div className="formula-box">
                <div className="formula-box-title">Why We Use Regular Close Here</div>
                <div className="formula-box-math">Adjusted close = premium endpoint on Twelvedata free tier</div>
                <div className="formula-box-description">
                   We use Twelvedata's free tier for historical prices, which provides
                   regular close data only. Adjusted close — which corrects for dividends
                   and splits — is a premium feature. For short-term charts the difference
                   is minimal. For dividend-heavy stocks over multi-year periods, you may
                   notice small downward gaps on ex-dividend dates. In production systems,
                   adjusted close is always preferred for total return analysis.
                </div>
            </div>

            <div className="formula-box">
                <div className="formula-box-title">Average Volume</div>
                <div className="formula-box-math">Avg Volume = Mean daily shares traded over 30 days</div>
                <div className="formula-box-description">
                   Average volume measures liquidity — how easily you can enter or exit a
                   position without moving the price. A stock with 50M average daily volume
                   (like AAPL) can absorb large orders with minimal price impact. A stock
                   with 100K average daily volume may gap significantly on any meaningful
                   order. Always compare today's volume to average volume: a spike signals
                   unusual activity — earnings, news, or institutional buying/selling.
                </div>
            </div>

            <div className="formula-box">
              <div className="formula-box-title">52-Week High / Low</div>
              <div className="formula-box-math">Range = [min(close), max(close)] over trailing 52 weeks</div>
              <div className="formula-box-description">
                The highest and lowest prices over the past year. Traders use these as
                psychological support and resistance levels. A stock near its 52-week
                high is in a strong uptrend; near its 52-week low may signal distress
                or a buying opportunity depending on context.
              </div>
            </div>

            <div className="formula-box">
              <div className="formula-box-title">Volume</div>
              <div className="formula-box-math">Volume = Number of shares traded in a session</div>
              <div className="formula-box-description">
                High volume on a price move confirms the move — many participants agree.
                Low volume on a price move is suspect — it may reverse. Average daily
                volume is used to measure liquidity: how easily you can buy or sell
                without moving the price.
              </div>
            </div>

          </div>
        </div>

      </div>
    </>
  );
};

export default StockSearch;