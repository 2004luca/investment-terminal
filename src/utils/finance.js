// ============================================================
// FINANCE — Pure math functions for quant metrics
// Input: arrays of prices or returns
// Output: single numbers or arrays (no UI, no API calls)
// ============================================================

// ============================================================
// RETURNS
// ============================================================

// Daily log returns from array of prices
// Log returns are preferred in finance: ln(P_t / P_{t-1})
export const logReturns = (prices) => {
  const returns = [];
  for (let i = 1; i < prices.length; i++) {
    returns.push(Math.log(prices[i] / prices[i - 1]));
  }
  return returns;
};

// Daily simple returns: (P_t - P_{t-1}) / P_{t-1}
export const simpleReturns = (prices) => {
  const returns = [];
  for (let i = 1; i < prices.length; i++) {
    returns.push((prices[i] - prices[i - 1]) / prices[i - 1]);
  }
  return returns;
};

// Cumulative return from array of simple returns
// (1 + r1)(1 + r2)...(1 + rn) - 1
export const cumulativeReturn = (returns) => {
  return returns.reduce((acc, r) => acc * (1 + r), 1) - 1;
};

// ============================================================
// DESCRIPTIVE STATISTICS
// ============================================================

export const mean = (arr) => {
  if (!arr.length) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
};

export const variance = (arr) => {
  if (arr.length < 2) return 0;
  const m = mean(arr);
  return arr.reduce((acc, v) => acc + (v - m) ** 2, 0) / (arr.length - 1);
};

export const stdDev = (arr) => Math.sqrt(variance(arr));

// Skewness — measures asymmetry of return distribution
// Negative skew = fat left tail (crash risk)
export const skewness = (arr) => {
  if (arr.length < 3) return 0;
  const m = mean(arr);
  const s = stdDev(arr);
  const n = arr.length;
  const sum = arr.reduce((acc, v) => acc + ((v - m) / s) ** 3, 0);
  return (n / ((n - 1) * (n - 2))) * sum;
};

// Excess kurtosis — measures fat tails vs normal distribution
// Normal distribution = 0 excess kurtosis
// Positive = fatter tails (leptokurtic) — more extreme events
export const excessKurtosis = (arr) => {
  if (arr.length < 4) return 0;
  const m = mean(arr);
  const s = stdDev(arr);
  const n = arr.length;
  const sum = arr.reduce((acc, v) => acc + ((v - m) / s) ** 4, 0);
  const kurt = (n * (n + 1)) / ((n - 1) * (n - 2) * (n - 3)) * sum;
  const correction = (3 * (n - 1) ** 2) / ((n - 2) * (n - 3));
  return kurt - correction;
};

// ============================================================
// RISK METRICS
// ============================================================

// Annualized volatility from daily returns
// Multiply daily std dev by sqrt(252) — 252 trading days per year
export const annualizedVol = (dailyReturns) => {
  return stdDev(dailyReturns) * Math.sqrt(252);
};

// Annualized return from daily returns
export const annualizedReturn = (dailyReturns) => {
  const m = mean(dailyReturns);
  return m * 252;
};

// Sharpe Ratio — risk-adjusted return
// Formula: (Rp - Rf) / σp  (annualized)
// riskFreeRate default: 5% (approx current T-bill rate)
export const sharpeRatio = (dailyReturns, riskFreeRate = 0.05) => {
  const annReturn = annualizedReturn(dailyReturns);
  const annVol = annualizedVol(dailyReturns);
  if (annVol === 0) return 0;
  return (annReturn - riskFreeRate) / annVol;
};

// Sortino Ratio — like Sharpe but only penalizes downside vol
// Formula: (Rp - Rf) / σ_downside
export const sortinoRatio = (dailyReturns, riskFreeRate = 0.05) => {
  const annReturn = annualizedReturn(dailyReturns);
  const downsideReturns = dailyReturns.filter(r => r < 0);
  const downsideVol = stdDev(downsideReturns) * Math.sqrt(252);
  if (downsideVol === 0) return 0;
  return (annReturn - riskFreeRate) / downsideVol;
};

