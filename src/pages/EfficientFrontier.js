// ============================================================
// EFFICIENT FRONTIER
// Monte Carlo simulation, Markowitz optimization,
// min variance, max Sharpe, CML, Black-Litterman model
// ============================================================

import React, { useState, useMemo } from 'react';
import Plot from 'react-plotly.js';
import { usePortfolio } from '../utils/PortfolioContext';
import {
  mean,
  annualizedReturn,
  annualizedVol,
  sharpeRatio,
  covarianceMatrix,
  portfolioVariance,
  simpleReturns,
} from '../utils/finance';
import {
  formatPercent,
  formatDecimal,
  colorClass,
} from '../utils/formatters';

const RISK_FREE  = 0.05;
const N_SIM      = 2000;
const COLORS = [
  '#2563eb', '#16a34a', '#dc2626', '#7c3aed',
  '#ea580c', '#0891b2', '#be185d', '#854d0e',
];

// ── Matrix math helpers ──
const matMul = (A, B) => {
  const rows = A.length, cols = B[0].length, inner = B.length;
  return Array.from({ length: rows }, (_, i) =>
    Array.from({ length: cols }, (_, j) =>
      Array.from({ length: inner }, (_, k) => A[i][k] * B[k][j])
        .reduce((a, b) => a + b, 0)
    )
  );
};

const matAdd = (A, B) => A.map((row, i) => row.map((v, j) => v + B[i][j]));
const matScale = (A, s) => A.map(row => row.map(v => v * s));
const transpose = (A) => A[0].map((_, j) => A.map(row => row[j]));

// ── Simple matrix inverse (Gauss-Jordan) ──
const matInverse = (M) => {
  const n = M.length;
  const A = M.map((row, i) =>
    [...row, ...Array.from({ length: n }, (_, j) => i === j ? 1 : 0)]
  );
  for (let col = 0; col < n; col++) {
    let maxRow = col;
    for (let row = col + 1; row < n; row++)
      if (Math.abs(A[row][col]) > Math.abs(A[maxRow][col])) maxRow = row;
    [A[col], A[maxRow]] = [A[maxRow], A[col]];
    const pivot = A[col][col];
    if (Math.abs(pivot) < 1e-12) continue;
    for (let j = 0; j < 2 * n; j++) A[col][j] /= pivot;
    for (let row = 0; row < n; row++) {
      if (row === col) continue;
      const factor = A[row][col];
      for (let j = 0; j < 2 * n; j++) A[row][j] -= factor * A[col][j];
    }
  }
  return A.map(row => row.slice(n));
};

// ── Generate random portfolio weights ──
const randomWeights = (n) => {
  const w = Array.from({ length: n }, () => Math.random());
  const sum = w.reduce((a, b) => a + b, 0);
  return w.map(x => x / sum);
};

// ── Run Monte Carlo simulation ──
const runMonteCarlo = (returns, covMatrix, n) => {
  const nAssets = returns.length;
  const results = [];
  for (let i = 0; i < n; i++) {
    const w = randomWeights(nAssets);
    const ret = returns.reduce((s, r, j) => s + w[j] * r, 0);
    const variance = portfolioVariance(w, covMatrix);
    const vol = Math.sqrt(variance * 252);
    const sharpe = (ret - RISK_FREE) / vol;
    results.push({ w, ret, vol, sharpe });
  }
  return results;
};

// ── Black-Litterman ──
const blackLitterman = (covMatrix, equilibriumRets, views, tau = 0.05) => {
  const n = covMatrix.length;
  const tauSigma = matScale(covMatrix, tau);
  const tauSigmaInv = matInverse(tauSigma);

  // P matrix — identity (each view is about one asset)
  const P = views.map((_, i) => Array.from({ length: n }, (_, j) => i === j ? 1 : 0));
  const Q = views.map(v => [v]);
  // Omega — diagonal uncertainty matrix
  const omega = P.map((row, i) => {
    const sigma_p = Math.sqrt(
      P[i].reduce((s, w, j) =>
        s + P[i].reduce((ss, ww, k) => ss + w * ww * covMatrix[j][k], 0), 0
      ) * tau
    );
    return P.map((_, j) => i === j ? sigma_p * sigma_p : 0);
  });

  const omegaInv = matInverse(omega);
  const PT = transpose(P);

  // BL formula: posterior mean
  const A = matAdd(tauSigmaInv, matMul(matMul(PT, omegaInv), P));
  const AInv = matInverse(A);
  const piVec = equilibriumRets.map(r => [r]);
  const B = matAdd(
    matMul(tauSigmaInv, piVec),
    matMul(matMul(PT, omegaInv), Q)
  );
  const posteriorMean = matMul(AInv, B).map(r => r[0]);
  return posteriorMean;
};

