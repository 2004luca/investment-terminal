// ============================================================
// STRESS TESTING
// Historical crisis scenarios, worst periods analysis,
// portfolio vs SPY under market shocks
// ============================================================

import React, { useState, useMemo } from 'react';
import Plot from 'react-plotly.js';
import { usePortfolio } from '../utils/PortfolioContext';
import {
  annualizedVol,
} from '../utils/finance';
import {
  formatPercent,
  formatDecimal,
} from '../utils/formatters';

const COLORS = [
  '#2563eb', '#16a34a', '#dc2626', '#7c3aed',
  '#ea580c', '#0891b2', '#be185d', '#854d0e',
];

// ── Historical scenario definitions ──
// For scenarios within our 2Y data window we use actual returns
// For older scenarios we use documented historical drawdowns
const SCENARIOS = [
  {
    id: 'covid',
    name: 'COVID Crash',
    period: 'Feb 19 – Mar 23, 2020',
    description: 'Fastest 30% decline in S&P 500 history. Global pandemic panic.',
    spyReturn: -0.3384,
    // Per-sector approximate returns during crash
    sectorReturns: {
      tech:      -0.28,
      consumer:  -0.30,
      health:    -0.15,
      finance:   -0.40,
      energy:    -0.55,
      defensive: -0.20,
      default:   -0.30,
    },
    color: '#dc2626',
    inDataWindow: false,
  },
  {
    id: 'gfc',
    name: '2008 Financial Crisis',
    period: 'Oct 2007 – Mar 2009',
    description: 'Global financial system collapse. S&P 500 fell 57% peak to trough.',
    spyReturn: -0.5700,
    sectorReturns: {
      tech:      -0.52,
      consumer:  -0.48,
      health:    -0.35,
      finance:   -0.75,
      energy:    -0.55,
      defensive: -0.25,
      default:   -0.50,
    },
    color: '#7c3aed',
    inDataWindow: false,
  },
  {
    id: 'bear2022',
    name: '2022 Bear Market',
    period: 'Jan 3 – Oct 12, 2022',
    description: 'Fed rate hike regime. S&P 500 fell 25%. Worst bond market in history.',
    spyReturn: -0.2503,
    sectorReturns: {
      tech:      -0.38,
      consumer:  -0.28,
      health:    -0.10,
      finance:   -0.18,
      energy:    +0.35,
      defensive: -0.05,
      default:   -0.25,
    },
    color: '#ea580c',
    inDataWindow: true,
    startDate: '2022-01-03',
    endDate:   '2022-10-12',
  },
  {
    id: 'dotcom',
    name: 'Dot-com Bust',
    period: 'Mar 2000 – Oct 2002',
    description: 'Tech bubble collapse. NASDAQ fell 78%. S&P 500 fell 49%.',
    spyReturn: -0.4900,
    sectorReturns: {
      tech:      -0.75,
      consumer:  -0.35,
      health:    -0.20,
      finance:   -0.30,
      energy:    +0.05,
      defensive: +0.10,
      default:   -0.40,
    },
    color: '#0891b2',
    inDataWindow: false,
  },
  {
    id: 'q42018',
    name: '2018 Q4 Selloff',
    period: 'Oct 3 – Dec 24, 2018',
    description: 'Fed tightening fears. S&P 500 fell 20% in 3 months.',
    spyReturn: -0.1990,
    sectorReturns: {
      tech:      -0.25,
      consumer:  -0.20,
      health:    -0.15,
      finance:   -0.22,
      energy:    -0.35,
      defensive: -0.08,
      default:   -0.20,
    },
    color: '#be185d',
    inDataWindow: false,
  },
];

