// ============================================================
// AUTOCORRELATION
// ACF, PACF, Ljung-Box test, squared returns ACF,
// random walk hypothesis, momentum vs mean reversion
// ============================================================

import React, { useState } from 'react';
import { useQuant } from '../utils/QuantContext';
import Plot from 'react-plotly.js';
import { fetchHistorical } from '../utils/api';
import {
  simpleReturns,
  autocorrelation,
} from '../utils/finance';
import {
  formatDecimal,
} from '../utils/formatters';

const RANGES = [
  { label: '1Y', outputsize: 252  },
  { label: '2Y', outputsize: 504  },
  { label: '3Y', outputsize: 756  },
  { label: '5Y', outputsize: 1260 },
];

const MAX_LAG = 30;

// ── PACF via Yule-Walker equations ──
const pacf = (returns, maxLag) => {
  const acfVals = autocorrelation(returns, maxLag).map(d => d.acf);
  const result = [1]; // PACF(0) = 1

  for (let k = 1; k <= maxLag; k++) {
    // Build Toeplitz matrix of ACF values
    const matrix = [];
    for (let i = 0; i < k; i++) {
      const row = [];
      for (let j = 0; j < k; j++) {
        const idx = Math.abs(i - j);
        row.push(idx === 0 ? 1 : acfVals[idx - 1]);
      }
      matrix.push(row);
    }
    // Solve using Levinson-Durbin approximation
    // For simplicity we use the last coefficient of the solution
    try {
      const phi = levinsonDurbin(acfVals, k);
      result.push(phi[k - 1]);
    } catch {
      result.push(0);
    }
  }
  return result.slice(1); // remove lag 0
};

// ── Levinson-Durbin recursion ──
const levinsonDurbin = (acf, order) => {
  const phi = new Array(order).fill(0);
  let phiPrev = [];
  let err = 1;

  for (let k = 1; k <= order; k++) {
    let lambda = acf[k - 1];
    for (let j = 1; j < k; j++) {
      lambda -= phiPrev[j - 1] * acf[k - j - 1] ?? 0;
    }
    const phiKK = lambda / err;
    const phiNew = new Array(k).fill(0);
    phiNew[k - 1] = phiKK;
    for (let j = 1; j < k; j++) {
      phiNew[j - 1] = (phiPrev[j - 1] ?? 0) - phiKK * (phiPrev[k - j - 1] ?? 0);
    }
    err *= (1 - phiKK * phiKK);
    phiPrev = phiNew;
    phi[k - 1] = phiKK;
  }
  return phi;
};

// ── Ljung-Box Q statistic ──
const ljungBox = (returns, maxLag) => {
  const n = returns.length;
  const acfVals = autocorrelation(returns, maxLag).map(d => d.acf);
  let Q = 0;
  for (let k = 1; k <= maxLag; k++) {
    Q += (acfVals[k - 1] ** 2) / (n - k);
  }
  Q *= n * (n + 2);

  // Chi-squared p-value approximation
  const pValue = chiSquaredPValue(Q, maxLag);
  return { Q, pValue };
};

// ── Chi-squared p-value (Wilson-Hilferty approximation) ──
const chiSquaredPValue = (x, df) => {
  if (x <= 0) return 1;
  const z = Math.pow(x / df, 1 / 3);
  const mu = 1 - 2 / (9 * df);
  const sigma = Math.sqrt(2 / (9 * df));
  const zScore = (z - mu) / sigma;
  return 1 - normalCDF(zScore);
};

const normalCDF = (x) => {
  const t = 1 / (1 + 0.2316419 * Math.abs(x));
  const d = 0.3989423 * Math.exp(-x * x / 2);
  const p = d * t * (0.3193815 + t * (-0.3565638 +
    t * (1.7814779 + t * (-1.8212560 + t * 1.3302744))));
  return x > 0 ? 1 - p : p;
};

