# Quant Terminal

A professional quantitative finance research and portfolio analysis tool built with React. Analyzes stocks and portfolios using real market data, implementing financial models from scratch with full educational explanations.

**Live Demo:** [investment-terminal-tau.vercel.app](https://investment-terminal-tau.vercel.app)

---

## What It Does

Two sections — Quant Research for individual stock analysis, Portfolio for multi-asset portfolio construction and risk management.

### Quant Research
| Page | What It Shows |
|---|---|
| Returns & Distribution | Daily returns histogram, normal overlay, QQ plot, skewness, kurtosis, VaR |
| Volatility & Risk | Rolling volatility, rolling Sharpe, drawdown underwater chart, Calmar ratio |
| Regression & Beta | OLS regression vs SPY, alpha, R², rolling beta, residuals, CAPM, SML |
| Autocorrelation | ACF, PACF, Ljung-Box test, squared returns, volatility clustering |

### Portfolio
| Page | What It Shows |
|---|---|
| Portfolio Builder | Add stocks with weights, performance vs SPY, correlation heatmap |
| Risk & Return | Sharpe, Sortino, Calmar, VaR, CVaR, drawdown, return distribution |
| Efficient Frontier | Monte Carlo simulation, Markowitz optimization, CML, Black-Litterman |
| Factor Models | CAPM, Jensen's Alpha, Treynor Ratio, SML, rolling beta/alpha, return decomposition |
| Stress Testing | 5 historical crisis scenarios, sector-level shock estimation, sensitivity table |
| Portfolio Attribution | Brinson-Hood-Beebower model — allocation, selection, interaction effects |

---

## Models Implemented From Scratch

- **OLS Regression** — beta, alpha, R², residuals
- **CAPM** — expected return, Jensen's alpha, Security Market Line
- **Markowitz Portfolio Optimization** — via Monte Carlo simulation (2,000 portfolios)
- **Black-Litterman Model** — Bayesian blending of equilibrium returns and investor views
- **Brinson-Hood-Beebower Attribution** — allocation, selection, interaction effects
- **Ljung-Box Test** — formal autocorrelation significance test
- **PACF** — via Levinson-Durbin recursion
- **Risk Metrics** — VaR, CVaR, Max Drawdown, Calmar, Sortino, Treynor
- **Rolling Analysis** — rolling beta, alpha, Sharpe, volatility
- **Covariance Matrix** — portfolio variance, diversification ratio

---

## Tech Stack

| Tool | Purpose |
|---|---|
| React + JavaScript | Frontend framework |
| Plotly.js | Charts — scatter, histogram, waterfall, heatmap, ACF bars |
| react-router-dom | Client-side routing |
| Twelvedata API | Real market data — prices, quotes |
| Custom CSS | Design system with CSS variables, no component library |

---

## Getting Started

### Prerequisites
- Node.js 16+
- Free Twelvedata API key from [twelvedata.com](https://twelvedata.com)

### Installation
```bash
git clone https://github.com/2004luca/investment-terminal.git
cd investment-terminal
npm install
```

### Environment Variables

Create a `.env` file in the root directory:
```
REACT_APP_TD_API_KEY=your_twelvedata_api_key_here
```

### Run
```bash
npm start
```

Opens at `http://localhost:3000`

---

## Project Structure
```
src/
├── components/        # Sidebar, Layout, shared UI
├── pages/             # One file per page (10 total)
├── styles/            # CSS design system — variables, cards, charts
└── utils/
    ├── api.js         # Twelvedata API calls
    ├── finance.js     # All quant math — pure functions
    ├── formatters.js  # Number formatting utilities
    └── PortfolioContext.js  # Global portfolio state
```

---

## Data

All price data is fetched live from the [Twelvedata](https://twelvedata.com) free tier (800 calls/day). Fundamental data and historical scenarios outside the 2-year window use documented sector-level estimates based on published research.

---

## Previous Projects

This is the third terminal in a series:
- **Options Terminal** — Black-Scholes pricing, Greeks, strategy P&L, PDE solver, volatility surface
- **Macro Terminal** — macroeconomic data visualization and analysis

---

## License

MIT