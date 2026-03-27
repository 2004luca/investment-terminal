// ============================================================
// PORTFOLIO BUILDER
// Add stocks with weights, performance vs SPY,
// correlation heatmap, holdings breakdown
// ============================================================

import React, { useState } from 'react';
import Plot from 'react-plotly.js';
import { fetchHistorical } from '../utils/api';
import {
  simpleReturns,
  mean,
  annualizedReturn,
  annualizedVol,
  sharpeRatio,
  maxDrawdown,
  cumulativeReturn,
} from '../utils/finance';
import {
  formatPercent,
  formatDecimal,
  colorClass,
} from '../utils/formatters';

const COLORS = [
  '#2563eb', '#16a34a', '#dc2626', '#7c3aed',
  '#ea580c', '#0891b2', '#be185d', '#854d0e',
];

// ── Compute correlation matrix ──
const correlationMatrix = (returnsMap, tickers) => {
  const matrix = [];
  for (const ti of tickers) {
    const row = [];
    for (const tj of tickers) {
      if (ti === tj) { row.push(1); continue; }
      const ri = returnsMap[ti];
      const rj = returnsMap[tj];
      const n  = Math.min(ri.length, rj.length);
      const mi = mean(ri.slice(0, n));
      const mj = mean(rj.slice(0, n));
      let num = 0, di = 0, dj = 0;
      for (let k = 0; k < n; k++) {
        num += (ri[k] - mi) * (rj[k] - mj);
        di  += (ri[k] - mi) ** 2;
        dj  += (rj[k] - mj) ** 2;
      }
      row.push(num / Math.sqrt(di * dj));
    }
    matrix.push(row);
  }
  return matrix;
};