// ── Map ticker to sector for shock estimation ──
const getSector = (ticker) => {
  const techTickers     = ['AAPL','MSFT','GOOGL','GOOG','META','AMZN','NVDA','AMD','TSLA','INTC','CRM','ORCL','ADBE','NFLX','UBER','LYFT','SNAP','TWTR','SQ','PYPL'];
  const financeTickers  = ['JPM','BAC','WFC','GS','MS','C','BRK','V','MA','AXP','BLK','SCHW'];
  const healthTickers   = ['JNJ','PFE','UNH','ABBV','MRK','LLY','BMY','AMGN','GILD','CVS'];
  const energyTickers   = ['XOM','CVX','COP','SLB','EOG','PXD','MPC','VLO'];
  const defensiveTickers= ['KO','PEP','PG','JNJ','WMT','COST','MCD','CL','GIS','K','HSY','MO'];
  const consumerTickers = ['AMZN','HD','LOW','TGT','NKE','SBUX','MCD','YUM','DPZ'];

  const t = ticker.toUpperCase();
  if (defensiveTickers.includes(t)) return 'defensive';
  if (techTickers.includes(t))      return 'tech';
  if (financeTickers.includes(t))   return 'finance';
  if (healthTickers.includes(t))    return 'health';
  if (energyTickers.includes(t))    return 'energy';
  if (consumerTickers.includes(t))  return 'consumer';
  return 'default';
};

// ── Compute worst rolling period ──
const worstRolling = (returns, window) => {
  let worst = 0;
  for (let i = window; i <= returns.length; i++) {
    const slice = returns.slice(i - window, i);
    const cum = slice.reduce((acc, r) => acc * (1 + r), 1) - 1;
    if (cum < worst) { worst = cum; }
  }
  return worst;
};

