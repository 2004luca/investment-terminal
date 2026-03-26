// ============================================================
// VOLATILITY & RISK
// Rolling volatility, rolling Sharpe, drawdown, Calmar ratio
// ============================================================

import React, { useState } from 'react';
import Plot from 'react-plotly.js';
import { fetchHistorical } from '../utils/api';
import {
  simpleReturns,
  annualizedVol,
  annualizedReturn,
  sharpeRatio,
  rollingVol,
  rollingSharpe,
  drawdownSeries,
  maxDrawdown,
  historicalVaR,
  mean,
  stdDev,
} from '../utils/finance';
import {
  formatPercent,
  formatDecimal,
  colorClass,
} from '../utils/formatters';

const RANGES = [
  { label: '1Y', outputsize: 252  },
  { label: '2Y', outputsize: 504  },
  { label: '3Y', outputsize: 756  },
  { label: '5Y', outputsize: 1260 },
];

const VOL_WINDOW    = 21;  // 1 month rolling vol
const SHARPE_WINDOW = 63;  // 1 quarter rolling Sharpe
const RISK_FREE     = 0.05;

const VolatilityRisk = () => {
  const [ticker, setTicker]     = useState('');
  const [returns, setReturns]   = useState([]);
  const [prices, setPrices]     = useState([]);
  const [dates, setDates]       = useState([]);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState(null);
  const [activeRange, setRange] = useState('2Y');
  const [stockName, setName]    = useState('');

  const handleSearch = async () => {
    if (!ticker.trim()) return;
    setLoading(true);
    setError(null);
    setReturns([]);
    setPrices([]);
    setDates([]);

    try {
      const range   = RANGES.find(r => r.label === activeRange);
      const history = await fetchHistorical(ticker.trim(), range.outputsize);
      const px      = history.map(d => d.close);
      const rets    = simpleReturns(px);
      const ds      = history.map(d => d.date);
      setPrices(px);
      setReturns(rets);
      setDates(ds);
      setName(ticker.trim().toUpperCase());
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') handleSearch();
  };

  // ── Computed stats ──
  const annVol    = returns.length ? annualizedVol(returns)              : 0;
  const annRet    = returns.length ? annualizedReturn(returns)           : 0;
  const sharpe    = returns.length ? sharpeRatio(returns, RISK_FREE)     : 0;
  const var95     = returns.length ? historicalVaR(returns, 0.95)        : 0;
  const mdd       = prices.length  ? maxDrawdown(prices)                 : { value: 0 };
  const calmar    = mdd.value !== 0 ? annRet / Math.abs(mdd.value)       : 0;

  // ── Rolling series ──
  const rollVol    = returns.length ? rollingVol(returns, VOL_WINDOW)       : [];
  const rollSharpe = returns.length ? rollingSharpe(returns, SHARPE_WINDOW, RISK_FREE) : [];
  const ddSeries   = prices.length  ? drawdownSeries(prices)               : [];

  // Dates aligned to rolling series
  const volDates    = dates.slice(VOL_WINDOW);
  const sharpeDates = dates.slice(SHARPE_WINDOW);
  const ddDates     = dates;

  // ── Chart layout base ──
  const baseLayout = {
    autosize: true,
    height: 280,
    margin: { t: 10, r: 20, b: 40, l: 60 },
    paper_bgcolor: 'transparent',
    plot_bgcolor: 'transparent',
    xaxis: {
      showgrid: false,
      tickfont: { size: 11, color: '#9ca3af' },
      tickformat: '%b %Y',
    },
    hovermode: 'x unified',
    showlegend: false,
  };

  // ── Rolling Volatility Chart ──
  const volChartData = rollVol.length ? [
    {
      x: volDates,
      y: rollVol,
      type: 'scatter',
      mode: 'lines',
      name: 'Rolling Vol (21d)',
      line: { color: '#2563eb', width: 1.5 },
      fill: 'tozeroy',
      fillcolor: 'rgba(37, 99, 235, 0.08)',
      hovertemplate: '<b>%{x}</b><br>Vol: %{y:.1%}<extra></extra>',
    },
  ] : [];

  const volLayout = {
    ...baseLayout,
    yaxis: {
      showgrid: true,
      gridcolor: '#f0f2f5',
      tickfont: { size: 11, color: '#9ca3af' },
      tickformat: '.0%',
    },
  };

  // ── Rolling Sharpe Chart ──
  const sharpeChartData = rollSharpe.length ? [
    {
      x: sharpeDates,
      y: rollSharpe,
      type: 'scatter',
      mode: 'lines',
      name: 'Rolling Sharpe (63d)',
      line: { color: '#7c3aed', width: 1.5 },
      hovertemplate: '<b>%{x}</b><br>Sharpe: %{y:.2f}<extra></extra>',
    },
    // Zero line
    {
      x: [sharpeDates[0], sharpeDates[sharpeDates.length - 1]],
      y: [0, 0],
      type: 'scatter',
      mode: 'lines',
      line: { color: '#9ca3af', width: 1, dash: 'dash' },
      hoverinfo: 'skip',
    },
  ] : [];

  const sharpeLayout = {
    ...baseLayout,
    yaxis: {
      showgrid: true,
      gridcolor: '#f0f2f5',
      tickfont: { size: 11, color: '#9ca3af' },
    },
  };

  // ── Drawdown Chart ──
  const ddChartData = ddSeries.length ? [
    {
      x: ddDates,
      y: ddSeries,
      type: 'scatter',
      mode: 'lines',
      name: 'Drawdown',
      line: { color: '#dc2626', width: 1.5 },
      fill: 'tozeroy',
      fillcolor: 'rgba(220, 38, 38, 0.1)',
      hovertemplate: '<b>%{x}</b><br>Drawdown: %{y:.1%}<extra></extra>',
    },
  ] : [];

  const ddLayout = {
    ...baseLayout,
    yaxis: {
      showgrid: true,
      gridcolor: '#f0f2f5',
      tickfont: { size: 11, color: '#9ca3af' },
      tickformat: '.0%',
    },
  };

  return (
    <>
      <div className="page-header">
        <h2>Volatility & Risk</h2>
        <p>
          Rolling volatility, rolling Sharpe ratio, drawdown analysis,
          Calmar ratio, and volatility clustering
        </p>
      </div>

      <div className="page-body">

        {/* ── Search Bar + Range ── */}
        <div style={{ display: 'flex', gap: '12px', marginBottom: '24px', alignItems: 'center' }}>
          <input
            className="search-input"
            type="text"
            placeholder="Enter ticker — e.g. AAPL, MSFT, SPY"
            value={ticker}
            onChange={(e) => setTicker(e.target.value.toUpperCase())}
            onKeyDown={handleKeyDown}
            style={{ flex: 1 }}
          />
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
          <button
            className="search-btn"
            onClick={handleSearch}
            disabled={loading}
          >
            {loading ? 'Loading...' : 'Analyze'}
          </button>
        </div>

        {error && (
          <div className="chart-error">
            <span>Could not load data: {error}</span>
          </div>
        )}

        {!returns.length && !loading && !error && (
          <div className="chart-empty">
            <span style={{ fontSize: '14px' }}>Enter a ticker to analyze its volatility and risk</span>
            <span style={{ fontSize: '12px' }}>Try AAPL, MSFT, TSLA, SPY</span>
          </div>
        )}

        {returns.length > 0 && (
          <>
            {/* ── Metric Cards ── */}
            <div className="metric-grid" style={{ marginBottom: '24px' }}>

              <div className="metric-card">
                <span className="metric-card-label">Ann. Volatility</span>
                <span className="metric-card-value">
                  {formatPercent(annVol)}
                </span>
                <span className="metric-card-sub">Annualized std dev</span>
              </div>

              <div className="metric-card">
                <span className="metric-card-label">Max Drawdown</span>
                <span className="metric-card-value negative">
                  {formatPercent(mdd.value)}
                </span>
                <span className="metric-card-sub">Worst peak-to-trough</span>
              </div>

              <div className="metric-card">
                <span className="metric-card-label">Calmar Ratio</span>
                <span className={`metric-card-value ${colorClass(calmar)}`}>
                  {formatDecimal(calmar, 2)}
                </span>
                <span className="metric-card-sub">Ann. return / Max DD</span>
              </div>

              <div className="metric-card">
                <span className="metric-card-label">Sharpe Ratio</span>
                <span className={`metric-card-value ${colorClass(sharpe)}`}>
                  {formatDecimal(sharpe, 2)}
                </span>
                <span className="metric-card-sub">Rf = 5%</span>
              </div>

              <div className="metric-card">
                <span className="metric-card-label">VaR 95%</span>
                <span className="metric-card-value negative">
                  {formatPercent(var95)}
                </span>
                <span className="metric-card-sub">Worst day in 20</span>
              </div>

              <div className="metric-card">
                <span className="metric-card-label">Current Roll. Vol</span>
                <span className="metric-card-value">
                  {rollVol.length ? formatPercent(rollVol[rollVol.length - 1]) : 'N/A'}
                </span>
                <span className="metric-card-sub">21-day window</span>
              </div>

              <div className="metric-card">
                <span className="metric-card-label">Current Roll. Sharpe</span>
                <span className={`metric-card-value ${rollSharpe.length ? colorClass(rollSharpe[rollSharpe.length - 1]) : ''}`}>
                  {rollSharpe.length ? formatDecimal(rollSharpe[rollSharpe.length - 1], 2) : 'N/A'}
                </span>
                <span className="metric-card-sub">63-day window</span>
              </div>

              <div className="metric-card">
                <span className="metric-card-label">Ann. Return</span>
                <span className={`metric-card-value ${colorClass(annRet)}`}>
                  {formatPercent(annRet)}
                </span>
                <span className="metric-card-sub">Over selected period</span>
              </div>

            </div>

            {/* ── Rolling Volatility Chart ── */}
            <div className="chart-container">
              <div className="chart-title">
                Rolling Volatility — {stockName} ({VOL_WINDOW}-day window, annualized)
              </div>
              <div className="chart-subtitle">
                Volatility clusters — high vol periods tend to be followed by high vol
              </div>
              <Plot
                data={volChartData}
                layout={volLayout}
                config={{ displayModeBar: false, responsive: true }}
                style={{ width: '100%' }}
              />
            </div>

            {/* ── Rolling Sharpe Chart ── */}
            <div className="chart-container">
              <div className="chart-title">
                Rolling Sharpe Ratio — {stockName} ({SHARPE_WINDOW}-day window)
              </div>
              <div className="chart-subtitle">
                Above 0 = positive risk-adjusted return. Above 1 = strong. Below 0 = destroying value.
              </div>
              <Plot
                data={sharpeChartData}
                layout={sharpeLayout}
                config={{ displayModeBar: false, responsive: true }}
                style={{ width: '100%' }}
              />
            </div>

            {/* ── Drawdown Chart ── */}
            <div className="chart-container">
              <div className="chart-title">
                Drawdown — {stockName} (Underwater Chart)
              </div>
              <div className="chart-subtitle">
                0% = at all-time high. Negative = below previous peak. Max drawdown = {formatPercent(mdd.value)}
              </div>
              <Plot
                data={ddChartData}
                layout={ddLayout}
                config={{ displayModeBar: false, responsive: true }}
                style={{ width: '100%' }}
              />
            </div>

          </>
        )}

        {/* ══════════════════════════════════════════
            CONCEPTS
        ══════════════════════════════════════════ */}
        <div className="section" style={{ marginTop: '48px' }}>
          <div className="section-title">Understanding Volatility & Risk</div>

          <div className="two-col" style={{ gap: '16px' }}>

            <div className="formula-box">
              <div className="formula-box-title">Rolling Volatility</div>
              <div className="formula-box-math">
                σ_t = std(r_t-w, ..., r_t) × √252
              </div>
              <div className="formula-box-description">
                Instead of computing a single volatility number for the entire period,
                rolling volatility computes it over a sliding window of w days. At each
                point in time, only the most recent w returns are used. This reveals how
                risk evolves — volatility is not constant. It spikes during crises and
                compresses during calm markets. The 21-day window (one trading month)
                is standard for short-term risk monitoring.
              </div>
            </div>

            <div className="formula-box">
              <div className="formula-box-title">Volatility Clustering</div>
              <div className="formula-box-math">
                Corr(|r_t|, |r_(t-1)|) significantly positive
              </div>
              <div className="formula-box-description">
                One of the most robust empirical facts in finance: large price changes
                tend to be followed by large price changes (of either sign), and small
                changes by small changes. This is visible in any rolling volatility chart
                as alternating periods of high and low volatility. Mandelbrot documented
                this in 1963. Engle formalized it with the ARCH model in 1982 (Nobel
                Prize 2003). GARCH models, used by every major bank for risk management,
                are built on this phenomenon.
              </div>
            </div>

            <div className="formula-box">
              <div className="formula-box-title">Rolling Sharpe Ratio</div>
              <div className="formula-box-math">
                Sharpe_t = (Ann.Return_t - Rf) / Ann.Vol_t
              </div>
              <div className="formula-box-description">
                The Sharpe ratio measures risk-adjusted return: how much excess return
                (above the risk-free rate) per unit of volatility. Computing it on a
                rolling basis reveals when a stock was actually generating good
                risk-adjusted returns versus when it was not. A single Sharpe ratio
                for a 5-year period can hide years of negative performance. The rolling
                version is honest — it shows the full picture.
              </div>
            </div>

            <div className="formula-box">
              <div className="formula-box-title">Drawdown & Underwater Chart</div>
              <div className="formula-box-math">
                DD_t = (P_t - max(P_0...P_t)) / max(P_0...P_t)
              </div>
              <div className="formula-box-description">
                Drawdown measures how far the current price is from its previous peak.
                The underwater chart plots this over time. When the line is at 0%, the
                stock is at an all-time high. The depth of the worst trough is the
                Maximum Drawdown — the single most important risk metric for investors
                who cannot tolerate large losses. Unlike volatility, drawdown directly
                measures the investor's pain: the actual loss from peak to trough.
              </div>
            </div>

            <div className="formula-box">
              <div className="formula-box-title">Maximum Drawdown</div>
              <div className="formula-box-math">
                MDD = min(DD_t) = max peak-to-trough decline
              </div>
              <div className="formula-box-description">
                The largest observed loss from a peak to a subsequent trough before a
                new peak is reached. MDD is expressed as a percentage. A stock with
                MDD of -50% requires a subsequent 100% gain just to break even. This
                asymmetry is why drawdown management is central to portfolio construction.
                Many professional investors have hard limits: if a position draws down
                more than 20%, it is automatically reduced or closed.
              </div>
            </div>

            <div className="formula-box">
              <div className="formula-box-title">Calmar Ratio</div>
              <div className="formula-box-math">
                Calmar = Annualized Return / |Max Drawdown|
              </div>
              <div className="formula-box-description">
                A risk-adjusted return metric that uses maximum drawdown as the risk
                denominator instead of volatility. Preferred by hedge funds and
                Commodity Trading Advisors (CTAs) because it directly measures return
                per unit of worst-case loss. A Calmar above 1 means the annual return
                exceeds the worst drawdown — generally considered good. The Sharpe ratio
                can be high even when drawdowns are severe; the Calmar catches this.
              </div>
            </div>

          </div>
        </div>

      </div>
    </>
  );
};

export default VolatilityRisk;