const PortfolioBuilder = () => {
  const [holdings, setHoldings]     = useState([]);
  const [newTicker, setNewTicker]   = useState('');
  const [newWeight, setNewWeight]   = useState('');
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState(null);
  const [portfolioData, setData]    = useState(null);

  // ── Add holding ──
  const addHolding = () => {
    if (!newTicker.trim() || !newWeight) return;
    const ticker = newTicker.trim().toUpperCase();
    if (holdings.find(h => h.ticker === ticker)) {
      setError(`${ticker} is already in the portfolio`);
      return;
    }
    setHoldings([...holdings, {
      ticker,
      weight: parseFloat(newWeight),
    }]);
    setNewTicker('');
    setNewWeight('');
    setError(null);
  };

  const removeHolding = (ticker) => {
    setHoldings(holdings.filter(h => h.ticker !== ticker));
    setData(null);
  };

  const totalWeight = holdings.reduce((s, h) => s + h.weight, 0);

  // ── Build portfolio ──
  const buildPortfolio = async () => {
    if (holdings.length < 1) return;
    setLoading(true);
    setError(null);
    setData(null);

    try {
      // Fetch all tickers + SPY
      const tickers = holdings.map(h => h.ticker);
      const allTickers = [...new Set([...tickers, 'SPY'])];
      const histMap = {};

      for (const t of allTickers) {
        histMap[t] = await fetchHistorical(t, 504); // 2Y
        await new Promise(res => setTimeout(res, 300));
      }

      // Find common dates
      const dateSets = allTickers.map(t =>
        new Set(histMap[t].map(d => d.date))
      );
      const commonDates = histMap[allTickers[0]]
        .map(d => d.date)
        .filter(date => dateSets.every(s => s.has(date)))
        .sort();

      if (commonDates.length < 30) throw new Error('Not enough common trading days');

      // Build price and return maps
      const priceMap  = {};
      const returnsMap = {};
      for (const t of allTickers) {
        const prices = commonDates.map(date => {
          const d = histMap[t].find(x => x.date === date);
          return d?.close ?? null;
        }).filter(Boolean);
        priceMap[t]   = prices;
        returnsMap[t] = simpleReturns(prices);
      }

      // Normalize weights
      const weights = tickers.map(t => {
        const h = holdings.find(x => x.ticker === t);
        return h.weight / totalWeight;
      });

      // Portfolio daily returns
      const nDays = returnsMap[tickers[0]].length;
      const portReturns = Array.from({ length: nDays }, (_, i) =>
        tickers.reduce((sum, t, wi) =>
          sum + weights[wi] * (returnsMap[t][i] ?? 0), 0
        )
      );
      const spyReturns = returnsMap['SPY'];

      // Cumulative returns (growth of $1)
      const cumPort = [1];
      const cumSPY  = [1];
      for (let i = 0; i < portReturns.length; i++) {
        cumPort.push(cumPort[cumPort.length - 1] * (1 + portReturns[i]));
        cumSPY.push(cumSPY[cumSPY.length - 1] * (1 + spyReturns[i]));
      }

      // Chart dates (one extra for starting point)
      const chartDates = [commonDates[0], ...commonDates.slice(1)];

      // Per-holding stats
      const holdingStats = tickers.map((t, i) => ({
        ticker:    t,
        weight:    weights[i],
        annReturn: annualizedReturn(returnsMap[t]),
        annVol:    annualizedVol(returnsMap[t]),
        sharpe:    sharpeRatio(returnsMap[t]),
        maxDD:     maxDrawdown(priceMap[t]).value,
        corWithSPY: (() => {
          const ri = returnsMap[t];
          const rs = returnsMap['SPY'];
          const n  = Math.min(ri.length, rs.length);
          const mi = mean(ri); const ms = mean(rs);
          let num = 0, di = 0, dj = 0;
          for (let k = 0; k < n; k++) {
            num += (ri[k] - mi) * (rs[k] - ms);
            di  += (ri[k] - mi) ** 2;
            dj  += (rs[k] - ms) ** 2;
          }
          return num / Math.sqrt(di * dj);
        })(),
      }));

      // Correlation matrix
      const corrMatrix = correlationMatrix(returnsMap, tickers);

      setData({
        portReturns,
        spyReturns,
        cumPort,
        cumSPY,
        chartDates,
        commonDates,
        holdingStats,
        corrMatrix,
        tickers,
        weights,
        annReturn: annualizedReturn(portReturns),
        annVol:    annualizedVol(portReturns),
        sharpe:    sharpeRatio(portReturns),
        maxDD:     maxDrawdown(cumPort).value,
        spyReturn: annualizedReturn(spyReturns),
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // ── Performance chart ──
  const perfChartData = portfolioData ? [
    {
      x: portfolioData.chartDates,
      y: portfolioData.cumPort.map(v => ((v - 1) * 100).toFixed(2)),
      type: 'scatter',
      mode: 'lines',
      name: 'Portfolio',
      line: { color: '#2563eb', width: 2 },
      hovertemplate: '<b>%{x}</b><br>Portfolio: %{y}%<extra></extra>',
    },
    {
      x: portfolioData.chartDates,
      y: portfolioData.cumSPY.map(v => ((v - 1) * 100).toFixed(2)),
      type: 'scatter',
      mode: 'lines',
      name: 'SPY',
      line: { color: '#9ca3af', width: 2, dash: 'dash' },
      hovertemplate: '<b>%{x}</b><br>SPY: %{y}%<extra></extra>',
    },
  ] : [];

  const perfLayout = {
    autosize: true,
    height: 360,
    margin: { t: 10, r: 20, b: 50, l: 60 },
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
      ticksuffix: '%',
      zeroline: true,
      zerolinecolor: '#e5e7eb',
    },
    legend: { orientation: 'h', y: -0.15, font: { size: 11 } },
    hovermode: 'x unified',
  };

  // ── Correlation heatmap ──
  const corrHeatmap = portfolioData ? [
    {
      z: portfolioData.corrMatrix,
      x: portfolioData.tickers,
      y: portfolioData.tickers,
      type: 'heatmap',
      colorscale: [
        [0,   '#dc2626'],
        [0.5, '#ffffff'],
        [1,   '#2563eb'],
      ],
      zmin: -1,
      zmax: 1,
      text: portfolioData.corrMatrix.map(row =>
        row.map(v => formatDecimal(v, 2))
      ),
      texttemplate: '%{text}',
      showscale: true,
      hovertemplate: '%{y} vs %{x}: %{z:.3f}<extra></extra>',
    },
  ] : [];

  const corrLayout = {
    autosize: true,
    height: 320,
    margin: { t: 10, r: 80, b: 60, l: 60 },
    paper_bgcolor: 'transparent',
    plot_bgcolor: 'transparent',
    xaxis: { tickfont: { size: 12, color: '#4a5568' } },
    yaxis: { tickfont: { size: 12, color: '#4a5568' } },
  };

  return (
    <>
      <div className="page-header">
        <h2>Portfolio Builder</h2>
        <p>
          Add stocks with custom weights, track performance vs SPY,
          analyze correlations and individual holding metrics
        </p>
      </div>

      <div className="page-body">

        {error && (
          <div className="chart-error" style={{ marginBottom: '16px' }}>
            <span>{error}</span>
          </div>
        )}

        {/* ── Builder Panel ── */}
        <div className="two-col-asymmetric" style={{ marginBottom: '24px' }}>

          {/* Left — Add holdings */}
          <div className="card">
            <div className="card-title">Build Your Portfolio</div>

            {/* Add ticker row */}
            <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
              <input
                className="search-input"
                type="text"
                placeholder="Ticker (e.g. AAPL)"
                value={newTicker}
                onChange={(e) => setNewTicker(e.target.value.toUpperCase())}
                onKeyDown={(e) => e.key === 'Enter' && addHolding()}
                style={{ flex: 2 }}
              />
              <input
                className="search-input"
                type="number"
                placeholder="Weight %"
                value={newWeight}
                onChange={(e) => setNewWeight(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addHolding()}
                style={{ flex: 1 }}
                min="0"
                max="100"
              />
              <button className="search-btn" onClick={addHolding}>
                Add
              </button>
            </div>

            {/* Holdings list */}
            {holdings.length > 0 && (
              <table className="data-table" style={{ marginBottom: '16px' }}>
                <thead>
                  <tr>
                    <th>Ticker</th>
                    <th>Weight</th>
                    <th>Normalized</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {holdings.map((h, i) => (
                    <tr key={h.ticker}>
                      <td style={{ fontWeight: 600, color: COLORS[i % COLORS.length] }}>
                        {h.ticker}
                      </td>
                      <td>{h.weight}%</td>
                      <td>{formatDecimal(h.weight / totalWeight * 100, 1)}%</td>
                      <td>
                        <button
                          onClick={() => removeHolding(h.ticker)}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: '#dc2626',
                            cursor: 'pointer',
                            fontSize: '16px',
                          }}
                        >
                          ×
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {/* Total weight indicator */}
            {holdings.length > 0 && (
              <div style={{ marginBottom: '16px' }}>
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontSize: '12px',
                  color: '#9ca3af',
                  marginBottom: '4px',
                }}>
                  <span>Total weight</span>
                  <span style={{
                    color: Math.abs(totalWeight - 100) < 0.01 ? '#16a34a' : '#ea580c',
                    fontWeight: 600,
                  }}>
                    {formatDecimal(totalWeight, 1)}%
                    {Math.abs(totalWeight - 100) > 0.01 && ' (will be normalized)'}
                  </span>
                </div>
                <div style={{
                  height: '4px',
                  background: '#f0f2f5',
                  borderRadius: '2px',
                }}>
                  <div style={{
                    height: '100%',
                    width: `${Math.min(totalWeight, 100)}%`,
                    background: Math.abs(totalWeight - 100) < 0.01
                      ? '#16a34a' : '#ea580c',
                    borderRadius: '2px',
                    transition: 'width 0.3s ease',
                  }} />
                </div>
              </div>
            )}

            <button
              className="search-btn"
              onClick={buildPortfolio}
              disabled={loading || holdings.length < 1}
              style={{ width: '100%' }}
            >
              {loading ? 'Building Portfolio...' : 'Build Portfolio'}
            </button>

            {holdings.length === 0 && (
              <div style={{
                textAlign: 'center',
                color: '#9ca3af',
                fontSize: '13px',
                marginTop: '24px',
              }}>
                Add at least one stock to get started.
                Try AAPL 40%, MSFT 30%, GOOGL 30%
              </div>
            )}
          </div>

          {/* Right — Portfolio summary */}
          {portfolioData && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>

              <div className="metric-card">
                <span className="metric-card-label">Portfolio Ann. Return</span>
                <span className={`metric-card-value ${colorClass(portfolioData.annReturn)}`}>
                  {formatPercent(portfolioData.annReturn)}
                </span>
                <span className="metric-card-sub">
                  SPY: {formatPercent(portfolioData.spyReturn)}
                </span>
              </div>

              <div className="metric-card">
                <span className="metric-card-label">Ann. Volatility</span>
                <span className="metric-card-value">
                  {formatPercent(portfolioData.annVol)}
                </span>
                <span className="metric-card-sub">Annualized std dev</span>
              </div>

              <div className="metric-card">
                <span className="metric-card-label">Sharpe Ratio</span>
                <span className={`metric-card-value ${colorClass(portfolioData.sharpe)}`}>
                  {formatDecimal(portfolioData.sharpe, 2)}
                </span>
                <span className="metric-card-sub">Risk-adjusted return (Rf=5%)</span>
              </div>

              <div className="metric-card">
                <span className="metric-card-label">Max Drawdown</span>
                <span className="metric-card-value negative">
                  {formatPercent(portfolioData.maxDD)}
                </span>
                <span className="metric-card-sub">Worst peak-to-trough</span>
              </div>

            </div>
          )}

          {!portfolioData && holdings.length > 0 && !loading && (
            <div className="chart-empty">
              <span style={{ fontSize: '14px' }}>
                Click Build Portfolio to analyze
              </span>
            </div>
          )}

        </div>

        {/* ── Performance Chart ── */}
        {portfolioData && (
          <>
            <div className="chart-container">
              <div className="chart-title">
                Portfolio vs SPY — Cumulative Return (2Y)
              </div>
              <div className="chart-subtitle">
                Growth of $1 invested — portfolio weighted returns vs SPY benchmark
              </div>
              <Plot
                data={perfChartData}
                layout={perfLayout}
                config={{ displayModeBar: false, responsive: true }}
                style={{ width: '100%' }}
              />
            </div>

            {/* ── Holdings Breakdown ── */}
            <div className="card" style={{ marginBottom: '24px' }}>
              <div className="card-title">Holdings Breakdown</div>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Ticker</th>
                    <th>Weight</th>
                    <th>Ann. Return</th>
                    <th>Ann. Volatility</th>
                    <th>Sharpe</th>
                    <th>Max Drawdown</th>
                    <th>Corr. w/ SPY</th>
                  </tr>
                </thead>
                <tbody>
                  {portfolioData.holdingStats.map((h, i) => (
                    <tr key={h.ticker}>
                      <td style={{
                        fontWeight: 600,
                        color: COLORS[i % COLORS.length],
                      }}>
                        {h.ticker}
                      </td>
                      <td>{formatDecimal(h.weight * 100, 1)}%</td>
                      <td className={colorClass(h.annReturn)}>
                        {formatPercent(h.annReturn)}
                      </td>
                      <td>{formatPercent(h.annVol)}</td>
                      <td className={colorClass(h.sharpe)}>
                        {formatDecimal(h.sharpe, 2)}
                      </td>
                      <td className="negative">
                        {formatPercent(h.maxDD)}
                      </td>
                      <td>{formatDecimal(h.corWithSPY, 3)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* ── Correlation Heatmap ── */}
            {portfolioData.tickers.length > 1 && (
              <div className="chart-container">
                <div className="chart-title">
                  Correlation Heatmap — Holdings
                </div>
                <div className="chart-subtitle">
                  Blue = positive correlation, Red = negative. Low correlation = better diversification.
                </div>
                <Plot
                  data={corrHeatmap}
                  layout={corrLayout}
                  config={{ displayModeBar: false, responsive: true }}
                  style={{ width: '100%' }}
                />
              </div>
            )}
          </>
        )}

        {/* ══════════════════════════════════════════
            CONCEPTS
        ══════════════════════════════════════════ */}
        <div className="section" style={{ marginTop: '48px' }}>
          <div className="section-title">Understanding Portfolio Construction</div>

          <div className="two-col" style={{ gap: '16px' }}>

            <div className="formula-box">
              <div className="formula-box-title">Portfolio Return</div>
              <div className="formula-box-math">
                R_p = sum(w_i × R_i)
              </div>
              <div className="formula-box-description">
                The portfolio return is simply the weighted average of individual
                asset returns. If you hold 40% AAPL and 60% MSFT, your daily return
                is 0.4 × R_AAPL + 0.6 × R_MSFT. This linear relationship means
                expected portfolio return is also the weighted average of expected
                individual returns. Portfolio construction is primarily about managing
                the risk side — variance — which is where diversification creates value.
              </div>
            </div>

            <div className="formula-box">
              <div className="formula-box-title">Portfolio Variance</div>
              <div className="formula-box-math">
                σ²_p = sum_i sum_j (w_i × w_j × σ_ij)
              </div>
              <div className="formula-box-description">
                Unlike return, portfolio variance is not simply the weighted average
                of individual variances. It includes covariance terms between every
                pair of assets. When assets are not perfectly correlated, the portfolio
                variance is less than the weighted average variance — this reduction
                is the mathematical source of diversification. Adding an asset to a
                portfolio reduces risk as long as its correlation with the existing
                portfolio is less than 1.
              </div>
            </div>

            <div className="formula-box">
              <div className="formula-box-title">Correlation & Diversification</div>
              <div className="formula-box-math">
                ρ(i,j) = Cov(R_i, R_j) / (σ_i × σ_j)
              </div>
              <div className="formula-box-description">
                Correlation ranges from -1 to +1. Two assets with correlation of 1
                move in lockstep — combining them provides no diversification benefit.
                Assets with correlation of -1 are perfect hedges — combining them
                can eliminate risk entirely. In practice, most stocks have positive
                correlations (0.3-0.7) because they share common macroeconomic drivers.
                The heatmap shows which pairs in your portfolio are most correlated
                and therefore provide the least diversification benefit.
              </div>
            </div>

            <div className="formula-box">
              <div className="formula-box-title">Benchmark Comparison</div>
              <div className="formula-box-math">
                Active Return = R_portfolio - R_benchmark
              </div>
              <div className="formula-box-description">
                We compare portfolio performance against SPY (S&P 500 ETF) because
                it represents the return available to any investor for free through
                passive indexing. Any active portfolio should be judged against this
                baseline. Outperforming SPY on a raw return basis is not sufficient —
                you must also consider whether the extra risk taken (higher volatility,
                higher drawdowns) justifies the extra return. The Sharpe ratio and
                drawdown metrics help answer this question.
              </div>
            </div>

            <div className="formula-box">
              <div className="formula-box-title">Weight Normalization</div>
              <div className="formula-box-math">
                w_i_norm = w_i / sum(w_j)
              </div>
              <div className="formula-box-description">
                Portfolio weights must sum to 1 (100%) for a fully invested portfolio.
                If you enter weights that sum to more or less than 100%, they are
                automatically normalized proportionally. This preserves the relative
                allocation between assets. For example, entering AAPL 40 and MSFT 60
                gives the same result as entering AAPL 4 and MSFT 6 — both normalize
                to 40%/60%.
              </div>
            </div>

            <div className="formula-box">
              <div className="formula-box-title">Growth of $1 Chart</div>
              <div className="formula-box-math">
                V_t = V_(t-1) × (1 + R_t)
              </div>
              <div className="formula-box-description">
                The performance chart shows the cumulative growth of $1 invested at
                the start of the period. This is the clearest way to compare two
                strategies — the vertical gap between the portfolio line and the SPY
                line at any point shows the cumulative outperformance or
                underperformance. A portfolio that starts above SPY but dips below
                during drawdowns reveals periods of underperformance that raw return
                numbers might hide.
              </div>
            </div>

          </div>
        </div>

      </div>
    </>
  );
};

export default PortfolioBuilder;