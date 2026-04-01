// ============================================================
// REGRESSION & BETA
// OLS regression vs SPY, alpha, beta, R², CAPM, SML,
// rolling beta, residuals analysis
// ============================================================

import React, { useState } from 'react';
import Plot from 'react-plotly.js';
import { fetchHistorical } from '../utils/api';
import {
  simpleReturns,
  linearRegression,
  annualizedReturn,
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

const RISK_FREE    = 0.05;   // 5% annual risk-free rate
const MARKET_RET   = 0.10;   // 10% expected market return
const ROLL_WINDOW  = 63;     // 63-day rolling beta window

// ── Rolling beta using OLS on a sliding window ──
const rollingBeta = (stockReturns, marketReturns, window) => {
  const result = [];
  for (let i = window; i <= stockReturns.length; i++) {
    const sx = marketReturns.slice(i - window, i);
    const sy = stockReturns.slice(i - window, i);
    const reg = linearRegression(sx, sy);
    result.push(reg.slope);
  }
  return result;
};

const RegressionBeta = () => {
  const [ticker, setTicker]       = useState('');
  const [stockRets, setStockRets] = useState([]);
  const [spyRets, setSpyRets]     = useState([]);
  const [dates, setDates]         = useState([]);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState(null);
  const [activeRange, setRange]   = useState('2Y');
  const [stockName, setName]      = useState('');

  const handleSearch = async () => {
    if (!ticker.trim()) return;
    setLoading(true);
    setError(null);
    setStockRets([]);
    setSpyRets([]);

    try {
      const range = RANGES.find(r => r.label === activeRange);

      // Fetch stock and SPY simultaneously
      const [stockHistory, spyHistory] = await Promise.all([
        fetchHistorical(ticker.trim(), range.outputsize),
        fetchHistorical('SPY', range.outputsize),
      ]);

      // Align dates — use only dates present in both
      const stockMap = Object.fromEntries(
        stockHistory.map(d => [d.date, d.close])
      );
      const spyMap = Object.fromEntries(
        spyHistory.map(d => [d.date, d.close])
      );
      const commonDates = stockHistory
        .map(d => d.date)
        .filter(d => spyMap[d] !== undefined)
        .sort();

      const stockPrices = commonDates.map(d => stockMap[d]);
      const spyPrices   = commonDates.map(d => spyMap[d]);

      const sr = simpleReturns(stockPrices);
      const mr = simpleReturns(spyPrices);
      const ds = commonDates.slice(1);

      setStockRets(sr);
      setSpyRets(mr);
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

  // ── OLS Regression ──
  const reg = stockRets.length && spyRets.length
    ? linearRegression(spyRets, stockRets)
    : null;

  const beta        = reg?.slope      ?? 0;
  const r2          = reg?.r2         ?? 0;
  const intercept   = reg?.intercept  ?? 0;

  // Daily alpha → annualized
  const annAlpha    = intercept * 252;

  // Actual vs CAPM expected return
  const actualAnnRet  = stockRets.length ? annualizedReturn(stockRets)  : 0;
  const capmExpected  = RISK_FREE + beta * (MARKET_RET - RISK_FREE);
  const correlation   = r2 >= 0 ? Math.sqrt(r2) * (beta >= 0 ? 1 : -1) : 0;

  // Residuals
  const residuals = stockRets.map((r, i) =>
    r - (intercept + beta * spyRets[i])
  );

  // Rolling beta
  const rollBeta = stockRets.length && spyRets.length
    ? rollingBeta(stockRets, spyRets, ROLL_WINDOW)
    : [];
  const rollBetaDates = dates.slice(ROLL_WINDOW);

  // ── Scatter plot: stock vs SPY returns ──
  const minSPY = spyRets.length ? Math.min(...spyRets) : -0.05;
  const maxSPY = spyRets.length ? Math.max(...spyRets) :  0.05;
  const regressionLine = {
    x: [minSPY, maxSPY],
    y: [intercept + beta * minSPY, intercept + beta * maxSPY],
  };

  const scatterData = stockRets.length ? [
    {
      x: spyRets,
      y: stockRets,
      type: 'scatter',
      mode: 'markers',
      name: 'Daily Returns',
      marker: { color: 'rgba(37, 99, 235, 0.4)', size: 4 },
      hovertemplate:
        'SPY: %{x:.3f}<br>' + stockName + ': %{y:.3f}<extra></extra>',
    },
    {
      x: regressionLine.x,
      y: regressionLine.y,
      type: 'scatter',
      mode: 'lines',
      name: `Regression (β=${formatDecimal(beta, 2)})`,
      line: { color: '#dc2626', width: 2 },
    },
  ] : [];

  const scatterLayout = {
    autosize: true,
    height: 360,
    margin: { t: 10, r: 20, b: 50, l: 60 },
    paper_bgcolor: 'transparent',
    plot_bgcolor: 'transparent',
    xaxis: {
      title: { text: 'SPY Daily Return', font: { size: 12, color: '#9ca3af' } },
      showgrid: true,
      gridcolor: '#f0f2f5',
      tickfont: { size: 11, color: '#9ca3af' },
      tickformat: '.1%',
      zeroline: true,
      zerolinecolor: '#e5e7eb',
    },
    yaxis: {
      title: { text: `${stockName} Daily Return`, font: { size: 12, color: '#9ca3af' } },
      showgrid: true,
      gridcolor: '#f0f2f5',
      tickfont: { size: 11, color: '#9ca3af' },
      tickformat: '.1%',
      zeroline: true,
      zerolinecolor: '#e5e7eb',
    },
    legend: { orientation: 'h', y: -0.15, font: { size: 11 } },
    hovermode: 'closest',
  };

  // ── Security Market Line ──
  const smlBetas  = [0, 0.5, 1.0, 1.5, 2.0, 2.5];
  const smlRets   = smlBetas.map(b => RISK_FREE + b * (MARKET_RET - RISK_FREE));

  const smlData = reg ? [
    {
      x: smlBetas,
      y: smlRets,
      type: 'scatter',
      mode: 'lines',
      name: 'Security Market Line',
      line: { color: '#9ca3af', width: 2, dash: 'dash' },
    },
    {
      x: [beta],
      y: [actualAnnRet],
      type: 'scatter',
      mode: 'markers',
      name: `${stockName} (actual)`,
      marker: {
        color: actualAnnRet > capmExpected ? '#16a34a' : '#dc2626',
        size: 14,
        symbol: 'diamond',
      },
      hovertemplate:
        `${stockName}<br>Beta: ${formatDecimal(beta, 2)}<br>` +
        `Actual: ${formatPercent(actualAnnRet)}<br>` +
        `CAPM: ${formatPercent(capmExpected)}<extra></extra>`,
    },
    // CAPM expected point
    {
      x: [beta],
      y: [capmExpected],
      type: 'scatter',
      mode: 'markers',
      name: 'CAPM Expected',
      marker: { color: '#2563eb', size: 10, symbol: 'circle-open' },
      hovertemplate:
        `CAPM Expected<br>Beta: ${formatDecimal(beta, 2)}<br>` +
        `Expected: ${formatPercent(capmExpected)}<extra></extra>`,
    },
  ] : [];

  const smlLayout = {
    autosize: true,
    height: 360,
    margin: { t: 10, r: 20, b: 50, l: 60 },
    paper_bgcolor: 'transparent',
    plot_bgcolor: 'transparent',
    xaxis: {
      title: { text: 'Beta', font: { size: 12, color: '#9ca3af' } },
      showgrid: true,
      gridcolor: '#f0f2f5',
      tickfont: { size: 11, color: '#9ca3af' },
      range: [-0.1, 2.6],
    },
    yaxis: {
      title: { text: 'Expected Annual Return', font: { size: 12, color: '#9ca3af' } },
      showgrid: true,
      gridcolor: '#f0f2f5',
      tickfont: { size: 11, color: '#9ca3af' },
      tickformat: '.0%',
    },
    legend: { orientation: 'h', y: -0.15, font: { size: 11 } },
    hovermode: 'closest',
  };

  // ── Rolling Beta Chart ──
  const rollBetaData = rollBeta.length ? [
    {
      x: rollBetaDates,
      y: rollBeta,
      type: 'scatter',
      mode: 'lines',
      name: `Rolling Beta (${ROLL_WINDOW}d)`,
      line: { color: '#7c3aed', width: 1.5 },
      hovertemplate: '<b>%{x}</b><br>Beta: %{y:.2f}<extra></extra>',
    },
    // Beta = 1 reference line
    {
      x: [rollBetaDates[0], rollBetaDates[rollBetaDates.length - 1]],
      y: [1, 1],
      type: 'scatter',
      mode: 'lines',
      name: 'β = 1 (market)',
      line: { color: '#9ca3af', width: 1, dash: 'dash' },
    },
    // Beta = 0 reference line
    {
      x: [rollBetaDates[0], rollBetaDates[rollBetaDates.length - 1]],
      y: [0, 0],
      type: 'scatter',
      mode: 'lines',
      name: 'β = 0',
      line: { color: '#e5e7eb', width: 1, dash: 'dot' },
    },
  ] : [];

  const rollBetaLayout = {
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
    yaxis: {
      showgrid: true,
      gridcolor: '#f0f2f5',
      tickfont: { size: 11, color: '#9ca3af' },
    },
    legend: { orientation: 'h', y: -0.2, font: { size: 11 } },
    hovermode: 'x unified',
  };

  // ── Residuals Chart ──
  const residualsData = residuals.length ? [
    {
      x: dates,
      y: residuals,
      type: 'bar',
      name: 'Residuals',
      marker: {
        color: residuals.map(r => r >= 0
          ? 'rgba(22, 163, 74, 0.6)'
          : 'rgba(220, 38, 38, 0.6)'
        ),
      },
      hovertemplate: '<b>%{x}</b><br>Residual: %{y:.4f}<extra></extra>',
    },
  ] : [];

  const residualsLayout = {
    autosize: true,
    height: 240,
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
      tickformat: '.2%',
    },
    hovermode: 'x unified',
    showlegend: false,
    bargap: 0,
  };

  return (
    <>
      <div className="page-header">
        <h2>Regression & Beta</h2>
        <p>
          OLS regression vs SPY — beta, alpha, R², CAPM expected return,
          security market line, rolling beta, and residual analysis
        </p>
      </div>

      <div className="page-body">

        {/* ── Search Bar ── */}
        <div style={{ display: 'flex', gap: '12px', marginBottom: '24px', alignItems: 'center' }}>
          <input
            className="search-input"
            type="text"
            placeholder="Enter ticker — SPY is fetched automatically as benchmark"
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

        {!stockRets.length && !loading && !error && (
          <div className="chart-empty">
            <span style={{ fontSize: '14px' }}>
              Enter a ticker to run beta regression against SPY
            </span>
            <span style={{ fontSize: '12px' }}>Try AAPL, TSLA, MSFT, GLD, BTC-USD</span>
          </div>
        )}

        {stockRets.length > 0 && reg && (
          <>
            {/* ── Metric Cards ── */}
            <div className="metric-grid" style={{ marginBottom: '24px' }}>

              <div className="metric-card">
                <span className="metric-card-label">Beta (β)</span>
                <span className={`metric-card-value ${beta > 1.2 ? 'negative' : beta < 0.8 ? 'positive' : ''}`}>
                  {formatDecimal(beta, 3)}
                </span>
                <span className="metric-card-sub">
                  {beta > 1.2 ? 'High market sensitivity' :
                   beta < 0.8 ? 'Low market sensitivity' :
                   'Near market beta'}
                </span>
              </div>

              <div className="metric-card">
                <span className="metric-card-label">Alpha (α) Ann.</span>
                <span className={`metric-card-value ${colorClass(annAlpha)}`}>
                  {formatPercent(annAlpha)}
                </span>
                <span className="metric-card-sub">Excess return vs CAPM</span>
              </div>

              <div className="metric-card">
                <span className="metric-card-label">R²</span>
                <span className="metric-card-value">
                  {formatDecimal(r2 * 100, 1)}%
                </span>
                <span className="metric-card-sub">Variance explained by market</span>
              </div>

              <div className="metric-card">
                <span className="metric-card-label">Correlation</span>
                <span className="metric-card-value">
                  {formatDecimal(correlation, 3)}
                </span>
                <span className="metric-card-sub">With SPY</span>
              </div>

              <div className="metric-card">
                <span className="metric-card-label">CAPM Expected</span>
                <span className="metric-card-value">
                  {formatPercent(capmExpected)}
                </span>
                <span className="metric-card-sub">Rf=5%, Rm=10%</span>
              </div>

              <div className="metric-card">
                <span className="metric-card-label">Actual Return</span>
                <span className={`metric-card-value ${colorClass(actualAnnRet)}`}>
                  {formatPercent(actualAnnRet)}
                </span>
                <span className="metric-card-sub">Annualized over period</span>
              </div>

              <div className="metric-card">
                <span className="metric-card-label">Alpha Significance</span>
                <span className={`metric-card-value ${colorClass(actualAnnRet - capmExpected)}`}>
                  {formatPercent(actualAnnRet - capmExpected)}
                </span>
                <span className="metric-card-sub">
                  {actualAnnRet > capmExpected ? 'Above SML — outperformed' : 'Below SML — underperformed'}
                </span>
              </div>

              <div className="metric-card">
                <span className="metric-card-label">Systematic Risk</span>
                <span className="metric-card-value">
                  {formatDecimal(r2 * 100, 1)}%
                </span>
                <span className="metric-card-sub">
                  Idiosyncratic: {formatDecimal((1 - r2) * 100, 1)}%
                </span>
              </div>

            </div>

            {/* ── Scatter + SML side by side ── */}
            <div className="two-col" style={{ marginBottom: '24px' }}>

              <div className="chart-container" style={{ marginBottom: 0 }}>
                <div className="chart-title">
                  {stockName} vs SPY — OLS Regression ({activeRange})
                </div>
                <div className="chart-subtitle">
                  Each dot = one trading day. Slope of red line = beta.
                </div>
                <Plot
                  data={scatterData}
                  layout={scatterLayout}
                  config={{ displayModeBar: false, responsive: true }}
                  style={{ width: '100%' }}
                />
              </div>

              <div className="chart-container" style={{ marginBottom: 0 }}>
                <div className="chart-title">
                  Security Market Line — {stockName}
                </div>
                <div className="chart-subtitle">
                  {actualAnnRet > capmExpected
                    ? `${stockName} plots ABOVE the SML — positive alpha, outperformed CAPM`
                    : `${stockName} plots BELOW the SML — negative alpha, underperformed CAPM`}
                </div>
                <Plot
                  data={smlData}
                  layout={smlLayout}
                  config={{ displayModeBar: false, responsive: true }}
                  style={{ width: '100%' }}
                />
              </div>

            </div>

            {/* ── Rolling Beta ── */}
            <div className="chart-container">
              <div className="chart-title">
                Rolling Beta — {stockName} vs SPY ({ROLL_WINDOW}-day window)
              </div>
              <div className="chart-subtitle">
                Beta is not constant — it shifts with market regimes and company events
              </div>
              <Plot
                data={rollBetaData}
                layout={rollBetaLayout}
                config={{ displayModeBar: false, responsive: true }}
                style={{ width: '100%' }}
              />
            </div>

            {/* ── Residuals ── */}
            <div className="chart-container">
              <div className="chart-title">
                Regression Residuals — {stockName}
              </div>
              <div className="chart-subtitle">
                The part of daily return not explained by SPY. Large residuals = idiosyncratic events (earnings, news).
              </div>
              <Plot
                data={residualsData}
                layout={residualsLayout}
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
          <div className="section-title">Understanding Regression & Beta</div>

          <div className="two-col" style={{ gap: '16px' }}>

            <div className="formula-box">
              <div className="formula-box-title">The Market Model</div>
              <div className="formula-box-math">R_stock = α + β × R_market + ε</div>
              <div className="formula-box-description">
                The market model decomposes a stock's return into three parts: a
                constant (alpha), a market-driven component (beta times market return),
                and an idiosyncratic residual (epsilon). OLS regression finds the alpha
                and beta that minimize the sum of squared residuals. This is the
                foundation of modern portfolio theory and the basis for nearly every
                risk model used in practice.
              </div>
            </div>

            <div className="formula-box">
              <div className="formula-box-title">Beta</div>
              <div className="formula-box-math">
                β = Cov(R_stock, R_market) / Var(R_market)
              </div>
              <div className="formula-box-description">
                Beta measures systematic risk — the sensitivity of the stock to broad
                market movements. A beta of 1.5 means the stock moves 1.5% for every
                1% market move on average. Beta above 1 amplifies market swings
                (higher risk, higher expected return). Beta below 1 dampens them
                (lower risk, lower expected return). Beta is not stable — it changes
                with company fundamentals, leverage, and market conditions.
              </div>
            </div>

            <div className="formula-box">
              <div className="formula-box-title">Alpha (Jensen's Alpha)</div>
              <div className="formula-box-math">
                α = R_actual - [Rf + β × (Rm - Rf)]
              </div>
              <div className="formula-box-description">
                Alpha is the return generated above and beyond what the stock's market
                risk (beta) alone would predict. Positive alpha means the stock
                outperformed its risk-adjusted benchmark. In the Efficient Market
                Hypothesis, persistent positive alpha is theoretically impossible —
                it would be arbitraged away. In practice, alpha can persist due to
                information advantages, liquidity premiums, or factor exposures not
                captured by the single-factor CAPM.
              </div>
            </div>

            <div className="formula-box">
              <div className="formula-box-title">R² — Coefficient of Determination</div>
              <div className="formula-box-math">
                R² = 1 - SS_residual / SS_total
              </div>
              <div className="formula-box-description">
                R² measures what fraction of the stock's return variance is explained
                by the market. R² of 0.65 means 65% of the stock's daily moves are
                driven by market-wide forces; the remaining 35% is idiosyncratic.
                High R² (close to 1) means the stock is a de facto market proxy —
                diversification benefit is low. Low R² means the stock adds
                diversification value — its movements are largely independent of
                the market.
              </div>
            </div>

            <div className="formula-box">
              <div className="formula-box-title">CAPM</div>
              <div className="formula-box-math">
                E(R) = Rf + β × (Rm - Rf)
              </div>
              <div className="formula-box-description">
                The Capital Asset Pricing Model says the expected return of any asset
                is the risk-free rate plus a risk premium proportional to its beta.
                The term (Rm - Rf) is the equity risk premium — the extra return
                investors demand for holding stocks over risk-free assets, historically
                around 5-6% annually. CAPM is the simplest and most widely taught
                asset pricing model. Its main limitation is that it uses only one
                risk factor (market beta) while empirical research shows that size,
                value, momentum, and other factors also explain returns.
              </div>
            </div>

            <div className="formula-box">
              <div className="formula-box-title">Security Market Line</div>
              <div className="formula-box-math">
                SML: E(R) = Rf + β × (Rm - Rf)
              </div>
              <div className="formula-box-description">
                The Security Market Line is the graphical representation of CAPM —
                a straight line plotting expected return against beta. Every asset
                should lie on the SML in equilibrium. Assets above the SML are
                undervalued (they offer more return than their risk warrants) and
                will be bid up until they fall onto the line. Assets below are
                overvalued. The distance of a stock from the SML is its alpha —
                the reward for stock picking beyond passive market exposure.
              </div>
            </div>

            <div className="formula-box">
              <div className="formula-box-title">Rolling Beta</div>
              <div className="formula-box-math">
                β_t = OLS slope over window (t-w, t)
              </div>
              <div className="formula-box-description">
                A single beta computed over the full sample hides how the relationship
                changes over time. Rolling beta uses a sliding window (63 days here)
                to show beta's evolution. During market crises, betas tend to converge
                toward 1 — correlations spike and all stocks move together. During calm
                markets, betas spread out. A stock whose rolling beta has been rising
                recently is becoming more sensitive to market moves — useful information
                for risk management.
              </div>
            </div>

            <div className="formula-box">
              <div className="formula-box-title">Residuals & Idiosyncratic Risk</div>
              <div className="formula-box-math">
                ε_t = R_stock_t - (α + β × R_market_t)
              </div>
              <div className="formula-box-description">
                The regression residuals are the daily returns not explained by the
                market model. Large positive residuals correspond to days the stock
                dramatically outperformed what market conditions would predict —
                usually earnings beats, M&A announcements, or product launches.
                Large negative residuals correspond to company-specific bad news.
                The standard deviation of residuals (idiosyncratic volatility) measures
                how much company-specific risk the stock carries beyond market risk.
              </div>
            </div>

          </div>
        </div>

      </div>
    </>
  );
};

export default RegressionBeta;