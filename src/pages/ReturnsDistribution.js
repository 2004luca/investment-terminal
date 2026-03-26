// ============================================================
// RETURNS & DISTRIBUTION
// Daily returns histogram, normal overlay, QQ plot,
// skewness, kurtosis, VaR, and full educational explanations
// ============================================================

import React, { useState } from 'react';
import Plot from 'react-plotly.js';
import { fetchHistorical } from '../utils/api';
import {
  simpleReturns,
  mean,
  stdDev,
  skewness,
  excessKurtosis,
  annualizedReturn,
  annualizedVol,
  historicalVaR,
  normalPDF,
} from '../utils/finance';
import {
  formatPercent,
  formatDecimal,
  formatPercentDirect,
  colorClass,
} from '../utils/formatters';

// ── Range options ──
const RANGES = [
  { label: '1Y', outputsize: 252  },
  { label: '2Y', outputsize: 504  },
  { label: '3Y', outputsize: 756  },
  { label: '5Y', outputsize: 1260 },
];

// ── Normal distribution PDF for overlay ──
const generateNormalCurve = (mu, sigma, minX, maxX, points = 200) => {
  const step = (maxX - minX) / points;
  const x = [];
  const y = [];
  for (let i = 0; i <= points; i++) {
    const xi = minX + i * step;
    x.push(xi);
    y.push(normalPDF(xi, mu, sigma));
  }
  return { x, y };
};

// ── QQ Plot data ──
const generateQQData = (returns) => {
  const sorted = [...returns].sort((a, b) => a - b);
  const n = sorted.length;
  const mu = mean(returns);
  const sigma = stdDev(returns);

  const theoretical = sorted.map((_, i) => {
    const p = (i + 0.5) / n;
    // Inverse normal approximation (Beasley-Springer-Moro)
    const t = Math.sqrt(-2 * Math.log(Math.min(p, 1 - p)));
    const c = [2.515517, 0.802853, 0.010328];
    const d = [1.432788, 0.189269, 0.001308];
    let z = t - (c[0] + c[1] * t + c[2] * t * t) /
      (1 + d[0] * t + d[1] * t * t + d[2] * t * t * t);
    if (p > 0.5) z = -z;
    return mu + sigma * z;
  });

  return { theoretical, actual: sorted };
};