const Autocorrelation = () => {
  const {
    quantTicker, setQuantTicker,
    quantReturns, setQuantReturns,
    setQuantHistory,
    setQuantDates,
  } = useQuant();
  const [ticker, setTicker]     = useState(quantTicker);
  const [returns, setReturns]   = useState(quantReturns);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState(null);
  const [activeRange, setRange] = useState('2Y');
  const [stockName, setName]    = useState(quantTicker);

  const handleSearch = async () => {
    if (!ticker.trim()) return;
    setLoading(true);
    setError(null);
    setReturns([]);

    try {
      const range   = RANGES.find(r => r.label === activeRange);
      const history = await fetchHistorical(ticker.trim(), range.outputsize);
      const prices  = history.map(d => d.close);
      const rets    = simpleReturns(prices);
      setReturns(rets);
      setName(ticker.trim().toUpperCase());
      // Save to context
      setQuantTicker(ticker.trim().toUpperCase());
      setQuantHistory(history);
      setQuantReturns(rets);
      setQuantDates([]);
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
  const n = returns.length;
  const sigBand = n ? 1.96 / Math.sqrt(n) : 0;

  const acfData  = returns.length ? autocorrelation(returns, MAX_LAG) : [];
  const pacfData = returns.length ? pacf(returns, MAX_LAG) : [];

  // Squared returns ACF (volatility clustering)
  const squaredReturns = returns.map(r => r * r);
  const acfSquared = returns.length
    ? autocorrelation(squaredReturns, MAX_LAG)
    : [];

  // Ljung-Box tests
  const lb10 = returns.length ? ljungBox(returns, 10) : null;
  const lb20 = returns.length ? ljungBox(returns, 20) : null;

  // ACF at specific lags
  const acf1  = acfData[0]?.acf  ?? 0;
  const acf5  = acfData[4]?.acf  ?? 0;
  const acf10 = acfData[9]?.acf  ?? 0;

  // Interpretation
  const getInterpretation = () => {
    if (!lb10) return '';
    if (lb10.pValue < 0.05) {
      const positiveACF = acfData.slice(0, 5).filter(d => d.acf > sigBand).length;
      const negativeACF = acfData.slice(0, 5).filter(d => d.acf < -sigBand).length;
      if (positiveACF > negativeACF) return 'Momentum detected';
      if (negativeACF > positiveACF) return 'Mean reversion detected';
      return 'Mixed autocorrelation';
    }
    return 'Consistent with random walk';
  };

  // ── ACF Chart ──
  const acfChartData = acfData.length ? [
    // Significance bands
    {
      x: [0, MAX_LAG + 1],
      y: [sigBand, sigBand],
      type: 'scatter',
      mode: 'lines',
      line: { color: '#dc2626', width: 1, dash: 'dash' },
      name: '95% Confidence',
      hoverinfo: 'skip',
    },
    {
      x: [0, MAX_LAG + 1],
      y: [-sigBand, -sigBand],
      type: 'scatter',
      mode: 'lines',
      line: { color: '#dc2626', width: 1, dash: 'dash' },
      showlegend: false,
      hoverinfo: 'skip',
    },
    // ACF bars
    ...acfData.map(d => ({
      x: [d.lag, d.lag],
      y: [0, d.acf],
      type: 'scatter',
      mode: 'lines',
      line: {
        color: Math.abs(d.acf) > sigBand ? '#2563eb' : '#93c5fd',
        width: 8,
      },
      showlegend: false,
      hovertemplate: `Lag ${d.lag}: ACF = ${formatDecimal(d.acf, 4)}<extra></extra>`,
    })),
  ] : [];

  const acfLayout = {
    autosize: true,
    height: 320,
    margin: { t: 10, r: 20, b: 50, l: 60 },
    paper_bgcolor: 'transparent',
    plot_bgcolor: 'transparent',
    xaxis: {
      title: { text: 'Lag (days)', font: { size: 12, color: '#9ca3af' } },
      showgrid: false,
      tickfont: { size: 11, color: '#9ca3af' },
      range: [0, MAX_LAG + 1],
    },
    yaxis: {
      title: { text: 'ACF', font: { size: 12, color: '#9ca3af' } },
      showgrid: true,
      gridcolor: '#f0f2f5',
      tickfont: { size: 11, color: '#9ca3af' },
      zeroline: true,
      zerolinecolor: '#e5e7eb',
    },
    hovermode: 'closest',
    showlegend: true,
    legend: { orientation: 'h', y: -0.2, font: { size: 11 } },
  };

  // ── PACF Chart ──
  const pacfChartData = pacfData.length ? [
    {
      x: [0, MAX_LAG + 1],
      y: [sigBand, sigBand],
      type: 'scatter',
      mode: 'lines',
      line: { color: '#dc2626', width: 1, dash: 'dash' },
      name: '95% Confidence',
      hoverinfo: 'skip',
    },
    {
      x: [0, MAX_LAG + 1],
      y: [-sigBand, -sigBand],
      type: 'scatter',
      mode: 'lines',
      line: { color: '#dc2626', width: 1, dash: 'dash' },
      showlegend: false,
      hoverinfo: 'skip',
    },
    ...pacfData.map((val, i) => ({
      x: [i + 1, i + 1],
      y: [0, val],
      type: 'scatter',
      mode: 'lines',
      line: {
        color: Math.abs(val) > sigBand ? '#7c3aed' : '#c4b5fd',
        width: 8,
      },
      showlegend: false,
      hovertemplate: `Lag ${i + 1}: PACF = ${formatDecimal(val, 4)}<extra></extra>`,
    })),
  ] : [];

  const pacfLayout = {
    ...acfLayout,
    yaxis: {
      ...acfLayout.yaxis,
      title: { text: 'PACF', font: { size: 12, color: '#9ca3af' } },
    },
  };

  // ── Squared Returns ACF Chart ──
  const acfSqChartData = acfSquared.length ? [
    {
      x: [0, MAX_LAG + 1],
      y: [sigBand, sigBand],
      type: 'scatter',
      mode: 'lines',
      line: { color: '#dc2626', width: 1, dash: 'dash' },
      name: '95% Confidence',
      hoverinfo: 'skip',
    },
    {
      x: [0, MAX_LAG + 1],
      y: [-sigBand, -sigBand],
      type: 'scatter',
      mode: 'lines',
      line: { color: '#dc2626', width: 1, dash: 'dash' },
      showlegend: false,
      hoverinfo: 'skip',
    },
    ...acfSquared.map(d => ({
      x: [d.lag, d.lag],
      y: [0, d.acf],
      type: 'scatter',
      mode: 'lines',
      line: {
        color: Math.abs(d.acf) > sigBand ? '#ea580c' : '#fed7aa',
        width: 8,
      },
      showlegend: false,
      hovertemplate: `Lag ${d.lag}: ACF(r²) = ${formatDecimal(d.acf, 4)}<extra></extra>`,
    })),
  ] : [];

  return (
    <>
      <div className="page-header">
        <h2>Autocorrelation</h2>
        <p>
          ACF, PACF, Ljung-Box test — does past performance predict future returns?
          Random walk hypothesis, momentum, and mean reversion.
        </p>
      </div>

      <div className="page-body">

        {/* ── Search Bar ── */}
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
            <span style={{ fontSize: '14px' }}>
              Enter a ticker to test for autocorrelation
            </span>
            <span style={{ fontSize: '12px' }}>
              Try AAPL, SPY, TSLA — compare large caps vs volatile stocks
            </span>
          </div>
        )}

        {returns.length > 0 && (
          <>
            {/* ── Metric Cards ── */}
            <div className="metric-grid" style={{ marginBottom: '24px' }}>

              <div className="metric-card">
                <span className="metric-card-label">ACF Lag 1</span>
                <span className={`metric-card-value ${Math.abs(acf1) > sigBand ? (acf1 > 0 ? 'positive' : 'negative') : ''}`}>
                  {formatDecimal(acf1, 4)}
                </span>
                <span className="metric-card-sub">
                  {Math.abs(acf1) > sigBand ? 'Significant' : 'Not significant'}
                </span>
              </div>

              <div className="metric-card">
                <span className="metric-card-label">ACF Lag 5</span>
                <span className={`metric-card-value ${Math.abs(acf5) > sigBand ? (acf5 > 0 ? 'positive' : 'negative') : ''}`}>
                  {formatDecimal(acf5, 4)}
                </span>
                <span className="metric-card-sub">
                  {Math.abs(acf5) > sigBand ? 'Significant' : 'Not significant'}
                </span>
              </div>

              <div className="metric-card">
                <span className="metric-card-label">ACF Lag 10</span>
                <span className={`metric-card-value ${Math.abs(acf10) > sigBand ? (acf10 > 0 ? 'positive' : 'negative') : ''}`}>
                  {formatDecimal(acf10, 4)}
                </span>
                <span className="metric-card-sub">
                  {Math.abs(acf10) > sigBand ? 'Significant' : 'Not significant'}
                </span>
              </div>

              <div className="metric-card">
                <span className="metric-card-label">95% Sig. Band</span>
                <span className="metric-card-value">
                  ±{formatDecimal(sigBand, 4)}
                </span>
                <span className="metric-card-sub">±1.96 / √{n}</span>
              </div>

              <div className="metric-card">
                <span className="metric-card-label">Ljung-Box Q(10)</span>
                <span className="metric-card-value">
                  {lb10 ? formatDecimal(lb10.Q, 2) : 'N/A'}
                </span>
                <span className="metric-card-sub">
                  p = {lb10 ? formatDecimal(lb10.pValue, 4) : 'N/A'}
                </span>
              </div>

              <div className="metric-card">
                <span className="metric-card-label">Ljung-Box Q(20)</span>
                <span className="metric-card-value">
                  {lb20 ? formatDecimal(lb20.Q, 2) : 'N/A'}
                </span>
                <span className="metric-card-sub">
                  p = {lb20 ? formatDecimal(lb20.pValue, 4) : 'N/A'}
                </span>
              </div>

              <div className="metric-card">
                <span className="metric-card-label">Interpretation</span>
                <span className="metric-card-value" style={{ fontSize: '14px' }}>
                  {getInterpretation()}
                </span>
                <span className="metric-card-sub">
                  Based on Ljung-Box p-value
                </span>
              </div>

              <div className="metric-card">
                <span className="metric-card-label">Observations</span>
                <span className="metric-card-value">{n}</span>
                <span className="metric-card-sub">Trading days</span>
              </div>

            </div>

            {/* ── ACF + PACF ── */}
            <div className="two-col" style={{ marginBottom: '24px' }}>

              <div className="chart-container" style={{ marginBottom: 0 }}>
                <div className="chart-title">
                  ACF — {stockName} ({activeRange})
                </div>
                <div className="chart-subtitle">
                  Dark blue bars exceed 95% confidence band — statistically significant autocorrelation
                </div>
                <Plot
                  data={acfChartData}
                  layout={acfLayout}
                  config={{ displayModeBar: false, responsive: true }}
                  style={{ width: '100%' }}
                />
              </div>

              <div className="chart-container" style={{ marginBottom: 0 }}>
                <div className="chart-title">
                  PACF — {stockName} ({activeRange})
                </div>
                <div className="chart-subtitle">
                  Direct effect of each lag after removing intermediate lags
                </div>
                <Plot
                  data={pacfChartData}
                  layout={pacfLayout}
                  config={{ displayModeBar: false, responsive: true }}
                  style={{ width: '100%' }}
                />
              </div>

            </div>

            {/* ── Squared Returns ACF ── */}
            <div className="chart-container">
              <div className="chart-title">
                ACF of Squared Returns — {stockName} (Volatility Clustering Test)
              </div>
              <div className="chart-subtitle">
                Strong autocorrelation in r² confirms ARCH effects — volatility clusters even when returns don't
              </div>
              <Plot
                data={acfSqChartData}
                layout={{
                  ...acfLayout,
                  height: 280,
                  yaxis: {
                    ...acfLayout.yaxis,
                    title: { text: 'ACF(r²)', font: { size: 12, color: '#9ca3af' } },
                  },
                }}
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
          <div className="section-title">Understanding Autocorrelation</div>

          <div className="two-col" style={{ gap: '16px' }}>

            <div className="formula-box">
              <div className="formula-box-title">Autocorrelation Function (ACF)</div>
              <div className="formula-box-math">
                ACF(k) = Cov(r_t, r_(t-k)) / Var(r)
              </div>
              <div className="formula-box-description">
                The ACF measures the correlation between a return series and a lagged
                version of itself. ACF at lag 1 answers: "does today's return predict
                tomorrow's?" ACF at lag 5 answers: "does today's return predict the
                return 5 days from now?" Values near zero indicate no predictability.
                Values significantly different from zero indicate structure — either
                momentum (positive) or mean reversion (negative).
              </div>
            </div>

            <div className="formula-box">
              <div className="formula-box-title">Partial Autocorrelation (PACF)</div>
              <div className="formula-box-math">
                PACF(k) = direct correlation between r_t and r_(t-k)
              </div>
              <div className="formula-box-description">
                While ACF at lag 5 includes the indirect effects through lags 1-4,
                PACF measures only the direct relationship. If PACF is significant at
                lag 2 but not lag 3, it suggests a second-order autoregressive process
                AR(2). PACF is the key tool for identifying the order of AR models
                used in time series forecasting. A sharp cutoff in PACF after lag p
                is the signature of an AR(p) process.
              </div>
            </div>

            <div className="formula-box">
              <div className="formula-box-title">Significance Bands</div>
              <div className="formula-box-math">
                Bands = ±1.96 / √n
              </div>
              <div className="formula-box-description">
                Under the null hypothesis that returns are i.i.d. (pure random walk),
                approximately 95% of ACF values should fall within ±1.96/√n. Any
                bar extending beyond the red dashed lines is statistically significant
                at the 5% level — it would occur by chance only 5% of the time if
                returns were truly random. With 30 lags plotted, we expect about 1-2
                bars to cross the bands by chance even under the null hypothesis.
              </div>
            </div>

            <div className="formula-box">
              <div className="formula-box-title">Ljung-Box Test</div>
              <div className="formula-box-math">
                Q = n(n+2) × sum(ACF(k)² / (n-k)) ~ χ²(m)
              </div>
              <div className="formula-box-description">
                The Ljung-Box Q statistic tests whether the first m autocorrelations
                are jointly zero. Unlike testing each lag individually, it is a joint
                test. The Q statistic follows a chi-squared distribution with m
                degrees of freedom under the null. A p-value below 0.05 rejects the
                null of no autocorrelation — meaning returns are not consistent with
                a random walk. This is the standard test used in time series analysis
                and quantitative trading research.
              </div>
            </div>

            <div className="formula-box">
              <div className="formula-box-title">Random Walk Hypothesis</div>
              <div className="formula-box-math">
                P_t = P_(t-1) + ε_t, where ε_t ~ i.i.d.
              </div>
              <div className="formula-box-description">
                The random walk hypothesis states that price changes are independent
                and identically distributed — past prices contain no information about
                future prices. If true, no amount of technical analysis or chart
                reading can generate consistent excess returns. The Efficient Market
                Hypothesis (weak form) implies returns follow a random walk. Empirical
                evidence shows daily returns are close to random but not perfectly so —
                there are small but statistically detectable patterns at very short
                and very long horizons.
              </div>
            </div>

            <div className="formula-box">
              <div className="formula-box-title">Volatility Clustering & ARCH Effects</div>
              <div className="formula-box-math">
                ACF(r²) significant even when ACF(r) ≈ 0
              </div>
              <div className="formula-box-description">
                Even when daily returns themselves show no significant autocorrelation
                (consistent with weak-form efficiency), squared returns almost always
                show strong positive autocorrelation. This means the magnitude of
                returns is predictable even if the direction is not. Large absolute
                returns today predict large absolute returns tomorrow. This is the
                ARCH effect discovered by Engle (1982). The third chart on this page
                tests this directly — strong orange bars in the ACF of r² confirm
                volatility clustering.
              </div>
            </div>

            <div className="formula-box">
              <div className="formula-box-title">Momentum vs Mean Reversion</div>
              <div className="formula-box-math">
                Momentum: ACF(k) greater than 0 for small k
                Mean reversion: ACF(k) less than 0 for small k
              </div>
              <div className="formula-box-description">
                Momentum means recent winners keep winning — positive autocorrelation
                at short lags. It is well-documented at weekly to 12-month horizons
                and is the basis of momentum factor strategies. Mean reversion means
                recent winners tend to give back gains — negative autocorrelation.
                It is documented at very short horizons (daily microstructure) and
                very long horizons (3-5 years). Most daily return series sit somewhere
                in between — small positive or negative ACF that may or may not be
                statistically significant depending on the period and asset.
              </div>
            </div>

            <div className="formula-box">
              <div className="formula-box-title">Implications for Trading</div>
              <div className="formula-box-math">
                Significant ACF ≠ profitable trading strategy
              </div>
              <div className="formula-box-description">
                Statistical significance does not imply economic significance.
                Even if ACF(1) is significantly positive at 0.05, it might only
                explain 0.25% of return variance — far too small to overcome
                transaction costs and slippage. The bar for a tradeable signal
                is much higher than statistical significance alone. Additionally,
                autocorrelation patterns found in historical data often disappear
                or reverse once discovered and traded upon — this is the
                adaptive markets hypothesis in action.
              </div>
            </div>

          </div>
        </div>

      </div>
    </>
  );
};

export default Autocorrelation;