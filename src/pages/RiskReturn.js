// ============================================================
// RISK & RETURN
// Sharpe, Sortino, Calmar, MDD, VaR, CVaR,
// underwater chart, return distribution, rolling Sharpe
// ============================================================

import React from 'react';
import Plot from 'react-plotly.js';
import { usePortfolio } from '../utils/PortfolioContext';
import {
  mean,
  stdDev,
  annualizedReturn,
  annualizedVol,
  sharpeRatio,
  sortinoRatio,
  maxDrawdown,
  drawdownSeries,
  historicalVaR,
  cVar,
  rollingSharpe,
  normalPDF,
  skewness,
  excessKurtosis,
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

const RISK_FREE     = 0.05;
const SHARPE_WINDOW = 63;

// Normal curve generator
const normalCurve = (mu, sigma, minX, maxX, points = 200) => {
  const step = (maxX - minX) / points;
  const x = [], y = [];
  for (let i = 0; i <= points; i++) {
    const xi = minX + i * step;
    x.push(xi);
    y.push(normalPDF(xi, mu, sigma));
  }
  return { x, y };
};

const RiskReturn = () => {
  const { portfolioData } = usePortfolio();

  if (!portfolioData) {
    return (
      <>
        <div className="page-header">
          <h2>Risk & Return</h2>
          <p>Sharpe, Sortino, Calmar, Max Drawdown, VaR, CVaR — with formulas and explanations</p>
        </div>
        <div className="page-body">
          <div className="chart-empty">
            <span style={{ fontSize: '14px' }}>No portfolio found</span>
            <span style={{ fontSize: '12px' }}>
              Go to Portfolio Builder and build a portfolio first
            </span>
          </div>
        </div>
      </>
    );
  }

  const { portReturns, cumPort, chartDates } = portfolioData;

  // ── Metrics ──
  const annRet   = annualizedReturn(portReturns);
  const annVol   = annualizedVol(portReturns);
  const sharpe   = sharpeRatio(portReturns, RISK_FREE);
  const sortino  = sortinoRatio(portReturns, RISK_FREE);
  const mdd      = maxDrawdown(cumPort);
  const calmar   = mdd.value !== 0 ? annRet / Math.abs(mdd.value) : 0;
  const var95    = historicalVaR(portReturns, 0.95);
  const var99    = historicalVaR(portReturns, 0.99);
  const cvar95   = cVar(portReturns, 0.95);
  const cvar99   = cVar(portReturns, 0.99);
  const skew     = skewness(portReturns);
  const kurt     = excessKurtosis(portReturns);
  const ddSeries = drawdownSeries(cumPort);

  // Rolling Sharpe
  const rollSharpe     = rollingSharpe(portReturns, SHARPE_WINDOW, RISK_FREE);
  const rollSharpeDates = chartDates.slice(SHARPE_WINDOW + 1);

  // ── Underwater chart ──
  const ddChartData = [
    {
      x: chartDates,
      y: ddSeries,
      type: 'scatter',
      mode: 'lines',
      name: 'Drawdown',
      line: { color: '#dc2626', width: 1.5 },
      fill: 'tozeroy',
      fillcolor: 'rgba(220, 38, 38, 0.1)',
      hovertemplate: '<b>%{x}</b><br>Drawdown: %{y:.2%}<extra></extra>',
    },
  ];

  const ddLayout = {
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
      tickformat: '.0%',
    },
    hovermode: 'x unified',
    showlegend: false,
  };

  // ── Return distribution ──
  const mu      = mean(portReturns);
  const sigma   = stdDev(portReturns);
  const minR    = Math.min(...portReturns);
  const maxR    = Math.max(...portReturns);
  const binCount = 40;
  const binWidth = (maxR - minR) / binCount;
  const normal   = normalCurve(mu, sigma, minR, maxR);
  const scaledNY = normal.y.map(y => y * portReturns.length * binWidth);

  const distChartData = [
    {
      x: portReturns,
      type: 'histogram',
      nbinsx: binCount,
      name: 'Portfolio Returns',
      marker: {
        color: 'rgba(37, 99, 235, 0.6)',
        line: { color: 'rgba(37, 99, 235, 0.8)', width: 0.5 },
      },
      hovertemplate: 'Return: %{x:.3f}<br>Count: %{y}<extra></extra>',
    },
    {
      x: normal.x,
      y: scaledNY,
      type: 'scatter',
      mode: 'lines',
      name: 'Normal',
      line: { color: '#dc2626', width: 2, dash: 'dash' },
    },
    {
      x: [var95, var95],
      y: [0, portReturns.length * 0.12],
      type: 'scatter',
      mode: 'lines',
      name: 'VaR 95%',
      line: { color: '#ea580c', width: 2, dash: 'dot' },
    },
    {
      x: [cvar95, cvar95],
      y: [0, portReturns.length * 0.12],
      type: 'scatter',
      mode: 'lines',
      name: 'CVaR 95%',
      line: { color: '#dc2626', width: 2, dash: 'dot' },
    },
  ];

  const distLayout = {
    autosize: true,
    height: 320,
    margin: { t: 10, r: 20, b: 50, l: 60 },
    paper_bgcolor: 'transparent',
    plot_bgcolor: 'transparent',
    xaxis: {
      title: { text: 'Daily Return', font: { size: 12, color: '#9ca3af' } },
      showgrid: false,
      tickfont: { size: 11, color: '#9ca3af' },
      tickformat: '.1%',
    },
    yaxis: {
      showgrid: true,
      gridcolor: '#f0f2f5',
      tickfont: { size: 11, color: '#9ca3af' },
    },
    legend: { orientation: 'h', y: -0.2, font: { size: 11 } },
    hovermode: 'x unified',
    bargap: 0.05,
  };

  // ── Rolling Sharpe ──
  const rollSharpeData = [
    {
      x: rollSharpeDates,
      y: rollSharpe,
      type: 'scatter',
      mode: 'lines',
      name: 'Rolling Sharpe',
      line: { color: '#7c3aed', width: 1.5 },
      hovertemplate: '<b>%{x}</b><br>Sharpe: %{y:.2f}<extra></extra>',
    },
    {
      x: [rollSharpeDates[0], rollSharpeDates[rollSharpeDates.length - 1]],
      y: [0, 0],
      type: 'scatter',
      mode: 'lines',
      line: { color: '#9ca3af', width: 1, dash: 'dash' },
      hoverinfo: 'skip',
      showlegend: false,
    },
    {
      x: [rollSharpeDates[0], rollSharpeDates[rollSharpeDates.length - 1]],
      y: [1, 1],
      type: 'scatter',
      mode: 'lines',
      name: 'Sharpe = 1',
      line: { color: '#16a34a', width: 1, dash: 'dot' },
    },
  ];

  const rollSharpeLayout = {
    autosize: true,
    height: 320,
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
    },
    legend: { orientation: 'h', y: -0.2, font: { size: 11 } },
    hovermode: 'x unified',
  };

  return (
    <>
      <div className="page-header">
        <h2>Risk & Return</h2>
        <p>
          Sharpe, Sortino, Calmar, Max Drawdown, VaR, CVaR —
          complete risk analysis of your portfolio
        </p>
      </div>

      <div className="page-body">

        {/* ── Portfolio Summary Bar ── */}
        <div className="card" style={{ marginBottom: '24px' }}>
          <div className="card-title">Current Portfolio</div>
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            {portfolioData.holdingStats.map((h, i) => (
              <div key={h.ticker} style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                background: '#f0f2f5',
                borderRadius: '6px',
                padding: '6px 12px',
              }}>
                <span style={{
                  fontWeight: 700,
                  color: COLORS[i % COLORS.length],
                  fontSize: '13px',
                }}>
                  {h.ticker}
                </span>
                <span style={{ fontSize: '12px', color: '#9ca3af' }}>
                  {formatDecimal(h.weight * 100, 1)}%
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* ── Metric Cards ── */}

        {/* ── Metric Cards ── */}
        <div className="metric-grid" style={{ marginBottom: '24px' }}>

          <div className="metric-card">
            <span className="metric-card-label">Ann. Return</span>
            <span className={`metric-card-value ${colorClass(annRet)}`}>
              {formatPercent(annRet)}
            </span>
            <span className="metric-card-sub">
              SPY: {formatPercent(portfolioData.spyReturn)}
            </span>
          </div>

          <div className="metric-card">
            <span className="metric-card-label">Ann. Volatility</span>
            <span className="metric-card-value">
              {formatPercent(annVol)}
            </span>
            <span className="metric-card-sub">Annualized std dev</span>
          </div>

          <div className="metric-card">
            <span className="metric-card-label">Sharpe Ratio</span>
            <span className={`metric-card-value ${colorClass(sharpe)}`}>
              {formatDecimal(sharpe, 3)}
            </span>
            <span className="metric-card-sub">
              {sharpe > 2 ? 'Excellent' : sharpe > 1 ? 'Good' :
               sharpe > 0 ? 'Positive' : 'Negative'} (Rf=5%)
            </span>
          </div>

          <div className="metric-card">
            <span className="metric-card-label">Sortino Ratio</span>
            <span className={`metric-card-value ${colorClass(sortino)}`}>
              {formatDecimal(sortino, 3)}
            </span>
            <span className="metric-card-sub">Downside risk adjusted</span>
          </div>

          <div className="metric-card">
            <span className="metric-card-label">Calmar Ratio</span>
            <span className={`metric-card-value ${colorClass(calmar)}`}>
              {formatDecimal(calmar, 3)}
            </span>
            <span className="metric-card-sub">Return / Max Drawdown</span>
          </div>

          <div className="metric-card">
            <span className="metric-card-label">Max Drawdown</span>
            <span className="metric-card-value negative">
              {formatPercent(mdd.value)}
            </span>
            <span className="metric-card-sub">Worst peak-to-trough</span>
          </div>

          <div className="metric-card">
            <span className="metric-card-label">VaR 95%</span>
            <span className="metric-card-value negative">
              {formatPercent(var95)}
            </span>
            <span className="metric-card-sub">Worst day in 20</span>
          </div>

          <div className="metric-card">
            <span className="metric-card-label">CVaR 95%</span>
            <span className="metric-card-value negative">
              {formatPercent(cvar95)}
            </span>
            <span className="metric-card-sub">Avg loss beyond VaR</span>
          </div>

          <div className="metric-card">
            <span className="metric-card-label">VaR 99%</span>
            <span className="metric-card-value negative">
              {formatPercent(var99)}
            </span>
            <span className="metric-card-sub">Worst day in 100</span>
          </div>

          <div className="metric-card">
            <span className="metric-card-label">CVaR 99%</span>
            <span className="metric-card-value negative">
              {formatPercent(cvar99)}
            </span>
            <span className="metric-card-sub">Avg loss beyond VaR 99%</span>
          </div>

          <div className="metric-card">
            <span className="metric-card-label">Skewness</span>
            <span className={`metric-card-value ${skew < 0 ? 'negative' : 'positive'}`}>
              {formatDecimal(skew, 3)}
            </span>
            <span className="metric-card-sub">
              {skew < -0.5 ? 'Left tail risk' :
               skew > 0.5  ? 'Right tail bias' : 'Near symmetric'}
            </span>
          </div>

          <div className="metric-card">
            <span className="metric-card-label">Excess Kurtosis</span>
            <span className={`metric-card-value ${kurt > 0 ? 'negative' : 'positive'}`}>
              {formatDecimal(kurt, 3)}
            </span>
            <span className="metric-card-sub">
              {kurt > 1 ? 'Fat tails' : 'Near normal tails'}
            </span>
          </div>

        </div>

        {/* ── Underwater Chart ── */}
        <div className="chart-container">
          <div className="chart-title">Portfolio Drawdown — Underwater Chart</div>
          <div className="chart-subtitle">
            0% = at all-time high. Max Drawdown = {formatPercent(mdd.value)}
          </div>
          <Plot
            data={ddChartData}
            layout={ddLayout}
            config={{ displayModeBar: false, responsive: true }}
            style={{ width: '100%' }}
          />
        </div>

        {/* ── Distribution + Rolling Sharpe ── */}
        <div className="two-col">
          <div className="chart-container" style={{ marginBottom: 0 }}>
            <div className="chart-title">Portfolio Return Distribution</div>
            <div className="chart-subtitle">
              Daily returns histogram with normal overlay, VaR and CVaR lines
            </div>
            <Plot
              data={distChartData}
              layout={distLayout}
              config={{ displayModeBar: false, responsive: true }}
              style={{ width: '100%' }}
            />
          </div>

          <div className="chart-container" style={{ marginBottom: 0 }}>
            <div className="chart-title">
              Rolling Sharpe Ratio ({SHARPE_WINDOW}-day window)
            </div>
            <div className="chart-subtitle">
              Above green line (Sharpe=1) = strong risk-adjusted performance
            </div>
            <Plot
              data={rollSharpeData}
              layout={rollSharpeLayout}
              config={{ displayModeBar: false, responsive: true }}
              style={{ width: '100%' }}
            />
          </div>
        </div>

        {/* ══════════════════════════════════════════
            CONCEPTS
        ══════════════════════════════════════════ */}
        <div className="section" style={{ marginTop: '48px' }}>
          <div className="section-title">Understanding Risk Metrics</div>

          <div className="two-col" style={{ gap: '16px' }}>

            <div className="formula-box">
              <div className="formula-box-title">Sharpe Ratio</div>
              <div className="formula-box-math">
                Sharpe = (Rp - Rf) / σp
              </div>
              <div className="formula-box-description">
                The Sharpe ratio measures return per unit of total risk. Developed
                by William Sharpe (Nobel Prize 1990), it is the most widely used
                risk-adjusted performance metric. Above 1 is generally considered
                good; above 2 is excellent; above 3 is exceptional and rare.
                The main limitation: it treats upside and downside volatility
                equally, penalizing portfolios that have occasional large gains.
                Use alongside Sortino for a more complete picture.
              </div>
            </div>

            <div className="formula-box">
              <div className="formula-box-title">Sortino Ratio</div>
              <div className="formula-box-math">
                Sortino = (Rp - Rf) / σ_downside
              </div>
              <div className="formula-box-description">
                The Sortino ratio improves on Sharpe by only penalizing downside
                volatility — the standard deviation of negative returns only.
                A portfolio that achieves high returns through occasional large
                gains will have a higher Sortino than Sharpe. If Sortino is
                significantly higher than Sharpe, it means most of the portfolio's
                volatility is upside — a desirable characteristic. If they are
                similar, the return distribution is roughly symmetric.
              </div>
            </div>

            <div className="formula-box">
              <div className="formula-box-title">Calmar Ratio</div>
              <div className="formula-box-math">
                Calmar = Ann. Return / |Max Drawdown|
              </div>
              <div className="formula-box-description">
                The Calmar ratio uses maximum drawdown as the risk denominator
                instead of volatility. It answers: how much annual return did
                you earn per unit of your worst loss? Calmar above 1 means the
                annual return exceeded the worst drawdown. Preferred by hedge
                funds and managed futures strategies because it directly measures
                return per unit of investor pain. A high Sharpe with a low Calmar
                signals the portfolio had a catastrophic drawdown that
                volatility-based metrics understated.
              </div>
            </div>

            <div className="formula-box">
              <div className="formula-box-title">VaR — Value at Risk</div>
              <div className="formula-box-math">
                VaR(95%) = 5th percentile of daily returns
              </div>
              <div className="formula-box-description">
                Value at Risk answers: what is the worst loss I should expect on
                a typical bad day? Historical VaR at 95% means on 95% of days,
                losses will be less than this amount. On 5% of days — roughly
                one per month — losses will exceed it. VaR is required by
                banking regulators (Basel III) and used universally in risk
                management. Its main weakness: it says nothing about how bad
                the worst days actually are — for that we use CVaR.
              </div>
            </div>

            <div className="formula-box">
              <div className="formula-box-title">CVaR — Expected Shortfall</div>
              <div className="formula-box-math">
                CVaR(95%) = mean(returns below VaR(95%))
              </div>
              <div className="formula-box-description">
                CVaR (Conditional Value at Risk), also called Expected Shortfall,
                answers what VaR cannot: on the bad days that exceed VaR, what
                is the average loss? CVaR is always worse than VaR by definition.
                The gap between VaR and CVaR measures tail severity — a large gap
                means the worst days are much worse than the VaR threshold suggests.
                CVaR is considered superior to VaR by regulators and academics
                because it is coherent (sub-additive) and captures tail risk properly.
              </div>
            </div>

            <div className="formula-box">
              <div className="formula-box-title">Maximum Drawdown</div>
              <div className="formula-box-math">
                MDD = min((P_t - Peak_t) / Peak_t)
              </div>
              <div className="formula-box-description">
                The largest observed loss from a peak to a subsequent trough.
                MDD is the most psychologically relevant risk metric — it measures
                the actual loss an investor who bought at the worst time would have
                experienced. A portfolio with 15% annual volatility might have a
                max drawdown of 40% or 15% depending on the timing and sequence
                of returns. The underwater chart shows every drawdown period and
                reveals how long recovery took — an important dimension that MDD
                alone does not capture.
              </div>
            </div>

          </div>
        </div>

      </div>
    </>
  );
};

export default RiskReturn;