const ReturnsDistribution = () => {
  const [ticker, setTicker]     = useState('');
  const [returns, setReturns]   = useState([]);
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

    try {
      const range = RANGES.find(r => r.label === activeRange);
      const history = await fetchHistorical(ticker.trim(), range.outputsize);
      const prices = history.map(d => d.close);
      const rets   = simpleReturns(prices);
      const ds     = history.slice(1).map(d => d.date);
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
  const mu        = returns.length ? mean(returns)             : 0;
  const sigma     = returns.length ? stdDev(returns)           : 0;
  const annRet    = returns.length ? annualizedReturn(returns) : 0;
  const annVol    = returns.length ? annualizedVol(returns)    : 0;
  const skew      = returns.length ? skewness(returns)         : 0;
  const kurt      = returns.length ? excessKurtosis(returns)   : 0;
  const var95     = returns.length ? historicalVaR(returns, 0.95) : 0;
  const var99     = returns.length ? historicalVaR(returns, 0.99) : 0;

  // ── Histogram + normal overlay ──
  const minR = returns.length ? Math.min(...returns) : -0.1;
  const maxR = returns.length ? Math.max(...returns) :  0.1;
  const normalCurve = returns.length
    ? generateNormalCurve(mu, sigma, minR, maxR)
    : { x: [], y: [] };

  // Scale normal PDF to match histogram counts
  const binCount  = 50;
  const binWidth  = (maxR - minR) / binCount;
  const scaleFactor = returns.length * binWidth;
  const scaledNormalY = normalCurve.y.map(y => y * scaleFactor);

  const histogramData = returns.length ? [
    {
      x: returns,
      type: 'histogram',
      nbinsx: binCount,
      name: 'Daily Returns',
      marker: {
        color: 'rgba(37, 99, 235, 0.6)',
        line: { color: 'rgba(37, 99, 235, 0.8)', width: 0.5 },
      },
      hovertemplate: 'Return: %{x:.3f}<br>Count: %{y}<extra></extra>',
    },
    {
      x: normalCurve.x,
      y: scaledNormalY,
      type: 'scatter',
      mode: 'lines',
      name: 'Normal Distribution',
      line: { color: '#dc2626', width: 2, dash: 'dash' },
      hovertemplate: 'Normal: %{y:.1f}<extra></extra>',
    },
    // VaR 95% line
    {
      x: [var95, var95],
      y: [0, returns.length * 0.15],
      type: 'scatter',
      mode: 'lines',
      name: 'VaR 95%',
      line: { color: '#ea580c', width: 2, dash: 'dot' },
      hovertemplate: 'VaR 95%: %{x:.3f}<extra></extra>',
    },
    // VaR 99% line
    {
      x: [var99, var99],
      y: [0, returns.length * 0.15],
      type: 'scatter',
      mode: 'lines',
      name: 'VaR 99%',
      line: { color: '#dc2626', width: 2, dash: 'dot' },
      hovertemplate: 'VaR 99%: %{x:.3f}<extra></extra>',
    },
  ] : [];

  const histLayout = {
    autosize: true,
    height: 380,
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
      title: { text: 'Frequency', font: { size: 12, color: '#9ca3af' } },
      showgrid: true,
      gridcolor: '#f0f2f5',
      tickfont: { size: 11, color: '#9ca3af' },
    },
    legend: {
      orientation: 'h',
      y: -0.15,
      font: { size: 11 },
    },
    hovermode: 'x unified',
    bargap: 0.05,
  };

  // ── QQ Plot ──
  const qqData = returns.length ? generateQQData(returns) : null;

  const qqChartData = qqData ? [
    {
      x: qqData.theoretical,
      y: qqData.actual,
      type: 'scatter',
      mode: 'markers',
      name: 'Quantiles',
      marker: { color: '#2563eb', size: 4, opacity: 0.7 },
      hovertemplate: 'Theoretical: %{x:.4f}<br>Actual: %{y:.4f}<extra></extra>',
    },
    // Perfect normal reference line — uses theoretical quantile range
    {
      x: qqData ? [Math.min(...qqData.theoretical), Math.max(...qqData.theoretical)] : [minR, maxR],
      y: qqData ? [Math.min(...qqData.theoretical), Math.max(...qqData.theoretical)] : [minR, maxR],
      type: 'scatter',
      mode: 'lines',
      name: 'Perfect Normal',
      line: { color: '#dc2626', width: 2, dash: 'dash' },
    },
  ] : [];

  const qqLayout = {
    autosize: true,
    height: 380,
    margin: { t: 10, r: 20, b: 50, l: 60 },
    paper_bgcolor: 'transparent',
    plot_bgcolor: 'transparent',
    xaxis: {
      title: { text: 'Theoretical Quantiles', font: { size: 12, color: '#9ca3af' } },
      showgrid: true,
      gridcolor: '#f0f2f5',
      tickfont: { size: 11, color: '#9ca3af' },
      tickformat: '.3f',
    },
    yaxis: {
      title: { text: 'Sample Quantiles', font: { size: 12, color: '#9ca3af' } },
      showgrid: true,
      gridcolor: '#f0f2f5',
      tickfont: { size: 11, color: '#9ca3af' },
      tickformat: '.3f',
    },
    legend: {
      orientation: 'h',
      y: -0.15,
      font: { size: 11 },
    },
    hovermode: 'closest',
  };

  return (
    <>
      <div className="page-header">
        <h2>Returns & Distribution</h2>
        <p>
          Analyze the statistical properties of daily returns — histogram,
          normal overlay, QQ plot, skewness, kurtosis, and Value at Risk
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
            <span style={{ fontSize: '14px' }}>Enter a ticker to analyze its return distribution</span>
            <span style={{ fontSize: '12px' }}>Try AAPL, MSFT, GOOGL, TSLA, SPY, BTC-USD</span>
          </div>
        )}

        {returns.length > 0 && (
          <>
            {/* ── Metric Cards ── */}
            <div className="metric-grid" style={{ marginBottom: '24px' }}>

              <div className="metric-card">
                <span className="metric-card-label">Ann. Return</span>
                <span className={`metric-card-value ${colorClass(annRet)}`}>
                  {formatPercent(annRet)}
                </span>
                <span className="metric-card-sub">
                  Daily avg: {formatPercent(mu)}
                </span>
              </div>

              <div className="metric-card">
                <span className="metric-card-label">Ann. Volatility</span>
                <span className="metric-card-value">
                  {formatPercent(annVol)}
                </span>
                <span className="metric-card-sub">
                  Daily std: {formatPercent(sigma)}
                </span>
              </div>

              <div className="metric-card">
                <span className="metric-card-label">Skewness</span>
                <span className={`metric-card-value ${skew < 0 ? 'negative' : 'positive'}`}>
                  {formatDecimal(skew, 3)}
                </span>
                <span className="metric-card-sub">
                  {skew < -0.5 ? 'Significant left tail' :
                   skew > 0.5  ? 'Significant right tail' :
                   'Near symmetric'}
                </span>
              </div>

              <div className="metric-card">
                <span className="metric-card-label">Excess Kurtosis</span>
                <span className={`metric-card-value ${kurt > 0 ? 'negative' : 'positive'}`}>
                  {formatDecimal(kurt, 3)}
                </span>
                <span className="metric-card-sub">
                  {kurt > 1 ? 'Fat tails — crash risk' :
                   kurt < -1 ? 'Thin tails' :
                   'Near normal tails'}
                </span>
              </div>

              <div className="metric-card">
                <span className="metric-card-label">VaR 95%</span>
                <span className="metric-card-value negative">
                  {formatPercent(var95)}
                </span>
                <span className="metric-card-sub">Worst day in 20</span>
              </div>

              <div className="metric-card">
                <span className="metric-card-label">VaR 99%</span>
                <span className="metric-card-value negative">
                  {formatPercent(var99)}
                </span>
                <span className="metric-card-sub">Worst day in 100</span>
              </div>

              <div className="metric-card">
                <span className="metric-card-label">Observations</span>
                <span className="metric-card-value">
                  {returns.length}
                </span>
                <span className="metric-card-sub">Trading days analyzed</span>
              </div>

              <div className="metric-card">
                <span className="metric-card-label">Best Day</span>
                <span className="metric-card-value positive">
                  {formatPercent(Math.max(...returns))}
                </span>
                <span className="metric-card-sub">
                  Worst: {formatPercent(Math.min(...returns))}
                </span>
              </div>

            </div>

            {/* ── Charts ── */}
            <div className="two-col" style={{ marginBottom: '24px' }}>

              <div className="chart-container" style={{ marginBottom: 0 }}>
                <div className="chart-title">
                  Returns Distribution — {stockName} ({activeRange})
                </div>
                <div className="chart-subtitle">
                  Histogram of daily returns with normal distribution overlay
                </div>
                <Plot
                  data={histogramData}
                  layout={histLayout}
                  config={{ displayModeBar: false, responsive: true }}
                  style={{ width: '100%' }}
                />
              </div>

              <div className="chart-container" style={{ marginBottom: 0 }}>
                <div className="chart-title">
                  QQ Plot — {stockName} vs Normal Distribution
                </div>
                <div className="chart-subtitle">
                  Points on the red line = perfectly normal. Curves away = fat tails.
                </div>
                <Plot
                  data={qqChartData}
                  layout={qqLayout}
                  config={{ displayModeBar: false, responsive: true }}
                  style={{ width: '100%' }}
                />
              </div>

            </div>
          </>
        )}

        {/* ══════════════════════════════════════════
            CONCEPTS — Always visible
        ══════════════════════════════════════════ */}
        <div className="section" style={{ marginTop: '48px' }}>
          <div className="section-title">Understanding Return Distributions</div>

          <div className="two-col" style={{ gap: '16px' }}>

            <div className="formula-box">
              <div className="formula-box-title">Daily Simple Returns</div>
              <div className="formula-box-math">r_t = (P_t - P_(t-1)) / P_(t-1)</div>
              <div className="formula-box-description">
                The percentage change in price from one day to the next. Simple returns
                are used here because they are intuitive and directly interpretable as
                percentage gains or losses. Log returns (ln(P_t / P_(t-1))) are preferred
                in some academic contexts because they are time-additive and symmetric,
                but simple returns are more natural for distribution analysis and risk
                interpretation.
              </div>
            </div>

            <div className="formula-box">
              <div className="formula-box-title">The Normal Distribution Assumption</div>
              <div className="formula-box-math">r ~ N(μ, σ²)</div>
              <div className="formula-box-description">
                Modern Portfolio Theory (Markowitz, 1952) and the Black-Scholes model
                assume stock returns follow a normal distribution. This assumption is
                mathematically convenient — it means risk is fully described by just
                two numbers: mean and variance. The red dashed curve on the histogram
                shows what the distribution would look like if this assumption were
                true. In practice, real returns almost always deviate significantly
                from normality.
              </div>
            </div>

            <div className="formula-box">
              <div className="formula-box-title">Skewness</div>
              <div className="formula-box-math">
                Skewness = E[(r - μ)³] / σ³
              </div>
              <div className="formula-box-description">
                Measures the asymmetry of the return distribution. A normal distribution
                has skewness = 0. Negative skewness means the left tail is longer —
                the stock experiences more extreme negative days than positive ones.
                Most individual stocks and indices exhibit negative skewness: they grind
                up slowly in bull markets and crash suddenly. This is sometimes called
                "picking up pennies in front of a steamroller."
              </div>
            </div>

            <div className="formula-box">
              <div className="formula-box-title">Excess Kurtosis</div>
              <div className="formula-box-math">
                Excess Kurtosis = E[(r - μ)⁴] / σ⁴ - 3
              </div>
              <div className="formula-box-description">
                Measures tail fatness relative to a normal distribution (which has
                kurtosis = 3, so excess kurtosis = 0). Positive excess kurtosis means
                fatter tails — extreme events happen more often than normality predicts.
                This is called leptokurtosis or "fat tails." It explains why events
                that should occur once in a billion years under normality (like the
                2008 crash) actually occur every decade. Risk models that assume
                normality systematically underestimate tail risk.
              </div>
            </div>

            <div className="formula-box">
              <div className="formula-box-title">QQ Plot — Quantile-Quantile</div>
              <div className="formula-box-math">
                Plot: actual quantiles vs theoretical normal quantiles
              </div>
              <div className="formula-box-description">
                The QQ plot is a visual normality test. If returns were perfectly
                normally distributed, all points would lie exactly on the red diagonal
                line. Deviations from the line reveal non-normality. The classic
                pattern for financial returns is an S-curve: points curve above the
                line at the left tail (more extreme losses than normal predicts) and
                below the line at the right tail (more extreme gains too). This S-shape
                is the visual signature of fat tails and negative skewness.
              </div>
            </div>

            <div className="formula-box">
              <div className="formula-box-title">Value at Risk (VaR)</div>
              <div className="formula-box-math">
                VaR(95%) = 5th percentile of daily returns
              </div>
              <div className="formula-box-description">
                VaR answers: "What is the worst loss I should expect on a typical
                bad day?" A 95% VaR of -2% means that on 95% of trading days, losses
                will be less than 2%. On 5% of days — roughly 1 day per month —
                losses will exceed 2%. VaR does not tell you how bad the bad days are,
                only how often they occur. For that, we use CVaR (Expected Shortfall),
                which we cover in the Risk & Return page. Historical VaR makes no
                distributional assumptions — it simply reads the percentile from
                actual past data.
              </div>
            </div>

            <div className="formula-box">
              <div className="formula-box-title">Annualized Return & Volatility</div>
              <div className="formula-box-math">
                Ann. Return = μ_daily × 252{'\n'}
                Ann. Volatility = σ_daily × √252
              </div>
              <div className="formula-box-description">
                We scale daily statistics to annual by multiplying by 252 — the number
                of trading days in a year. Return scales linearly (multiply by 252).
                Volatility scales by the square root of time (multiply by √252 ≈ 15.87)
                because under the random walk assumption, variance grows linearly with
                time, so standard deviation grows with the square root. This square
                root of time rule is one of the most important results in quantitative
                finance.
              </div>
            </div>

            <div className="formula-box">
              <div className="formula-box-title">Why This Matters for Risk Management</div>
              <div className="formula-box-math">
                Real returns: fat tails + negative skew ≠ Normal
              </div>
              <div className="formula-box-description">
                The combination of negative skewness and positive excess kurtosis —
                which is present in virtually all financial assets — means that
                standard risk models (which assume normality) consistently
                underestimate both the frequency and severity of extreme losses.
                This gap between assumed and actual distributions contributed to
                the failure of many risk models in 2008. More robust approaches
                use Student's t-distribution, historical simulation, or extreme
                value theory to better capture tail risk.
              </div>
            </div>

          </div>
        </div>

      </div>
    </>
  );
};

export default ReturnsDistribution;