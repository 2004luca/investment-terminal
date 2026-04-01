// ============================================================
// FACTOR MODELS
// CAPM, alpha, beta, R², Jensen's Alpha, Treynor Ratio,
// Security Market Line, return decomposition,
// rolling alpha and beta
// ============================================================

import React, { useState, useMemo } from 'react';
import Plot from 'react-plotly.js';
import { usePortfolio } from '../utils/PortfolioContext';
import {
  annualizedReturn,
  annualizedVol,
  sharpeRatio,
  linearRegression,
} from '../utils/finance';
import {
  formatPercent,
  formatDecimal,
  colorClass,
} from '../utils/formatters';

const RISK_FREE   = 0.05;
const MARKET_RET  = 0.10;
const ROLL_WINDOW = 63;
const COLORS = [
  '#2563eb', '#16a34a', '#dc2626', '#7c3aed',
  '#ea580c', '#0891b2', '#be185d', '#854d0e',
];

// ── Rolling regression ──
const rollingRegression = (y, x, window) => {
  const alphas = [], betas = [], r2s = [];
  for (let i = window; i <= y.length; i++) {
    const xi = x.slice(i - window, i);
    const yi = y.slice(i - window, i);
    const reg = linearRegression(xi, yi);
    alphas.push(reg.intercept * 252);
    betas.push(reg.slope);
    r2s.push(reg.r2);
  }
  return { alphas, betas, r2s };
};