// Value at Risk (Historical) — worst loss at confidence level
// e.g. 95% VaR = loss exceeded only 5% of the time
export const historicalVaR = (dailyReturns, confidence = 0.95) => {
  const sorted = [...dailyReturns].sort((a, b) => a - b);
  const index = Math.floor((1 - confidence) * sorted.length);
  return sorted[index];
};

// CVaR / Expected Shortfall — average loss beyond VaR
// More informative than VaR: tells you how bad the bad days are
export const cVar = (dailyReturns, confidence = 0.95) => {
  const sorted = [...dailyReturns].sort((a, b) => a - b);
  const cutoff = Math.floor((1 - confidence) * sorted.length);
  const tail = sorted.slice(0, cutoff);
  return tail.length ? mean(tail) : sorted[0];
};

// Maximum Drawdown — largest peak-to-trough decline
// Returns object with value, peak index, trough index
export const maxDrawdown = (prices) => {
  let maxDD = 0;
  let peak = prices[0];
  let peakIdx = 0;
  let troughIdx = 0;
  let tempPeakIdx = 0;

  for (let i = 1; i < prices.length; i++) {
    if (prices[i] > peak) {
      peak = prices[i];
      tempPeakIdx = i;
    }
    const dd = (prices[i] - peak) / peak;
    if (dd < maxDD) {
      maxDD = dd;
      peakIdx = tempPeakIdx;
      troughIdx = i;
    }
  }
  return { value: maxDD, peakIdx, troughIdx };
};

// Drawdown series — full time series of drawdown at each point
// Used to draw the underwater chart
export const drawdownSeries = (prices) => {
  const series = [];
  let peak = prices[0];
  for (let i = 0; i < prices.length; i++) {
    if (prices[i] > peak) peak = prices[i];
    series.push((prices[i] - peak) / peak);
  }
  return series;
};

// ============================================================
// ROLLING METRICS
// ============================================================

// Rolling volatility — std dev over a sliding window
export const rollingVol = (dailyReturns, window = 21) => {
  const result = [];
  for (let i = window; i <= dailyReturns.length; i++) {
    const slice = dailyReturns.slice(i - window, i);
    result.push(stdDev(slice) * Math.sqrt(252));
  }
  return result;
};

// Rolling Sharpe — annualized Sharpe over a sliding window
export const rollingSharpe = (dailyReturns, window = 63, riskFreeRate = 0.05) => {
  const result = [];
  for (let i = window; i <= dailyReturns.length; i++) {
    const slice = dailyReturns.slice(i - window, i);
    result.push(sharpeRatio(slice, riskFreeRate));
  }
  return result;
};

// ============================================================
// REGRESSION / BETA
// ============================================================

// OLS linear regression — returns slope, intercept, R²
// Used for beta calculation and CAPM
export const linearRegression = (x, y) => {
  const n = x.length;
  const meanX = mean(x);
  const meanY = mean(y);
  const covXY = x.reduce((acc, xi, i) => acc + (xi - meanX) * (y[i] - meanY), 0) / (n - 1);
  const varX  = variance(x);
  const slope = covXY / varX;
  const intercept = meanY - slope * meanX;

  // R² — proportion of variance explained by the model
  const yPred = x.map(xi => slope * xi + intercept);
  const ssTot = y.reduce((acc, yi) => acc + (yi - meanY) ** 2, 0);
  const ssRes = y.reduce((acc, yi, i) => acc + (yi - yPred[i]) ** 2, 0);
  const r2 = 1 - ssRes / ssTot;

  return { slope, intercept, r2 };
};

// Beta — sensitivity of stock to market (SPY)
// beta > 1: more volatile than market
// beta < 1: less volatile than market
export const beta = (stockReturns, marketReturns) => {
  const reg = linearRegression(marketReturns, stockReturns);
  return reg.slope;
};

// ============================================================
// TECHNICAL INDICATORS
// ============================================================

// Simple Moving Average
export const sma = (prices, window) => {
  const result = new Array(window - 1).fill(null);
  for (let i = window - 1; i < prices.length; i++) {
    const slice = prices.slice(i - window + 1, i + 1);
    result.push(slice.reduce((a, b) => a + b, 0) / window);
  }
  return result;
};