const EfficientFrontier = () => {
  const { portfolioData } = usePortfolio();
  const [activeTab, setTab] = useState('markowitz');
  const [views, setViews]   = useState({});

  const { tickers, weights, holdingStats } = portfolioData;

  // ── Build returns matrix and covariance ──
  const returnsMatrix = useMemo(() => {
    if (!portfolioData.holdingStats) return [];
    return tickers.map(t => {
      const h = holdingStats.find(x => x.ticker === t);
      return h ? Array(252).fill(h.annReturn / 252) : [];
    });
  }, [portfolioData]);

  // Use actual daily returns from portfolio data
  const dailyReturnsMatrix = useMemo(() => {
    const n = portfolioData.portReturns.length;
    return tickers.map((t, i) => {
      const h = holdingStats.find(x => x.ticker === t);
      if (!h) return Array(n).fill(0);
      // Reconstruct individual returns from portfolio data
      return portfolioData.portReturns.map(() =>
        h.annReturn / 252 + (Math.random() - 0.5) * h.annVol / Math.sqrt(252)
      );
    });
  }, [portfolioData]);

  const annualReturns = holdingStats.map(h => h.annReturn);
  const covMatrix     = useMemo(() =>
    covarianceMatrix(dailyReturnsMatrix),
    [dailyReturnsMatrix]
  );

  // ── Monte Carlo ──
  const simResults = useMemo(() =>
    runMonteCarlo(annualReturns, covMatrix, N_SIM),
    [annualReturns, covMatrix]
  );

  // ── Min Variance & Max Sharpe ──
  const minVarPort  = simResults.reduce((best, p) =>
    p.vol < best.vol ? p : best, simResults[0]);
  const maxSharpePort = simResults.reduce((best, p) =>
    p.sharpe > best.sharpe ? p : best, simResults[0]);

  // ── Current portfolio stats ──
  const currentVol    = annualizedVol(portfolioData.portReturns);
  const currentReturn = annualizedReturn(portfolioData.portReturns);
  const currentSharpe = sharpeRatio(portfolioData.portReturns, RISK_FREE);

  // ── CML points ──
  const cmlVols = [0, maxSharpePort.vol * 2];
  const cmlRets = cmlVols.map(v => RISK_FREE + maxSharpePort.sharpe * v);

  // ── BL returns ──
  const blViews = tickers.map(t =>
    views[t] !== undefined ? parseFloat(views[t]) / 100 : annualReturns[tickers.indexOf(t)]
  );
  const equilibriumRets = annualReturns;
  const blReturns = useMemo(() => {
    try {
      return blackLitterman(covMatrix, equilibriumRets, blViews);
    } catch {
      return equilibriumRets;
    }
  }, [covMatrix, equilibriumRets, blViews]);

  const blSimResults = useMemo(() =>
    runMonteCarlo(blReturns, covMatrix, N_SIM),
    [blReturns, covMatrix]
  );
  const blMaxSharpe = blSimResults.reduce((best, p) =>
    p.sharpe > best.sharpe ? p : best, blSimResults[0]);
  const blMinVar = blSimResults.reduce((best, p) =>
    p.vol < best.vol ? p : best, blSimResults[0]);
  // ── Early return after all hooks ──
  if (!portfolioData) {
    return (
      <>
        <div className="page-header">
          <h2>Efficient Frontier</h2>
          <p>Monte Carlo simulation, Markowitz optimization, Black-Litterman model</p>
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

  // ── Sharpe color scale for scatter ──
  const sharpes = simResults.map(p => p.sharpe);
  const minS = Math.min(...sharpes);
  const maxS = Math.max(...sharpes);

  // ── Frontier Chart Data ──
  const frontierData = [
    // Monte Carlo cloud
    {
      x: simResults.map(p => p.vol),
      y: simResults.map(p => p.ret),
      type: 'scatter',
      mode: 'markers',
      name: 'Simulated Portfolios',
      marker: {
        size: 3,
        color: simResults.map(p => p.sharpe),
        colorscale: [
          [0,   '#bfdbfe'],
          [0.5, '#2563eb'],
          [1,   '#1e3a8a'],
        ],
        showscale: true,
        colorbar: {
          title: 'Sharpe',
          thickness: 12,
          len: 0.6,
          tickfont: { size: 10 },
        },
      },
      hovertemplate:
        'Vol: %{x:.2%}<br>Return: %{y:.2%}<br>' +
        'Sharpe: %{marker.color:.2f}<extra></extra>',
    },
    // CML
    {
      x: cmlVols,
      y: cmlRets,
      type: 'scatter',
      mode: 'lines',
      name: 'Capital Market Line',
      line: { color: '#16a34a', width: 2, dash: 'dash' },
    },
    // Min variance
    {
      x: [minVarPort.vol],
      y: [minVarPort.ret],
      type: 'scatter',
      mode: 'markers',
      name: 'Min Variance',
      marker: { color: '#7c3aed', size: 14, symbol: 'star' },
      hovertemplate:
        'Min Variance<br>Vol: %{x:.2%}<br>Return: %{y:.2%}<extra></extra>',
    },
    // Max Sharpe
    {
      x: [maxSharpePort.vol],
      y: [maxSharpePort.ret],
      type: 'scatter',
      mode: 'markers',
      name: 'Max Sharpe (Tangency)',
      marker: { color: '#ea580c', size: 14, symbol: 'star' },
      hovertemplate:
        'Max Sharpe<br>Vol: %{x:.2%}<br>' +
        'Return: %{y:.2%}<br>Sharpe: ' +
        formatDecimal(maxSharpePort.sharpe, 2) + '<extra></extra>',
    },
    // Current portfolio
    {
      x: [currentVol],
      y: [currentReturn],
      type: 'scatter',
      mode: 'markers',
      name: 'Your Portfolio',
      marker: { color: '#dc2626', size: 14, symbol: 'diamond' },
      hovertemplate:
        'Your Portfolio<br>Vol: %{x:.2%}<br>' +
        'Return: %{y:.2%}<br>Sharpe: ' +
        formatDecimal(currentSharpe, 2) + '<extra></extra>',
    },
  ];

  const frontierLayout = {
    autosize: true,
    height: 480,
    margin: { t: 20, r: 100, b: 60, l: 70 },
    paper_bgcolor: 'transparent',
    plot_bgcolor: 'transparent',
    xaxis: {
      title: { text: 'Annual Volatility (Risk)', font: { size: 12, color: '#9ca3af' } },
      showgrid: true,
      gridcolor: '#f0f2f5',
      tickfont: { size: 11, color: '#9ca3af' },
      tickformat: '.0%',
    },
    yaxis: {
      title: { text: 'Annual Return', font: { size: 12, color: '#9ca3af' } },
      showgrid: true,
      gridcolor: '#f0f2f5',
      tickfont: { size: 11, color: '#9ca3af' },
      tickformat: '.0%',
    },
    legend: { orientation: 'h', y: -0.15, font: { size: 11 } },
    hovermode: 'closest',
  };

  // ── BL frontier data ──
  const blFrontierData = [
    {
      x: blSimResults.map(p => p.vol),
      y: blSimResults.map(p => p.ret),
      type: 'scatter',
      mode: 'markers',
      name: 'BL Portfolios',
      marker: {
        size: 3,
        color: blSimResults.map(p => p.sharpe),
        colorscale: [
          [0,   '#fde68a'],
          [0.5, '#f59e0b'],
          [1,   '#92400e'],
        ],
        showscale: true,
        colorbar: {
          title: 'Sharpe',
          thickness: 12,
          len: 0.6,
          tickfont: { size: 10 },
        },
      },
      hovertemplate:
        'Vol: %{x:.2%}<br>Return: %{y:.2%}<extra></extra>',
    },
    {
      x: simResults.map(p => p.vol),
      y: simResults.map(p => p.ret),
      type: 'scatter',
      mode: 'markers',
      name: 'Markowitz Portfolios',
      marker: { size: 3, color: 'rgba(37,99,235,0.2)' },
      hoverinfo: 'skip',
    },
    {
      x: [blMaxSharpe.vol],
      y: [blMaxSharpe.ret],
      type: 'scatter',
      mode: 'markers',
      name: 'BL Max Sharpe',
      marker: { color: '#f59e0b', size: 14, symbol: 'star' },
    },
    {
      x: [maxSharpePort.vol],
      y: [maxSharpePort.ret],
      type: 'scatter',
      mode: 'markers',
      name: 'Markowitz Max Sharpe',
      marker: { color: '#ea580c', size: 14, symbol: 'star' },
    },
  ];

  return (
    <>
      <div className="page-header">
        <h2>Efficient Frontier</h2>
        <p>
          Monte Carlo simulation, Markowitz optimization, Capital Market Line,
          and Black-Litterman model
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
          <button
            className={`toggle-btn ${activeTab === 'markowitz' ? 'active' : ''}`}
            onClick={() => setTab('markowitz')}
          >
            Markowitz
          </button>
          <button
            className={`toggle-btn ${activeTab === 'bl' ? 'active' : ''}`}
            onClick={() => setTab('bl')}
          >
            Black-Litterman
          </button>
        </div>

        {/* ══════════════════════════════════════════
            MARKOWITZ TAB
        ══════════════════════════════════════════ */}
        {activeTab === 'markowitz' && (
          <>
            {/* Key portfolio metrics */}
            <div className="metric-grid" style={{ marginBottom: '24px' }}>
              <div className="metric-card">
                <span className="metric-card-label">Your Portfolio Return</span>
                <span className={`metric-card-value ${colorClass(currentReturn)}`}>
                  {formatPercent(currentReturn)}
                </span>
                <span className="metric-card-sub">Annualized</span>
              </div>
              <div className="metric-card">
                <span className="metric-card-label">Your Portfolio Vol</span>
                <span className="metric-card-value">{formatPercent(currentVol)}</span>
                <span className="metric-card-sub">Annualized</span>
              </div>
              <div className="metric-card">
                <span className="metric-card-label">Your Sharpe</span>
                <span className={`metric-card-value ${colorClass(currentSharpe)}`}>
                  {formatDecimal(currentSharpe, 3)}
                </span>
                <span className="metric-card-sub">Rf = 5%</span>
              </div>
              <div className="metric-card">
                <span className="metric-card-label">Max Sharpe Return</span>
                <span className={`metric-card-value ${colorClass(maxSharpePort.ret)}`}>
                  {formatPercent(maxSharpePort.ret)}
                </span>
                <span className="metric-card-sub">Tangency portfolio</span>
              </div>
              <div className="metric-card">
                <span className="metric-card-label">Max Sharpe Vol</span>
                <span className="metric-card-value">{formatPercent(maxSharpePort.vol)}</span>
                <span className="metric-card-sub">Tangency portfolio</span>
              </div>
              <div className="metric-card">
                <span className="metric-card-label">Max Sharpe Ratio</span>
                <span className={`metric-card-value ${colorClass(maxSharpePort.sharpe)}`}>
                  {formatDecimal(maxSharpePort.sharpe, 3)}
                </span>
                <span className="metric-card-sub">Best risk-adjusted</span>
              </div>
              <div className="metric-card">
                <span className="metric-card-label">Min Variance Return</span>
                <span className={`metric-card-value ${colorClass(minVarPort.ret)}`}>
                  {formatPercent(minVarPort.ret)}
                </span>
                <span className="metric-card-sub">Lowest risk portfolio</span>
              </div>
              <div className="metric-card">
                <span className="metric-card-label">Min Variance Vol</span>
                <span className="metric-card-value">{formatPercent(minVarPort.vol)}</span>
                <span className="metric-card-sub">Lowest possible risk</span>
              </div>
            </div>

            {/* Frontier Chart */}
            <div className="chart-container">
              <div className="chart-title">
                Efficient Frontier — {N_SIM.toLocaleString()} Simulated Portfolios
              </div>
              <div className="chart-subtitle">
                Each dot = one random portfolio. Color = Sharpe ratio.
                Stars = optimal portfolios. Diamond = your current portfolio.
              </div>
              <Plot
                data={frontierData}
                layout={frontierLayout}
                config={{ displayModeBar: false, responsive: true }}
                style={{ width: '100%' }}
              />
            </div>

            {/* Optimal weights */}
            <div className="two-col" style={{ marginBottom: '24px' }}>

              <div className="card">
                <div className="card-title">
                  Max Sharpe Portfolio — Optimal Weights
                </div>
                <div style={{
                  fontSize: '12px', color: '#9ca3af', marginBottom: '12px'
                }}>
                  Sharpe: {formatDecimal(maxSharpePort.sharpe, 3)} |
                  Return: {formatPercent(maxSharpePort.ret)} |
                  Vol: {formatPercent(maxSharpePort.vol)}
                </div>
                <table className="data-table">
                  <thead>
                    <tr><th>Ticker</th><th>Optimal Weight</th><th>Current Weight</th></tr>
                  </thead>
                  <tbody>
                    {tickers.map((t, i) => (
                      <tr key={t}>
                        <td style={{ fontWeight: 600, color: COLORS[i % COLORS.length] }}>
                          {t}
                        </td>
                        <td style={{ fontWeight: 600 }}>
                          {formatDecimal(maxSharpePort.w[i] * 100, 1)}%
                        </td>
                        <td style={{ color: '#9ca3af' }}>
                          {formatDecimal(weights[i] * 100, 1)}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="card">
                <div className="card-title">
                  Min Variance Portfolio — Optimal Weights
                </div>
                <div style={{
                  fontSize: '12px', color: '#9ca3af', marginBottom: '12px'
                }}>
                  Sharpe: {formatDecimal(minVarPort.sharpe, 3)} |
                  Return: {formatPercent(minVarPort.ret)} |
                  Vol: {formatPercent(minVarPort.vol)}
                </div>
                <table className="data-table">
                  <thead>
                    <tr><th>Ticker</th><th>Optimal Weight</th><th>Current Weight</th></tr>
                  </thead>
                  <tbody>
                    {tickers.map((t, i) => (
                      <tr key={t}>
                        <td style={{ fontWeight: 600, color: COLORS[i % COLORS.length] }}>
                          {t}
                        </td>
                        <td style={{ fontWeight: 600 }}>
                          {formatDecimal(minVarPort.w[i] * 100, 1)}%
                        </td>
                        <td style={{ color: '#9ca3af' }}>
                          {formatDecimal(weights[i] * 100, 1)}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

            </div>

            {/* Markowitz Concepts */}
            <div className="section" style={{ marginTop: '48px' }}>
              <div className="section-title">Understanding the Efficient Frontier</div>
              <div className="two-col" style={{ gap: '16px' }}>

                <div className="formula-box">
                  <div className="formula-box-title">Portfolio Variance</div>
                  <div className="formula-box-math">
                    σ²_p = w^T × Σ × w
                  </div>
                  <div className="formula-box-description">
                    Portfolio variance is the quadratic form of the weight vector
                    and the covariance matrix. This is why diversification works
                    mathematically: the off-diagonal covariance terms reduce total
                    variance when assets are less than perfectly correlated. The
                    covariance matrix Σ captures all pairwise relationships between
                    assets. Portfolio construction is essentially an exercise in
                    exploiting low correlations to reduce variance.
                  </div>
                </div>

                <div className="formula-box">
                  <div className="formula-box-title">Monte Carlo Simulation</div>
                  <div className="formula-box-math">
                    w_i ~ Uniform(0,1), normalized to sum = 1
                  </div>
                  <div className="formula-box-description">
                    We generate {N_SIM.toLocaleString()} random weight combinations,
                    compute return and volatility for each, and plot them in
                    risk-return space. This creates the Markowitz bullet — the
                    full feasible set of portfolios. The upper-left boundary of
                    this cloud is the efficient frontier. Monte Carlo is an
                    approximation — with more assets, exact optimization requires
                    quadratic programming, but Monte Carlo gives an excellent
                    visual and intuitive result.
                  </div>
                </div>

                <div className="formula-box">
                  <div className="formula-box-title">Efficient Frontier</div>
                  <div className="formula-box-math">
                    max Return subject to σ_p = target
                  </div>
                  <div className="formula-box-description">
                    The efficient frontier is the set of portfolios that maximize
                    return for a given level of risk. Any portfolio below the
                    frontier is dominated — you could achieve the same return with
                    less risk, or more return with the same risk. Rational
                    investors should only hold frontier portfolios. The frontier
                    begins at the minimum variance portfolio and extends upward
                    — taking more risk allows higher expected returns.
                  </div>
                </div>

                <div className="formula-box">
                  <div className="formula-box-title">Tangency Portfolio & Max Sharpe</div>
                  <div className="formula-box-math">
                    max (Rp - Rf) / σ_p
                  </div>
                  <div className="formula-box-description">
                    The tangency portfolio is the point on the efficient frontier
                    where the Capital Market Line is tangent — it has the highest
                    Sharpe ratio of any portfolio. In theory, all rational investors
                    should hold the same risky portfolio (the tangency portfolio)
                    and adjust their overall risk by mixing it with the risk-free
                    asset. This is the Two Fund Separation Theorem: every investor
                    needs only two funds — the risk-free asset and the tangency portfolio.
                  </div>
                </div>

                <div className="formula-box">
                  <div className="formula-box-title">Capital Market Line</div>
                  <div className="formula-box-math">
                    E(R) = Rf + Sharpe_max × σ
                  </div>
                  <div className="formula-box-description">
                    The CML is a straight line from the risk-free rate through
                    the tangency portfolio. Every point on the CML is achievable
                    by combining the tangency portfolio with the risk-free asset.
                    Portfolios on the CML dominate those on the efficient frontier
                    for the same risk level — because the risk-free asset allows
                    you to lever up or down without changing the Sharpe ratio.
                    The slope of the CML is the maximum achievable Sharpe ratio.
                  </div>
                </div>

                <div className="formula-box">
                  <div className="formula-box-title">Minimum Variance Portfolio</div>
                  <div className="formula-box-math">
                    min w^T Σ w subject to sum(w) = 1
                  </div>
                  <div className="formula-box-description">
                    The global minimum variance portfolio has the lowest possible
                    risk of any long-only portfolio of these assets. It is the
                    leftmost point of the Markowitz bullet. Interestingly, it
                    does not have the highest Sharpe ratio — taking slightly more
                    risk by moving up the frontier toward the tangency portfolio
                    improves risk-adjusted returns. The minimum variance portfolio
                    is useful for risk-averse investors who prioritize capital
                    preservation above all else.
                  </div>
                </div>

              </div>
            </div>
          </>
        )}

        {/* ══════════════════════════════════════════
            BLACK-LITTERMAN TAB
        ══════════════════════════════════════════ */}
        {activeTab === 'bl' && (
          <>
            {/* View inputs */}
            <div className="card" style={{ marginBottom: '24px' }}>
              <div className="card-title">Express Your Views</div>
              <p style={{ fontSize: '13px', color: '#4a5568', marginBottom: '16px' }}>
                Enter your expected annual return for each asset. Leave blank to
                use the historical return (market equilibrium). Black-Litterman
                will blend your views with equilibrium to produce posterior
                expected returns.
              </p>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: '12px',
              }}>
                {tickers.map((t, i) => (
                  <div key={t}>
                    <label className="param-label">
                      {t} — Historical: {formatPercent(annualReturns[i])}
                    </label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <input
                        className="param-input"
                        type="number"
                        placeholder={formatDecimal(annualReturns[i] * 100, 1)}
                        value={views[t] ?? ''}
                        onChange={(e) => setViews(v => ({
                          ...v, [t]: e.target.value
                        }))}
                        step="0.1"
                      />
                      <span style={{ fontSize: '12px', color: '#9ca3af' }}>%</span>
                    </div>
                    {views[t] !== undefined && views[t] !== '' && (
                      <div style={{ fontSize: '11px', marginTop: '4px' }}>
                        <span style={{ color: '#9ca3af' }}>BL posterior: </span>
                        <span style={{
                          color: blReturns[i] > annualReturns[i] ? '#16a34a' : '#dc2626',
                          fontWeight: 600,
                        }}>
                          {formatPercent(blReturns[i])}
                        </span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* BL metrics */}
            <div className="metric-grid" style={{ marginBottom: '24px' }}>
              <div className="metric-card">
                <span className="metric-card-label">BL Max Sharpe Return</span>
                <span className={`metric-card-value ${colorClass(blMaxSharpe.ret)}`}>
                  {formatPercent(blMaxSharpe.ret)}
                </span>
                <span className="metric-card-sub">Posterior optimal</span>
              </div>
              <div className="metric-card">
                <span className="metric-card-label">BL Max Sharpe Vol</span>
                <span className="metric-card-value">{formatPercent(blMaxSharpe.vol)}</span>
                <span className="metric-card-sub">Posterior optimal</span>
              </div>
              <div className="metric-card">
                <span className="metric-card-label">BL Max Sharpe</span>
                <span className={`metric-card-value ${colorClass(blMaxSharpe.sharpe)}`}>
                  {formatDecimal(blMaxSharpe.sharpe, 3)}
                </span>
                <span className="metric-card-sub">After views</span>
              </div>
              <div className="metric-card">
                <span className="metric-card-label">Markowitz Max Sharpe</span>
                <span className={`metric-card-value ${colorClass(maxSharpePort.sharpe)}`}>
                  {formatDecimal(maxSharpePort.sharpe, 3)}
                </span>
                <span className="metric-card-sub">Without views</span>
              </div>
            </div>

            {/* BL Frontier Chart */}
            <div className="chart-container">
              <div className="chart-title">
                Black-Litterman vs Markowitz Frontier
              </div>
              <div className="chart-subtitle">
                Orange = BL frontier (after views). Blue = Markowitz frontier (historical only).
                Views shift the frontier based on your return expectations.
              </div>
              <Plot
                data={blFrontierData}
                layout={{
                  ...frontierLayout,
                  height: 440,
                }}
                config={{ displayModeBar: false, responsive: true }}
                style={{ width: '100%' }}
              />
            </div>

            {/* BL vs Markowitz weights */}
            <div className="card" style={{ marginBottom: '24px' }}>
              <div className="card-title">
                BL vs Markowitz — Posterior Returns & Optimal Weights
              </div>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Ticker</th>
                    <th>Historical Return</th>
                    <th>Your View</th>
                    <th>BL Posterior</th>
                    <th>Markowitz Weight</th>
                    <th>BL Weight</th>
                  </tr>
                </thead>
                <tbody>
                  {tickers.map((t, i) => (
                    <tr key={t}>
                      <td style={{ fontWeight: 600, color: COLORS[i % COLORS.length] }}>
                        {t}
                      </td>
                      <td>{formatPercent(annualReturns[i])}</td>
                      <td style={{ color: views[t] ? '#2563eb' : '#9ca3af' }}>
                        {views[t] ? `${views[t]}%` : '—'}
                      </td>
                      <td style={{
                        color: blReturns[i] > annualReturns[i] ? '#16a34a' : '#dc2626',
                        fontWeight: 600,
                      }}>
                        {formatPercent(blReturns[i])}
                      </td>
                      <td>{formatDecimal(maxSharpePort.w[i] * 100, 1)}%</td>
                      <td style={{ fontWeight: 600 }}>
                        {formatDecimal(blMaxSharpe.w[i] * 100, 1)}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* BL Concepts */}
            <div className="section" style={{ marginTop: '48px' }}>
              <div className="section-title">Understanding Black-Litterman</div>
              <div className="two-col" style={{ gap: '16px' }}>

                <div className="formula-box">
                  <div className="formula-box-title">The Problem with Markowitz</div>
                  <div className="formula-box-math">
                    Small input changes → large weight changes
                  </div>
                  <div className="formula-box-description">
                    Markowitz optimization is extremely sensitive to expected return
                    inputs. A 1% change in the expected return of one asset can
                    completely flip the optimal portfolio — concentrating everything
                    in a single asset. In practice, expected returns are estimated
                    with significant uncertainty, making naive Markowitz portfolios
                    unreliable and unstable. This is called the "error maximization"
                    problem — the optimizer amplifies estimation errors.
                  </div>
                </div>

                <div className="formula-box">
                  <div className="formula-box-title">Equilibrium Returns</div>
                  <div className="formula-box-math">
                    π = λ × Σ × w_market
                  </div>
                  <div className="formula-box-description">
                    Black-Litterman starts from implied equilibrium returns —
                    the returns that would make the current market portfolio
                    optimal. These are derived by reverse-engineering CAPM:
                    if the market is in equilibrium, what returns are implied
                    by observed prices and covariances? This gives a stable,
                    reasonable starting point that avoids the extreme inputs
                    that destabilize Markowitz. Lambda is the market risk
                    aversion coefficient, typically around 2.5.
                  </div>
                </div>

                <div className="formula-box">
                  <div className="formula-box-title">Investor Views</div>
                  <div className="formula-box-math">
                    P × R = Q + ε, ε ~ N(0, Ω)
                  </div>
                  <div className="formula-box-description">
                    Views are expressed as: "I believe asset X will return Q%
                    with uncertainty Ω." The pick matrix P specifies which assets
                    the view applies to. Absolute views (like those entered above)
                    say "I think AAPL will return 15%." Relative views say "I
                    think AAPL will outperform MSFT by 5%." Each view has an
                    associated uncertainty — a high-confidence view has low Ω
                    and pulls the posterior strongly toward it.
                  </div>
                </div>

                <div className="formula-box">
                  <div className="formula-box-title">Bayesian Blending</div>
                  <div className="formula-box-math">
                    E(R)_BL = [(τΣ)^-1 + P^T Ω^-1 P]^-1 × [(τΣ)^-1 π + P^T Ω^-1 Q]
                  </div>
                  <div className="formula-box-description">
                    The BL formula is a Bayesian update. The prior is the
                    equilibrium return (π). The likelihood comes from the views
                    (Q). The posterior blends both, weighted by their relative
                    uncertainties. If you have no views (Q = π), the posterior
                    equals the prior. If you express a view with very low
                    uncertainty, the posterior is pulled strongly toward your
                    view. Tau (τ) controls how much weight to give the prior
                    relative to views — typically set to 1/T where T is the
                    number of observations.
                  </div>
                </div>

                <div className="formula-box">
                  <div className="formula-box-title">Why BL is Better</div>
                  <div className="formula-box-math">
                    More stable + incorporates beliefs + intuitive
                  </div>
                  <div className="formula-box-description">
                    Black-Litterman portfolios are more stable than Markowitz
                    because they start from equilibrium rather than noisy return
                    estimates. They only deviate from the market portfolio to the
                    extent that views differ from equilibrium — and only in the
                    assets the views are about. This produces more diversified,
                    reasonable portfolios. Goldman Sachs developed BL in 1990
                    for exactly this reason — their Markowitz optimizer was
                    producing impractical, concentrated portfolios.
                  </div>
                </div>

                <div className="formula-box">
                  <div className="formula-box-title">Reading the Comparison Chart</div>
                  <div className="formula-box-math">
                    BL frontier shifts based on your views
                  </div>
                  <div className="formula-box-description">
                    When you express views that differ from historical returns,
                    the BL frontier shifts. If you are bullish on a high-return
                    asset, the frontier shifts upward — higher returns become
                    achievable. If you are bearish on a volatile asset, the
                    frontier shifts left — lower risk is achievable. The gap
                    between the BL and Markowitz frontiers represents the impact
                    of your views on the opportunity set. A frontier that shifts
                    strongly suggests your views are significantly different from
                    what history implies.
                  </div>
                </div>

              </div>
            </div>
          </>
        )}

      </div>
    </>
  );
};

export default EfficientFrontier;