const FactorModels = () => {
  const { portfolioData } = usePortfolio();
  const [activeTab, setTab] = useState('capm');

  // ── All useMemo hooks must be called before any conditional return ──
  const regression = useMemo(() => {
    if (!portfolioData) return null;
    const { portReturns, spyReturns } = portfolioData;
    const n = Math.min(portReturns.length, spyReturns.length);
    const pr = portReturns.slice(0, n);
    const sr = spyReturns.slice(0, n);
    return linearRegression(sr, pr);
  }, [portfolioData]);

  const rollingReg = useMemo(() => {
    if (!portfolioData) return null;
    const { portReturns, spyReturns } = portfolioData;
    const n = Math.min(portReturns.length, spyReturns.length);
    return rollingRegression(
      portReturns.slice(0, n),
      spyReturns.slice(0, n),
      ROLL_WINDOW
    );
  }, [portfolioData]);

  const holdingRegs = useMemo(() => {
    if (!portfolioData) return [];
    const { holdingStats, spyReturns, portReturns } = portfolioData;
    return holdingStats.map(h => {
      // Approximate individual returns from holding stats
      const n = portReturns.length;
      const dailyMu  = h.annReturn / 252;
      const dailySig = h.annVol / Math.sqrt(252);
      const fakeRets = Array.from({ length: n }, (_, i) =>
        dailyMu + (spyReturns[i] * h.corWithSPY * dailySig /
          (annualizedVol(spyReturns) / Math.sqrt(252)))
      );
      const reg = linearRegression(spyReturns.slice(0, n), fakeRets);
      return {
        ticker:   h.ticker,
        beta:     reg.slope,
        alpha:    reg.intercept * 252,
        r2:       reg.r2,
        annRet:   h.annReturn,
        capmExp:  RISK_FREE + reg.slope * (MARKET_RET - RISK_FREE),
        treynor:  reg.slope !== 0
          ? (h.annReturn - RISK_FREE) / reg.slope
          : 0,
        sharpe:   sharpeRatio(fakeRets, RISK_FREE),
      };
    });
  }, [portfolioData]);

  if (!portfolioData || !regression) {
    return (
      <>
        <div className="page-header">
          <h2>Factor Models</h2>
          <p>CAPM, alpha, beta, R², Jensen's Alpha, Treynor Ratio, Security Market Line</p>
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

  const { portReturns, spyReturns, chartDates, holdingStats, weights } = portfolioData;


  const beta       = regression.slope;
  const r2         = regression.r2;
  const intercept  = regression.intercept;
  const annAlpha   = intercept * 252;
  const annRet     = annualizedReturn(portReturns);
  const capmExp    = RISK_FREE + beta * (MARKET_RET - RISK_FREE);
  const treynor    = beta !== 0 ? (annRet - RISK_FREE) / beta : 0;
  const sharpe     = sharpeRatio(portReturns, RISK_FREE);
  const jensensAlpha = annRet - capmExp;
  const correlation  = Math.sqrt(r2) * (beta >= 0 ? 1 : -1);

  const rollDates = chartDates.slice(ROLL_WINDOW + 1);

  // ── Scatter: portfolio vs SPY ──
  const minSPY = Math.min(...spyReturns);
  const maxSPY = Math.max(...spyReturns);
  const regLine = {
    x: [minSPY, maxSPY],
    y: [intercept + beta * minSPY, intercept + beta * maxSPY],
  };

  const scatterData = [
    {
      x: spyReturns,
      y: portReturns,
      type: 'scatter',
      mode: 'markers',
      name: 'Daily Returns',
      marker: { color: 'rgba(37, 99, 235, 0.35)', size: 4 },
      hovertemplate:
        'SPY: %{x:.3f}<br>Portfolio: %{y:.3f}<extra></extra>',
    },
    {
      x: regLine.x,
      y: regLine.y,
      type: 'scatter',
      mode: 'lines',
      name: `Regression (β=${formatDecimal(beta, 2)})`,
      line: { color: '#dc2626', width: 2 },
    },
  ];

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
      title: { text: 'Portfolio Daily Return', font: { size: 12, color: '#9ca3af' } },
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

  // ── SML ──
  const smlBetas = [0, 0.5, 1.0, 1.5, 2.0, 2.5];
  const smlRets  = smlBetas.map(b => RISK_FREE + b * (MARKET_RET - RISK_FREE));

  const smlData = [
    {
      x: smlBetas,
      y: smlRets,
      type: 'scatter',
      mode: 'lines',
      name: 'Security Market Line',
      line: { color: '#9ca3af', width: 2, dash: 'dash' },
    },
    // Individual holdings
    ...holdingRegs.map((h, i) => ({
      x: [h.beta],
      y: [h.annRet],
      type: 'scatter',
      mode: 'markers',
      name: h.ticker,
      marker: {
        color: COLORS[i % COLORS.length],
        size: 10,
        symbol: 'circle',
      },
      hovertemplate:
        `${h.ticker}<br>β: ${formatDecimal(h.beta, 2)}<br>` +
        `Return: ${formatPercent(h.annRet)}<br>` +
        `CAPM: ${formatPercent(h.capmExp)}<extra></extra>`,
    })),
    // Portfolio
    {
      x: [beta],
      y: [annRet],
      type: 'scatter',
      mode: 'markers',
      name: 'Portfolio',
      marker: { color: '#0f1117', size: 14, symbol: 'diamond' },
      hovertemplate:
        `Portfolio<br>β: ${formatDecimal(beta, 2)}<br>` +
        `Return: ${formatPercent(annRet)}<br>` +
        `CAPM: ${formatPercent(capmExp)}<extra></extra>`,
    },
  ];

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
      title: { text: 'Annual Return', font: { size: 12, color: '#9ca3af' } },
      showgrid: true,
      gridcolor: '#f0f2f5',
      tickfont: { size: 11, color: '#9ca3af' },
      tickformat: '.0%',
    },
    legend: { orientation: 'h', y: -0.2, font: { size: 11 } },
    hovermode: 'closest',
  };

  // ── Rolling Beta ──
  const rollBetaData = rollingReg ? [
    {
      x: rollDates,
      y: rollingReg.betas,
      type: 'scatter',
      mode: 'lines',
      name: 'Rolling Beta',
      line: { color: '#2563eb', width: 1.5 },
      hovertemplate: '<b>%{x}</b><br>Beta: %{y:.3f}<extra></extra>',
    },
    {
      x: [rollDates[0], rollDates[rollDates.length - 1]],
      y: [1, 1],
      type: 'scatter',
      mode: 'lines',
      name: 'β = 1',
      line: { color: '#9ca3af', width: 1, dash: 'dash' },
    },
    {
      x: [rollDates[0], rollDates[rollDates.length - 1]],
      y: [beta, beta],
      type: 'scatter',
      mode: 'lines',
      name: `Full period β = ${formatDecimal(beta, 2)}`,
      line: { color: '#dc2626', width: 1, dash: 'dot' },
    },
  ] : [];

  // ── Rolling Alpha ──
  const rollAlphaData = rollingReg ? [
    {
      x: rollDates,
      y: rollingReg.alphas,
      type: 'scatter',
      mode: 'lines',
      name: 'Rolling Alpha (ann.)',
      line: { color: '#16a34a', width: 1.5 },
      fill: 'tozeroy',
      fillcolor: 'rgba(22, 163, 74, 0.08)',
      hovertemplate: '<b>%{x}</b><br>Alpha: %{y:.2%}<extra></extra>',
    },
    {
      x: [rollDates[0], rollDates[rollDates.length - 1]],
      y: [0, 0],
      type: 'scatter',
      mode: 'lines',
      line: { color: '#9ca3af', width: 1, dash: 'dash' },
      showlegend: false,
      hoverinfo: 'skip',
    },
  ] : [];

  const rollLayout = (title) => ({
    autosize: true,
    height: 260,
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
    legend: { orientation: 'h', y: -0.25, font: { size: 11 } },
    hovermode: 'x unified',
  });

  // ── Return decomposition pie ──
  const systematicVar  = r2 * 100;
  const idiosyncraticVar = (1 - r2) * 100;

  const decompData = [
    {
      values: [systematicVar, idiosyncraticVar],
      labels: ['Systematic (Market) Risk', 'Idiosyncratic Risk'],
      type: 'pie',
      marker: { colors: ['#2563eb', '#e5e7eb'] },
      textinfo: 'label+percent',
      hovertemplate: '%{label}: %{value:.1f}%<extra></extra>',
      hole: 0.5,
    },
  ];

  const decompLayout = {
    autosize: true,
    height: 300,
    margin: { t: 10, r: 20, b: 20, l: 20 },
    paper_bgcolor: 'transparent',
    showlegend: true,
    legend: { orientation: 'h', y: -0.1, font: { size: 11 } },
  };

  return (
    <>
      <div className="page-header">
        <h2>Factor Models</h2>
        <p>
          CAPM, Jensen's Alpha, Treynor Ratio, Security Market Line,
          rolling beta and alpha, return decomposition
        </p>
      </div>

      <div className="page-body">

        {/* ── Portfolio Summary ── */}
        <div className="card" style={{ marginBottom: '24px' }}>
          <div className="card-title">Current Portfolio</div>
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            {holdingStats.map((h, i) => (
              <div key={h.ticker} style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                background: '#f0f2f5', borderRadius: '6px', padding: '6px 12px',
              }}>
                <span style={{ fontWeight: 700, color: COLORS[i % COLORS.length], fontSize: '13px' }}>
                  {h.ticker}
                </span>
                <span style={{ fontSize: '12px', color: '#9ca3af' }}>
                  {formatDecimal(h.weight * 100, 1)}%
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* ── Tabs ── */}
        <div className="toggle-group" style={{ marginBottom: '24px' }}>
          {[
            { id: 'capm',  label: 'CAPM & Beta' },
            { id: 'sml',   label: 'Security Market Line' },
            { id: 'roll',  label: 'Rolling Analysis' },
            { id: 'decomp',label: 'Return Decomposition' },
          ].map(tab => (
            <button
              key={tab.id}
              className={`toggle-btn ${activeTab === tab.id ? 'active' : ''}`}
              onClick={() => setTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* ══════════════════════════════════════════
            TAB 1 — CAPM & BETA
        ══════════════════════════════════════════ */}
        {activeTab === 'capm' && (
          <>
            <div className="metric-grid" style={{ marginBottom: '24px' }}>

              <div className="metric-card">
                <span className="metric-card-label">Portfolio Beta</span>
                <span className="metric-card-value">
                  {formatDecimal(beta, 3)}
                </span>
                <span className="metric-card-sub">
                  {beta > 1.2 ? 'Aggressive — amplifies market' :
                   beta < 0.8 ? 'Defensive — dampens market' :
                   'Near market beta'}
                </span>
              </div>

              <div className="metric-card">
                <span className="metric-card-label">Jensen's Alpha (ann.)</span>
                <span className={`metric-card-value ${colorClass(annAlpha)}`}>
                  {formatPercent(annAlpha)}
                </span>
                <span className="metric-card-sub">Regression intercept × 252</span>
              </div>

              <div className="metric-card">
                <span className="metric-card-label">R²</span>
                <span className="metric-card-value">
                  {formatDecimal(r2 * 100, 1)}%
                </span>
                <span className="metric-card-sub">Variance explained by market</span>
              </div>

              <div className="metric-card">
                <span className="metric-card-label">Correlation w/ SPY</span>
                <span className="metric-card-value">
                  {formatDecimal(correlation, 3)}
                </span>
                <span className="metric-card-sub">√R²</span>
              </div>

              <div className="metric-card">
                <span className="metric-card-label">CAPM Expected Return</span>
                <span className="metric-card-value">
                  {formatPercent(capmExp)}
                </span>
                <span className="metric-card-sub">Rf=5%, Rm=10%</span>
              </div>

              <div className="metric-card">
                <span className="metric-card-label">Actual Return</span>
                <span className={`metric-card-value ${colorClass(annRet)}`}>
                  {formatPercent(annRet)}
                </span>
                <span className="metric-card-sub">Annualized</span>
              </div>

              <div className="metric-card">
                <span className="metric-card-label">Alpha vs CAPM</span>
                <span className={`metric-card-value ${colorClass(jensensAlpha)}`}>
                  {formatPercent(jensensAlpha)}
                </span>
                <span className="metric-card-sub">
                  {jensensAlpha > 0
                    ? 'Above SML — outperformed'
                    : 'Below SML — underperformed'}
                </span>
              </div>

              <div className="metric-card">
                <span className="metric-card-label">Treynor Ratio</span>
                <span className={`metric-card-value ${colorClass(treynor)}`}>
                  {formatDecimal(treynor, 4)}
                </span>
                <span className="metric-card-sub">(Rp - Rf) / β</span>
              </div>

              <div className="metric-card">
                <span className="metric-card-label">Sharpe Ratio</span>
                <span className={`metric-card-value ${colorClass(sharpe)}`}>
                  {formatDecimal(sharpe, 3)}
                </span>
                <span className="metric-card-sub">(Rp - Rf) / σ</span>
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

            {/* Scatter */}
            <div className="chart-container">
              <div className="chart-title">Portfolio vs SPY — OLS Regression</div>
              <div className="chart-subtitle">
                Each dot = one trading day. Slope = beta. Intercept (daily) × 252 = annualized alpha.
              </div>
              <Plot
                data={scatterData}
                layout={scatterLayout}
                config={{ displayModeBar: false, responsive: true }}
                style={{ width: '100%' }}
              />
            </div>

            {/* Per-holding table */}
            <div className="card">
              <div className="card-title">CAPM Analysis — Per Holding</div>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Ticker</th>
                    <th>Weight</th>
                    <th>Beta</th>
                    <th>Alpha (ann.)</th>
                    <th>R²</th>
                    <th>CAPM Expected</th>
                    <th>Actual Return</th>
                    <th>Treynor</th>
                  </tr>
                </thead>
                <tbody>
                  {holdingRegs.map((h, i) => (
                    <tr key={h.ticker}>
                      <td style={{ fontWeight: 600, color: COLORS[i % COLORS.length] }}>
                        {h.ticker}
                      </td>
                      <td>{formatDecimal(weights[i] * 100, 1)}%</td>
                      <td>{formatDecimal(h.beta, 3)}</td>
                      <td className={colorClass(h.alpha)}>
                        {formatPercent(h.alpha)}
                      </td>
                      <td>{formatDecimal(h.r2 * 100, 1)}%</td>
                      <td>{formatPercent(h.capmExp)}</td>
                      <td className={colorClass(h.annRet)}>
                        {formatPercent(h.annRet)}
                      </td>
                      <td className={colorClass(h.treynor)}>
                        {formatDecimal(h.treynor, 4)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* ══════════════════════════════════════════
            TAB 2 — SECURITY MARKET LINE
        ══════════════════════════════════════════ */}
        {activeTab === 'sml' && (
          <>
            <div className="chart-container">
              <div className="chart-title">Security Market Line</div>
              <div className="chart-subtitle">
                Dashed line = CAPM prediction. Points above = positive alpha.
                Points below = negative alpha. Diamond = portfolio.
              </div>
              <Plot
                data={smlData}
                layout={smlLayout}
                config={{ displayModeBar: false, responsive: true }}
                style={{ width: '100%' }}
              />
            </div>

            <div className="card">
              <div className="card-title">SML Analysis — Position vs CAPM</div>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Asset</th>
                    <th>Beta</th>
                    <th>CAPM Expected</th>
                    <th>Actual Return</th>
                    <th>Alpha (Actual - CAPM)</th>
                    <th>Position vs SML</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    ...holdingRegs.map((h, i) => ({
                      label: h.ticker,
                      color: COLORS[i % COLORS.length],
                      beta: h.beta,
                      capm: h.capmExp,
                      actual: h.annRet,
                      alpha: h.annRet - h.capmExp,
                    })),
                    {
                      label: 'Portfolio',
                      color: '#0f1117',
                      beta,
                      capm: capmExp,
                      actual: annRet,
                      alpha: jensensAlpha,
                    },
                  ].map(row => (
                    <tr key={row.label}>
                      <td style={{ fontWeight: 600, color: row.color }}>
                        {row.label}
                      </td>
                      <td>{formatDecimal(row.beta, 3)}</td>
                      <td>{formatPercent(row.capm)}</td>
                      <td className={colorClass(row.actual)}>
                        {formatPercent(row.actual)}
                      </td>
                      <td className={colorClass(row.alpha)} style={{ fontWeight: 600 }}>
                        {formatPercent(row.alpha)}
                      </td>
                      <td style={{ color: row.alpha > 0 ? '#16a34a' : '#dc2626' }}>
                        {row.alpha > 0 ? 'Above SML' : 'Below SML'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* ══════════════════════════════════════════
            TAB 3 — ROLLING ANALYSIS
        ══════════════════════════════════════════ */}
        {activeTab === 'roll' && (
          <>
            <div className="chart-container">
              <div className="chart-title">
                Rolling Beta — Portfolio vs SPY ({ROLL_WINDOW}-day window)
              </div>
              <div className="chart-subtitle">
                Red dotted = full-period beta. Dashed = β=1 (market).
                Beta convergence during crises is a known phenomenon.
              </div>
              <Plot
                data={rollBetaData}
                layout={rollLayout('Rolling Beta')}
                config={{ displayModeBar: false, responsive: true }}
                style={{ width: '100%' }}
              />
            </div>

            <div className="chart-container">
              <div className="chart-title">
                Rolling Alpha — Portfolio ({ROLL_WINDOW}-day window, annualized)
              </div>
              <div className="chart-subtitle">
                Above zero = generating excess return beyond market risk.
                Below zero = underperforming CAPM prediction.
              </div>
              <Plot
                data={rollAlphaData}
                layout={{
                  ...rollLayout('Rolling Alpha'),
                  yaxis: {
                    showgrid: true,
                    gridcolor: '#f0f2f5',
                    tickfont: { size: 11, color: '#9ca3af' },
                    tickformat: '.0%',
                  },
                }}
                config={{ displayModeBar: false, responsive: true }}
                style={{ width: '100%' }}
              />
            </div>
          </>
        )}

        {/* ══════════════════════════════════════════
            TAB 4 — RETURN DECOMPOSITION
        ══════════════════════════════════════════ */}
        {activeTab === 'decomp' && (
          <>
            <div className="two-col" style={{ marginBottom: '24px' }}>

              <div className="chart-container" style={{ marginBottom: 0 }}>
                <div className="chart-title">Risk Decomposition</div>
                <div className="chart-subtitle">
                  Systematic vs idiosyncratic variance (R² = {formatDecimal(r2 * 100, 1)}%)
                </div>
                <Plot
                  data={decompData}
                  layout={decompLayout}
                  config={{ displayModeBar: false, responsive: true }}
                  style={{ width: '100%' }}
                />
              </div>

              <div className="card" style={{ marginBottom: 0 }}>
                <div className="card-title">Return Decomposition</div>
                <p style={{ fontSize: '13px', color: '#4a5568', marginBottom: '16px' }}>
                  Total portfolio return broken down into market-driven
                  and alpha components.
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {[
                    {
                      label: 'Total Portfolio Return',
                      value: annRet,
                      desc: 'Annualized actual return',
                      bold: true,
                    },
                    {
                      label: 'Risk-Free Rate (Rf)',
                      value: RISK_FREE,
                      desc: 'Base return, no risk required',
                    },
                    {
                      label: 'Market Risk Premium × β',
                      value: beta * (MARKET_RET - RISK_FREE),
                      desc: `β (${formatDecimal(beta, 2)}) × (Rm - Rf)`,
                    },
                    {
                      label: 'CAPM Expected Return',
                      value: capmExp,
                      desc: 'Rf + β × (Rm - Rf)',
                    },
                    {
                      label: "Jensen's Alpha",
                      value: jensensAlpha,
                      desc: 'Actual − CAPM expected',
                      bold: true,
                    },
                  ].map(item => (
                    <div key={item.label} style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '10px 0',
                      borderBottom: '1px solid var(--border-light)',
                    }}>
                      <div>
                        <div style={{
                          fontSize: '13px',
                          fontWeight: item.bold ? 700 : 500,
                          color: '#0f1117',
                        }}>
                          {item.label}
                        </div>
                        <div style={{ fontSize: '11px', color: '#9ca3af' }}>
                          {item.desc}
                        </div>
                      </div>
                      <div style={{
                        fontSize: '16px',
                        fontWeight: 700,
                        color: item.value >= 0 ? '#16a34a' : '#dc2626',
                      }}>
                        {formatPercent(item.value)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

            </div>

            {/* Holding decomposition */}
            <div className="card">
              <div className="card-title">Return Decomposition — Per Holding</div>
              <p style={{ fontSize: '12px', color: '#9ca3af', marginBottom: '12px' }}>
                Note: systematic/idiosyncratic split uses approximated individual returns.
                For accurate per-holding R², use the Regression & Beta page with individual tickers.
              </p>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Ticker</th>
                    <th>Actual Return</th>
                    <th>Rf</th>
                    <th>β × (Rm-Rf)</th>
                    <th>CAPM Expected</th>
                    <th>Alpha</th>
                    <th>Systematic %</th>
                    <th>Idiosyncratic %</th>
                  </tr>
                </thead>
                <tbody>
                  {holdingRegs.map((h, i) => (
                    <tr key={h.ticker}>
                      <td style={{ fontWeight: 600, color: COLORS[i % COLORS.length] }}>
                        {h.ticker}
                      </td>
                      <td className={colorClass(h.annRet)}>
                        {formatPercent(h.annRet)}
                      </td>
                      <td>{formatPercent(RISK_FREE)}</td>
                      <td>{formatPercent(h.beta * (MARKET_RET - RISK_FREE))}</td>
                      <td>{formatPercent(h.capmExp)}</td>
                      <td className={colorClass(h.annRet - h.capmExp)} style={{ fontWeight: 600 }}>
                        {formatPercent(h.annRet - h.capmExp)}
                      </td>
                      <td>{formatDecimal(h.r2 * 100, 1)}%</td>
                      <td>{formatDecimal((1 - h.r2) * 100, 1)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* ══════════════════════════════════════════
            CONCEPTS — Always visible
        ══════════════════════════════════════════ */}
        <div className="section" style={{ marginTop: '48px' }}>
          <div className="section-title">Understanding Factor Models</div>
          <div className="two-col" style={{ gap: '16px' }}>

            <div className="formula-box">
              <div className="formula-box-title">CAPM</div>
              <div className="formula-box-math">
                E(R) = Rf + β × (Rm - Rf)
              </div>
              <div className="formula-box-description">
                The Capital Asset Pricing Model is the foundation of modern
                asset pricing. It says the expected return of any asset equals
                the risk-free rate plus a risk premium proportional to its
                systematic risk (beta). The equity risk premium (Rm - Rf) is
                the extra return investors demand for holding risky assets over
                the risk-free rate — historically around 5-6% annually.
                CAPM assumes markets are efficient and investors are rational
                and diversified.
              </div>
            </div>

            <div className="formula-box">
              <div className="formula-box-title">Jensen's Alpha</div>
              <div className="formula-box-math">
                α = Rp - [Rf + β × (Rm - Rf)]
              </div>
              <div className="formula-box-description">
                Jensen's alpha (1968) measures the excess return above what
                CAPM predicts given the portfolio's beta. A positive alpha
                means the portfolio generated returns that cannot be explained
                by market exposure alone — this is the holy grail of active
                management. In efficient markets, persistent positive alpha is
                theoretically impossible. In practice, alpha can persist due to
                skill, information advantages, or factor exposures not captured
                by single-factor CAPM.
              </div>
            </div>

            <div className="formula-box">
              <div className="formula-box-title">Treynor Ratio</div>
              <div className="formula-box-math">
                Treynor = (Rp - Rf) / β
              </div>
              <div className="formula-box-description">
                The Treynor ratio measures excess return per unit of systematic
                risk (beta) rather than total risk (sigma). It is appropriate
                when the portfolio is one component of a larger diversified
                portfolio — because idiosyncratic risk will be diversified away.
                Compare: Sharpe uses total volatility (appropriate for standalone
                portfolios), Treynor uses beta (appropriate for components of
                a larger portfolio). A higher Treynor ratio means more return
                per unit of market risk taken.
              </div>
            </div>

            <div className="formula-box">
              <div className="formula-box-title">Security Market Line</div>
              <div className="formula-box-math">
                SML: E(R) = Rf + β × (Rm - Rf)
              </div>
              <div className="formula-box-description">
                The SML is the graphical representation of CAPM — plotting
                expected return against beta. In equilibrium, all assets should
                lie on the SML. Assets above the SML are undervalued — they
                offer more return than their systematic risk warrants and will
                be bid up. Assets below are overvalued. The distance from the
                SML is alpha — the reward for active management beyond passive
                market exposure. The SML differs from the CML: the SML uses
                beta as risk measure, the CML uses total volatility.
              </div>
            </div>

            <div className="formula-box">
              <div className="formula-box-title">Return Decomposition</div>
              <div className="formula-box-math">
                Rp = Rf + β(Rm-Rf) + α + ε
              </div>
              <div className="formula-box-description">
                Every portfolio return can be decomposed into four parts:
                the risk-free rate (compensation for time), the market risk
                premium scaled by beta (compensation for systematic risk),
                alpha (skill or luck), and epsilon (random residual noise).
                The decomposition clarifies how much of your return came
                "for free" from market exposure versus from genuine active
                management. A portfolio with high return but high beta may
                simply be a leveraged index position.
              </div>
            </div>

            <div className="formula-box">
              <div className="formula-box-title">Systematic vs Idiosyncratic Risk</div>
              <div className="formula-box-math">
                σ²_total = β² × σ²_market + σ²_idiosyncratic
              </div>
              <div className="formula-box-description">
                Total portfolio variance decomposes into systematic variance
                (driven by market movements, measured by R²) and idiosyncratic
                variance (company-specific, measured by 1-R²). Systematic risk
                cannot be diversified away — it is the price of market
                participation. Idiosyncratic risk can be eliminated by holding
                a diversified portfolio. CAPM says you should not be compensated
                for taking idiosyncratic risk since it is diversifiable.
                Only systematic risk earns a risk premium.
              </div>
            </div>

          </div>
        </div>

      </div>
    </>
  );
};

export default FactorModels;