// Exponential Moving Average
export const ema = (prices, window) => {
  const k = 2 / (window + 1);
  const result = [prices[0]];
  for (let i = 1; i < prices.length; i++) {
    result.push(prices[i] * k + result[i - 1] * (1 - k));
  }
  return result;
};

// Bollinger Bands — SMA ± 2 standard deviations
export const bollingerBands = (prices, window = 20, multiplier = 2) => {
  const middle = sma(prices, window);
  const upper = [];
  const lower = [];
  for (let i = 0; i < prices.length; i++) {
    if (i < window - 1) {
      upper.push(null);
      lower.push(null);
    } else {
      const slice = prices.slice(i - window + 1, i + 1);
      const sd = stdDev(slice);
      upper.push(middle[i] + multiplier * sd);
      lower.push(middle[i] - multiplier * sd);
    }
  }
  return { upper, middle, lower };
};

// RSI — Relative Strength Index (momentum oscillator)
// RSI > 70: overbought, RSI < 30: oversold
export const rsi = (prices, window = 14) => {
  const result = new Array(window).fill(null);
  for (let i = window; i < prices.length; i++) {
    const slice = prices.slice(i - window, i + 1);
    const gains = [];
    const losses = [];
    for (let j = 1; j < slice.length; j++) {
      const diff = slice[j] - slice[j - 1];
      if (diff > 0) gains.push(diff);
      else losses.push(Math.abs(diff));
    }
    const avgGain = gains.length ? gains.reduce((a, b) => a + b, 0) / window : 0;
    const avgLoss = losses.length ? losses.reduce((a, b) => a + b, 0) / window : 0;
    const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
    result.push(100 - 100 / (1 + rs));
  }
  return result;
};

// MACD — Moving Average Convergence Divergence
// Returns macd line, signal line, histogram
export const macd = (prices, fast = 12, slow = 26, signal = 9) => {
  const emaFast = ema(prices, fast);
  const emaSlow = ema(prices, slow);
  const macdLine = emaFast.map((v, i) => v - emaSlow[i]);
  const signalLine = ema(macdLine, signal);
  const histogram = macdLine.map((v, i) => v - signalLine[i]);
  return { macdLine, signalLine, histogram };
};

// ============================================================
// AUTOCORRELATION
// ============================================================

// Autocorrelation at lag k — correlation of series with itself shifted by k
// Tests if past returns predict future returns
export const autocorrelation = (returns, maxLag = 20) => {
  const m = mean(returns);
  const n = returns.length;
  const denom = returns.reduce((acc, r) => acc + (r - m) ** 2, 0);
  const result = [];
  for (let lag = 1; lag <= maxLag; lag++) {
    let num = 0;
    for (let i = lag; i < n; i++) {
      num += (returns[i] - m) * (returns[i - lag] - m);
    }
    result.push({ lag, acf: num / denom });
  }
  return result;
};

// ============================================================
// PORTFOLIO MATH
// ============================================================

// Portfolio return — weighted sum of individual returns
export const portfolioReturn = (returns, weights) => {
  return returns.reduce((acc, r, i) => acc + weights[i] * r, 0);
};

// Portfolio variance — w^T * Σ * w
export const portfolioVariance = (weights, covMatrix) => {
  let pVar = 0;
  for (let i = 0; i < weights.length; i++) {
    for (let j = 0; j < weights.length; j++) {
      pVar += weights[i] * weights[j] * covMatrix[i][j];
    }
  }
  return pVar;
};

// Covariance matrix from matrix of return arrays
// returnsMatrix: array of return arrays, one per asset
export const covarianceMatrix = (returnsMatrix) => {
  const n = returnsMatrix.length;
  const matrix = Array.from({ length: n }, () => new Array(n).fill(0));
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      const xi = returnsMatrix[i];
      const xj = returnsMatrix[j];
      const mi = mean(xi);
      const mj = mean(xj);
      const cov = xi.reduce((acc, v, k) => acc + (v - mi) * (xj[k] - mj), 0) / (xi.length - 1);
      matrix[i][j] = cov;
    }
  }
  return matrix;
};

// Normal distribution PDF — for overlay on return histogram
export const normalPDF = (x, mu, sigma) => {
  return (1 / (sigma * Math.sqrt(2 * Math.PI))) *
    Math.exp(-0.5 * ((x - mu) / sigma) ** 2);
};