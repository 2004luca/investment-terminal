// ============================================================
// PORTFOLIO ATTRIBUTION
// Brinson-Hood-Beebower model: allocation, selection,
// interaction effects, contribution analysis,
// diversification ratio
// ============================================================

import React, { useMemo } from 'react';
import Plot from 'react-plotly.js';
import { usePortfolio } from '../utils/PortfolioContext';
import {
  annualizedReturn,
  annualizedVol,
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

// ── SPY sector weights (approximate S&P 500 weights) ──
const SPY_SECTOR_WEIGHTS = {
  tech:      0.31,
  health:    0.13,
  finance:   0.13,
  consumer:  0.10,
  defensive: 0.07,
  energy:    0.04,
  default:   0.05,
};

// ── SPY sector returns (approximate 2Y annualized) ──
const SPY_SECTOR_RETURNS = {
  tech:      0.18,
  health:    0.06,
  finance:   0.14,
  consumer:  0.12,
  defensive: 0.08,
  energy:    0.05,
  default:   0.10,
};

// ── Map ticker to sector ──
const getSector = (ticker) => {
  const techTickers      = ['AAPL','MSFT','GOOGL','GOOG','META','AMZN','NVDA','AMD','TSLA','INTC','CRM','ORCL','ADBE','NFLX','UBER','SQ','PYPL'];
  const financeTickers   = ['JPM','BAC','WFC','GS','MS','C','V','MA','AXP','BLK','SCHW'];
  const healthTickers    = ['JNJ','PFE','UNH','ABBV','MRK','LLY','BMY','AMGN','GILD','CVS'];
  const energyTickers    = ['XOM','CVX','COP','SLB','EOG','PXD','MPC','VLO'];
  const defensiveTickers = ['KO','PEP','PG','WMT','COST','MCD','CL','GIS','K','HSY','MO'];
  const consumerTickers  = ['HD','LOW','TGT','NKE','SBUX','YUM','DPZ'];

  const t = ticker.toUpperCase();
  if (defensiveTickers.includes(t)) return 'defensive';
  if (techTickers.includes(t))      return 'tech';
  if (financeTickers.includes(t))   return 'finance';
  if (healthTickers.includes(t))    return 'health';
  if (energyTickers.includes(t))    return 'energy';
  if (consumerTickers.includes(t))  return 'consumer';
  return 'default';
};

const PortfolioAttribution = () => {
  const { portfolioData } = usePortfolio();

  // ── BHB Attribution ──
  const attribution = useMemo(() => {
    if (!portfolioData) return null;
    const { tickers, weights, holdingStats, spyReturns, portReturns } = portfolioData;

    const benchmarkReturn = annualizedReturn(spyReturns);
    const portfolioReturn = annualizedReturn(portReturns);
    const activeReturn    = portfolioReturn - benchmarkReturn;

    // Group holdings by sector
    const sectorMap = {};
    tickers.forEach((t, i) => {
      const sector = getSector(t);
      if (!sectorMap[sector]) sectorMap[sector] = { tickers: [], weights: [], returns: [] };
      sectorMap[sector].tickers.push(t);
      sectorMap[sector].weights.push(weights[i]);
      const h = holdingStats.find(x => x.ticker === t);
      sectorMap[sector].returns.push(h?.annReturn ?? 0);
    });

    // Per-sector attribution
    const sectorAttribution = Object.entries(sectorMap).map(([sector, data]) => {
      const w_p = data.weights.reduce((a, b) => a + b, 0);
      const w_b = SPY_SECTOR_WEIGHTS[sector] ?? SPY_SECTOR_WEIGHTS.default;
      const R_p = data.returns.reduce((s, r, i) =>
        s + (data.weights[i] / w_p) * r, 0
      );
      const R_b = SPY_SECTOR_RETURNS[sector] ?? SPY_SECTOR_RETURNS.default;
      const R_B = benchmarkReturn;

      const allocation  = (w_p - w_b) * (R_b - R_B);
      const selection   = w_b * (R_p - R_b);
      const interaction = (w_p - w_b) * (R_p - R_b);
      const total       = allocation + selection + interaction;

      return {
        sector,
        w_p, w_b, R_p, R_b,
        allocation, selection, interaction, total,
      };
    });

    // Totals
    const totalAllocation  = sectorAttribution.reduce((s, x) => s + x.allocation,  0);
    const totalSelection   = sectorAttribution.reduce((s, x) => s + x.selection,   0);
    const totalInteraction = sectorAttribution.reduce((s, x) => s + x.interaction, 0);

    // Per-holding contribution
    const contributions = tickers.map((t, i) => {
      const h = holdingStats.find(x => x.ticker === t);
      return {
        ticker:       t,
        weight:       weights[i],
        annReturn:    h?.annReturn ?? 0,
        contribution: weights[i] * (h?.annReturn ?? 0),
        annVol:       h?.annVol ?? 0,
        sector:       getSector(t),
      };
    }).sort((a, b) => b.contribution - a.contribution);

    // Diversification ratio
    const weightedAvgVol = holdingStats.reduce((s, h, i) =>
      s + weights[i] * (h.annVol ?? 0), 0
    );
    const portVol = annualizedVol(portReturns);
    const divRatio = portVol > 0 ? weightedAvgVol / portVol : 1;

    return {
      portfolioReturn,
      benchmarkReturn,
      activeReturn,
      totalAllocation,
      totalSelection,
      totalInteraction,
      sectorAttribution,
      contributions,
      divRatio,
      weightedAvgVol,
      portVol,
    };
  }, [portfolioData]);

  if (!portfolioData || !attribution) {
    return (
      <>
        <div className="page-header">
          <h2>Portfolio Attribution</h2>
          <p>Return decomposition — allocation, selection, and interaction effects</p>
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

  const { tickers, holdingStats } = portfolioData;
  const {
    portfolioReturn, benchmarkReturn, activeReturn,
    totalAllocation, totalSelection, totalInteraction,
    sectorAttribution, contributions, divRatio,
    weightedAvgVol, portVol,
  } = attribution;

  // ── Waterfall chart ──
  const waterfallData = [
    {
      type: 'waterfall',
      orientation: 'v',
      measure: ['absolute', 'relative', 'relative', 'relative', 'total'],
      x: ['Benchmark (SPY)', 'Allocation', 'Selection', 'Interaction', 'Portfolio'],
      y: [
        benchmarkReturn * 100,
        totalAllocation * 100,
        totalSelection * 100,
        totalInteraction * 100,
        portfolioReturn * 100,
      ],
      text: [
        formatPercent(benchmarkReturn),
        formatPercent(totalAllocation),
        formatPercent(totalSelection),
        formatPercent(totalInteraction),
        formatPercent(portfolioReturn),
      ],
      textposition: 'outside',
      connector: { line: { color: '#e5e7eb', width: 1 } },
      increasing: { marker: { color: '#16a34a' } },
      decreasing: { marker: { color: '#dc2626' } },
      totals:     { marker: { color: '#2563eb' } },
      hovertemplate: '%{x}: %{text}<extra></extra>',
    },
  ];

  const waterfallLayout = {
    autosize: true,
    height: 360,
    margin: { t: 30, r: 20, b: 40, l: 60 },
    paper_bgcolor: 'transparent',
    plot_bgcolor: 'transparent',
    xaxis: {
      showgrid: false,
      tickfont: { size: 12, color: '#4a5568' },
    },
    yaxis: {
      showgrid: true,
      gridcolor: '#f0f2f5',
      tickfont: { size: 11, color: '#9ca3af' },
      ticksuffix: '%',
    },
    showlegend: false,
  };

  // ── Contribution bar chart ──
  const contribData = [
    {
      x: contributions.map(c => c.ticker),
      y: contributions.map(c => c.contribution * 100),
      type: 'bar',
      marker: {
        color: contributions.map(c =>
          c.contribution >= 0
            ? 'rgba(37, 99, 235, 0.7)'
            : 'rgba(220, 38, 38, 0.7)'
        ),
      },
      text: contributions.map(c => formatPercent(c.contribution)),
      textposition: 'outside',
      hovertemplate: '%{x}<br>Contribution: %{text}<extra></extra>',
    },
  ];

  const contribLayout = {
    autosize: true,
    height: 360,
    margin: { t: 30, r: 20, b: 40, l: 60 },
    paper_bgcolor: 'transparent',
    plot_bgcolor: 'transparent',
    xaxis: {
      showgrid: false,
      tickfont: { size: 12, color: '#4a5568' },
    },
    yaxis: {
      showgrid: true,
      gridcolor: '#f0f2f5',
      tickfont: { size: 11, color: '#9ca3af' },
      ticksuffix: '%',
      zeroline: true,
      zerolinecolor: '#e5e7eb',
    },
    showlegend: false,
  };

  // ── Sector attribution bar chart ──
  const sectorBarData = [
    {
      x: sectorAttribution.map(s => s.sector),
      y: sectorAttribution.map(s => s.allocation * 100),
      type: 'bar',
      name: 'Allocation',
      marker: { color: 'rgba(37, 99, 235, 0.7)' },
      hovertemplate: '%{x}<br>Allocation: %{y:.2f}%<extra></extra>',
    },
    {
      x: sectorAttribution.map(s => s.sector),
      y: sectorAttribution.map(s => s.selection * 100),
      type: 'bar',
      name: 'Selection',
      marker: { color: 'rgba(22, 163, 74, 0.7)' },
      hovertemplate: '%{x}<br>Selection: %{y:.2f}%<extra></extra>',
    },
    {
      x: sectorAttribution.map(s => s.sector),
      y: sectorAttribution.map(s => s.interaction * 100),
      type: 'bar',
      name: 'Interaction',
      marker: { color: 'rgba(124, 58, 237, 0.7)' },
      hovertemplate: '%{x}<br>Interaction: %{y:.2f}%<extra></extra>',
    },
  ];

  const sectorBarLayout = {
    autosize: true,
    height: 320,
    margin: { t: 10, r: 20, b: 50, l: 60 },
    paper_bgcolor: 'transparent',
    plot_bgcolor: 'transparent',
    barmode: 'group',
    xaxis: {
      showgrid: false,
      tickfont: { size: 11, color: '#4a5568' },
    },
    yaxis: {
      showgrid: true,
      gridcolor: '#f0f2f5',
      tickfont: { size: 11, color: '#9ca3af' },
      ticksuffix: '%',
      zeroline: true,
      zerolinecolor: '#e5e7eb',
    },
    legend: { orientation: 'h', y: -0.2, font: { size: 11 } },
    hovermode: 'x unified',
  };

  return (
    <>
      <div className="page-header">
        <h2>Portfolio Attribution</h2>
        <p>
          Brinson-Hood-Beebower model — decompose active return into
          allocation, selection, and interaction effects
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

        {/* ── Metric Cards ── */}
        <div className="metric-grid" style={{ marginBottom: '24px' }}>

          <div className="metric-card">
            <span className="metric-card-label">Portfolio Return</span>
            <span className={`metric-card-value ${colorClass(portfolioReturn)}`}>
              {formatPercent(portfolioReturn)}
            </span>
            <span className="metric-card-sub">Annualized</span>
          </div>

          <div className="metric-card">
            <span className="metric-card-label">Benchmark (SPY)</span>
            <span className={`metric-card-value ${colorClass(benchmarkReturn)}`}>
              {formatPercent(benchmarkReturn)}
            </span>
            <span className="metric-card-sub">Annualized</span>
          </div>

          <div className="metric-card">
            <span className="metric-card-label">Active Return</span>
            <span className={`metric-card-value ${colorClass(activeReturn)}`}>
              {formatPercent(activeReturn)}
            </span>
            <span className="metric-card-sub">Portfolio minus benchmark</span>
          </div>

          <div className="metric-card">
            <span className="metric-card-label">Allocation Effect</span>
            <span className={`metric-card-value ${colorClass(totalAllocation)}`}>
              {formatPercent(totalAllocation)}
            </span>
            <span className="metric-card-sub">Sector weight decisions</span>
          </div>

          <div className="metric-card">
            <span className="metric-card-label">Selection Effect</span>
            <span className={`metric-card-value ${colorClass(totalSelection)}`}>
              {formatPercent(totalSelection)}
            </span>
            <span className="metric-card-sub">Stock picking within sectors</span>
          </div>

          <div className="metric-card">
            <span className="metric-card-label">Interaction Effect</span>
            <span className={`metric-card-value ${colorClass(totalInteraction)}`}>
              {formatPercent(totalInteraction)}
            </span>
            <span className="metric-card-sub">Allocation × selection skill</span>
          </div>

          <div className="metric-card">
            <span className="metric-card-label">Diversification Ratio</span>
            <span className={`metric-card-value ${divRatio > 1 ? 'positive' : ''}`}>
              {formatDecimal(divRatio, 3)}
            </span>
            <span className="metric-card-sub">
              {divRatio > 1.1 ? 'Good diversification' :
               divRatio > 1.0 ? 'Mild diversification' :
               'Low diversification benefit'}
            </span>
          </div>

          <div className="metric-card">
            <span className="metric-card-label">Weighted Avg Vol</span>
            <span className="metric-card-value">
              {formatPercent(weightedAvgVol)}
            </span>
            <span className="metric-card-sub">
              Portfolio vol: {formatPercent(portVol)}
            </span>
          </div>

        </div>

        {/* ── Waterfall + Contribution ── */}
        <div className="two-col" style={{ marginBottom: '24px' }}>

          <div className="chart-container" style={{ marginBottom: 0 }}>
            <div className="chart-title">Active Return Decomposition</div>
            <div className="chart-subtitle">
              How each effect contributes to active return vs SPY
            </div>
            <Plot
              data={waterfallData}
              layout={waterfallLayout}
              config={{ displayModeBar: false, responsive: true }}
              style={{ width: '100%' }}
            />
          </div>

          <div className="chart-container" style={{ marginBottom: 0 }}>
            <div className="chart-title">Return Contribution by Holding</div>
            <div className="chart-subtitle">
              Weight × annualized return for each stock
            </div>
            <Plot
              data={contribData}
              layout={contribLayout}
              config={{ displayModeBar: false, responsive: true }}
              style={{ width: '100%' }}
            />
          </div>

        </div>

        {/* ── Sector Attribution Chart ── */}
        <div className="chart-container">
          <div className="chart-title">Attribution by Sector</div>
          <div className="chart-subtitle">
            Allocation, selection, and interaction effects broken down by sector
          </div>
          <Plot
            data={sectorBarData}
            layout={sectorBarLayout}
            config={{ displayModeBar: false, responsive: true }}
            style={{ width: '100%' }}
          />
        </div>

        {/* ── Holding Detail Table ── */}
        <div className="card" style={{ marginBottom: '24px' }}>
          <div className="card-title">Holding-Level Attribution</div>
          <table className="data-table">
            <thead>
              <tr>
                <th>Ticker</th>
                <th>Sector</th>
                <th>Weight</th>
                <th>Ann. Return</th>
                <th>Contribution</th>
                <th>Sector Benchmark</th>
                <th>Selection vs Sector</th>
              </tr>
            </thead>
            <tbody>
              {contributions.map((c, i) => {
                const sectorRet = SPY_SECTOR_RETURNS[c.sector]
                  ?? SPY_SECTOR_RETURNS.default;
                const selectionVsSector = c.annReturn - sectorRet;
                return (
                  <tr key={c.ticker}>
                    <td style={{
                      fontWeight: 600,
                      color: COLORS[tickers.indexOf(c.ticker) % COLORS.length],
                    }}>
                      {c.ticker}
                    </td>
                    <td style={{ textTransform: 'capitalize', color: '#9ca3af' }}>
                      {c.sector}
                    </td>
                    <td>{formatDecimal(c.weight * 100, 1)}%</td>
                    <td className={colorClass(c.annReturn)}>
                      {formatPercent(c.annReturn)}
                    </td>
                    <td className={colorClass(c.contribution)} style={{ fontWeight: 600 }}>
                      {formatPercent(c.contribution)}
                    </td>
                    <td>{formatPercent(sectorRet)}</td>
                    <td className={colorClass(selectionVsSector)}>
                      {formatPercent(selectionVsSector)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* ── Sector Attribution Table ── */}
        <div className="card" style={{ marginBottom: '24px' }}>
          <div className="card-title">Sector Attribution — BHB Model</div>
          <table className="data-table">
            <thead>
              <tr>
                <th>Sector</th>
                <th>Port. Weight</th>
                <th>Bench. Weight</th>
                <th>Port. Return</th>
                <th>Bench. Return</th>
                <th>Allocation</th>
                <th>Selection</th>
                <th>Interaction</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              {sectorAttribution.map(s => (
                <tr key={s.sector}>
                  <td style={{ fontWeight: 600, textTransform: 'capitalize' }}>
                    {s.sector}
                  </td>
                  <td>{formatDecimal(s.w_p * 100, 1)}%</td>
                  <td>{formatDecimal(s.w_b * 100, 1)}%</td>
                  <td className={colorClass(s.R_p)}>{formatPercent(s.R_p)}</td>
                  <td>{formatPercent(s.R_b)}</td>
                  <td className={colorClass(s.allocation)}>
                    {formatPercent(s.allocation)}
                  </td>
                  <td className={colorClass(s.selection)}>
                    {formatPercent(s.selection)}
                  </td>
                  <td className={colorClass(s.interaction)}>
                    {formatPercent(s.interaction)}
                  </td>
                  <td className={colorClass(s.total)} style={{ fontWeight: 600 }}>
                    {formatPercent(s.total)}
                  </td>
                </tr>
              ))}
              <tr style={{ fontWeight: 700, borderTop: '2px solid var(--border-light)' }}>
                <td colSpan={5}>Total</td>
                <td className={colorClass(totalAllocation)}>
                  {formatPercent(totalAllocation)}
                </td>
                <td className={colorClass(totalSelection)}>
                  {formatPercent(totalSelection)}
                </td>
                <td className={colorClass(totalInteraction)}>
                  {formatPercent(totalInteraction)}
                </td>
                <td className={colorClass(activeReturn)}>
                  {formatPercent(activeReturn)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* ══════════════════════════════════════════
            CONCEPTS
        ══════════════════════════════════════════ */}
        <div className="section" style={{ marginTop: '48px' }}>
          <div className="section-title">Understanding Portfolio Attribution</div>
          <div className="two-col" style={{ gap: '16px' }}>

            <div className="formula-box">
              <div className="formula-box-title">The BHB Model</div>
              <div className="formula-box-math">
                Active Return = Allocation + Selection + Interaction
              </div>
              <div className="formula-box-description">
                The Brinson-Hood-Beebower model (1986) is the industry standard
                for performance attribution. It decomposes the active return —
                the difference between portfolio and benchmark — into three
                mutually exclusive and exhaustive effects. Every basis point of
                active return can be explained by one of these three sources.
                The model requires grouping assets into sectors or categories
                and comparing portfolio weights and returns to benchmark weights
                and returns within each group.
              </div>
            </div>

            <div className="formula-box">
              <div className="formula-box-title">Allocation Effect</div>
              <div className="formula-box-math">
                Allocation_i = (w_p_i - w_b_i) × (R_b_i - R_b)
              </div>
              <div className="formula-box-description">
                The allocation effect measures the value added by overweighting
                or underweighting sectors relative to the benchmark. It is
                positive when you overweight a sector that outperformed the
                benchmark (R_b_i greater than R_b) or underweight a sector that
                underperformed. This is the pure asset allocation decision —
                independent of which stocks you chose within each sector.
                A skilled asset allocator generates positive allocation effect
                consistently.
              </div>
            </div>

            <div className="formula-box">
              <div className="formula-box-title">Selection Effect</div>
              <div className="formula-box-math">
                Selection_i = w_b_i × (R_p_i - R_b_i)
              </div>
              <div className="formula-box-description">
                The selection effect measures the value added by picking stocks
                within each sector that outperformed the sector benchmark. It
                uses the benchmark weight (not portfolio weight) to isolate the
                pure stock-picking contribution. A positive selection effect in
                tech means your tech stocks outperformed the tech sector average.
                This is the classic active management question: can you pick
                winners within a sector?
              </div>
            </div>

            <div className="formula-box">
              <div className="formula-box-title">Interaction Effect</div>
              <div className="formula-box-math">
                Interaction_i = (w_p_i - w_b_i) × (R_p_i - R_b_i)
              </div>
              <div className="formula-box-description">
                The interaction effect captures the joint impact of allocation
                and selection decisions. It is positive when you overweight a
                sector AND your stock picks within that sector outperformed.
                This is sometimes called the "skill multiplier" — it rewards
                the combination of correct sector tilts and correct stock
                selection within those sectors. A consistently positive
                interaction effect signals genuine investment skill.
              </div>
            </div>

            <div className="formula-box">
              <div className="formula-box-title">Contribution Analysis</div>
              <div className="formula-box-math">
                Contribution_i = w_i × R_i
              </div>
              <div className="formula-box-description">
                Simpler than BHB attribution, contribution analysis just shows
                how much each holding contributed to the total portfolio return.
                A stock with 40% weight and 20% return contributes 8% to the
                portfolio. This directly answers "which stocks made me money?"
                without decomposing why. High contribution stocks are the ones
                most responsible for your results — both good and bad. It is
                the starting point for any portfolio review.
              </div>
            </div>

            <div className="formula-box">
              <div className="formula-box-title">Diversification Ratio</div>
              <div className="formula-box-math">
                DR = weighted avg volatility / portfolio volatility
              </div>
              <div className="formula-box-description">
                The diversification ratio measures how much the portfolio
                benefits from diversification. A DR of 1.0 means no
                diversification benefit — the portfolio volatility equals
                the weighted average of individual volatilities (only possible
                if all assets are perfectly correlated). A DR of 1.5 means
                the portfolio is 33% less volatile than the weighted average
                of its components. Higher DR indicates more effective
                diversification and more efficient use of the risk budget.
              </div>
            </div>

          </div>
        </div>

      </div>
    </>
  );
};

export default PortfolioAttribution;