const StressTesting = () => {
  const { portfolioData } = usePortfolio();
  const [activeScenario, setActiveScenario] = useState(null);

  const { tickers, weights, holdingStats, portReturns, chartDates } = portfolioData;

  // ── Compute scenario returns ──
  const scenarioResults = useMemo(() => {
    return SCENARIOS.map(scenario => {
      // Compute portfolio return for this scenario
      const portReturn = tickers.reduce((sum, t, i) => {
        const sector = getSector(t);
        const assetReturn = scenario.sectorReturns[sector] ?? scenario.sectorReturns.default;
        return sum + weights[i] * assetReturn;
      }, 0);

      const vsspy = portReturn - scenario.spyReturn;
      const relativePerf = vsspy > 0 ? 'outperformed' : 'underperformed';

      return {
        ...scenario,
        portReturn,
        vsspy,
        relativePerf,
      };
    });
  }, [tickers, weights]);

  // ── Early return after all hooks ──
  if (!portfolioData) {
    return (
      <>
        <div className="page-header">
          <h2>Stress Testing</h2>
          <p>Portfolio performance under historical crisis scenarios</p>
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

  // ── Worst periods from actual data ──
  const worstDay   = Math.min(...portReturns);
  const worstWeek  = worstRolling(portReturns, 5);
  const worstMonth = worstRolling(portReturns, 21);
  const worstDayIdx = portReturns.indexOf(worstDay);
  const worstDayDate = chartDates[worstDayIdx] ?? 'N/A';

  // ── Bar chart data ──
  const barChartData = [
    {
      x: scenarioResults.map(s => s.name),
      y: scenarioResults.map(s => s.portReturn * 100),
      type: 'bar',
      name: 'Portfolio',
      marker: {
        color: scenarioResults.map(s =>
          s.portReturn > s.spyReturn
            ? 'rgba(22, 163, 74, 0.7)'
            : 'rgba(220, 38, 38, 0.7)'
        ),
      },
      hovertemplate: '%{x}<br>Portfolio: %{y:.2f}%<extra></extra>',
    },
    {
      x: scenarioResults.map(s => s.name),
      y: scenarioResults.map(s => s.spyReturn * 100),
      type: 'bar',
      name: 'SPY',
      marker: { color: 'rgba(156, 163, 175, 0.7)' },
      hovertemplate: '%{x}<br>SPY: %{y:.2f}%<extra></extra>',
    },
  ];

  const barLayout = {
    autosize: true,
    height: 340,
    margin: { t: 10, r: 20, b: 80, l: 60 },
    paper_bgcolor: 'transparent',
    plot_bgcolor: 'transparent',
    barmode: 'group',
    xaxis: {
      showgrid: false,
      tickfont: { size: 11, color: '#4a5568' },
      tickangle: -15,
    },
    yaxis: {
      showgrid: true,
      gridcolor: '#f0f2f5',
      tickfont: { size: 11, color: '#9ca3af' },
      ticksuffix: '%',
      zeroline: true,
      zerolinecolor: '#e5e7eb',
    },
    legend: { orientation: 'h', y: -0.25, font: { size: 11 } },
    hovermode: 'x unified',
  };

  // ── Per-holding scenario impact ──
  const selectedScenario = activeScenario
    ? scenarioResults.find(s => s.id === activeScenario)
    : null;

  return (
    <>
      <div className="page-header">
        <h2>Stress Testing</h2>
        <p>
          Portfolio performance under historical crisis scenarios —
          2008, COVID, 2022 bear market, dot-com bust, and more
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

        {/* ── Worst Periods from Actual Data ── */}
        <div className="section">
          <div className="section-title">Worst Periods — Actual 2Y Data</div>
          <div className="metric-grid" style={{ marginBottom: '24px' }}>
            <div className="metric-card">
              <span className="metric-card-label">Worst Single Day</span>
              <span className="metric-card-value negative">
                {formatPercent(worstDay)}
              </span>
              <span className="metric-card-sub">{worstDayDate}</span>
            </div>
            <div className="metric-card">
              <span className="metric-card-label">Worst Week (5d)</span>
              <span className="metric-card-value negative">
                {formatPercent(worstWeek)}
              </span>
              <span className="metric-card-sub">Worst 5-day rolling return</span>
            </div>
            <div className="metric-card">
              <span className="metric-card-label">Worst Month (21d)</span>
              <span className="metric-card-value negative">
                {formatPercent(worstMonth)}
              </span>
              <span className="metric-card-sub">Worst 21-day rolling return</span>
            </div>
            <div className="metric-card">
              <span className="metric-card-label">Ann. Volatility</span>
              <span className="metric-card-value">
                {formatPercent(annualizedVol(portReturns))}
              </span>
              <span className="metric-card-sub">Over 2Y period</span>
            </div>
          </div>
        </div>

        {/* ── Scenario Cards ── */}
        <div className="section">
          <div className="section-title">Historical Crisis Scenarios</div>
          <p style={{ fontSize: '13px', color: '#9ca3af', marginBottom: '16px' }}>
            Returns for scenarios outside the 2Y data window are estimated using
            documented historical sector drawdowns. Click a scenario for holding-level detail.
          </p>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: '16px',
            marginBottom: '24px',
          }}>
            {scenarioResults.map(scenario => (
              <div
                key={scenario.id}
                className="card"
                onClick={() => setActiveScenario(
                  activeScenario === scenario.id ? null : scenario.id
                )}
                style={{
                  cursor: 'pointer',
                  borderLeft: `4px solid ${scenario.color}`,
                  transition: 'box-shadow 0.15s ease',
                  boxShadow: activeScenario === scenario.id
                    ? '0 4px 16px rgba(0,0,0,0.12)'
                    : 'var(--shadow-sm)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '14px', color: '#0f1117' }}>
                      {scenario.name}
                    </div>
                    <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '2px' }}>
                      {scenario.period}
                    </div>
                  </div>
                  <div style={{
                    fontSize: '11px',
                    color: scenario.vsspy > 0 ? '#16a34a' : '#dc2626',
                    fontWeight: 600,
                    textAlign: 'right',
                  }}>
                    {scenario.vsspy > 0 ? 'Outperformed' : 'Underperformed'}
                    <br />SPY by {formatPercent(Math.abs(scenario.vsspy))}
                  </div>
                </div>

                <p style={{ fontSize: '12px', color: '#4a5568', marginBottom: '12px', lineHeight: '1.5' }}>
                  {scenario.description}
                </p>

                <div style={{ display: 'flex', gap: '16px' }}>
                  <div>
                    <div style={{ fontSize: '11px', color: '#9ca3af', marginBottom: '2px' }}>
                      PORTFOLIO
                    </div>
                    <div style={{
                      fontSize: '20px',
                      fontWeight: 700,
                      color: scenario.portReturn >= 0 ? '#16a34a' : '#dc2626',
                    }}>
                      {formatPercent(scenario.portReturn)}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: '11px', color: '#9ca3af', marginBottom: '2px' }}>
                      SPY
                    </div>
                    <div style={{
                      fontSize: '20px',
                      fontWeight: 700,
                      color: '#9ca3af',
                    }}>
                      {formatPercent(scenario.spyReturn)}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Holding detail for selected scenario ── */}
        {selectedScenario && (
          <div className="card" style={{ marginBottom: '24px' }}>
            <div className="card-title">
              {selectedScenario.name} — Holding-Level Impact
            </div>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Ticker</th>
                  <th>Sector</th>
                  <th>Weight</th>
                  <th>Estimated Return</th>
                  <th>Contribution to Portfolio</th>
                </tr>
              </thead>
              <tbody>
                {tickers.map((t, i) => {
                  const sector = getSector(t);
                  const assetReturn = selectedScenario.sectorReturns[sector]
                    ?? selectedScenario.sectorReturns.default;
                  const contribution = weights[i] * assetReturn;
                  return (
                    <tr key={t}>
                      <td style={{ fontWeight: 600, color: COLORS[i % COLORS.length] }}>
                        {t}
                      </td>
                      <td style={{ textTransform: 'capitalize', color: '#9ca3af' }}>
                        {sector}
                      </td>
                      <td>{formatDecimal(weights[i] * 100, 1)}%</td>
                      <td className={assetReturn >= 0 ? 'text-green' : 'text-red'}>
                        {formatPercent(assetReturn)}
                      </td>
                      <td className={contribution >= 0 ? 'text-green' : 'text-red'}>
                        {formatPercent(contribution)}
                      </td>
                    </tr>
                  );
                })}
                <tr style={{ fontWeight: 700, borderTop: '2px solid var(--border-light)' }}>
                  <td colSpan={4}>Total Portfolio Return</td>
                  <td className={selectedScenario.portReturn >= 0 ? 'text-green' : 'text-red'}>
                    {formatPercent(selectedScenario.portReturn)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        )}

        {/* ── Bar Chart ── */}
        <div className="chart-container">
          <div className="chart-title">
            Portfolio vs SPY — All Scenarios
          </div>
          <div className="chart-subtitle">
            Green = portfolio outperformed SPY in this scenario.
            Red = portfolio underperformed SPY.
          </div>
          <Plot
            data={barChartData}
            layout={barLayout}
            config={{ displayModeBar: false, responsive: true }}
            style={{ width: '100%' }}
          />
        </div>

        {/* ── Sensitivity Analysis ── */}
        <div className="section">
          <div className="section-title">Scenario Sensitivity — Shock Multipliers</div>
          <p style={{ fontSize: '13px', color: '#4a5568', marginBottom: '16px' }}>
            How does your portfolio perform if each crisis was more or less severe?
            We apply multipliers to the base scenario return.
          </p>
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Scenario</th>
                  <th>50% Severity</th>
                  <th>75% Severity</th>
                  <th>Base (100%)</th>
                  <th>125% Severity</th>
                  <th>150% Severity</th>
                </tr>
              </thead>
              <tbody>
                {scenarioResults.map(s => (
                  <tr key={s.id}>
                    <td style={{ fontWeight: 600 }}>{s.name}</td>
                    {[0.5, 0.75, 1.0, 1.25, 1.5].map(mult => {
                      const val = s.portReturn * mult;
                      return (
                        <td key={mult}
                          className={val >= 0 ? 'text-green' : 'text-red'}
                          style={{ fontWeight: mult === 1.0 ? 700 : 400 }}
                        >
                          {formatPercent(val)}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* ══════════════════════════════════════════
            CONCEPTS
        ══════════════════════════════════════════ */}
        <div className="section" style={{ marginTop: '48px' }}>
          <div className="section-title">Understanding Stress Testing</div>
          <div className="two-col" style={{ gap: '16px' }}>

            <div className="formula-box">
              <div className="formula-box-title">What is Stress Testing?</div>
              <div className="formula-box-math">
                Portfolio loss = sum(w_i × R_i_scenario)
              </div>
              <div className="formula-box-description">
                Stress testing evaluates portfolio performance under extreme but
                plausible market conditions. Unlike VaR which uses statistical
                distributions, stress testing uses actual historical events.
                Regulators require banks to stress test portfolios against
                standardized scenarios (Basel III, CCAR). For individual investors,
                stress testing reveals which scenarios are most dangerous for
                their specific holdings and whether the portfolio has hidden
                concentrations that only emerge under stress.
              </div>
            </div>

            <div className="formula-box">
              <div className="formula-box-title">Historical Simulation</div>
              <div className="formula-box-math">
                R_portfolio = sum(w_i × R_i_historical_period)
              </div>
              <div className="formula-box-description">
                For scenarios within our 2-year data window, we use actual price
                data. For older scenarios (2008, dot-com), we use documented
                sector-level drawdowns from financial research. This is an
                approximation — the actual performance would depend on the
                specific stocks held. The methodology correctly captures the
                key insight: how does your asset allocation perform under
                different market regimes?
              </div>
            </div>

            <div className="formula-box">
              <div className="formula-box-title">Sector-Based Shock Estimation</div>
              <div className="formula-box-math">
                R_stock ≈ R_sector during crisis
              </div>
              <div className="formula-box-description">
                During market crises, individual stock returns are heavily driven
                by their sector. In the 2008 financial crisis, financials fell
                75% while consumer staples fell only 25%. In 2022, energy stocks
                actually rose 35% while tech fell 38%. By mapping each holding
                to its sector, we can estimate how the portfolio would have
                performed even in periods before the stock existed or before our
                data window. This is standard practice in scenario analysis.
              </div>
            </div>

            <div className="formula-box">
              <div className="formula-box-title">Relative Performance vs SPY</div>
              <div className="formula-box-math">
                Active return = R_portfolio - R_SPY
              </div>
              <div className="formula-box-description">
                The key question during a crisis is not just how much you lost,
                but whether you lost more or less than the market. A portfolio
                that falls 20% when SPY falls 30% has actually protected capital
                well in relative terms. Outperforming SPY during a crash is the
                primary goal of defensive portfolio construction. Portfolios with
                defensive tilts (utilities, consumer staples, gold) and low-beta
                stocks tend to outperform during crises but lag in bull markets.
              </div>
            </div>

            <div className="formula-box">
              <div className="formula-box-title">Worst Rolling Periods</div>
              <div className="formula-box-math">
                Worst window = min(prod(1+r_t) - 1) over all windows
              </div>
              <div className="formula-box-description">
                The worst rolling period analysis scans all possible windows of
                a given length (5 days for weekly, 21 days for monthly) and finds
                the worst cumulative return. This is more informative than just
                looking at single days — multi-day drawdowns capture extended
                periods of stress that are more likely to trigger behavioral
                mistakes like panic selling. An investor who can withstand the
                worst month in their actual data is better prepared psychologically.
              </div>
            </div>

            <div className="formula-box">
              <div className="formula-box-title">Sensitivity Analysis</div>
              <div className="formula-box-math">
                Stressed return = base scenario × severity multiplier
              </div>
              <div className="formula-box-description">
                The sensitivity table shows how portfolio performance changes if
                each crisis were more or less severe. A 50% severity scenario
                represents a milder version of the crisis. A 150% severity
                scenario asks: what if the 2008 crisis had been 50% worse?
                This reveals non-linearities — some portfolios hold up well
                in mild stress but deteriorate catastrophically under extreme
                scenarios. Understanding this convexity is essential for
                tail risk management.
              </div>
            </div>

          </div>
        </div>

      </div>
    </>
  );
};

export default StressTesting;